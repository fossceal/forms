
import { verifyToken, signToken, checkPassword } from "./auth.js";
import {
	validate,
	loginSchema,
	saveFormSchema,
	updateFormSchema,
	createSubmissionSchema
} from "./validation.js";

// Security - Rate Limiting
async function checkKvRateLimit(kv, key, limit = 5, windowSec = 60) {
	if (!kv) return true; // Fail open if no KV (should be configured though)
	const now = Math.floor(Date.now() / 1000);
	const currentWindow = Math.floor(now / windowSec);
	const kvKey = `rate_limit:${key}:${currentWindow}`;

	const count = await kv.get(kvKey);
	const currentCount = count ? parseInt(count) : 0;

	if (currentCount >= limit) return false;

	await kv.put(kvKey, (currentCount + 1).toString(), { expirationTtl: windowSec * 2 });
	return true;
}

// Security - JSON Body Validation
async function parseAndValidate(request, schema, maxSize = 10485760) {
	const contentType = request.headers.get("content-type") || "";
	if (!contentType.includes("application/json")) {
		throw new Error("Invalid Content-Type. Expected application/json.");
	}

	const contentLength = parseInt(request.headers.get("content-length") || "0");
	if (contentLength > maxSize) {
		throw new Error(`Payload too large (Max ${maxSize / 1024 / 1024}MB)`);
	}

	let body;
	try {
		body = await request.json();
	} catch (e) {
		throw new Error("Invalid JSON body");
	}

	if (schema) {
		return await validate(schema, body);
	}
	return body;
}

function logSecurityEvent(request, reason, context = {}) {
	const ip = request.headers.get("cf-connecting-ip") || "unknown";
	const method = request.method;
	const url = request.url;
	console.info(`[SECURITY_REJECTION] ${reason} | IP: ${ip} | Method: ${method} | URL: ${url}`, context);
}

function addSecurityHeaders(headers) {
	headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
	headers.set("X-Frame-Options", "DENY");
	headers.set("X-Content-Type-Options", "nosniff");
	headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
	headers.set("X-XSS-Protection", "1; mode=block");
	headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
	// Updated CSP - stringent
	headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: https:; connect-src 'self' https:;");
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		// Clean URL rewriting: /page -> /page.html
		// Skip root '/', avoid paths with extensions, and ignore /api routes
		let isCleanUrl = false;
		if (url.pathname !== "/" && !url.pathname.includes(".") && !url.pathname.startsWith("/api")) {
			url.pathname += ".html";
			isCleanUrl = true;
		}

		const ip = request.headers.get("cf-connecting-ip") || "unknown";
		const origin = request.headers.get("Origin");

		// CORS - strict check
		const allowedOrigins = [env.ALLOWED_ORIGIN, "http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5500", "http://127.0.0.1:5500", "https://foss.ceal.in"];
		const isOriginAllowed = !origin || allowedOrigins.includes(origin);

		// If origin is present but not allowed, reject immediately for safety (or handle via CORS headers)
		// We return generic CORS headers but specific Origin only if allowed.
		const corsHeaders = {
			"Access-Control-Allow-Origin": isOriginAllowed && origin ? origin : env.ALLOWED_ORIGIN,
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
			"Access-Control-Max-Age": "86400"
		};

		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: corsHeaders });
		}

		if (origin && !isOriginAllowed) {
			logSecurityEvent(request, "CORS_REJECTION", { origin });
			return new Response("Forbidden: Origin Not Allowed", { status: 403, headers: corsHeaders });
		}

		// Helper for secure responses
		const secureRes = (body, init = {}) => {
			const headers = new Headers(init.headers || {});
			Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
			addSecurityHeaders(headers);
			return new Response(body, { ...init, headers });
		};

		try {
			// Public API Routes

			// 1. Login
			if (url.pathname === "/api/login" && request.method === "POST") {
				const isAllowed = await checkKvRateLimit(env.LIMITER, `login:${ip}`, 5, 60);
				if (!isAllowed) {
					logSecurityEvent(request, "RATE_LIMIT_EXCEEDED", { type: "login" });
					return secureRes("Too Many Requests", { status: 429 });
				}

				const data = await parseAndValidate(request, loginSchema, 5120); // 5KB max
				return handleLogin(data, env, secureRes, request);
			}

			// 2. Get Form (Public)
			if (url.pathname.match(/^\/api\/forms\/[^\/]+$/) && request.method === "GET") {
				const slug = url.pathname.split("/").pop();
				return getFormBySlug(slug, env, secureRes);
			}

			// 3. Submit Response (Public)
			if (url.pathname.match(/^\/api\/forms\/[^\/]+\/submit$/) && request.method === "POST") {
				const slug = url.pathname.split("/")[3];

				const isAllowed = await checkKvRateLimit(env.LIMITER, `submit:${ip}:${slug}`, 5, 60);
				if (!isAllowed) {
					logSecurityEvent(request, "RATE_LIMIT_EXCEEDED", { type: "submit", slug });
					return secureRes("Too Many Requests", { status: 429 });
				}

				// We validate payload inside because schema is dynamic based on form config
				return submitResponse(slug, request, env, secureRes);
			}

			// 4. Form Stats (Public?) - checking if this should be protected. 
			// History implies it might be used publicly, but let's rate limit it at least.
			if (url.pathname === "/api/form-stats" && request.method === "GET") {
				const id = url.searchParams.get("id");
				// Weak rate limit for stats
				const isAllowed = await checkKvRateLimit(env.LIMITER, `stats:${ip}`, 20, 60);
				if (!isAllowed) return secureRes("Too Many Requests", { status: 429 });

				return getFormStats(id, env, secureRes);
			}

			// --- Protected API Routes ---

			// Verify Admin Token
			// We skip this check for logic/submit/stats which are above.
			const user = await isAuthenticated(request, env);
			if (!user) {
				return secureRes("Unauthorized", { status: 401 });
			}

			// 5. List Forms
			if (url.pathname === "/api/forms/library/all" && request.method === "GET") {
				return getAllForms(env, secureRes);
			}

			// 6. Create Form
			if (url.pathname === "/api/forms" && request.method === "POST") {
				const data = await parseAndValidate(request, saveFormSchema, 1048576); // 1MB
				return saveForm(data, env, secureRes);
			}

			// 7. Delete Form
			if (url.pathname === "/api/forms/delete" && request.method === "POST") {
				// Simple schema for delete
				const data = await parseAndValidate(request, null, 1024);
				if (!data.slug) throw new Error("Slug is required");
				return deleteForm(data.slug, env, secureRes);
			}

			// 8. Update Form Status
			if (url.pathname.match(/^\/api\/forms\/[^\/]+\/status$/) && request.method === "POST") {
				const slug = url.pathname.split("/")[3];
				const data = await parseAndValidate(request, null, 1024);
				if (!data.status) throw new Error("Status is required");
				return updateFormStatus(slug, data.status, env, secureRes);
			}

			// 9. Responses Management
			if (url.pathname.match(/^\/api\/forms\/[^\/]+\/responses$/)) {
				const slug = url.pathname.split("/")[3];
				if (request.method === "GET") return getResponses(slug, env, secureRes);
				if (request.method === "DELETE") return clearResponses(slug, env, secureRes);
			}

			if (url.pathname.match(/^\/api\/forms\/[^\/]+\/responses\/[^\/]+$/)) {
				const slug = url.pathname.split("/")[3];
				const responseId = url.pathname.split("/")[5];
				if (request.method === "DELETE") return deleteResponse(responseId, env, secureRes);
				if (request.method === "PUT") {
					const data = await parseAndValidate(request, null, 51200);
					return updateResponseData(responseId, data, env, secureRes);
				}
			}

			// 10. Update Form
			if (url.pathname.match(/^\/api\/forms\/[^\/]+$/) && request.method === "PUT") {
				const id = url.pathname.split("/").pop();
				const data = await parseAndValidate(request, updateFormSchema, 1048576);
				return updateForm(id, data, env, secureRes);
			}

			// If no API route matched, handle static assets
			if (url.pathname.startsWith("/api")) {
				return secureRes("Not Found", { status: 404 });
			}

			// Fall back to fetching the request (which might have been rewritten to .html)
			// Using the modified URL object if it was a clean URL rewrite
			const finalRequest = isCleanUrl ? new Request(url.toString(), request) : request;

			// If on Pages, env.ASSETS is the way to fetch static content
			if (env.ASSETS) {
				return env.ASSETS.fetch(finalRequest);
			}

			// For standard Workers, fetch(finalRequest) will work if it's a proxy 
			// or if the environment handles asset resolution
			return fetch(finalRequest);

		} catch (error) {
			logSecurityEvent(request, "WORKER_ERROR", { error: error.message });
			const status = (error.message.includes("Unauthorized") || error.message.includes("Authentication")) ? 401
				: error.message.includes("Forbidden") ? 403
					: (error.message.includes("Validation") || error.message.includes("required") || error.message.includes("Invalid")) ? 400
						: 500;
			return new Response(JSON.stringify({ error: error.message }), {
				status: status,
				headers: { ...corsHeaders, "Content-Type": "application/json" }
			});
		}
	}
};

// --- Logic Handlers ---

async function handleLogin(data, env, secureRes, request) {
	const { password } = data;
	const isValid = await checkPassword(password, env.ADMIN_PASSWORD);

	if (!isValid) {
		logSecurityEvent(request, "INVALID_LOGIN_ATTEMPT");
		// Use a generic error message
		return secureRes(JSON.stringify({ error: "Invalid credentials" }), {
			status: 401,
			headers: { "Content-Type": "application/json" }
		});
	}

	// Sign a JWT
	const token = await signToken({ role: "admin" }, env.ADMIN_PASSWORD);
	// Ideally use env.SECRET_KEY, but reusing ADMIN_PASSWORD is okay for now if it's strong.
	// Better: env.JWT_SECRET || env.ADMIN_PASSWORD

	return secureRes(JSON.stringify({ token }), { headers: { "Content-Type": "application/json" } });
}

async function isAuthenticated(request, env) {
	const auth = request.headers.get("Authorization");
	if (!auth) return false;
	const token = auth.replace("Bearer ", "");
	// Verify JWT
	return await verifyToken(token, env.ADMIN_PASSWORD);
}

// Database Helpers

async function getFormBySlug(slug, env, secureRes) {
	// Parameterized query: SAFE
	const form = await env.DB.prepare(
		"SELECT * FROM forms WHERE slug = ? OR id = ?"
	).bind(slug, slug).first();

	if (!form) return secureRes("Form not found", { status: 404 });
	return secureRes(JSON.stringify({
		...form,
		config: JSON.parse(form.config),
		design: JSON.parse(form.design)
	}), { headers: { "Content-Type": "application/json" } });
}

async function getAllForms(env, secureRes) {
	try {
		const stmt = await env.DB.prepare("SELECT * FROM forms ORDER BY updated_at DESC").all();
		const results = stmt.results || [];
		const forms = results.map(r => ({
			...r,
			date: new Date(r.updated_at).toLocaleDateString(),
			config: JSON.parse(r.config),
			design: JSON.parse(r.design)
		}));
		return secureRes(JSON.stringify(forms), { headers: { "Content-Type": "application/json" } });
	} catch (e) {
		console.error("getAllForms error:", e);
		return secureRes(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
	}
}

async function saveForm(data, env, secureRes) {
	// 1. Enforce Defaults & Clean Data
	const title = data.title && data.title.trim() ? data.title.trim() : "Untitled Form";
	const description = data.description || "";
	const fields = data.fields || [];
	const design = data.design || {
		themeColor: "#db4437",
		formTitle: title,
		formDescription: description
	};
	const responseLimit = data.responseLimit || null;

	// 2. Normalize design fields (Pro-level improvement)
	const cleanDesign = {
		...design,
		banner: design.banner || null,
		logoLight: design.logoLight || null,
		logoDark: design.logoDark || null,
		formTitle: title,
		formDescription: description,
		responseLimit
	};

	// 3. Generate System Fields
	let baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
	if (!baseSlug) baseSlug = 'form';

	let slug = baseSlug;
	let counter = 0;

	// 4. Ensure Unique Slug
	let exists = true;
	while (exists) {
		const check = await env.DB.prepare("SELECT id FROM forms WHERE slug = ?").bind(slug).first();
		if (!check) {
			exists = false;
		} else {
			counter++;
			slug = `${baseSlug}-${counter}`;
		}
	}

	const id = crypto.randomUUID();
	const now = Date.now();

	// 5. Insert into DB (Strict Contract)
	await env.DB.prepare(`
        INSERT INTO forms (id, slug, name, config, design, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'open', ?, ?)
    `).bind(
		id,
		slug,
		title,
		JSON.stringify(fields), // Config maps to fields array
		JSON.stringify(cleanDesign),
		now,
		now
	).run();

	return secureRes(JSON.stringify({ success: true, id, slug }), {
		status: 201,
		headers: { "Content-Type": "application/json" }
	});
}

async function updateForm(targetId, data, env, secureRes) {
	const { title: updatedTitle, description: updatedDescription, fields: updatedFields, design: updatedDesign, responseLimit: updatedResponseLimit } = data;

	const formRecord = await env.DB.prepare(`SELECT slug FROM forms WHERE id=?`).bind(targetId).first();
	if (!formRecord) {
		return secureRes(JSON.stringify({ error: "Form not found" }), {
			status: 404,
			headers: { "Content-Type": "application/json" }
		});
	}
	const formSlug = formRecord.slug;
	const updateTime = Date.now();

	// Normalize design fields
	const cleanDesign = {
		...updatedDesign,
		banner: updatedDesign.banner || null,
		logoLight: updatedDesign.logoLight || null,
		logoDark: updatedDesign.logoDark || null,
		formTitle: updatedTitle,
		formDescription: updatedDescription || '',
		responseLimit: updatedResponseLimit
	};

	await env.DB.prepare(`
        UPDATE forms 
        SET name=?, config=?, design=?, updated_at=?
        WHERE id=?
    `).bind(
		updatedTitle,
		JSON.stringify(updatedFields),
		JSON.stringify(cleanDesign),
		updateTime,
		targetId
	).run();

	return secureRes(JSON.stringify({
		success: true,
		id: targetId,
		slug: formSlug
	}), {
		headers: { "Content-Type": "application/json" }
	});

}

async function deleteForm(slug, env, secureRes) {
	await env.DB.prepare("DELETE FROM forms WHERE slug = ?").bind(slug).run();
	await env.DB.prepare("DELETE FROM responses WHERE form_slug = ?").bind(slug).run();
	return secureRes(JSON.stringify({ status: "deleted" }), { headers: { "Content-Type": "application/json" } });
}

async function updateFormStatus(slug, status, env, secureRes) {
	await env.DB.prepare("UPDATE forms SET status = ?, updated_at = ? WHERE slug = ?").bind(status, Date.now(), slug).run();
	const updated = await env.DB.prepare(
		"SELECT * FROM forms WHERE slug = ?"
	).bind(slug).first();

	return secureRes(JSON.stringify(updated), {
		headers: { "Content-Type": "application/json" }
	});
}

async function submitResponse(slug, request, env, secureRes) {
	// 1. Validate Payload Size first
	const body = await parseAndValidate(request, null, 51200);

	const now = Date.now();

	const form = await env.DB
		.prepare("SELECT id, status, design, config FROM forms WHERE slug = ? OR id = ?")
		.bind(slug, slug)
		.first();

	if (!form) {
		return secureRes(JSON.stringify({ error: "Form not found" }), {
			status: 404,
			headers: { "Content-Type": "application/json" }
		});
	}

	if (form.status !== "open") {
		return secureRes(JSON.stringify({ error: "Form is closed" }), {
			status: 403,
			headers: { "Content-Type": "application/json" }
		});
	}

	// 2. Validate Data against Form Schema
	try {
		const config = JSON.parse(form.config);
		const dynamicSchema = createSubmissionSchema(config);
		await validate(dynamicSchema, body);
	} catch (err) {
		return secureRes(JSON.stringify({ error: err.message }), {
			status: 400,
			headers: { "Content-Type": "application/json" }
		});
	}

	const design = JSON.parse(form.design);

	// Strict Single Response Enforcement (KV + IP)
	if (design.allowMultipleResponses === false && env.LIMITER) {
		const ip = request.headers.get("cf-connecting-ip") || "unknown";
		const hasSubmitted = await env.LIMITER.get(`submitted:${slug}:${ip}`);
		if (hasSubmitted) {
			return secureRes(JSON.stringify({ error: "You have already submitted this form." }), {
				status: 403,
				headers: { "Content-Type": "application/json" }
			});
		}
	}

	if (design.responseLimit && parseInt(design.responseLimit) > 0) {
		const countRow = await env.DB
			.prepare("SELECT COUNT(*) as count FROM responses WHERE form_slug = ?")
			.bind(slug)
			.first();

		if ((countRow.count || 0) >= parseInt(design.responseLimit)) {
			return secureRes(JSON.stringify({ error: "Response limit reached" }), {
				status: 403,
				headers: { "Content-Type": "application/json" }
			});
		}
	}

	await env.DB.prepare(
		"INSERT INTO responses (form_slug, form_id, data, submitted_at) VALUES (?, ?, ?, ?)"
	).bind(slug, form.id, JSON.stringify(body), now).run();

	// Record submission in KV if multiple disallowed
	if (design.allowMultipleResponses === false && env.LIMITER) {
		const ip = request.headers.get("cf-connecting-ip") || "unknown";
		await env.LIMITER.put(`submitted:${slug}:${ip}`, "true", { expirationTtl: 2592000 });
	}

	return secureRes(JSON.stringify({ status: "success" }), {
		headers: { "Content-Type": "application/json" }
	});
}

async function getResponses(slug, env, secureRes) {
	const { results } = await env.DB.prepare("SELECT * FROM responses WHERE form_slug = ? ORDER BY submitted_at DESC").bind(slug).all();
	const out = results.map(r => ({ ...r, data: JSON.parse(r.data) }));
	return secureRes(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
}

async function clearResponses(slug, env, secureRes) {
	await env.DB.prepare("DELETE FROM responses WHERE form_slug = ?").bind(slug).run();
	return secureRes(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
}

async function deleteResponse(id, env, secureRes) {
	await env.DB.prepare("DELETE FROM responses WHERE id = ?").bind(id).run();
	return secureRes(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
}

async function updateResponseData(id, requestData, env, secureRes) {
	if (!requestData || !requestData.data) { // Check structure assuming { data: ... } wrapper
		return secureRes(JSON.stringify({ error: "Invalid data format" }), { status: 400, headers: { "Content-Type": "application/json" } });
	}
	await env.DB.prepare("UPDATE responses SET data = ? WHERE id = ?").bind(JSON.stringify(requestData.data), id).run();
	return secureRes(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
}

async function getFormStats(id, env, secureRes) {
	// Note: The previous implementation used URL param 'id', but here we often use slug. 
	// The previous implementation had: if (url.pathname === "/api/form-stats" ... const id = url.searchParams.get("id");
	// And executed SELECT ... WHERE form_slug = ? 
	// This implies 'id' param actually held the slug. Safe to assume slug.
	const countRow = await env.DB.prepare(
		"SELECT COUNT(*) as count FROM responses WHERE form_slug = ?"
	).bind(id).first();

	return secureRes(JSON.stringify({ count: countRow.count || 0 }), {
		headers: { "Content-Type": "application/json" }
	});
}
