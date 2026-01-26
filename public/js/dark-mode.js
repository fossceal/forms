/* --- dark-mode.js --- */
(function () {
    function initDarkMode() {
        const themeToggle = document.getElementById("themeToggle");
        const logo = document.querySelector(".club-logo-img");

        // Icons
        const moonIcon = '<i class="fa-solid fa-moon"></i>';
        const sunIcon = '<i class="fa-solid fa-sun"></i>';

        function updateUI(isDark) {
            // Standard UX: Show Sun in Dark Mode (to go light), Moon in Light Mode (to go dark)
            if (themeToggle) themeToggle.innerHTML = isDark ? sunIcon : moonIcon;

            // Sync with root and body (Better variable scope and compatibility)
            if (isDark) {
                document.documentElement.setAttribute("data-theme", "dark");
                document.body.setAttribute("data-theme", "dark");
            } else {
                document.documentElement.removeAttribute("data-theme");
                document.body.removeAttribute("data-theme");
            }

            // LOGO LOGIC (Multi-Form Support)
            if (logo) {
                // 1. Get Logos from Form Context (Specific to this form)
                const ctxLight = window.formContext?.design?.logoLight;
                const ctxDark = window.formContext?.design?.logoDark;

                // 2. Get Logos from Global Storage (Admin Workspace)
                const globalLight = localStorage.getItem("clubLogoLight");
                const globalDark = localStorage.getItem("clubLogoDark");
                const globalLegacy = localStorage.getItem("clubLogo");

                // Determine effective logos for both modes
                // Form Specific -> Global -> Legacy -> Default
                let lightSrc = ctxLight || globalLight || globalLegacy || "foss_light.png";
                let darkSrc = ctxDark || globalDark || globalLegacy || "foss_dark.png";

                // Robust Cross-Mode Fallback: 
                // If light is default but dark is custom, use dark for light.
                // If dark is default but light is custom, use light for dark.
                const isDefaultLight = lightSrc.includes("foss_light.png");
                const isDefaultDark = darkSrc.includes("foss_dark.png");

                if (isDefaultLight && !isDefaultDark) lightSrc = darkSrc;
                if (isDefaultDark && !isDefaultLight) darkSrc = lightSrc;

                // Apply correct source based on theme
                logo.src = isDark ? darkSrc : lightSrc;

                // Visibility logic
                const noLogo = !logo.src || logo.src.includes("foss_light.png") || logo.src.includes("foss_dark.png");
                logo.style.display = noLogo ? "none" : "block";

                // Adjust text wrapper if on form page
                const textWrapper = document.getElementById("headerTextWrapper");
                if (textWrapper) {
                    textWrapper.style.marginLeft = noLogo ? "0" : "80px";
                }
            }
        }

        // 1. Check Storage
        const savedTheme = localStorage.getItem("theme");
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

        let isDark = savedTheme === "dark" || (!savedTheme && prefersDark);

        // Apply Initial State
        updateUI(isDark);

        // 2. Click Handler
        if (themeToggle) {
            themeToggle.onclick = function (e) {
                e.preventDefault();
                isDark = !isDark;
                localStorage.setItem("theme", isDark ? "dark" : "light");
                updateUI(isDark);
            };
        }

        // 3. Live Sync (Cross-Tab / Admin Updates)
        window.addEventListener('storage', (e) => {
            if (['theme', 'clubLogo', 'clubLogoLight', 'clubLogoDark'].includes(e.key)) {
                const newSavedTheme = localStorage.getItem("theme");
                if (newSavedTheme) {
                    isDark = newSavedTheme === "dark";
                }
                updateUI(isDark);
            }
        });
    }

    // Run when DOM is ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initDarkMode);
    } else {
        initDarkMode();
    }
})();
