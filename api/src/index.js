// Security
async function checkKvRateLimit(kv, key, limit = 5, windowSec = 60) {
	if (!kv) return true;
	const now = Math.floor(Date.now() / 1000);
	const currentWindow = Math.floor(now / windowSec);
	const kvKey = `rate_limit:${key}:${currentWindow}`;

	const count = await kv.get(kvKey);
	const currentCount = count ? parseInt(count) : 0;

	if (currentCount >= limit) return false;

	await kv.put(kvKey, (currentCount + 1).toString(), { expirationTtl: windowSec * 2 });
	return true;
}


async function validatePayload(request, maxSize = 10485760) {
	const contentType = request.headers.get("content-type") || "";
	if (!contentType.includes("application/json")) {
		throw new Error("Invalid Content-Type. Expected application/json.");
	}

	const contentLength = parseInt(request.headers.get("content-length") || "0");
	if (contentLength > maxSize) {
		throw new Error("Payload too large (Max 10MB)");
	}
}

async function validateSchema(data, config) {
	for (const field of config) {
		let val = data[field.id];

		// Trim input before validation (and for storage)
		if (typeof val === "string") {
			val = val.trim();
			data[field.id] = val;
		}

		if (field.required && !field.type.includes("description") && !field.type.includes("image")) {
			if (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0)) {
				throw new Error(`Field "${field.label || field.id}" is required.`);
			}
		}

		// Email format validation (Backend)
		if (field.type === "email" && val && val !== "") {
			const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
			if (!emailRegex.test(val)) {
				throw new Error(`Field "${field.label || field.id}" must be a valid email address.`);
			}
		}
	}
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
	headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: https:; connect-src 'self' https:;");
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const ip = request.headers.get("cf-connecting-ip") || "unknown";
		const origin = request.headers.get("Origin");

		// CORS
		const allowedOrigins = [env.ALLOWED_ORIGIN, "http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5500", "http://127.0.0.1:5500", "https://foss.ceal.in"];
		const isOriginAllowed = !origin || allowedOrigins.includes(origin);
		const corsOrigin = isOriginAllowed ? origin : env.ALLOWED_ORIGIN;

		const corsHeaders = {
			"Access-Control-Allow-Origin": corsOrigin || "*",
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
			"Access-Control-Max-Age": "86400"
		};

		if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

		if (origin && !isOriginAllowed) {
			logSecurityEvent(request, "CORS_REJECTION", { origin });
			return new Response("Forbidden: Origin Not Allowed", { status: 403, headers: corsHeaders });
		}

		try {
			const secureRes = (body, init = {}) => {
				const headers = new Headers(init.headers || {});
				Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
				addSecurityHeaders(headers);
				return new Response(body, { ...init, headers });
			};

			// Public API
			if (url.pathname === "/api/login" && request.method === "POST") {
				const isAllowed = await checkKvRateLimit(env.LIMITER, `login:${ip}`, 5, 60);
				if (!isAllowed) {
					logSecurityEvent(request, "RATE_LIMIT_EXCEEDED", { type: "login" });
					return secureRes("Too Many Requests", { status: 429 });
				}

				await validatePayload(request, 5120);
				return handleLogin(request, env, secureRes);
			}

			if (url.pathname.match(/^\/api\/forms\/[^\/]+$/) && request.method === "GET") {
				const slug = url.pathname.split("/").pop();
				return getFormBySlug(slug, env, secureRes);
			}

			if (url.pathname.match(/^\/api\/forms\/[^\/]+\/submit$/) && request.method === "POST") {
				const slug = url.pathname.split("/")[3];

				const isAllowed = await checkKvRateLimit(env.LIMITER, `submit:${ip}:${slug}`, 5, 60);
				if (!isAllowed) {
					logSecurityEvent(request, "RATE_LIMIT_EXCEEDED", { type: "submit", slug });
					return secureRes("Too Many Requests", { status: 429 });
				}

				await validatePayload(request, 51200);
				return submitResponse(slug, request, env, secureRes);
			}

			if (url.pathname === "/api/form-stats" && request.method === "GET") {
				const id = url.searchParams.get("id");
				return getFormStats(id, env, secureRes);
			}

			// Protected API
			if (!isAuthenticated(request, env)) {
				return secureRes("Unauthorized", { status: 401 });
			}

			if (["POST", "PUT"].includes(request.method)) {
				await validatePayload(request);
			}

			if (url.pathname === "/api/forms/library/all" && request.method === "GET") return getAllForms(env, secureRes);
			if (url.pathname === "/api/forms" && request.method === "POST") return saveForm(request, env, secureRes);
			if (url.pathname === "/api/forms/delete" && request.method === "POST") return deleteForm(request, env, secureRes);

			if (url.pathname.match(/^\/api\/forms\/[^\/]+\/status$/) && request.method === "POST") {
				const slug = url.pathname.split("/")[3];
				return updateFormStatus(slug, request, env, secureRes);
			}

			if (url.pathname.match(/^\/api\/forms\/[^\/]+\/responses$/)) {
				const slug = url.pathname.split("/")[3];
				if (request.method === "GET") return getResponses(slug, env, secureRes);
				if (request.method === "DELETE") return clearResponses(slug, env, secureRes);
			}

			if (url.pathname.match(/^\/api\/forms\/[^\/]+\/responses\/[^\/]+$/)) {
				const slug = url.pathname.split("/")[3];
				const responseId = url.pathname.split("/")[5];
				if (request.method === "DELETE") return deleteResponse(responseId, env, secureRes);
				if (request.method === "PUT") return updateResponseData(responseId, request, env, secureRes);
			}

			if (url.pathname.match(/^\/api\/forms\/[^\/]+$/) && request.method === "PUT") {
				const id = url.pathname.split("/").pop();
				return updateForm(id, request, env, secureRes);
			}

			return secureRes("Not Found", { status: 404 });

		} catch (error) {
			logSecurityEvent(request, "WORKER_ERROR", { error: error.message });
			return new Response(JSON.stringify({ error: error.message }), {
				status: 500,
				headers: { ...corsHeaders, "Content-Type": "application/json" }
			});
		}
	}
};

// Auth
const sessions = new Map();
async function handleLogin(request, env, secureRes) {
	const body = await request.json();
	const { password } = body;
	if (password !== env.ADMIN_PASSWORD) {
		logSecurityEvent(request, "INVALID_LOGIN_ATTEMPT");
		return secureRes(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers: { "Content-Type": "application/json" } });
	}
	const token = crypto.randomUUID();
	sessions.set(token, { createdAt: Date.now() });
	return secureRes(JSON.stringify({ token }), { headers: { "Content-Type": "application/json" } });
}

function isAuthenticated(request, env) {
	const auth = request.headers.get("Authorization");
	if (!auth) return false;
	const token = auth.replace("Bearer ", "");
	return sessions.has(token);
}

// Database
async function getFormBySlug(slug, env, secureRes) {
	const form = await env.DB.prepare(
		"SELECT * FROM forms WHERE slug = ? AND status = 'open'"
	).bind(slug).first();

	if (!form) return secureRes("Form not found", { status: 404 });
	return secureRes(JSON.stringify({
		...form,
		config: JSON.parse(form.config),
		design: JSON.parse(form.design)
	}), { headers: { "Content-Type": "application/json" } });
}

async function getAllForms(env, secureRes) {
	const { results } = await env.DB.prepare("SELECT * FROM forms ORDER BY updated_at DESC").all();
	const forms = results.map(r => ({
		...r,
		date: new Date(r.updated_at).toLocaleDateString(),
		config: JSON.parse(r.config),
		design: JSON.parse(r.design)
	}));
	return secureRes(JSON.stringify(forms), { headers: { "Content-Type": "application/json" } });
}

async function saveForm(request, env, secureRes) {
	try {
		const body = await request.json();
		const { title, description, fields, design, responseLimit } = body;

		if (!title || !fields) {
			return secureRes(JSON.stringify({ error: "Title and fields are required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" }
			});
		}

		// Generate stable human-readable slug
		let baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
		if (!baseSlug) baseSlug = 'form';

		let slug = baseSlug;
		let counter = 0;
		let exists = true;

		// Loop until we find a unique slug
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

		await env.DB.prepare(`
			INSERT INTO forms (id, slug, name, config, design, status, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, 'open', ?, ?)
		`).bind(
			id,
			slug,
			title,
			JSON.stringify(fields),
			JSON.stringify({
				...design,
				formTitle: title,
				formDescription: description || '',
				responseLimit
			}),
			now,
			now
		).run();

		return secureRes(JSON.stringify({ success: true, id, slug }), {
			status: 201,
			headers: { "Content-Type": "application/json" }
		});
	} catch (error) {
		console.error("Save form error:", error);
		return secureRes(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: { "Content-Type": "application/json" }
		});
	}
}

async function updateForm(targetId, request, env, secureRes) {
	try {
		const updateBody = await request.json();
		const { title: updatedTitle, description: updatedDescription, fields: updatedFields, design: updatedDesign, responseLimit: updatedResponseLimit } = updateBody;

		// 1. Fetch current slug so we can return it (needed by frontend state sync)
		const formRecord = await env.DB.prepare(`SELECT slug FROM forms WHERE id=?`).bind(targetId).first();
		if (!formRecord) {
			console.error(`[API] updateForm: Form with ID ${targetId} not found`);
			return secureRes(JSON.stringify({ error: "Form not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" }
			});
		}
		const formSlug = formRecord.slug;

		// 2. Perform the update
		const updateTime = Date.now();

		await env.DB.prepare(`
			UPDATE forms 
			SET name=?, config=?, design=?, updated_at=?
			WHERE id=?
		`).bind(
			updatedTitle,
			JSON.stringify(updatedFields),
			JSON.stringify({
				...updatedDesign,
				formTitle: updatedTitle,
				formDescription: updatedDescription || '',
				responseLimit: updatedResponseLimit
			}),
			updateTime,
			targetId
		).run();

		console.log(`[API] updateForm: Successfully updated form ${targetId} (${formSlug})`);

		return secureRes(JSON.stringify({
			success: true,
			id: targetId,
			slug: formSlug
		}), {
			headers: { "Content-Type": "application/json" }
		});
	} catch (error) {
		console.error("[API] updateForm error:", error);
		return secureRes(JSON.stringify({
			error: error.message,
			details: "Error occurred during updateForm execution"
		}), {
			status: 500,
			headers: { "Content-Type": "application/json" }
		});
	}
}

async function deleteForm(request, env, secureRes) {
	const { slug } = await request.json();
	await env.DB.prepare("DELETE FROM forms WHERE slug = ?").bind(slug).run();
	await env.DB.prepare("DELETE FROM responses WHERE form_slug = ?").bind(slug).run();
	return secureRes(JSON.stringify({ status: "deleted" }), { headers: { "Content-Type": "application/json" } });
}

async function updateFormStatus(slug, request, env, secureRes) {
	const { status } = await request.json();
	await env.DB.prepare("UPDATE forms SET status = ?, updated_at = ? WHERE slug = ?").bind(status, Date.now(), slug).run();
	const updated = await env.DB.prepare(
		"SELECT * FROM forms WHERE slug = ?"
	).bind(slug).first();

	return secureRes(JSON.stringify(updated), {
		headers: { "Content-Type": "application/json" }
	});
}

// Submissions
async function submitResponse(slug, request, env, secureRes) {
	const body = await request.json();
	const { ...data } = body;
	const now = Date.now();

	const form = await env.DB
		.prepare("SELECT id, status, design, config FROM forms WHERE slug = ?")
		.bind(slug)
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

	try {
		const config = JSON.parse(form.config);
		await validateSchema(data, config);
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

		const count = countRow.count || 0;

		if (count >= parseInt(design.responseLimit)) {
			return secureRes(JSON.stringify({ error: "Response limit reached" }), {
				status: 403,
				headers: { "Content-Type": "application/json" }
			});
		}
	}

	await env.DB.prepare(
		"INSERT INTO responses (form_slug, form_id, data, submitted_at) VALUES (?, ?, ?, ?)"
	).bind(slug, form.id, JSON.stringify(data), now).run();

	// Record submission in KV if multiple disallowed
	if (design.allowMultipleResponses === false && env.LIMITER) {
		const ip = request.headers.get("cf-connecting-ip") || "unknown";
		// Store for 30 days (default) or longer if needed. TTL in seconds.
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

async function updateResponseData(id, request, env, secureRes) {
	try {
		const { data } = await request.json();
		await env.DB.prepare("UPDATE responses SET data = ? WHERE id = ?").bind(JSON.stringify(data), id).run();
		return secureRes(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
	} catch (error) {
		return secureRes(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
	}
}

async function getFormStats(slug, env, secureRes) {
	const countRow = await env.DB.prepare(
		"SELECT COUNT(*) as count FROM responses WHERE form_slug = ?"
	).bind(slug).first();

	return secureRes(JSON.stringify({ count: countRow.count || 0 }), {
		headers: { "Content-Type": "application/json" }
	});
}

