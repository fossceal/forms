import { verifyToken, signToken, checkPassword, hashPassword, verifySubAdminPassword } from './auth.js';
import { validate, loginSchema, saveFormSchema, updateFormSchema, createSubmissionSchema, createAdminUserSchema } from './validation.js';

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
	const contentType = request.headers.get('content-type') || '';
	if (!contentType.includes('application/json')) {
		throw new Error('Invalid Content-Type. Expected application/json.');
	}

	const contentLength = parseInt(request.headers.get('content-length') || '0');
	if (contentLength > maxSize) {
		throw new Error(`Payload too large (Max ${maxSize / 1024 / 1024}MB)`);
	}

	let body;
	try {
		body = await request.json();
	} catch (e) {
		throw new Error('Invalid JSON body');
	}

	if (schema) {
		return await validate(schema, body);
	}
	return body;
}

function logSecurityEvent(request, reason, context = {}) {
	const ip = request.headers.get('cf-connecting-ip') || 'unknown';
	const method = request.method;
	const url = request.url;
	console.info(`[SECURITY_REJECTION] ${reason} | IP: ${ip} | Method: ${method} | URL: ${url}`, context);
}

function addSecurityHeaders(headers) {
	headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
	headers.set('X-Frame-Options', 'DENY');
	headers.set('X-Content-Type-Options', 'nosniff');
	headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	headers.set('X-XSS-Protection', '1; mode=block');
	headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	// Updated CSP - stringent
	headers.set(
		'Content-Security-Policy',
		"default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: https:; connect-src 'self' https:;",
	);
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		// Clean URL rewriting: /page -> /page.html
		// Skip root '/', avoid paths with extensions, and ignore /api routes
		let isCleanUrl = false;
		if (url.pathname !== '/' && !url.pathname.includes('.') && !url.pathname.startsWith('/api')) {
			url.pathname += '.html';
			isCleanUrl = true;
		}

		const ip = request.headers.get('cf-connecting-ip') || 'unknown';
		const origin = request.headers.get('Origin');

		// CORS - strict check
		const allowedOrigins = [
			env.ALLOWED_ORIGIN,
			'http://localhost:3000',
			'http://127.0.0.1:3000',
			'http://localhost:5500',
			'http://127.0.0.1:5500',
			'https://forms.ceal.in',
		];
		const isOriginAllowed = !origin || allowedOrigins.includes(origin);

		const corsHeaders = {
			'Access-Control-Allow-Origin': isOriginAllowed && origin ? origin : env.ALLOWED_ORIGIN,
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Fingerprint',
			'Access-Control-Max-Age': '86400',
		};

		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: corsHeaders });
		}

		if (origin && !isOriginAllowed) {
			logSecurityEvent(request, 'CORS_REJECTION', { origin });
			return new Response('Forbidden: Origin Not Allowed', { status: 403, headers: corsHeaders });
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
			if (url.pathname === '/api/login' && request.method === 'POST') {
				const isAllowed = await checkKvRateLimit(env.LIMITER, `login:${ip}`, 5, 60);
				if (!isAllowed) {
					logSecurityEvent(request, 'RATE_LIMIT_EXCEEDED', { type: 'login' });
					return secureRes('Too Many Requests', { status: 429 });
				}

				const data = await parseAndValidate(request, loginSchema, 5120); // 5KB max
				return handleLogin(data, env, secureRes, request);
			}

			// 2. Get Form (Public)
			if (url.pathname.match(/^\/api\/forms\/[^\/]+$/) && request.method === 'GET') {
				const slug = url.pathname.split('/').pop();
				return getFormBySlug(slug, env, secureRes);
			}

			// 3. Submit Response (Public)
			if (url.pathname.match(/^\/api\/forms\/[^\/]+\/submit$/) && request.method === 'POST') {
				const slug = url.pathname.split('/')[3];

				const isAllowed = await checkKvRateLimit(env.LIMITER, `submit:${ip}:${slug}`, 5, 60);
				if (!isAllowed) {
					logSecurityEvent(request, 'RATE_LIMIT_EXCEEDED', { type: 'submit', slug });
					return secureRes('Too Many Requests', { status: 429 });
				}

				// We validate payload inside because schema is dynamic based on form config
				return submitResponse(slug, request, env, secureRes);
			}

			if (url.pathname === '/api/form-stats' && request.method === 'GET') {
				const id = url.searchParams.get('id');
				const isAllowed = await checkKvRateLimit(env.LIMITER, `stats:${ip}`, 20, 60);
				if (!isAllowed) return secureRes('Too Many Requests', { status: 429 });

				return getFormStats(id, env, secureRes);
			}

			// --- Protected API Routes ---

			// Verify Admin Token (superadmin OR sub-admin)
			const user = await isAuthenticated(request, env);
			if (!user) {
				return secureRes(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
			}

			// --- Superadmin-Only: Team Management ---

			// List sub-admins
			if (url.pathname === '/api/admin/users' && request.method === 'GET') {
				if (!isSuperAdmin(user))
					return secureRes(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
				return listAdminUsers(env, secureRes);
			}

			// Create sub-admin
			if (url.pathname === '/api/admin/users' && request.method === 'POST') {
				if (!isSuperAdmin(user))
					return secureRes(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
				const data = await parseAndValidate(request, createAdminUserSchema, 1024);
				return createAdminUser(data, env, secureRes);
			}

			// Delete sub-admin
			if (url.pathname.match(/^\/api\/admin\/users\/[^\/]+$/) && request.method === 'DELETE') {
				if (!isSuperAdmin(user))
					return secureRes(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
				const userId = url.pathname.split('/').pop();
				return deleteAdminUser(userId, env, secureRes);
			}

			// Change sub-admin password
			if (url.pathname === '/api/admin/password' && request.method === 'PUT') {
				// Superadmin doesn't change password here (handled by env vars)
				if (isSuperAdmin(user))
					return secureRes(JSON.stringify({ error: 'Superadmin password cannot be changed here' }), {
						status: 403,
						headers: { 'Content-Type': 'application/json' },
					});
				const data = await parseAndValidate(request, null, 1024); // Simple custom parsing
				if (!data.newPassword || data.newPassword.length < 8) {
					return secureRes(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
						status: 400,
						headers: { 'Content-Type': 'application/json' },
					});
				}
				return updateAdminPassword(user.username, data.newPassword, env, secureRes);
			}

			// 5. List Forms
			if (url.pathname === '/api/forms/library/all' && request.method === 'GET') {
				return getAllForms(env, secureRes, user);
			}

			// 6. Create Form
			if (url.pathname === '/api/forms' && request.method === 'POST') {
				const data = await parseAndValidate(request, saveFormSchema, 1048576); // 1MB
				return saveForm(data, env, secureRes, user);
			}

			// 7. Delete Form
			if (url.pathname === '/api/forms/delete' && request.method === 'POST') {
				// Simple schema for delete
				const data = await parseAndValidate(request, null, 1024);
				if (!data.slug) throw new Error('Slug is required');
				return deleteForm(data.slug, env, secureRes, user);
			}

			// 8. Update Form Status
			if (url.pathname.match(/^\/api\/forms\/[^\/]+\/status$/) && request.method === 'POST') {
				const slug = url.pathname.split('/')[3];
				const data = await parseAndValidate(request, null, 1024);
				if (!data.status) throw new Error('Status is required');
				return updateFormStatus(slug, data.status, env, secureRes, user);
			}

			// 9. Responses Management
			if (url.pathname.match(/^\/api\/forms\/[^\/]+\/responses$/)) {
				const slug = url.pathname.split('/')[3];
				if (request.method === 'GET') return getResponses(slug, env, secureRes, user);
				if (request.method === 'DELETE') return clearResponses(slug, env, secureRes, user);
			}

			if (url.pathname.match(/^\/api\/forms\/[^\/]+\/responses\/[^\/]+$/)) {
				const slug = url.pathname.split('/')[3];
				const responseId = url.pathname.split('/')[5];
				if (request.method === 'DELETE') return deleteResponse(responseId, env, secureRes, user);
				if (request.method === 'PUT') {
					const data = await parseAndValidate(request, null, 51200);
					return updateResponseData(responseId, data, env, secureRes, user);
				}
			}

			// 10. Update Form
			if (url.pathname.match(/^\/api\/forms\/[^\/]+$/) && request.method === 'PUT') {
				const id = url.pathname.split('/').pop();
				const data = await parseAndValidate(request, updateFormSchema, 1048576);
				return updateForm(id, data, env, secureRes, user);
			}

			// If no API route matched, handle static assets
			if (url.pathname.startsWith('/api')) {
				return secureRes('Not Found', { status: 404 });
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
			logSecurityEvent(request, 'WORKER_ERROR', { error: error.message });
			const status =
				error.message.includes('Unauthorized') || error.message.includes('Authentication')
					? 401
					: error.message.includes('Forbidden')
						? 403
						: error.message.includes('Validation') || error.message.includes('required') || error.message.includes('Invalid')
							? 400
							: 500;
			return new Response(JSON.stringify({ error: error.message }), {
				status: status,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}
	},
};

// --- Logic Handlers ---

async function handleLogin(data, env, secureRes, request) {
	const { password, username } = data;

	if (username && username.trim()) {
		// --- Sub-Admin Login ---
		const trimmedUsername = username.trim();
		const userRecord = await env.DB.prepare('SELECT id, username, password_hash, salt FROM admin_users WHERE username = ?')
			.bind(trimmedUsername)
			.first();

		if (!userRecord) {
			logSecurityEvent(request, 'INVALID_SUB_ADMIN_LOGIN', { username: trimmedUsername });
			return secureRes(JSON.stringify({ error: 'Invalid credentials' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const isValid = await verifySubAdminPassword(password, userRecord.password_hash, userRecord.salt);
		if (!isValid) {
			logSecurityEvent(request, 'INVALID_SUB_ADMIN_PASSWORD', { username: trimmedUsername });
			return secureRes(JSON.stringify({ error: 'Invalid credentials' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Sign a sub-admin JWT
		const token = await signToken({ role: 'admin', username: userRecord.username }, env.ADMIN_PASSWORD);
		return secureRes(JSON.stringify({ token }), { headers: { 'Content-Type': 'application/json' } });
	} else {
		// --- Super Admin Login (password-only) ---
		const isValid = await checkPassword(password, env.ADMIN_PASSWORD);

		if (!isValid) {
			logSecurityEvent(request, 'INVALID_SUPERADMIN_LOGIN_ATTEMPT');
			return secureRes(JSON.stringify({ error: 'Invalid credentials' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const token = await signToken({ role: 'superadmin' }, env.ADMIN_PASSWORD);
		return secureRes(JSON.stringify({ token }), { headers: { 'Content-Type': 'application/json' } });
	}
}

async function isAuthenticated(request, env) {
	const auth = request.headers.get('Authorization');
	if (!auth) return null;
	const token = auth.replace('Bearer ', '').trim();
	if (!token) return null;
	// Verify JWT and return the payload (contains role, username, etc.)
	return await verifyToken(token, env.ADMIN_PASSWORD);
}

/**
 * Returns true only if the JWT payload has role === 'superadmin'.
 */
function isSuperAdmin(user) {
	return user && user.role === 'superadmin';
}

async function isFormOwner(slugOrId, env, user) {
	if (isSuperAdmin(user)) return true;
	const form = await env.DB.prepare('SELECT created_by FROM forms WHERE slug = ? OR id = ?').bind(slugOrId, slugOrId).first();
	if (!form) return false;
	// Treat forms with no creator (legacy) as superadmin only, unless the user matches
	return form.created_by === user.username;
}

async function isResponseOwner(responseId, env, user) {
	if (isSuperAdmin(user)) return true;
	const response = await env.DB.prepare('SELECT form_slug FROM responses WHERE id = ?').bind(responseId).first();
	if (!response) return false;
	return await isFormOwner(response.form_slug, env, user);
}

// --- Admin User Management ---

async function listAdminUsers(env, secureRes) {
	try {
		const { results } = await env.DB.prepare('SELECT id, username, created_at FROM admin_users ORDER BY created_at ASC').all();
		return secureRes(JSON.stringify(results || []), { headers: { 'Content-Type': 'application/json' } });
	} catch (e) {
		console.error('listAdminUsers error:', e);
		return secureRes(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
	}
}

async function createAdminUser(data, env, secureRes) {
	const { username, password } = data;

	// Check if username already exists
	const existing = await env.DB.prepare('SELECT id FROM admin_users WHERE username = ?').bind(username.trim()).first();

	if (existing) {
		return secureRes(JSON.stringify({ error: `Username "${username}" is already taken.` }), {
			status: 409,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const id = crypto.randomUUID();
	const salt = crypto.randomUUID();
	const password_hash = await hashPassword(password, salt);
	const now = Date.now();

	await env.DB.prepare('INSERT INTO admin_users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)')
		.bind(id, username.trim().toLowerCase(), password_hash, salt, now)
		.run();

	return secureRes(JSON.stringify({ success: true, id, username: username.trim().toLowerCase() }), {
		status: 201,
		headers: { 'Content-Type': 'application/json' },
	});
}

async function deleteAdminUser(id, env, secureRes) {
	const existing = await env.DB.prepare('SELECT id FROM admin_users WHERE id = ?').bind(id).first();

	if (!existing) {
		return secureRes(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
	}

	await env.DB.prepare('DELETE FROM admin_users WHERE id = ?').bind(id).run();
	return secureRes(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
}

async function updateAdminPassword(username, newPassword, env, secureRes) {
	try {
		const existing = await env.DB.prepare('SELECT id FROM admin_users WHERE username = ?').bind(username).first();
		if (!existing) {
			return secureRes(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
		}

		const newSalt = crypto.randomUUID();
		const newHash = await hashPassword(newPassword, newSalt);

		await env.DB.prepare('UPDATE admin_users SET password_hash = ?, salt = ? WHERE username = ?').bind(newHash, newSalt, username).run();

		return secureRes(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
	} catch (e) {
		console.error('updateAdminPassword error:', e);
		return secureRes(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
	}
}

// Database Helpers

async function getFormBySlug(slug, env, secureRes) {
	// Parameterized query: SAFE
	const form = await env.DB.prepare('SELECT * FROM forms WHERE slug = ? OR id = ?').bind(slug, slug).first();

	if (!form) return secureRes('Form not found', { status: 404 });
	return secureRes(
		JSON.stringify({
			...form,
			config: JSON.parse(form.config),
			design: JSON.parse(form.design),
		}),
		{ headers: { 'Content-Type': 'application/json' } },
	);
}

async function getAllForms(env, secureRes, user) {
	try {
		// Lazy migration: ensure created_by column exists
		try {
			await env.DB.prepare('ALTER TABLE forms ADD COLUMN created_by TEXT').run();
		} catch (e) {
			// Ignore if column already exists
		}

		let stmt;
		if (isSuperAdmin(user)) {
			stmt = await env.DB.prepare('SELECT * FROM forms ORDER BY updated_at DESC').all();
		} else {
			stmt = await env.DB.prepare('SELECT * FROM forms WHERE created_by = ? ORDER BY updated_at DESC')
				.bind(user.username || 'unknown')
				.all();
		}

		const results = stmt.results || [];
		const forms = results.map((r) => ({
			...r,
			date: new Date(r.updated_at).toLocaleDateString(),
			config: JSON.parse(r.config),
			design: JSON.parse(r.design),
		}));
		return secureRes(JSON.stringify(forms), { headers: { 'Content-Type': 'application/json' } });
	} catch (e) {
		console.error('getAllForms error:', e);
		return secureRes(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
	}
}

async function saveForm(data, env, secureRes, user) {
	const title = data.title && data.title.trim() ? data.title.trim() : 'Untitled Form';
	const description = data.description || '';
	const fields = data.fields || [];
	const design = data.design || {
		themeColor: '#db4437',
		formTitle: title,
		formDescription: description,
	};
	const responseLimit = data.responseLimit || null;

	const cleanDesign = {
		...design,
		banner: design.banner || null,
		logoLight: design.logoLight || null,
		logoDark: design.logoDark || null,
		formTitle: title,
		formDescription: description,
		responseLimit: data.responseLimit || design.responseLimit || null,
		closingDate: data.closingDate || design.closingDate || null,
	};

	let baseSlug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
	if (!baseSlug) baseSlug = 'form';

	let slug = baseSlug;
	let counter = 0;

	let exists = true;
	while (exists) {
		const check = await env.DB.prepare('SELECT id FROM forms WHERE slug = ?').bind(slug).first();
		if (!check) {
			exists = false;
		} else {
			counter++;
			slug = `${baseSlug}-${counter}`;
		}
	}

	const id = crypto.randomUUID();
	const now = Date.now();
	const creator = user && user.username ? user.username : 'superadmin';

	await env.DB.prepare(
		`
        INSERT INTO forms (id, slug, name, config, design, status, created_at, updated_at, created_by)
        VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?)
    `,
	)
		.bind(
			id,
			slug,
			title,
			JSON.stringify(fields), // Config maps to fields array
			JSON.stringify(cleanDesign),
			now,
			now,
			creator,
		)
		.run();

	return secureRes(JSON.stringify({ success: true, id, slug }), {
		status: 201,
		headers: { 'Content-Type': 'application/json' },
	});
}

async function updateForm(targetId, data, env, secureRes, user) {
	if (!(await isFormOwner(targetId, env, user))) {
		return secureRes(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
	}
	const {
		title: updatedTitle,
		description: updatedDescription,
		fields: updatedFields,
		design: updatedDesign,
		responseLimit: updatedResponseLimit,
	} = data;

	const formRecord = await env.DB.prepare(`SELECT slug FROM forms WHERE id=?`).bind(targetId).first();
	if (!formRecord) {
		return secureRes(JSON.stringify({ error: 'Form not found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' },
		});
	}
	const formSlug = formRecord.slug;
	const updateTime = Date.now();

	const cleanDesign = {
		...updatedDesign,
		banner: updatedDesign.banner || null,
		logoLight: updatedDesign.logoLight || null,
		logoDark: updatedDesign.logoDark || null,
		formTitle: updatedTitle,
		formDescription: updatedDescription || '',
		responseLimit: updatedResponseLimit || updatedDesign.responseLimit || null,
		closingDate: data.closingDate || updatedDesign.closingDate || null,
	};

	await env.DB.prepare(
		`
        UPDATE forms 
        SET name=?, config=?, design=?, updated_at=?
        WHERE id=?
    `,
	)
		.bind(updatedTitle, JSON.stringify(updatedFields), JSON.stringify(cleanDesign), updateTime, targetId)
		.run();

	return secureRes(
		JSON.stringify({
			success: true,
			id: targetId,
			slug: formSlug,
		}),
		{
			headers: { 'Content-Type': 'application/json' },
		},
	);
}

async function deleteForm(slug, env, secureRes, user) {
	if (!(await isFormOwner(slug, env, user))) {
		return secureRes(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
	}
	await env.DB.prepare('DELETE FROM forms WHERE slug = ?').bind(slug).run();
	await env.DB.prepare('DELETE FROM responses WHERE form_slug = ?').bind(slug).run();
	return secureRes(JSON.stringify({ status: 'deleted' }), { headers: { 'Content-Type': 'application/json' } });
}

async function updateFormStatus(slug, status, env, secureRes, user) {
	if (!(await isFormOwner(slug, env, user))) {
		return secureRes(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
	}
	await env.DB.prepare('UPDATE forms SET status = ?, updated_at = ? WHERE slug = ?').bind(status, Date.now(), slug).run();
	const updated = await env.DB.prepare('SELECT * FROM forms WHERE slug = ?').bind(slug).first();

	return secureRes(JSON.stringify(updated), {
		headers: { 'Content-Type': 'application/json' },
	});
}

async function submitResponse(slug, request, env, secureRes) {
	// 1. Validate Payload Size first
	const body = await parseAndValidate(request, null, 51200);

	const now = Date.now();

	const form = await env.DB.prepare('SELECT id, status, design, config FROM forms WHERE slug = ? OR id = ?').bind(slug, slug).first();

	if (!form) {
		return secureRes(JSON.stringify({ error: 'Form not found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	if (form.status !== 'open') {
		return secureRes(JSON.stringify({ error: 'Form is closed' }), {
			status: 403,
			headers: { 'Content-Type': 'application/json' },
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
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const design = JSON.parse(form.design);

	// Strict Closing Date Enforcement
	if (design.closingDate) {
		const closingTime = new Date(design.closingDate).getTime();
		if (now > closingTime) {
			return secureRes(JSON.stringify({ error: 'This form has closed and is no longer accepting responses.' }), {
				status: 403,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	}

	// Strict Single Response Enforcement (KV + IP + Fingerprint)
	if (design.allowMultipleResponses === false && env.LIMITER) {
		const ip = request.headers.get('cf-connecting-ip') || 'unknown';
		const fingerprint = request.headers.get('X-Device-Fingerprint');

		const hasSubmittedIP = await env.LIMITER.get(`submitted:${slug}:${ip}`);
		let hasSubmittedFP = false;
		if (fingerprint) {
			hasSubmittedFP = await env.LIMITER.get(`submitted:${slug}:fp:${fingerprint}`);
		}

		if (hasSubmittedIP || hasSubmittedFP) {
			return secureRes(JSON.stringify({ error: 'You have already submitted this form.' }), {
				status: 403,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	}

	if (design.responseLimit && parseInt(design.responseLimit) > 0) {
		const countRow = await env.DB.prepare('SELECT COUNT(*) as count FROM responses WHERE form_slug = ?').bind(slug).first();

		if ((countRow.count || 0) >= parseInt(design.responseLimit)) {
			return secureRes(JSON.stringify({ error: 'Response limit reached' }), {
				status: 403,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	}

	await env.DB.prepare('INSERT INTO responses (form_slug, form_id, data, submitted_at) VALUES (?, ?, ?, ?)')
		.bind(slug, form.id, JSON.stringify(body), now)
		.run();

	// Record submission in KV if multiple disallowed
	if (design.allowMultipleResponses === false && env.LIMITER) {
		const ip = request.headers.get('cf-connecting-ip') || 'unknown';
		const fingerprint = request.headers.get('X-Device-Fingerprint');

		await env.LIMITER.put(`submitted:${slug}:${ip}`, 'true', { expirationTtl: 2592000 });
		if (fingerprint) {
			await env.LIMITER.put(`submitted:${slug}:fp:${fingerprint}`, 'true', { expirationTtl: 2592000 });
		}
	}

	return secureRes(JSON.stringify({ status: 'success' }), {
		headers: { 'Content-Type': 'application/json' },
	});
}

async function getResponses(slug, env, secureRes, user) {
	if (!(await isFormOwner(slug, env, user))) {
		return secureRes(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
	}
	const { results } = await env.DB.prepare('SELECT * FROM responses WHERE form_slug = ? ORDER BY submitted_at DESC').bind(slug).all();
	const out = results.map((r) => ({ ...r, data: JSON.parse(r.data) }));
	return secureRes(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
}

async function clearResponses(slug, env, secureRes, user) {
	if (!(await isFormOwner(slug, env, user))) {
		return secureRes(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
	}
	await env.DB.prepare('DELETE FROM responses WHERE form_slug = ?').bind(slug).run();
	return secureRes(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
}

async function deleteResponse(id, env, secureRes, user) {
	if (!(await isResponseOwner(id, env, user))) {
		return secureRes(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
	}
	await env.DB.prepare('DELETE FROM responses WHERE id = ?').bind(id).run();
	return secureRes(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
}

async function updateResponseData(id, requestData, env, secureRes, user) {
	if (!(await isResponseOwner(id, env, user))) {
		return secureRes(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
	}
	if (!requestData || !requestData.data) {
		// Check structure assuming { data: ... } wrapper
		return secureRes(JSON.stringify({ error: 'Invalid data format' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
	}
	await env.DB.prepare('UPDATE responses SET data = ? WHERE id = ?').bind(JSON.stringify(requestData.data), id).run();
	return secureRes(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
}

async function getFormStats(id, env, secureRes) {
	// Note: The previous implementation used URL param 'id', but here we often use slug.
	// The previous implementation had: if (url.pathname === "/api/form-stats" ... const id = url.searchParams.get("id");
	// And executed SELECT ... WHERE form_slug = ?
	// This implies 'id' param actually held the slug. Safe to assume slug.
	const countRow = await env.DB.prepare('SELECT COUNT(*) as count FROM responses WHERE form_slug = ?').bind(id).first();

	return secureRes(JSON.stringify({ count: countRow.count || 0 }), {
		headers: { 'Content-Type': 'application/json' },
	});
}
