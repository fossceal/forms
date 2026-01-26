export default {
    async fetch(request, env, ctx) {
        // --- 1. HANDLE CORS (Strict) ---
        // Allow ONLY specific origin (e.g., https://admin.yourdomain.com)
        // For development, you might use localhost, but for production, restrict it.
        // NOTE: Replace 'https://admin.yourdomain.com' with your ACTUAL domain.
        const allowedOrigin = "https://foss.ceal.in";


        const corsHeaders = {
            "Access-Control-Allow-Origin": allowedOrigin,
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
        };

        // Handle CORS Preflight
        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        const url = new URL(request.url);

        // --- 2. PUBLIC ROUTES ---

        // Health Check
        if (url.pathname === "/api/health") {
            return json({ status: "ok" }, 200, corsHeaders);
        }

        // Login Endpoint (Public)
        if (url.pathname === "/api/login" && request.method === "POST") {
            return handleLogin(request, env, corsHeaders);
        }

        // --- 3. PROTECTED ADMIN ROUTES ---
        // GLOBAL AUTH MIDDLEWARE: All other /api/ routes MUST be authenticated

        if (url.pathname.startsWith("/api/")) {

            // Check Token
            if (!isAuthenticated(request)) {
                return new Response("Forbidden", {
                    status: 403,
                    headers: corsHeaders
                });
            }

            // Route: Get Forms
            if (url.pathname === "/api/get-forms") {
                // Mock Data
                const forms = [
                    { id: "1", name: "Workshop Registration", slug: "workshop-2026" },
                    { id: "2", name: "Feedback Form", slug: "feedback-q1" }
                ];
                return json(forms, 200, corsHeaders);
            }

            // Route: Create Form
            if (url.pathname === "/api/create-form" && request.method === "POST") {
                // Logic to save form would go here
                return json({ status: "success", id: crypto.randomUUID() }, 200, corsHeaders);
            }

            // Route: Update Form
            if (url.pathname === "/api/update-form" && request.method === "POST") {
                return json({ status: "updated" }, 200, corsHeaders);
            }

            // Route: Delete Form
            if (url.pathname === "/api/delete-form" && request.method === "POST") {
                return json({ status: "deleted" }, 200, corsHeaders);
            }

            // Route: Admin Data (Dashboard Stats)
            if (url.pathname === "/api/admin-data") {
                return json({ users: 152, forms: 12 }, 200, corsHeaders);
            }
        }

        return new Response("Not Found", { status: 404, headers: corsHeaders });
    }
};

// ----------------------------------------------------------------------------
// SESSION STORAGE (Server-Side)
// ----------------------------------------------------------------------------
// In-memory Map for Level 1 simplicity. 
// Resets on Worker restart. Use KV for persistence.
const SESSIONS = new Map();


// ----------------------------------------------------------------------------
// AUTH HANDLERS
// ----------------------------------------------------------------------------

async function handleLogin(request, env, corsHeaders) {
    try {
        const body = await request.json();

        // 1. Validate Password against Secret
        if (!env.ADMIN_PASSWORD || body.password !== env.ADMIN_PASSWORD) {
            // Slight delay to mitigate timing attacks (optional but good practice)
            await new Promise(r => setTimeout(r, 200));
            return new Response(JSON.stringify({ error: "Invalid password" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 2. Generate Secure Random Token
        const token = crypto.randomUUID();

        // 3. Store Session
        SESSIONS.set(token, {
            role: "admin",
            created: Date.now()
        });

        // 4. Return Token
        return json({ token }, 200, corsHeaders);

    } catch (e) {
        return new Response("Bad Request", { status: 400, headers: corsHeaders });
    }
}

function isAuthenticated(request) {
    // 1. Extract Header
    const auth = request.headers.get("Authorization");
    if (!auth) return false;

    // 2. Parse Token ("Bearer <token>")
    const token = auth.replace("Bearer ", "").trim();
    if (!token) return false;

    // 3. Validate Server-Side
    return SESSIONS.has(token);
}


// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

function json(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...headers,
            "Content-Type": "application/json"
        }
    });
}
