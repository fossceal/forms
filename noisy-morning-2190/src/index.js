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


		// ---------- FORM STATS (Response Limiter) ----------
		if (url.pathname === "/api/form-stats") {
			const id = url.searchParams.get("id");
			if (!id) return new Response("Missing Form ID", { status: 400, headers: corsHeaders });

			// Initialize count if not exists (In-memory only)
			// detailed-forms-map might be better if we had KV
			if (!sessions.has("counts_" + id)) {
				sessions.set("counts_" + id, 0);
			}

			if (request.method === "POST" && url.searchParams.get("action") === "increment") {
				const current = sessions.get("counts_" + id) || 0;
				sessions.set("counts_" + id, current + 1);
				return new Response(JSON.stringify({ count: current + 1 }), {
					headers: { "Content-Type": "application/json", ...corsHeaders }
				});
			}

			// GET (default)
			const count = sessions.get("counts_" + id) || 0;
			return new Response(JSON.stringify({ count }), {
				headers: { "Content-Type": "application/json", ...corsHeaders }
			});
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
