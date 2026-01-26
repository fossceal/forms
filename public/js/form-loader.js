/* js/* form-loader.js - Loads form context BEFORE form-logic.js */
(function () {
    const urlParams = new URLSearchParams(window.location.search);
    const formSlug = urlParams.get('form');  // New slug-based parameter
    const formId = urlParams.get('id');      // Legacy ID parameter

    if (formSlug || formId) {
        // Load from library using slug (preferred) or ID (backward compatibility)
        const library = JSON.parse(localStorage.getItem("savedFormsLibrary")) || [];
        let savedForm = null;

        if (formSlug) {
            savedForm = library.find(f => f.slug === formSlug);
        } else if (formId) {
            savedForm = library.find(f => f.id === formId);
        }

        if (savedForm) {
            window.formContext = {
                config: savedForm.config,
                scriptUrl: savedForm.scriptUrl,
                sheetName: savedForm.sheetTab,
                formName: savedForm.name,
                status: savedForm.status || "open", // Default to open for backward compatibility
                design: savedForm.design || {
                    formTitle: savedForm.name,
                    formDescription: "",
                    themeColor: "#db4437",
                    banner: null,
                    logoLight: null,
                    logoDark: null
                }
            };
            console.log("Loaded form from library:", savedForm.name);
            console.log("Form config:", savedForm.config);
            console.log("Sheet tab:", savedForm.sheetTab);
            console.log("Design:", window.formContext.design);
        } else {
            console.warn("Form ID not found in library:", formId);
            // Fallback to localStorage
            window.formContext = {
                config: JSON.parse(localStorage.getItem("formConfig")) || [],
                scriptUrl: localStorage.getItem("globalSheetUrl") || "",
                sheetName: localStorage.getItem("sheetName") || "",
                status: "open", // Default to open
                design: {
                    formTitle: "Registration Form",
                    formDescription: "",
                    themeColor: localStorage.getItem("themeColor") || "#db4437",
                    banner: localStorage.getItem("headerBanner"),
                    logoLight: localStorage.getItem("clubLogoLight"),
                    logoDark: localStorage.getItem("clubLogoDark")
                }
            };
        }
    } else {
        // No ID provided, use current localStorage state
        window.formContext = {
            config: JSON.parse(localStorage.getItem("formConfig")) || [],
            scriptUrl: localStorage.getItem("globalSheetUrl") || "",
            sheetName: localStorage.getItem("sheetName") || "",
            status: "open", // Default to open
            design: {
                formTitle: "Registration Form",
                formDescription: "",
                themeColor: localStorage.getItem("themeColor") || "#db4437",
                banner: localStorage.getItem("headerBanner"),
                logoLight: localStorage.getItem("clubLogoLight"),
                logoDark: localStorage.getItem("clubLogoDark")
            }
        };
        console.log("No form ID, using localStorage");
    }
})();


// 2. DOM Updates (Run on Loaded)
document.addEventListener("DOMContentLoaded", () => {

    // Apply Design Settings
    if (window.formContext && window.formContext.design) {
        const design = window.formContext.design;

        // Set Form Title
        const titleEl = document.getElementById("dynamicFormTitle");
        if (titleEl && design.formTitle) {
            titleEl.textContent = design.formTitle;
        }

        // Set Form Description (subtitle)
        const descEl = document.getElementById("dynamicFormDescription");
        if (descEl && design.formDescription) {
            descEl.textContent = design.formDescription;
            descEl.style.display = "block";
        }

        // Apply Banner and Logo Spacing
        const logoEl = document.getElementById("dynamicLogo");
        const textWrapper = document.getElementById("headerTextWrapper");

        if (design.banner) {
            document.documentElement.style.setProperty("--header-image-url", `url('${design.banner}')`);
        }

        // We only handle visibility/spacing here; dark-mode.js will set the correct src 
        // based on the current theme (light vs dark) immediately after this.
        const hasLogo = !!(design.logoLight || design.logoDark || localStorage.getItem("clubLogoLight") || localStorage.getItem("clubLogo"));

        if (logoEl) logoEl.style.display = hasLogo ? "block" : "none";
        if (textWrapper) textWrapper.style.marginLeft = hasLogo ? "80px" : "0";

        // Apply Theme Color
        if (design.themeColor) {
            document.documentElement.style.setProperty('--theme-primary', design.themeColor);
            document.documentElement.style.setProperty('--theme-primary-hover', design.themeColor);

            // Custom Cursor
            const svg = `<svg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'><path d='M2 2 L14 28 L18 18 L28 14 L2 2 Z' fill='${design.themeColor}' stroke='white' stroke-width='1.5' fill-opacity='0.6' /></svg>`;
            const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}") 2 2, auto`;
            document.body.style.cursor = url;
        }
    }
});
