/* js/admin.js */
document.addEventListener("DOMContentLoaded", () => {
    // SECURITY: Authenticate User
    const token = localStorage.getItem("adminToken");
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    // AUTH INTERCEPTOR: Handle 401s globally
    const { fetch: originalFetch } = window;
    window.fetch = async (...args) => {
        let [resource, config] = args;
        config = config || {};

        // Attach Token
        const token = localStorage.getItem("adminToken");
        if (token) {
            config.headers = {
                ...config.headers,
                "Authorization": `Bearer ${token}`
            };
        }

        const response = await originalFetch(resource, config);

        if (response.status === 401 || response.status === 403) {
            // Token expired, invalid, or forbidden
            localStorage.removeItem("adminToken");
            window.location.href = "login.html";
        }

        return response;
    };


    // Standard Theme Sync
    const adminThemeToggle = document.getElementById("adminThemeToggle");
    const initAdminTheme = () => {
        const savedTheme = localStorage.getItem("theme") || "light";
        const isDark = savedTheme === "dark";
        if (isDark) {
            document.documentElement.setAttribute("data-theme", "dark");
            document.body.setAttribute("data-theme", "dark");
            if (adminThemeToggle) adminThemeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
        } else {
            document.documentElement.removeAttribute("data-theme");
            document.body.removeAttribute("data-theme");
            if (adminThemeToggle) adminThemeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
        }
    };
    initAdminTheme();

    if (adminThemeToggle) {
        adminThemeToggle.onclick = () => {
            const isDark = document.documentElement.getAttribute("data-theme") === "dark";
            const newTheme = isDark ? "light" : "dark";
            localStorage.setItem("theme", newTheme);
            initAdminTheme();
        };
    }

    // --- UI REFERENCES (Top Level) ---
    const builderList = document.getElementById("fieldBuilderList");
    const colorPicker = document.getElementById("themeColorPicker");
    const colorValue = document.getElementById("colorValue");
    const whatsappInput = document.getElementById("whatsappLinkInput");
    const bannerUpload = document.getElementById("bannerUpload");
    const removeBannerBtn = document.getElementById("removeBanner");

    const logoLight = document.getElementById("logoLightUpload");
    const logoDark = document.getElementById("logoDarkUpload");
    const manageLogoBtn = document.getElementById("manageLogoBtn");
    const removeLogosBtn = document.getElementById("removeLogosBtn");

    const editorSidebar = document.getElementById("editorSidebar");
    const sidebarOverlay = document.getElementById("sidebarOverlay");
    const closeSidebarBtn = document.querySelector(".close-sidebar");

    const openAddSidebarBtn = document.getElementById("openAddSidebarBtn");
    const saveFieldBtn = document.getElementById("saveFieldBtn");
    const deleteFieldBtn = document.getElementById("deleteFieldBtn");

    const editLabel = document.getElementById("editLabel");
    const editType = document.getElementById("editType");
    const editRequired = document.getElementById("editRequired");
    const editLinkUrl = document.getElementById("editLinkUrl");
    const linkUrlContainer = document.getElementById("linkUrlContainer");

    const optionsContainer = document.getElementById("optionsContainer");
    const optionsList = document.getElementById("optionsList");
    const addOptionBtn = document.getElementById("addOptionBtn");

    // --- FORM LIBRARY REFERENCES ---
    const formsLibraryList = document.getElementById("formsLibraryList");
    const saveToLibraryBtn = document.getElementById("saveToLibraryBtn");
    const refreshLibraryBtn = document.getElementById("refreshLibraryBtn");

    // --- TRACK CURRENT FORM & DESIGN (Must be before restoreState) ---
    let currentFormId = null;
    let currentDesign = {
        formTitle: "",
        formDescription: "",
        themeColor: localStorage.getItem("themeColor") || "#db4437",
        banner: localStorage.getItem("headerBanner"),
        logoLight: localStorage.getItem("clubLogoLight"),
        logoDark: localStorage.getItem("clubLogoDark")
    };

    // --- STATE RESTORATION ---
    restoreState();
    renderLibrary(); // Initial render of my forms

    function restoreState() {
        // 1. Theme - Load from current design state
        if (colorPicker) colorPicker.value = currentDesign.themeColor;
        if (colorValue) colorValue.innerText = currentDesign.themeColor;

        // 2. Form Title & Description
        const formTitleInput = document.getElementById("formTitleInput");
        const formDescInput = document.getElementById("formDescriptionInput");
        if (formTitleInput) formTitleInput.value = currentDesign.formTitle;
        if (formDescInput) formDescInput.value = currentDesign.formDescription;

        // 3. Builder
        const storedFields = localStorage.getItem("formConfig");
        let fields = storedFields ? JSON.parse(storedFields) : [];
        if (fields.length === 0) {
            fields = [
                { label: "Full Name", type: "text", required: true, id: "fullname" },
                { label: "Email", type: "email", required: true, id: "email" },
                { label: "Phone Number", type: "tel", required: true, id: "phone" }
            ];
            saveFields(fields);
        }
        renderFieldBuilder(fields);
    }

    // --- FORM LIBRARY LOGIC ---

    function getLibrary() {
        return JSON.parse(localStorage.getItem("savedFormsLibrary")) || [];
    }

    // Generate URL-safe slug from form name
    function generateSlug(name) {
        const baseSlug = name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with hyphens
            .replace(/^-+|-+$/g, '');      // Remove leading/trailing hyphens

        // Check for uniqueness
        const library = getLibrary();
        let slug = baseSlug;
        let counter = 1;

        while (library.some(f => f.slug === slug && f.id !== currentFormId)) {
            slug = `${baseSlug}-${counter}`;
            counter++;
        }

        return slug || 'form'; // Fallback if name is empty
    }

    function saveToLibrary() {
        // Collect current design settings
        const formTitleInput = document.getElementById("formTitleInput");
        const formDescInput = document.getElementById("formDescriptionInput");
        const themeColorPicker = document.getElementById("themeColorPicker");

        currentDesign.formTitle = formTitleInput ? formTitleInput.value : "";
        currentDesign.formDescription = formDescInput ? formDescInput.value : "";
        currentDesign.themeColor = themeColorPicker ? themeColorPicker.value : "#db4437";

        // Auto-generate tab name from form title
        const formTitle = currentDesign.formTitle || "Untitled Form";
        const autoTabName = formTitle
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')  // Replace non-alphanumeric with underscore
            .replace(/^_+|_+$/g, '');      // Remove leading/trailing underscores

        const currentSheetName = autoTabName || "untitled_form";

        const rawFields = localStorage.getItem("formConfig");
        const fields = rawFields ? JSON.parse(rawFields) : [];

        localStorage.setItem("sheetName", currentSheetName);

        const library = getLibrary();

        // Check if we're updating an existing form
        if (currentFormId) {
            const existingIndex = library.findIndex(f => f.id === currentFormId);
            if (existingIndex !== -1) {
                // Update existing form - regenerate slug if name changed
                const slug = generateSlug(formTitle);
                library[existingIndex] = {
                    ...library[existingIndex],
                    slug: slug,
                    sheetTab: currentSheetName,
                    scriptUrl: localStorage.getItem("globalSheetUrl") || "",
                    spreadsheetUrl: localStorage.getItem("spreadsheetUrl") || "",
                    config: fields,
                    design: { ...currentDesign }, // Save design settings
                    status: library[existingIndex].status || "open", // Preserve existing status or default to open
                    date: new Date().toLocaleDateString()
                };
            } else {
                // Form ID doesn't exist anymore, create new
                currentFormId = Date.now().toString();
                const slug = generateSlug(formTitle);
                library.push({
                    id: currentFormId,
                    slug: slug,
                    name: currentSheetName || "Untitled Form",
                    sheetTab: currentSheetName,
                    scriptUrl: localStorage.getItem("globalSheetUrl") || "",
                    spreadsheetUrl: localStorage.getItem("spreadsheetUrl") || "",
                    config: fields,
                    design: { ...currentDesign },
                    status: "open", // New forms are open by default
                    date: new Date().toLocaleDateString()
                });
            }
        } else {
            // Create new form
            currentFormId = Date.now().toString();
            const slug = generateSlug(formTitle);
            library.push({
                id: currentFormId,
                slug: slug,
                name: currentSheetName || "Untitled Form",
                sheetTab: currentSheetName,
                scriptUrl: localStorage.getItem("globalSheetUrl") || "",
                spreadsheetUrl: localStorage.getItem("spreadsheetUrl") || "",
                config: fields,
                design: { ...currentDesign },
                status: "open", // New forms are open by default
                date: new Date().toLocaleDateString()
            });
        }

        localStorage.setItem("savedFormsLibrary", JSON.stringify(library));
        renderLibrary();

        // Show quick feedback
        const btn = document.getElementById("saveToLibraryBtn");
        if (btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
            btn.style.background = '#22c55e';
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.style.background = '';
            }, 1500);
        }

        // Hide builder section after save
        const builderSection = document.getElementById("builder");
        if (builderSection) {
            builderSection.style.display = "none";
            builderSection.classList.remove("active");
        }

        // Remove Form Builder from navigation
        removeBuilderFromNav();

        // Switch to "My Forms" Tab
        document.querySelector('[data-tab="library"]').click();
    }

    function deleteFromLibrary(id) {
        showModal({
            title: "Delete Form",
            message: "Delete this saved form permanently?",
            confirmText: "Delete",
            onConfirm: () => {
                const library = getLibrary();
                const newLib = library.filter(f => f.id !== id);
                localStorage.setItem("savedFormsLibrary", JSON.stringify(newLib));
                renderLibrary();
            }
        });
    }

    function loadFromLibrary(id) {
        showModal({
            title: "Load Form",
            message: "This will overwrite your current workspace. Unsaved changes will be lost.",
            confirmText: "Load",
            onConfirm: () => {
                const library = getLibrary();
                const form = library.find(f => f.id === id);
                if (!form) return;

                // Set current form ID so saves update instead of duplicate
                currentFormId = id;

                // Load design settings
                if (form.design) {
                    currentDesign = { ...form.design };
                } else {
                    // Backward compatibility - use defaults
                    currentDesign = {
                        formTitle: form.name || "",
                        formDescription: "",
                        themeColor: "#db4437",
                        banner: null,
                        logoLight: null,
                        logoDark: null
                    };
                }

                // Apply design to UI
                const formTitleInput = document.getElementById("formTitleInput");
                const formDescInput = document.getElementById("formDescriptionInput");
                const themeColorPicker = document.getElementById("themeColorPicker");
                const colorValue = document.getElementById("colorValue");

                if (formTitleInput) formTitleInput.value = currentDesign.formTitle;
                if (formDescInput) formDescInput.value = currentDesign.formDescription;
                if (themeColorPicker) themeColorPicker.value = currentDesign.themeColor;
                if (colorValue) colorValue.innerText = currentDesign.themeColor;

                // Apply banner and logos to preview
                if (currentDesign.banner) {
                    document.documentElement.style.setProperty("--header-image-url", `url('${currentDesign.banner}')`);
                } else {
                    document.documentElement.style.setProperty("--header-image-url", "none");
                }

                // Apply form config
                localStorage.setItem("formConfig", JSON.stringify(form.config));
                localStorage.setItem("sheetName", form.sheetTab);
                if (form.scriptUrl) localStorage.setItem("globalSheetUrl", form.scriptUrl);
                if (form.spreadsheetUrl) localStorage.setItem("spreadsheetUrl", form.spreadsheetUrl);

                // Update UI
                if (document.getElementById("scriptUrlInput") && form.scriptUrl) document.getElementById("scriptUrlInput").value = form.scriptUrl;
                if (document.getElementById("spreadsheetUrlInput") && form.spreadsheetUrl) document.getElementById("spreadsheetUrlInput").value = form.spreadsheetUrl;
                renderFieldBuilder(form.config);

                // Show builder section and add to navigation
                const builderSection = document.getElementById("builder");
                if (builderSection) {
                    builderSection.style.display = "block";
                    builderSection.classList.add("active");
                }

                // Add Form Builder to navigation if not present
                addBuilderToNav();

                // Switch to Builder
                document.querySelector('[data-tab="builder"]').click();
            }
        });
    }

    function renderLibrary() {
        if (!formsLibraryList) return;
        const library = getLibrary();

        if (library.length === 0) {
            formsLibraryList.innerHTML = `
                <div style="text-align:center; padding:40px; color:#999; grid-column: 1/-1;">
                    <i class="fa-regular fa-folder-open" style="font-size:2rem; margin-bottom:10px;"></i>
                    <p>No saved forms yet.</p>
                </div>`;
            return;
        }

        formsLibraryList.innerHTML = "";
        library.forEach(form => {
            // Ensure backward compatibility - set status to "open" if not present
            const formStatus = form.status || "open";
            const isOpen = formStatus === "open";

            const statusBadgeColor = isOpen ? "#22c55e" : "#ef4444";
            const statusBadgeText = isOpen ? "Open" : "Closed";
            const statusIcon = isOpen ? "fa-circle-check" : "fa-circle-xmark";

            // Generate slug if missing (backward compatibility)
            if (!form.slug) {
                form.slug = generateSlug(form.name);
                localStorage.setItem("savedFormsLibrary", JSON.stringify(library));
            }

            const card = document.createElement("div");
            card.className = "forms-library-card";
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:15px;">
                    <div>
                        <h4 style="margin:0; font-size:1.1rem; color:var(--text-main);">${form.name}</h4>
                        <p style="margin:5px 0 0; font-size:0.85rem; color:var(--text-secondary);">Slug: <code>${form.slug}</code></p>
                        <p style="margin:2px 0 0; font-size:0.8rem; color:var(--text-muted); opacity: 0.7;">${form.config.length} fields • ${form.date}</p>
                    </div>
                    <span class="status-badge" style="background:${statusBadgeColor};">
                        <i class="fa-solid ${statusIcon}"></i> ${statusBadgeText}
                    </span>
                </div>
                <div style="display:flex; gap:10px; margin-bottom:10px;">
                     <button class="btn btn-sm btn-outline-secondary copy-link-btn" data-slug="${form.slug}" style="flex:1;" title="Copy Live Link"><i class="fa-regular fa-copy"></i> Link</button>
                     <a href="event-form.html?form=${form.slug}" target="_blank" class="btn btn-sm btn-outline-secondary" style="flex:1; text-align:center; text-decoration:none;"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open</a>
                </div>
                <div style="display:flex; gap:10px; margin-bottom:10px;">
                    <button class="btn btn-sm ${isOpen ? 'btn-outline-danger' : 'btn-outline-success'} toggle-status-btn" data-id="${form.id}" style="flex:1;">
                         <i class="fa-solid ${isOpen ? 'fa-lock' : 'fa-lock-open'}"></i> ${isOpen ? 'Close Form' : 'Open Form'}
                    </button>
                </div>
                <div style="display:flex; gap:10px; margin-top:auto;">
                    <button class="btn btn-sm btn-outline-primary load-btn" data-id="${form.id}" style="flex:1;"><i class="fa-solid fa-upload"></i> Load to Edit</button>
                    <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${form.id}"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            formsLibraryList.appendChild(card);
        });
    }


    // Toggle Form Status (Open/Close)
    function toggleFormStatus(id) {
        const library = getLibrary();
        const formIndex = library.findIndex(f => f.id === id);

        if (formIndex === -1) return;

        const currentStatus = library[formIndex].status || "open";
        const newStatus = currentStatus === "open" ? "closed" : "open";

        library[formIndex].status = newStatus;
        localStorage.setItem("savedFormsLibrary", JSON.stringify(library));
        renderLibrary();

        // Show feedback
        const statusText = newStatus === "open" ? "opened" : "closed";
        console.log(`Form ${library[formIndex].name} has been ${statusText}`);
    }


    // Event Delegation for Library List (More Robust)
    if (formsLibraryList) {
        formsLibraryList.addEventListener("click", (e) => {
            const btn = e.target.closest("button");
            if (!btn) return;

            const id = btn.dataset.id;
            const slug = btn.dataset.slug;
            if (!id && !slug && !btn.classList.contains('load-btn')) return; // Some buttons might not have ID if not related

            if (btn.classList.contains("load-btn")) {
                loadFromLibrary(id);
            } else if (btn.classList.contains("delete-btn")) {
                deleteFromLibrary(id);
            } else if (btn.classList.contains("toggle-status-btn")) {
                toggleFormStatus(id);
            } else if (btn.classList.contains("copy-link-btn")) {
                const url = window.location.origin + window.location.pathname.replace("admin.html", "event-form.html") + "?form=" + slug;
                navigator.clipboard.writeText(url).then(() => {
                    // Quick Feedback
                    const originalHTML = btn.innerHTML;
                    btn.innerHTML = `<i class="fa-solid fa-check"></i> Copied`;
                    setTimeout(() => btn.innerHTML = originalHTML, 1500);
                });
            }
        });
    }

    if (saveToLibraryBtn) saveToLibraryBtn.onclick = saveToLibrary;
    if (refreshLibraryBtn) refreshLibraryBtn.onclick = renderLibrary;

    window.saveStateToLibrary = saveToLibrary; // Expose for debugging if needed

    // --- TABS LOGIC ---
    const navItems = document.querySelectorAll(".nav-item");
    const tabPanes = document.querySelectorAll(".tab-pane");

    navItems.forEach(item => {
        item.addEventListener("click", () => {
            navItems.forEach(n => n.classList.remove("active"));
            item.classList.add("active");
            const target = item.dataset.tab;

            tabPanes.forEach(p => {
                p.classList.remove("active");
                if (p.id === target) {
                    p.classList.add("active");
                }
            });
        });
    });


    // --- HELPER: ADD/REMOVE BUILDER FROM NAV ---
    function addBuilderToNav() {
        const navLinks = document.querySelector(".nav-links");
        const existingBuilderNav = document.querySelector('[data-tab="builder"]');

        if (!existingBuilderNav && navLinks) {
            const builderNavItem = document.createElement("li");
            builderNavItem.className = "nav-item";
            builderNavItem.setAttribute("data-tab", "builder");
            builderNavItem.innerHTML = '<i class="fa-solid fa-hammer"></i> Form Builder';

            // Insert between "My Forms" and "Connect & Save"
            const integrationsNav = document.querySelector('[data-tab="integrations"]');
            if (integrationsNav) {
                navLinks.insertBefore(builderNavItem, integrationsNav);
            } else {
                navLinks.appendChild(builderNavItem);
            }

            // Add click listener
            builderNavItem.addEventListener("click", () => {
                const allNavItems = document.querySelectorAll(".nav-item");
                allNavItems.forEach(n => n.classList.remove("active"));
                builderNavItem.classList.add("active");

                const allTabPanes = document.querySelectorAll(".tab-pane");
                allTabPanes.forEach(p => {
                    p.classList.remove("active");
                    if (p.id === "builder") {
                        p.classList.add("active");
                    }
                });
            });
        }
    }

    function removeBuilderFromNav() {
        const builderNavItem = document.querySelector('[data-tab="builder"]');
        if (builderNavItem) {
            builderNavItem.remove();
        }
    }

    // --- SAVE HELPERS ---
    function saveFields(fields) {
        localStorage.setItem("formConfig", JSON.stringify(fields));
    }

    // --- THEME & INTEGRATION LISTENERS ---
    if (colorPicker) {
        colorPicker.addEventListener("input", (e) => {
            const val = e.target.value;
            localStorage.setItem("themeColor", val);
            if (colorValue) colorValue.innerText = val;
        });
    }

    if (whatsappInput) whatsappInput.addEventListener("input", (e) => localStorage.setItem("whatsappLink", e.target.value));

    // Script URL Logic
    if (scriptUrlInput) {
        scriptUrlInput.value = localStorage.getItem("globalSheetUrl") || "";

        const autoFetchSheet = async (url) => {
            if (!url || !url.includes("script.google.com")) return;

            // Visual feedback
            const originalPlaceholder = document.getElementById("spreadsheetUrlInput").placeholder;
            document.getElementById("spreadsheetUrlInput").placeholder = "Auto-detecting Sheet URL...";

            try {
                const response = await fetch(url);
                const data = await response.json();

                if (data.result === "success" && data.sheetUrl) {
                    if (spreadsheetUrlInput) {
                        spreadsheetUrlInput.value = data.sheetUrl;
                        localStorage.setItem("spreadsheetUrl", data.sheetUrl);
                        // Optional: Flash success
                        spreadsheetUrlInput.style.borderColor = "#4caf50"; // Green
                        setTimeout(() => spreadsheetUrlInput.style.borderColor = "var(--border)", 2000);
                    }
                }
            } catch (e) {
                console.warn("Auto-discovery failed. CORS or script error.", e);
            } finally {
                document.getElementById("spreadsheetUrlInput").placeholder = originalPlaceholder;
            }
        };

        scriptUrlInput.addEventListener("input", (e) => {
            const val = e.target.value.trim();
            localStorage.setItem("globalSheetUrl", val);
            // Debounce or just wait for blur? Blur is safer for network
        });

        scriptUrlInput.addEventListener("blur", (e) => {
            const val = e.target.value.trim();
            // Only auto-fetch if Sheet URL is empty to avoid overwriting user
            const currentSheet = spreadsheetUrlInput ? spreadsheetUrlInput.value : "";
            if (val && !currentSheet) {
                autoFetchSheet(val);
            }
        });
    }

    // Spreadsheet URL Logic
    const spreadsheetUrlInput = document.getElementById("spreadsheetUrlInput");
    const testSheetBtn = document.getElementById("testSheetBtn");

    if (spreadsheetUrlInput) {
        spreadsheetUrlInput.value = localStorage.getItem("spreadsheetUrl") || "";
        spreadsheetUrlInput.addEventListener("input", (e) => localStorage.setItem("spreadsheetUrl", e.target.value));
    }

    if (testSheetBtn) {
        testSheetBtn.addEventListener("click", () => {
            const url = spreadsheetUrlInput ? spreadsheetUrlInput.value.trim() : "";

            if (!url) return alert("Please paste your Google Sheet URL first.");

            if (url.includes("script.google.com")) {
                return showModal({
                    title: "Wrong URL Type",
                    message: "It looks like you pasted the 'Script URL' here. This box is for the 'Google Sheet URL' (docs.google.com...).\n\nPlease paste the link to your Spreadsheet instead.",
                    confirmText: "OK",
                    onConfirm: () => { } // Just close
                });
            }

            if (url.startsWith("http://") || url.startsWith("https://")) {
                window.open(url, "_blank");
            } else {
                alert("Please enter a valid URL starting with https://");
            }
        });
    }

    // Target Page (Tab Name) Logic
    const sheetNameInput = document.getElementById("sheetNameInput");
    const newTargetBtn = document.getElementById("newTargetBtn");

    if (sheetNameInput) {
        sheetNameInput.value = localStorage.getItem("sheetName") || "";
        sheetNameInput.addEventListener("input", (e) => localStorage.setItem("sheetName", e.target.value));
    }

    if (newTargetBtn) {
        newTargetBtn.addEventListener("click", () => {
            showModal({
                title: "Create New Form",
                message: "Enter a unique Tab Name for this form.\n\nThis will be:\n✓ The name in your 'My Forms' list\n✓ The tab name in your Google Sheet where data is saved\n\nExamples: workshop_2025, event_registration, feedback_form\n\n(Use underscores instead of spaces)",
                showInput: true,
                defaultValue: "",
                confirmText: "Create Form",
                onConfirm: (tabName) => {
                    if (!tabName || tabName.trim() === "") {
                        alert("Please enter a Tab Name to create the form!");
                        return;
                    }

                    const finalName = tabName.trim();
                    const finalTab = finalName.replace(/\s+/g, '_').toLowerCase(); // Sanitize

                    // 1. Set the Tab Name in UI and Storage
                    if (sheetNameInput) {
                        sheetNameInput.value = finalTab;
                    }
                    localStorage.setItem("sheetName", finalTab);

                    if (document.getElementById("whatsappLinkInput")) {
                        document.getElementById("whatsappLinkInput").value = "";
                    }
                    localStorage.removeItem("whatsappLink");

                    // Keep Script URL as it's often global/reused
                    const scriptUrl = localStorage.getItem("globalSheetUrl") || "";

                    // 2. Reset Builder to Default
                    const defaultFields = [
                        { label: "Full Name", type: "text", required: true, id: "fullname" },
                        { label: "Email", type: "email", required: true, id: "email" },
                        { label: "Phone Number", type: "tel", required: true, id: "phone" }
                    ];
                    saveFields(defaultFields);
                    renderFieldBuilder(defaultFields);

                    // 3. AUTO-SAVE to Library
                    const library = getLibrary();
                    currentFormId = Date.now().toString(); // Set the ID for this new form

                    // Initialize default design
                    currentDesign = {
                        formTitle: finalName,
                        formDescription: "",
                        themeColor: "#db4437",
                        banner: null,
                        logoLight: null,
                        logoDark: null
                    };

                    const newEntry = {
                        id: currentFormId,
                        name: finalName,
                        sheetTab: finalTab, // THIS is what determines the Google Sheet tab!
                        scriptUrl: scriptUrl,
                        config: defaultFields,
                        design: { ...currentDesign },
                        status: "open", // New forms are open by default
                        date: new Date().toLocaleDateString()
                    };
                    library.push(newEntry);
                    localStorage.setItem("savedFormsLibrary", JSON.stringify(library));
                    renderLibrary(); // Update the list immediately

                    // Restore UI with new design
                    restoreState();

                    // Show builder section and add to navigation
                    const builderSection = document.getElementById("builder");
                    if (builderSection) {
                        builderSection.style.display = "block";
                        builderSection.classList.add("active");
                    }

                    // Add Form Builder to navigation
                    addBuilderToNav();

                    // 4. Switch to Builder Tab
                    document.querySelector('[data-tab="builder"]').click();
                }
            });
        });
    }

    // --- BANNER UPLOAD ---
    if (bannerUpload) {
        bannerUpload.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                const base64 = ev.target.result;
                currentDesign.banner = base64;
                localStorage.setItem("headerBanner", base64);
                document.documentElement.style.setProperty("--header-image-url", `url('${base64}')`);
            };
            reader.readAsDataURL(file);
        });
    }

    if (removeBannerBtn) {
        removeBannerBtn.addEventListener("click", () => {
            currentDesign.banner = null;
            localStorage.removeItem("headerBanner");
            document.documentElement.style.setProperty("--header-image-url", "none");
        });
    }

    // --- LOGO UPLOAD ---
    function saveGlobalLogo(file, key) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const base64 = evt.target.result;
            localStorage.setItem(key, base64);

            // Save to currentDesign
            if (key === "clubLogoLight") {
                currentDesign.logoLight = base64;
            } else if (key === "clubLogoDark") {
                currentDesign.logoDark = base64;
            }

            alert("Logo updated!");
        }
        reader.readAsDataURL(file);
    }

    if (logoLight) logoLight.addEventListener("change", (e) => saveGlobalLogo(e.target.files[0], "clubLogoLight"));
    if (logoDark) logoDark.addEventListener("change", (e) => saveGlobalLogo(e.target.files[0], "clubLogoDark"));

    if (manageLogoBtn) {
        manageLogoBtn.onclick = () => {
            const sec = document.getElementById("logoUploadSection");
            const isHidden = sec.style.display === "none";
            sec.style.display = isHidden ? "block" : "none";
            manageLogoBtn.innerHTML = isHidden ? '<i class="fa-solid fa-chevron-up"></i> Hide Logo Options' : '<i class="fa-solid fa-image"></i> Manage / Upload Logo';
        };
    }

    if (removeLogosBtn) {
        removeLogosBtn.onclick = () => {
            showModal({
                title: "Remove Logos",
                message: "Are you sure you want to remove all uploaded logos?",
                confirmText: "Remove",
                onConfirm: () => {
                    currentDesign.logoLight = null;
                    currentDesign.logoDark = null;
                    localStorage.removeItem("clubLogoLight");
                    localStorage.removeItem("clubLogoDark");
                    alert("Logos removed.");
                }
            });
        };
    }
    // --- BUILDER RENDERER ---
    function renderFieldBuilder(fields) {
        if (!builderList) return;
        builderList.innerHTML = "";
        fields.forEach((field, index) => {
            const item = document.createElement("div");
            item.className = "builder-item";
            item.draggable = true;
            item.dataset.index = index;

            // Icon Logic
            let iconHtml = "";
            let metaHtml = `<span style="color:#666; font-size:0.85rem; margin-left:8px;">(${field.type})</span>`;

            if (field.type === 'success_link') {
                iconHtml = `<i class="fa-brands fa-whatsapp" style="color:#25D366; margin-right:8px;"></i>`;
                metaHtml = `<span style="background:#dcfce7; color:#166534; font-size:0.75rem; padding:2px 6px; border-radius:4px; margin-left:8px;">Success Page Only</span>`;
            }

            item.innerHTML = `
                <div style="display:flex; align-items:center;">
                    <span class="drag-handle"><i class="fa-solid fa-grip-vertical"></i></span>
                    ${iconHtml}
                    <span style="font-weight:500;">${field.label}</span>
                    ${metaHtml}
                    ${field.required ? '<span style="color:red; margin-left:4px;">*</span>' : ''}
                </div>
                <div class="builder-actions">
                     <button class="edit-field" onclick="openEditor(${index})" title="Edit"><i class="fa-solid fa-pen"></i></button>
                </div>
            `;
            item.addEventListener('dragstart', handleDragStart);
            item.addEventListener('dragover', handleDragOver);
            item.addEventListener('drop', handleDrop);
            item.addEventListener('dragenter', handleDragEnter);
            item.addEventListener('dragleave', handleDragLeave);
            builderList.appendChild(item);
        });
    }

    // Drag & Drop
    let dragSrcEl = null;
    function handleDragStart(e) { dragSrcEl = this; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/html', this.innerHTML); this.classList.add('dragging'); }
    function handleDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; return false; }
    function handleDragEnter(e) { this.classList.add('over'); }
    function handleDragLeave(e) { this.classList.remove('over'); }
    function handleDrop(e) {
        if (e.stopPropagation) e.stopPropagation();
        if (dragSrcEl !== this) {
            const srcIdx = parseInt(dragSrcEl.dataset.index);
            const destIdx = parseInt(this.dataset.index);

            const raw = localStorage.getItem("formConfig");
            const fields = raw ? JSON.parse(raw) : [];

            const movedItem = fields[srcIdx];
            fields.splice(srcIdx, 1);
            fields.splice(destIdx, 0, movedItem);

            saveFields(fields);
            renderFieldBuilder(fields);
        }
        return false;
    }


    // --- SIDEBAR EDITOR ---
    function openSidebar() { if (editorSidebar) editorSidebar.classList.add("show"); if (sidebarOverlay) sidebarOverlay.classList.add("show"); }
    function closeSidebarPanel() { if (editorSidebar) editorSidebar.classList.remove("show"); if (sidebarOverlay) sidebarOverlay.classList.remove("show"); }

    if (closeSidebarBtn) closeSidebarBtn.addEventListener("click", closeSidebarPanel);
    if (sidebarOverlay) sidebarOverlay.addEventListener("click", closeSidebarPanel);

    let currentEditIndex = -1;

    if (openAddSidebarBtn) openAddSidebarBtn.onclick = () => {
        currentEditIndex = -1;
        document.getElementById("sidebarTitle").innerText = "Add New Field";
        deleteFieldBtn.style.display = "none";
        saveFieldBtn.innerText = "Create Field";
        editLabel.value = ""; editType.value = "text"; editRequired.checked = false;
        toggleOptionsEditor("text");
        openSidebar();
    };

    window.openEditor = (index) => {
        currentEditIndex = index;
        const raw = localStorage.getItem("formConfig");
        const fields = raw ? JSON.parse(raw) : [];
        const field = fields[index];

        document.getElementById("sidebarTitle").innerText = "Edit Field";
        deleteFieldBtn.style.display = "block";
        saveFieldBtn.innerText = "Save Changes";

        editLabel.value = field.label;
        editType.value = field.type;
        editRequired.checked = field.required;

        if (editLinkUrl) editLinkUrl.value = field.linkUrl || "";

        toggleOptionsEditor(field.type, field.options);
        openSidebar();
    };

    function toggleOptionsEditor(type, existingOptions) {
        const needsOptions = ['radio', 'checkbox_group', 'select'].includes(type);
        const isSuccessLink = (type === 'success_link');

        if (optionsContainer) optionsContainer.style.display = needsOptions ? 'block' : 'none';
        if (optionsList) optionsList.innerHTML = "";

        // Handle Link Input
        if (linkUrlContainer) linkUrlContainer.style.display = isSuccessLink ? 'block' : 'none';

        // Handle Required Toggle (Not needed for success link)
        if (editRequired && editRequired.parentElement) {
            editRequired.parentElement.style.display = isSuccessLink ? 'none' : 'flex';
        }

        if (needsOptions) {
            if (existingOptions) existingOptions.forEach(opt => addOptionRow(opt.label));
            else addOptionRow("Option 1");
        }
    }

    function addOptionRow(value = "") {
        const row = document.createElement("div");
        row.className = "option-row";
        row.innerHTML = `<input type="text" value="${value}" placeholder="Option Label"><button class="icon-btn" onclick="this.parentElement.remove()" style="color:red;">&times;</button>`;
        if (optionsList) optionsList.appendChild(row);
    }

    if (addOptionBtn) addOptionBtn.onclick = () => addOptionRow();
    if (editType) editType.onchange = (e) => toggleOptionsEditor(e.target.value);

    // Save Logic
    if (saveFieldBtn) saveFieldBtn.onclick = () => {
        const label = editLabel.value.trim();
        if (!label) return alert("Label needed");

        const raw = localStorage.getItem("formConfig");
        const fields = raw ? JSON.parse(raw) : [];

        // Generate clean ID from label
        const cleanId = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

        const field = {
            id: (currentEditIndex === -1) ? cleanId : fields[currentEditIndex].id,
            label: label,
            type: editType.value,
            required: (editType.value === 'success_link') ? false : editRequired.checked,
            linkUrl: (editType.value === 'success_link' && editLinkUrl) ? editLinkUrl.value.trim() : ""
        };

        if (['radio', 'checkbox_group', 'select'].includes(field.type)) {
            const opts = [];
            optionsList.querySelectorAll("input").forEach(i => { if (i.value.trim()) opts.push({ label: i.value.trim(), value: i.value.trim() }); });
            field.options = opts;
        }

        if (currentEditIndex === -1) fields.push(field); else fields[currentEditIndex] = field;

        saveFields(fields);
        renderFieldBuilder(fields);
        closeSidebarPanel();
    };

    if (deleteFieldBtn) deleteFieldBtn.onclick = () => {
        showModal({
            title: "Delete Field",
            message: "Remove this field?",
            confirmText: "Delete",
            onConfirm: () => {
                const raw = localStorage.getItem("formConfig");
                const fields = raw ? JSON.parse(raw) : [];
                fields.splice(currentEditIndex, 1);
                saveFields(fields);
                renderFieldBuilder(fields);
                closeSidebarPanel();
            }
        });
    };

    // --- CUSTOM MODAL LOGIC (Replaces Native Prompts) ---
    const modalOverlay = document.getElementById("customModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalMessage = document.getElementById("modalMessage");
    const modalInput = document.getElementById("modalInput");
    const modalCancel = document.getElementById("modalCancel");
    const modalConfirm = document.getElementById("modalConfirm");

    let currentModalCallback = null;

    function showModal(options) {
        if (!modalOverlay) return;

        modalTitle.innerText = options.title || "Confirm";
        modalMessage.innerText = options.message || "Are you sure?";
        modalConfirm.innerText = options.confirmText || "Confirm";

        if (options.showInput) {
            modalInput.style.display = "block";
            modalInput.value = options.defaultValue || "";
            setTimeout(() => modalInput.focus(), 100);
        } else {
            modalInput.style.display = "none";
        }

        // Store callback
        currentModalCallback = options.onConfirm;

        modalOverlay.classList.add("show");
    }

    function closeModal() {
        if (modalOverlay) modalOverlay.classList.remove("show");
        currentModalCallback = null;
    }

    // Set up modal button listeners ONCE
    if (modalConfirm) {
        modalConfirm.addEventListener("click", () => {
            if (currentModalCallback) {
                currentModalCallback(modalInput.value);
            }
            closeModal();
        });
    }

    if (modalCancel) {
        modalCancel.addEventListener("click", closeModal);
    }

    // Close on overlay click
    if (modalOverlay) {
        modalOverlay.addEventListener("click", (e) => {
            if (e.target === modalOverlay) closeModal();
        });
    }
});
