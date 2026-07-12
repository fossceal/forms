document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const errorMsg = document.getElementById("errorMsg");
    const submitBtn = document.getElementById("loginBtn");

    if (!loginForm) return;

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const usernameInput = document.getElementById("username");
        const username = usernameInput ? usernameInput.value.trim() : "";
        const password = document.getElementById("password").value;

        // Hide any previous error
        if (errorMsg) {
            errorMsg.style.display = "none";
            errorMsg.textContent = "";
        }

        // Show loading state
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Logging in\u2026";
        }

        try {
            // Build payload: include username only if provided (sub-admin mode)
            const payload = username ? { username, password } : { password };

            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const apiBase = isLocal ? "http://127.0.0.1:8787" : "https://custom-forms-api.mr-adhi125.workers.dev";
            
            const res = await fetch(`${apiBase}/api/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok) {
                showError(data.error || "Invalid credentials. Please try again.");
                return;
            }

            // Store token
            localStorage.setItem("adminToken", data.token);

            // Decode JWT payload to extract role (no library needed — just base64)
            try {
                const payloadB64 = data.token.split(".")[1];
                const decoded = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
                localStorage.setItem("adminRole", decoded.role || "admin");
                localStorage.setItem("adminUsername", decoded.username || "");
            } catch (_) {
                // If decode fails, just proceed
                localStorage.setItem("adminRole", "admin");
                localStorage.setItem("adminUsername", "");
            }

            window.location.href = "admin.html";

        } catch (err) {
            showError("Network error. Please check your connection and try again.");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Login";
            }
        }
    });

    function showError(message) {
        if (errorMsg) {
            errorMsg.textContent = message;
            errorMsg.style.display = "block";
        } else {
            alert(message);
        }
    }
});
