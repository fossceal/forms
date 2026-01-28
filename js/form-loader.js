/* js/form-loader.js - Loads form context BEFORE form-logic.js */
import { API_BASE } from "./api.js";

// Make this async to handle fetching
(async function () {
    const urlParams = new URLSearchParams(window.location.search);
    const formSlug = urlParams.get('form');  // New slug-based parameter
    const formId = urlParams.get('id');      // Legacy ID parameter

    let savedForm = null;

    if (formSlug || formId) {
        // Fetch from backend API (single source of truth)
        const identifier = formSlug || formId;

        try {
            console.log("Fetching form config from backend for:", identifier);
            const res = await fetch(`${API_BASE}/api/forms/${identifier}`);
            if (res.ok) {
                savedForm = await res.json();
            } else {
                console.error("Form not found in backend:", res.status);
            }
        } catch (e) {
            console.error("Failed to fetch form config:", e);
        }

        if (savedForm) {
            window.formContext = {
                id: savedForm.id,
                slug: savedForm.slug,
                config: savedForm.config,
                formName: savedForm.name,
                status: savedForm.status || "open",
                design: savedForm.design
            };
            console.log("Loaded form context:", window.formContext);

            // Trigger DOM update manually since we might be async
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", updateDesign);
            } else {
                updateDesign();
            }

            // Also trigger form logic if it's already loaded
            if (typeof renderForm === 'function') renderForm();
            return;
        } else {
            // Form not found - show error
            console.error("Form not found");
            window.formContext = null;

            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", showFormNotFound);
            } else {
                showFormNotFound();
            }
            return;
        }
    }

    // No form ID/slug provided - show error
    console.warn("No form identifier provided");
    window.formContext = null;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", showFormNotFound);
    } else {
        showFormNotFound();
    }

})();

function showFormNotFound() {
    const formEl = document.getElementById("registrationForm");
    const closedMsg = document.getElementById("formClosedMessage");

    if (formEl) formEl.style.display = "none";
    if (closedMsg) {
        closedMsg.classList.add("show");
        const h2 = closedMsg.querySelector('h2');
        const p = closedMsg.querySelector('p');
        if (h2) h2.textContent = "Form Not Found";
        if (p) p.textContent = "This form does not exist or has been removed.";
    }
}


function updateDesign() {
    if (!window.formContext || !window.formContext.design) return;
    const design = window.formContext.design;

    // 1. Set Webpage Title (Tab Title) - HIGHEST PRIORITY
    if (design.webTitle && design.webTitle.trim() !== "") {
        document.title = design.webTitle;
    } else if (design.formTitle && design.formTitle.trim() !== "") {
        document.title = design.formTitle;
    } else {
        document.title = "Zeon Forms";
    }

    // 2. Set Form Header Title (The actual text on the page)
    const titleEl = document.getElementById("dynamicFormTitle");
    if (titleEl && design.formTitle) {
        titleEl.textContent = design.formTitle;
    }

    // 3. Set Form Description (subtitle)
    const descEl = document.getElementById("dynamicFormDescription");
    if (descEl && design.formDescription) {
        descEl.textContent = design.formDescription;
        descEl.style.display = "block";
    }

    // 4. Apply Banner
    if (design.banner) {
        document.documentElement.style.setProperty("--header-image-url", `url('${design.banner}')`);
    }

    // 5. Logo visibility and src
    const logoEl = document.getElementById("dynamicLogo");
    const textWrapper = document.getElementById("headerTextWrapper");
    const hasLogo = !!(design.logoLight || design.logoDark);

    if (logoEl && hasLogo) {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const isDark = currentTheme === 'dark';
        const lightSrc = design.logoLight || design.logoDark;
        const darkSrc = design.logoDark || design.logoLight;
        logoEl.src = isDark ? darkSrc : lightSrc;
        logoEl.style.display = "block";
    } else if (logoEl) {
        logoEl.style.display = "none";
    }

    if (textWrapper) {
        textWrapper.style.marginLeft = hasLogo ? "80px" : "0";
    }

    // 6. Theme Color
    if (design.themeColor) {
        document.documentElement.style.setProperty('--theme-primary', design.themeColor);
        document.documentElement.style.setProperty('--theme-primary-hover', design.themeColor);

        // Apply custom cursor if colors match (using timeout to ensure body exists)
        setTimeout(() => {
            const svg = `<svg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'><path d='M2 2 L14 28 L18 18 L28 14 L2 2 Z' fill='${design.themeColor}' stroke='white' stroke-width='1.5' fill-opacity='0.6' /></svg>`;
            const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}") 2 2, auto`;
            document.body.style.cursor = url;
        }, 0);
    }
}
