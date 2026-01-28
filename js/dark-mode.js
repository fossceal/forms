/* --- dark-mode.js --- */
(function () {
    function initDarkMode() {
        const toggleSelectors = ["#themeToggle", ".theme-toggle-btn", "[data-theme-toggle]"];
        const logo = document.querySelector(".club-logo-img");

        // Icons
        const moonIcon = '<i class="fa-solid fa-moon"></i>';
        const sunIcon = '<i class="fa-solid fa-sun"></i>';

        function updateUI(isDark) {
            // Apply theme to document and body
            if (isDark) {
                document.documentElement.setAttribute("data-theme", "dark");
                document.body.setAttribute("data-theme", "dark");
            } else {
                document.documentElement.removeAttribute("data-theme");
                document.body.removeAttribute("data-theme");
            }

            // Update all toggle elements found on the page
            toggleSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(btn => {
                    btn.innerHTML = isDark ? sunIcon : moonIcon;
                });
            });

            // LOGO LOGIC (Multi-Form Support)
            if (logo) {
                const ctxLight = window.formContext?.design?.logoLight;
                const ctxDark = window.formContext?.design?.logoDark;

                if (!ctxLight && !ctxDark) {
                    logo.style.display = "none";
                    const textWrapper = document.getElementById("headerTextWrapper");
                    if (textWrapper) textWrapper.style.marginLeft = "0";
                    return;
                }

                let lightSrc = ctxLight || ctxDark;
                let darkSrc = ctxDark || ctxLight;

                logo.src = isDark ? darkSrc : lightSrc;
                logo.style.display = "block";

                const textWrapper = document.getElementById("headerTextWrapper");
                if (textWrapper) {
                    textWrapper.style.marginLeft = "80px";
                }
            }
        }

        // 1. Initial State Check
        const savedTheme = localStorage.getItem("theme");
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        let isDark = savedTheme === "dark" || (!savedTheme && prefersDark);

        // Apply Initial State immediately
        updateUI(isDark);

        // 2. Delegate Click Events (handles dynamically added buttons)
        document.addEventListener("click", function (e) {
            const toggleBtn = e.target.closest(toggleSelectors.join(","));
            if (toggleBtn) {
                e.preventDefault();
                isDark = !isDark;
                localStorage.setItem("theme", isDark ? "dark" : "light");
                updateUI(isDark);
            }
        });

        // 3. Live Sync Across Tabs
        window.addEventListener('storage', (e) => {
            if (e.key === 'theme') {
                const newSavedTheme = localStorage.getItem("theme");
                isDark = newSavedTheme === "dark";
                updateUI(isDark);
            }
        });
    }

    // Immediate execution for theme application
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
        document.documentElement.setAttribute("data-theme", "dark");
    }

    // Run deep init when DOM is ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initDarkMode);
    } else {
        initDarkMode();
    }
})();
