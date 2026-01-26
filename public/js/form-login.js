/* js/form-login.js */
// SECURITY: Frontend is untrusted. We only send credentials to the trusted Worker.
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // 1. Capture Inputs
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('errorMsg');
    const btn = e.target.querySelector('button');

    // UI Feedback
    btn.disabled = true;
    btn.textContent = "Verifying...";
    errorMsg.style.display = 'none';

    try {
        // 2. Send to Trusted Backend (FULL URL)
        const response = await fetch(
            'https://noisy-morning-2190.mr-adhi125.workers.dev/api/login',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            }
        );

        // 3. Handle Response
        if (response.ok) {
            const data = await response.json();

            if (data.token) {
                // Success: Store the random session token
                localStorage.setItem('adminToken', data.token);

                // Redirect to the protected dashboard
                window.location.href = 'admin.html';
            } else {
                throw new Error("Invalid response");
            }
        } else {
            // 4. Handle Auth Failure
            throw new Error("Invalid password");
        }
    } catch (err) {
        console.error("Login failed:", err);
        errorMsg.textContent = "Invalid password. Please try again.";
        errorMsg.style.display = 'block';
        btn.disabled = false;
        btn.textContent = "Login";
    }
});
