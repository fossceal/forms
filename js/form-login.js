document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const password = document.getElementById("password").value;

    const res = await fetch("https://custom-forms-api.mr-adhi125.workers.dev/api/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ password })
    });

    const data = await res.json();

    if (!res.ok) {
        alert(data.error || "Login failed");
        return;
    }

    localStorage.setItem("adminToken", data.token);
    window.location.href = "admin.html";
});
