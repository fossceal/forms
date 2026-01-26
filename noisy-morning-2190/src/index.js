const sessions = new Map();

export default {
	async fetch(request, env) {
		// ----- CORS HEADERS -----
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		};

		// Handle preflight
		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		const url = new URL(request.url);

		// ---------- LOGIN ----------
		if (url.pathname === "/api/login" && request.method === "POST") {
			const { password } = await request.json();

			if (password !== env.ADMIN_PASSWORD) {
				return new Response("Unauthorized", {
					status: 401,
					headers: corsHeaders,
				});
			}

			const token = crypto.randomUUID();
			sessions.set(token, true);

			return new Response(JSON.stringify({ token }), {
				headers: {
					"Content-Type": "application/json",
					...corsHeaders,
				},
			});
		}

		// ---------- PROTECTED ADMIN ROUTE ----------
		if (url.pathname === "/api/admin-data") {
			if (!isAuthenticated(request)) {
				return new Response("Forbidden", {
					status: 403,
					headers: corsHeaders,
				});
			}

			return new Response(
				JSON.stringify({
					message: "This is admin-only data",
					time: new Date().toISOString(),
				}),
				{
					headers: {
						"Content-Type": "application/json",
						...corsHeaders,
					},
				}
			);
		}

		return new Response("Not Found", { status: 404, headers: corsHeaders });
	},
};

function isAuthenticated(request) {
	const auth = request.headers.get("Authorization");
	if (!auth) return false;
	const token = auth.replace("Bearer ", "");
	return sessions.has(token);
}
