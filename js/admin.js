import { API_BASE } from "./api.js";

// State
let currentResponses = [];
let currentFormSlug = null;
let formMode = "create";
let currentDesign = {
    themeColor: "#db4437",
    formTitle: "Untitled Form",
    formDescription: "",
    banner: null,
    logoLight: null,
    logoDark: null,
    responseLimit: null,
    allowMultipleResponses: true,
    webTitle: "",
    cloudinary: {
        cloudName: "",
        preset: ""
    }
};

let backendForms = [];
let currentFields = [];
let currentFormId = null;

document.addEventListener("DOMContentLoaded", () => {
    // Auth
    const token = localStorage.getItem('adminToken');
    if (!token && !window.location.pathname.includes('login.html')) {
        window.location.href = 'login.html';
        return;
    }

    // Standardized API Fetch with Auth
    const originalFetch = window.fetch;
    window.fetch = function (url, options = {}) {
        const token = localStorage.getItem('adminToken');
        if (token) {
            options.headers = {
                ...options.headers,
                'Authorization': `Bearer ${token}`
            };
        }
        return originalFetch(url, options).then(response => {
            if (response.status === 401 || response.status === 403) {
                if (!url.toString().includes('/api/login')) {
                    localStorage.removeItem('adminToken');
                    window.location.href = 'login.html';
                }
            }
            return response;
        });
    };

    // Initialize
    loadFormsFromBackend();
    const libraryContainer = document.getElementById("formsLibraryList");
    const builderSection = document.getElementById("builder");
    const librarySection = document.getElementById("library");
    const addFieldBtn = document.getElementById("openAddSidebarBtn");
    const fieldList = document.getElementById("fieldBuilderList");
    const previewContainer = null; // Not used in current HTML
    const saveLibraryBtn = document.getElementById("saveToLibraryBtn");
    const newTargetBtn = document.getElementById("newTargetBtn");
    const backToLibraryBtn = null; // Not in current HTML
    const colorPicker = document.getElementById("themeColorPicker");
    const colorValue = document.getElementById("colorValue");
    const formTitleInput = document.getElementById("formTitleInput");
    const formDescInput = document.getElementById("formDescInput");
    const responseLimitInput = document.getElementById("responseLimitInput");
    const allowMultipleInput = document.getElementById("allowMultipleResponsesInput");
    const webTitleInput = document.getElementById("webTitleInput");

    // Initialize
    loadFormsFromBackend();

    // Color picker
    if (colorPicker && colorValue) {
        colorPicker.addEventListener('input', (e) => {
            currentDesign.themeColor = e.target.value;
            colorValue.textContent = e.target.value;
        });
    }

    // Sync form title
    if (formTitleInput) {
        formTitleInput.addEventListener('input', (e) => {
            currentDesign.formTitle = e.target.value;
        });
    }

    // Sync web title
    if (webTitleInput) {
        webTitleInput.addEventListener('input', (e) => {
            currentDesign.webTitle = e.target.value;
        });
    }

    // Sync form description
    if (formDescInput) {
        formDescInput.addEventListener('input', (e) => {
            currentDesign.formDescription = e.target.value;
        });
    }

    // Sync response limit
    if (responseLimitInput) {
        responseLimitInput.addEventListener('input', (e) => {
            currentDesign.responseLimit = e.target.value ? parseInt(e.target.value) : null;
        });
    }

    // Cloudinary
    const cloudNameInput = document.getElementById('cloudinaryCloudName');
    const cloudPresetInput = document.getElementById('cloudinaryPreset');

    if (cloudNameInput) {
        cloudNameInput.addEventListener('input', (e) => {
            if (!currentDesign.cloudinary) currentDesign.cloudinary = { cloudName: '', preset: '' };
            currentDesign.cloudinary.cloudName = e.target.value.trim();
        });
    }

    if (cloudPresetInput) {
        cloudPresetInput.addEventListener('input', (e) => {
            if (!currentDesign.cloudinary) currentDesign.cloudinary = { cloudName: '', preset: '' };
            currentDesign.cloudinary.preset = e.target.value.trim();
        });
    }

    // Image Upload (Sidebar)
    const editImageUpload = document.getElementById('editImageUpload');
    const editMediaUrl = document.getElementById('editMediaUrl');
    const imageUploadStatus = document.getElementById('imageUploadStatus');
    let editingFieldIndex = null; // Track which field we are editing

    if (editImageUpload) {
        editImageUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Check configuration
            const cloudName = currentDesign.cloudinary?.cloudName;
            const preset = currentDesign.cloudinary?.preset;

            if (!cloudName || !preset) {
                alert("Please configure Cloudinary (Cloud Name & Preset) in 'Design & Theme' first.");
                editImageUpload.value = ''; // Reset input
                return;
            }

            try {
                imageUploadStatus.textContent = "Uploading to Cloudinary...";
                imageUploadStatus.style.color = "#2563eb";

                const formData = new FormData();
                formData.append("file", file);
                formData.append("upload_preset", preset);

                const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/upload`, {
                    method: 'POST',
                    body: formData
                });

                if (!res.ok) throw new Error("Upload failed. Check your Cloudinary settings.");

                const data = await res.json();

                // Sync to text input
                if (editMediaUrl) {
                    editMediaUrl.value = data.secure_url;
                    // Trigger input event manually if needed, but sidebar save button reads from .value
                }

                imageUploadStatus.textContent = "Upload successful! 🎉";
                imageUploadStatus.style.color = "#16a34a";
                setTimeout(() => { if (imageUploadStatus) imageUploadStatus.textContent = ""; }, 3000);

            } catch (err) {
                console.error("Sidebar upload error:", err);
                imageUploadStatus.textContent = "Error: " + err.message;
                imageUploadStatus.style.color = "#dc2626";
            }
        });
    }

    // Mobile Menu
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.querySelector('.sidebar');

    if (mobileMenuToggle && sidebar) {
        mobileMenuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-open');
            const icon = mobileMenuToggle.querySelector('i');

            if (sidebar.classList.contains('mobile-open')) {
                icon.className = 'fa-solid fa-times';
            } else {
                icon.className = 'fa-solid fa-bars';
            }
        });

        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                if (!sidebar.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
                    sidebar.classList.remove('mobile-open');
                    const icon = mobileMenuToggle.querySelector('i');
                    icon.className = 'fa-solid fa-bars';
                }
            }
        });

        // Close sidebar when nav item is clicked on mobile
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('mobile-open');
                    const icon = mobileMenuToggle.querySelector('i');
                    icon.className = 'fa-solid fa-bars';
                }
            });
        });
    }

    function showFormTabs() {
        document.querySelectorAll('.nav-item[data-tab="builder"], .nav-item[data-tab="responses"]')
            .forEach(item => item.classList.remove('hidden'));
    }

    function hideFormTabs() {
        document.querySelectorAll('.nav-item[data-tab="builder"], .nav-item[data-tab="responses"]')
            .forEach(item => item.classList.add('hidden'));
    }

    window.showFormTabs = showFormTabs;
    window.hideFormTabs = hideFormTabs;

    // Tabs
    document.querySelectorAll('.nav-item').forEach(navItem => {
        navItem.addEventListener('click', function () {
            const targetTab = this.getAttribute('data-tab');

            // If switching AWAY from library, we might need to hide its specific buttons
            if (targetTab !== 'library') {
                const addFormBtn = document.getElementById('addFormBtn');
                if (addFormBtn) addFormBtn.style.display = 'none';
            } else {
                // Switching back to library, restore buttons
                const addFormBtn = document.getElementById('addFormBtn');
                if (addFormBtn) addFormBtn.style.display = 'block';
            }

            // Remove active from all
            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

            // Activation logic
            if (targetTab === 'library') {
                hideFormTabs();
            }

            // Centralized tab switching
            switchTab(targetTab);
        });
    });

    /**
     * Centralized function to switch between dashboard tabs
     * @param {string} tabId - The ID of the tab to activate
     */
    function switchTab(tabId) {
        // Hide all
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

        // Show target
        const tab = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
        const pane = document.getElementById(tabId);

        if (tab) tab.classList.add('active');
        if (pane) pane.classList.add('active');

        // Contextual buttons
        const addFormBtn = document.getElementById('addFormBtn');
        if (addFormBtn) {
            addFormBtn.style.display = (tabId === 'library') ? 'block' : 'none';
        }

        console.log(`Switched to tab: ${tabId}`);
    }
    window.switchTab = switchTab;

    function renderLibrary() {
        if (!libraryContainer) return;
        libraryContainer.innerHTML = "";

        if (backendForms.length === 0) {
            libraryContainer.innerHTML = '<p class="text-secondary" style="grid-column: 1/-1; text-align:center; padding: 40px;">No forms found. Create your first one!</p>';
            return;
        }

        backendForms.forEach(form => {
            const card = document.createElement("div");
            card.className = "target-card";
            const isOpen = form.status !== 'closed';

            const safeName = escapeHtml(form.name || "Untitled");
            const safeSlug = escapeHtml(form.slug);

            card.innerHTML = `
                <div class="target-card-header">
                    <h3>${safeName}</h3>
                    <span class="status-badge ${isOpen ? 'status-open' : 'status-closed'}">
                        ${isOpen ? 'Accepting Responses' : 'Closed'}
                    </span>
                </div>
                <div class="target-card-info">
                    <p>Slug: <code>${safeSlug}</code></p>
                    <p>Modified: ${form.date || 'Unknown'}</p>
                </div>
                <div class="target-card-actions">
                    <button class="btn-card-primary edit-form-btn" data-id="${form.id}">Edit</button>
                    <button class="btn-card-secondary toggle-status-btn" data-id="${form.id}">
                        ${isOpen ? 'Close' : 'Open'}
                    </button>
                    <button class="btn-card-secondary delete-form-btn" data-id="${form.id}" style="color: var(--danger)">Delete</button>
                    <a href="index.html?form=${safeSlug}" target="_blank" class="btn-card-secondary">View Live</a>
                    <button class="btn-card-secondary view-responses-btn" data-slug="${form.slug}">
                        <i class="fa-solid fa-chart-simple"></i> Responses
                    </button>
                </div>
            `;
            libraryContainer.appendChild(card);
        });

        document.querySelectorAll(".edit-form-btn").forEach(btn => btn.onclick = () => loadFormToBuilder(btn.dataset.id));
        document.querySelectorAll(".toggle-status-btn").forEach(btn => btn.onclick = () => toggleFormStatus(btn.dataset.id));
        document.querySelectorAll(".delete-form-btn").forEach(btn => btn.onclick = () => deleteForm(btn.dataset.id));
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Library
    const refreshLibraryBtn = document.getElementById('refreshLibraryBtn');
    if (refreshLibraryBtn) {
        refreshLibraryBtn.addEventListener('click', () => loadFormsFromBackend());
    }

    async function loadFormsFromBackend() {
        const refreshBtn = document.getElementById('refreshLibraryBtn');

        try {
            // Show loading state (FIX BUG #5)
            if (refreshBtn) {
                refreshBtn.disabled = true;
                refreshBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            }

            const res = await fetch(API_BASE + '/api/forms/library/all');

            // Error handling (FIX BUG #7)
            if (!res.ok) {
                throw new Error(`Failed to load forms: ${res.status} ${res.statusText}`);
            }

            backendForms = await res.json();
            renderLibrary();
        } catch (err) {
            console.error("Could not load forms from backend:", err);

            // User-friendly error message
            if (libraryContainer) {
                libraryContainer.innerHTML = `
                    <div style="grid-column: 1/-1; text-align:center; padding: 40px; color: var(--theme-error);">
                        <i class="fa-solid fa-exclamation-triangle" style="font-size:2rem; margin-bottom:10px;"></i>
                        <p><strong>Failed to load forms</strong></p>
                        <p style="font-size:0.9rem; color:var(--text-secondary);">${err.message}</p>
                        <button onclick="location.reload()" class="btn btn-primary" style="margin-top:15px;">
                            <i class="fa-solid fa-rotate"></i> Retry
                        </button>
                    </div>
                `;
            }
        } finally {
            // Restore button state
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '<i class="fa-solid fa-rotate"></i>';
            }
        }
    }

    async function toggleFormStatus(id) {
        const form = backendForms.find(f => f.id === id);
        if (!form) return;

        const newStatus = (form.status !== 'closed') ? 'closed' : 'open';
        const btn = document.querySelector(`.toggle-status-btn[data-id="${id}"]`);
        const originalText = btn?.textContent;

        try {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            }

            const res = await fetch(API_BASE + `/api/forms/${form.slug}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            if (!res.ok) throw new Error(`Failed to update status: ${res.status}`);

            await loadFormsFromBackend();
        } catch (err) {
            console.error("Status toggle failed:", err);
            alert(`Failed to update form status: ${err.message}`);

            if (btn) {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        }
    }

    async function deleteForm(id) {
        const form = backendForms.find(f => f.id === id);
        if (!form || !confirm(`Delete form "${form.name}"?`)) return;

        // Find button for loading state
        const btn = document.querySelector(`.delete-form-btn[data-id="${id}"]`);

        try {
            // Show loading (FIX BUG #5)
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            }

            const res = await fetch(API_BASE + '/api/forms/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug: form.slug })
            });

            // Error handling (FIX BUG #7)
            if (!res.ok) {
                throw new Error(`Failed to delete: ${res.status}`);
            }

            await loadFormsFromBackend();
        } catch (err) {
            console.error("Delete failed:", err);
            alert(`Failed to delete form: ${err.message}`);

            // Restore button
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Delete';
            }
        }
    }

    // Builder


    async function loadFormToBuilder(id) {
        const formIndex = backendForms.findIndex(f => f.id === id);
        if (formIndex === -1) return;
        const fullForm = backendForms[formIndex];

        // Set to EDIT mode
        formMode = "edit";
        currentFormId = fullForm.id;
        currentFormSlug = fullForm.slug;
        currentFields = fullForm.config || [];
        currentDesign = fullForm.design || { ...currentDesign };

        // Sync UI
        if (document.getElementById("formTitleInput")) document.getElementById("formTitleInput").value = currentDesign.formTitle || "";
        if (document.getElementById("formDescInput")) document.getElementById("formDescInput").value = currentDesign.formDescription || "";
        if (document.getElementById("webTitleInput")) document.getElementById("webTitleInput").value = currentDesign.webTitle || "";
        if (document.getElementById("responseLimitInput")) document.getElementById("responseLimitInput").value = currentDesign.responseLimit || "";
        if (allowMultipleInput) allowMultipleInput.checked = currentDesign.allowMultipleResponses !== false;

        // Sync Cloudinary UI
        if (document.getElementById("cloudinaryCloudName")) document.getElementById("cloudinaryCloudName").value = currentDesign.cloudinary?.cloudName || "";
        if (document.getElementById("cloudinaryPreset")) document.getElementById("cloudinaryPreset").value = currentDesign.cloudinary?.preset || "";

        if (colorPicker) {
            colorPicker.value = currentDesign.themeColor || "#db4437";
            colorValue.innerText = currentDesign.themeColor || "#db4437";
        }

        renderFieldBuilder();
        updatePreview();

        // Show tabs when form is loaded
        showFormTabs();

        // Switch to builder tab
        librarySection.classList.remove("active");
        builderSection.classList.add("active");
    }

    // newTargetBtn removed - using addFormBtn instead

    // --- ADD FORM BUTTON ---
    document.getElementById('addFormBtn')?.addEventListener('click', () => {
        // Set to CREATE mode
        formMode = "create";

        // Reset form state completely
        currentFormId = null;
        currentFormSlug = null;
        currentFields = [];
        currentDesign = {
            themeColor: "#db4437",
            formTitle: "Untitled Form",
            formDescription: "",
            banner: null,
            logoLight: null,
            logoDark: null,
            responseLimit: null,
            allowMultipleResponses: true,
            webTitle: "",
            cloudinary: {
                cloudName: "",
                preset: ""
            }
        };

        // Update UI - Form Design
        document.getElementById('cloudinaryCloudName').value = "";
        document.getElementById('cloudinaryPreset').value = "";
        document.getElementById('themeColorPicker').value = "#db4437"; // Default theme color
        document.getElementById('colorValue').textContent = "#db4437";
        if (formTitleInput) formTitleInput.value = currentDesign.formTitle;
        if (webTitleInput) webTitleInput.value = currentDesign.webTitle || "";
        if (formDescInput) formDescInput.value = currentDesign.formDescription;
        document.getElementById('responseLimitInput').value = '';
        if (allowMultipleInput) allowMultipleInput.checked = true;

        // Clear file inputs
        const bannerUpload = document.getElementById('bannerUpload');
        const logoLightUpload = document.getElementById('logoLightUpload');
        const logoDarkUpload = document.getElementById('logoDarkUpload');
        if (bannerUpload) bannerUpload.value = '';
        if (logoLightUpload) logoLightUpload.value = '';
        if (logoDarkUpload) logoDarkUpload.value = '';

        // Clear fields list
        renderFieldBuilder(); // Changed from renderFieldsList() to renderFieldBuilder() to match existing function name

        // Show tabs when creating new form
        showFormTabs();

        // Switch to Form Builder tab
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

        const builderTab = document.querySelector('.nav-item[data-tab="builder"]');
        const builderPane = document.getElementById('builder');

        if (builderTab) builderTab.classList.add('active');
        if (builderPane) builderPane.classList.add('active');

        console.log('Add Form: Mode set to CREATE');
    });

    function loadFormIntoBuilder(form) {
        // Set to EDIT mode
        formMode = "edit";

        currentFormId = form.id;
        currentFormSlug = form.slug;
        currentFields = form.fields || [];

        // Load design
        currentDesign.formTitle = form.title || "Untitled Form";
        currentDesign.formDescription = form.description || "";
        currentDesign.themeColor = form.design?.themeColor || "#db4437";
        currentDesign.banner = form.design?.banner || null;
        currentDesign.logoLight = form.design?.logoLight || null;
        currentDesign.logoDark = form.design?.logoDark || null;
        currentDesign.responseLimit = form.responseLimit || null;

        // Load new security & integration settings
        currentDesign.webTitle = form.design?.webTitle || "";
        currentDesign.allowMultipleResponses = form.design?.allowMultipleResponses !== false;
        currentDesign.cloudinary = form.design?.cloudinary || { cloudName: '', preset: '' };

        // Update UI
        if (document.getElementById("formTitleInput")) document.getElementById("formTitleInput").value = currentDesign.formTitle;
        if (document.getElementById("formDescInput")) document.getElementById("formDescInput").value = currentDesign.formDescription;
        if (document.getElementById("themeColorPicker")) {
            document.getElementById("themeColorPicker").value = currentDesign.themeColor;
            document.getElementById("colorValue").textContent = currentDesign.themeColor;
        }
        if (document.getElementById("responseLimitInput")) document.getElementById("responseLimitInput").value = currentDesign.responseLimit || '';
        if (document.getElementById("webTitleInput")) document.getElementById("webTitleInput").value = currentDesign.webTitle;
        if (document.getElementById("allowMultipleResponsesInput")) document.getElementById("allowMultipleResponsesInput").checked = currentDesign.allowMultipleResponses;

        // Update Cloudinary UI
        if (document.getElementById("cloudinaryCloudName")) document.getElementById("cloudinaryCloudName").value = currentDesign.cloudinary.cloudName;
        if (document.getElementById("cloudinaryPreset")) document.getElementById("cloudinaryPreset").value = currentDesign.cloudinary.preset;

        renderFieldBuilder();

        // Switch to builder tab
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

        const builderTab = document.querySelector('.nav-item[data-tab="builder"]');
        const builderPane = document.getElementById('builder');

        if (builderTab) builderTab.classList.add('active');
        if (builderPane) builderPane.classList.add('active');

        console.log('Load Form: Mode set to EDIT, settings restored');
    }

    // Back to library functionality (handled by tab navigation in current HTML)

    // --- FIELD BUILDER ---

    function renderFieldBuilder() {
        if (!fieldList) return;
        fieldList.innerHTML = "";

        currentFields.forEach((field, index) => {
            const fieldItem = document.createElement("div");
            fieldItem.className = "field-item";
            fieldItem.style.cursor = "pointer";
            fieldItem.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong style="color: var(--primary);">${field.type.toUpperCase()}</strong>
                        <div style="margin-top:4px; color: var(--text-main);">${field.label}</div>
                        ${field.required ? '<span style="color: var(--danger); font-size:0.8rem;">* Required</span>' : ''}
                    </div>
                    <button class="remove-field" data-index="${index}" style="color: var(--danger); border:none; background:none; cursor:pointer; padding:8px;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;

            // Click to edit
            fieldItem.addEventListener('click', (e) => {
                if (!e.target.closest('.remove-field')) {
                    openSidebar(index);
                }
            });

            fieldList.appendChild(fieldItem);
        });

        // Wire up remove buttons
        document.querySelectorAll(".remove-field").forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                if (confirm('Delete this field?')) {
                    currentFields.splice(btn.dataset.index, 1);
                    renderFieldBuilder();
                    updatePreview();
                }
            };
        });
    }

    // --- FIELD EDITOR SIDEBAR (COMPLETE IMPLEMENTATION) ---
    const editorSidebar = document.getElementById('editorSidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const closeSidebarBtn = document.querySelector('.close-sidebar');
    const editLabel = document.getElementById('editLabel');
    const editType = document.getElementById('editType');
    const editRequired = document.getElementById('editRequired');
    const editLinkUrl = document.getElementById('editLinkUrl');
    const linkUrlContainer = document.getElementById('linkUrlContainer');
    const optionsContainer = document.getElementById('optionsContainer');
    const optionsList = document.getElementById('optionsList');
    const addOptionBtn = document.getElementById('addOptionBtn');
    const saveFieldBtn = document.getElementById('saveFieldBtn');
    const deleteFieldBtn = document.getElementById('deleteFieldBtn');
    const mediaUrlContainer = document.getElementById('mediaUrlContainer');
    // editMediaUrl and editingFieldIndex already declared above

    function openSidebar(index = null) {
        editingFieldIndex = index;

        if (index !== null) {
            // Editing existing field
            const field = currentFields[index];
            document.getElementById('sidebarTitle').textContent = 'Edit Field';
            editLabel.value = field.label || '';
            editType.value = field.type || 'text';
            editRequired.checked = field.required || false;
            editLinkUrl.value = field.linkUrl || '';
            if (editMediaUrl) editMediaUrl.value = field.mediaUrl || '';

            // Handle options for radio/checkbox/select
            if (field.options) {
                renderOptions(field.options);
            }

            deleteFieldBtn.style.display = 'block';
        } else {
            // Adding new field
            document.getElementById('sidebarTitle').textContent = 'Add Field';
            editLabel.value = '';
            editType.value = 'text';
            editRequired.checked = false;
            editLinkUrl.value = '';
            if (editMediaUrl) editMediaUrl.value = '';
            optionsList.innerHTML = '';
            deleteFieldBtn.style.display = 'none';
        }

        updateFieldTypeUI();
        editorSidebar.classList.add('show');
        sidebarOverlay.classList.add('show');
    }

    function closeSidebar() {
        editorSidebar.classList.remove('show');
        sidebarOverlay.classList.remove('show');
        editingFieldIndex = null;
    }

    function updateFieldTypeUI() {
        const type = editType.value;

        // Show/hide link URL for success_link type
        if (type === 'success_link') {
            linkUrlContainer.style.display = 'block';
        } else {
            linkUrlContainer.style.display = 'none';
        }

        // Show/hide image URL for image type
        if (type === 'image') {
            if (mediaUrlContainer) mediaUrlContainer.style.display = 'block';
        } else {
            if (mediaUrlContainer) mediaUrlContainer.style.display = 'none';
        }

        // Show/hide options for radio/checkbox/select
        if (['radio', 'checkbox_group', 'select'].includes(type)) {
            optionsContainer.style.display = 'block';
            if (optionsList.children.length === 0) {
                renderOptions(['Option 1', 'Option 2']);
            }
        } else {
            optionsContainer.style.display = 'none';
        }
    }

    function renderOptions(options = []) {
        optionsList.innerHTML = '';
        options.forEach((opt, i) => {
            const row = document.createElement('div');
            row.className = 'option-row';
            row.innerHTML = `
                <input type="text" value="${opt}" data-index="${i}" placeholder="Option ${i + 1}">
                <button class="icon-btn remove-option" data-index="${i}">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            `;
            optionsList.appendChild(row);
        });

        // Wire up remove buttons
        document.querySelectorAll('.remove-option').forEach(btn => {
            btn.onclick = () => {
                const opts = getOptionsFromUI();
                opts.splice(btn.dataset.index, 1);
                renderOptions(opts);
            };
        });
    }

    function getOptionsFromUI() {
        return Array.from(optionsList.querySelectorAll('input')).map(inp => inp.value.trim()).filter(v => v);
    }

    // Event listeners
    if (addFieldBtn) {
        addFieldBtn.onclick = () => openSidebar(null);
    }

    if (closeSidebarBtn) {
        closeSidebarBtn.onclick = closeSidebar;
    }

    if (sidebarOverlay) {
        sidebarOverlay.onclick = closeSidebar;
    }

    if (editType) {
        editType.onchange = updateFieldTypeUI;
    }

    if (addOptionBtn) {
        addOptionBtn.onclick = () => {
            const opts = getOptionsFromUI();
            opts.push(`Option ${opts.length + 1}`);
            renderOptions(opts);
        };
    }

    if (saveFieldBtn) {
        saveFieldBtn.onclick = () => {
            const fieldData = {
                id: editingFieldIndex !== null ? currentFields[editingFieldIndex].id : `field_${Date.now()}`,
                type: editType.value,
                label: editLabel.value || 'Untitled Field',
                required: editRequired.checked,
                placeholder: editLabel.value || ''
            };

            // Add options for radio/checkbox/select
            if (['radio', 'checkbox_group', 'select'].includes(fieldData.type)) {
                fieldData.options = getOptionsFromUI();
            }

            // Add link URL for success_link
            if (fieldData.type === 'success_link') {
                fieldData.linkUrl = editLinkUrl.value;
            }

            // Add image URL for image type
            if (fieldData.type === 'image') {
                fieldData.mediaUrl = editMediaUrl.value || '';
            }

            if (editingFieldIndex !== null) {
                // Update existing field
                currentFields[editingFieldIndex] = fieldData;
            } else {
                // Add new field
                currentFields.push(fieldData);
            }

            renderFieldBuilder();
            updatePreview();
            closeSidebar();
        };
    }

    if (deleteFieldBtn) {
        deleteFieldBtn.onclick = () => {
            if (editingFieldIndex !== null && confirm('Delete this field?')) {
                currentFields.splice(editingFieldIndex, 1);
                renderFieldBuilder();
                updatePreview();
                closeSidebar();
            }
        };
    }

    // --- PREVIEW & SYNC ---

    function updatePreview() {
        if (!previewContainer) return;
        previewContainer.innerHTML = "";

        const title = document.getElementById("formTitleInput")?.value || "Untitled Form";
        const desc = document.getElementById("formDescInput")?.value || "";

        const header = document.createElement("div");
        header.innerHTML = `<h2 style="color: ${currentDesign.themeColor}">${title}</h2><p>${desc}</p><hr style="margin: 20px 0; border: 0; border-top: 1px solid var(--theme-border);">`;
        previewContainer.appendChild(header);

        currentFields.forEach(field => {
            const group = document.createElement("div");
            group.style.marginBottom = "15px";
            group.innerHTML = `
                <label style="display:block; margin-bottom:5px; font-weight:500;">${field.label} ${field.required ? '*' : ''}</label>
                <input type="${field.type === 'email' ? 'email' : 'text'}" placeholder="${field.placeholder || ''}" ${field.type === 'email' ? 'pattern="[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"' : ''} disabled style="width:100%; padding:8px; border:1px solid var(--theme-border); border-radius:4px;">
            `;
            previewContainer.appendChild(group);
        });
    }

    // Old saveLibraryBtn handler removed - using saveToLibraryBtn instead

    // --- SAVE FORM TO LIBRARY ---
    const saveToLibraryBtn = document.getElementById('saveToLibraryBtn');
    if (saveToLibraryBtn) {
        saveToLibraryBtn.addEventListener('click', async () => {
            // Validation
            if (!currentDesign.formTitle || currentDesign.formTitle.trim() === '') {
                alert('Please enter a form title');
                return;
            }

            if (currentFields.length === 0) {
                alert('Please add at least one field to your form');
                return;
            }

            // Prepare payload
            const payload = {
                title: currentDesign.formTitle,
                description: currentDesign.formDescription || '',
                fields: currentFields,
                design: {
                    themeColor: currentDesign.themeColor,
                    banner: currentDesign.banner,
                    logoLight: currentDesign.logoLight,
                    logoDark: currentDesign.logoDark,
                    allowMultipleResponses: currentDesign.allowMultipleResponses !== false,
                    webTitle: currentDesign.webTitle || '',
                    cloudinary: currentDesign.cloudinary || { cloudName: '', preset: '' }
                },
                responseLimit: currentDesign.responseLimit ? parseInt(currentDesign.responseLimit) : null
            };

            try {
                // Show loading state
                saveToLibraryBtn.disabled = true;
                saveToLibraryBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

                let response;

                // Use formMode to determine create vs edit
                if (formMode === "edit" && currentFormId) {
                    // UPDATE existing form
                    console.log('Updating form:', currentFormId);
                    const token = localStorage.getItem('adminToken');
                    response = await fetch(`${API_BASE}/api/forms/${currentFormId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(payload)
                    });
                } else {
                    // CREATE new form
                    console.log('Creating new form');
                    const token = localStorage.getItem('adminToken');
                    response = await fetch(`${API_BASE}/api/forms`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(payload)
                    });
                }

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to save form');
                }

                const result = await response.json();

                // Update current form ID and slug after save
                currentFormId = result.id;
                currentFormSlug = result.slug;

                // Switch to edit mode after successful create
                if (formMode === "create") {
                    formMode = "edit";
                }

                // Reload forms library
                await loadFormsFromBackend();

                // Show success message
                const action = formMode === "edit" ? "updated" : "created";
                alert(`Form "${currentDesign.formTitle}" ${action} successfully!`);

                // Switch to My Forms tab to show the saved form
                document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

                const libraryTab = document.querySelector('.nav-item[data-tab="library"]');
                const libraryPane = document.getElementById('library');

                if (libraryTab) libraryTab.classList.add('active');
                if (libraryPane) libraryPane.classList.add('active');

            } catch (error) {
                console.error('Save form error:', error);
                alert(`Failed to save form: ${error.message}`);
            } finally {
                // Restore button state
                saveToLibraryBtn.disabled = false;
                saveToLibraryBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save to Library';
            }
        });
    }

    // Media
    const manageLogoBtn = document.getElementById('manageLogoBtn');
    const logoUploadSection = document.getElementById('logoUploadSection');
    const logoLightUpload = document.getElementById('logoLightUpload');
    const logoDarkUpload = document.getElementById('logoDarkUpload');
    const removeLogosBtn = document.getElementById('removeLogosBtn');

    // Toggle logo upload section
    if (manageLogoBtn && logoUploadSection) {
        manageLogoBtn.addEventListener('click', () => {
            if (logoUploadSection.style.display === 'none') {
                logoUploadSection.style.display = 'block';
                manageLogoBtn.innerHTML = '<i class="fa-solid fa-chevron-up"></i> Hide Logo Upload';
            } else {
                logoUploadSection.style.display = 'none';
                manageLogoBtn.innerHTML = '<i class="fa-solid fa-image"></i> Manage / Upload Logo';
            }
        });
    }

    // Helper function to convert file to base64
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // --- ASSET UPLOAD HELPER ---
    async function uploadAsset(file) {
        // 1. Try Cloudinary first
        if (currentDesign.cloudinary && currentDesign.cloudinary.cloudName && currentDesign.cloudinary.preset) {
            try {
                const formData = new FormData();
                formData.append("file", file);
                formData.append("upload_preset", currentDesign.cloudinary.preset);

                const res = await fetch(`https://api.cloudinary.com/v1_1/${currentDesign.cloudinary.cloudName}/upload`, {
                    method: 'POST',
                    body: formData
                });

                if (!res.ok) throw new Error("Cloudinary upload failed");
                const data = await res.json();
                return data.secure_url; // Return URL
            } catch (err) {
                console.error("Cloudinary upload error:", err);
                if (!confirm("Cloudinary upload failed. Fallback to local storage (slower)?")) {
                    throw err;
                }
            }
        } else {
            // Warn if no Cloudinary
            if (file.size > 500 * 1024) { // 500KB warning
                if (!confirm("Warning: You are uploading a large image without Cloudinary configured. This will slow down your form. Continue?")) {
                    throw new Error("Upload cancelled");
                }
            }
        }

        // 2. Fallback to Base64
        return await fileToBase64(file);
    }


    // Handle light mode logo upload
    if (logoLightUpload) {
        logoLightUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const url = await uploadAsset(file);
                    currentDesign.logoLight = url;
                    updatePreview();
                    alert('Light mode logo uploaded! Remember to save the form.');
                } catch (err) {
                    console.error('Logo upload error:', err);
                    if (err.message !== "Upload cancelled") alert('Failed to upload logo');
                }
            }
        });
    }

    // Handle dark mode logo upload
    if (logoDarkUpload) {
        logoDarkUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const url = await uploadAsset(file);
                    currentDesign.logoDark = url;
                    updatePreview();
                    alert('Dark mode logo uploaded! Remember to save the form.');
                } catch (err) {
                    console.error('Logo upload error:', err);
                    if (err.message !== "Upload cancelled") alert('Failed to upload logo');
                }
            }
        });
    }

    // Remove logos
    if (removeLogosBtn) {
        removeLogosBtn.addEventListener('click', () => {
            if (confirm('Remove both logos?')) {
                currentDesign.logoLight = null;
                currentDesign.logoDark = null;
                logoLightUpload.value = '';
                logoDarkUpload.value = '';
                updatePreview();
                alert('Logos removed! Remember to save the form.');
            }
        });
    }

    // --- BANNER UPLOAD FUNCTIONALITY ---
    const bannerUpload = document.getElementById('bannerUpload');
    const removeBannerBtn = document.getElementById('removeBanner');

    // Handle banner upload
    if (bannerUpload) {
        bannerUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const url = await uploadAsset(file);
                    currentDesign.banner = url;
                    updatePreview();
                    alert('Banner uploaded! Remember to save the form.');
                } catch (err) {
                    console.error('Banner upload error:', err);
                    if (err.message !== "Upload cancelled") alert('Failed to upload banner');
                }
            }
        });
    }

    // Remove banner
    if (removeBannerBtn) {
        removeBannerBtn.addEventListener('click', () => {
            if (confirm('Remove banner?')) {
                currentDesign.banner = null;
                bannerUpload.value = '';
                updatePreview();
                alert('Banner removed! Remember to save the form.');
            }
        });
    }
    // Responses
    libraryContainer.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;

        if (btn.classList.contains("view-responses-btn")) {
            showFormTabs();
            openResponsesPanel(btn.dataset.slug);
        }
    });

    // Handle Responses nav item click
    const responsesNavItem = document.querySelector('.nav-item[data-tab="responses"]');
    if (responsesNavItem) {
        responsesNavItem.addEventListener('click', (e) => {
            // Check if hidden (usually means no form is active)
            if (responsesNavItem.classList.contains('hidden')) {
                e.preventDefault();
                alert('Please select a form from "My Forms" and click the "Responses" button to view its responses.');
                return;
            }

            // If already on the tab and have a slug, we can refresh
            if (currentFormSlug) {
                openResponsesPanel(currentFormSlug);
            }
        });
    }




    // Export

    /**
     * Export responses as CSV file
     * @param {string} formSlug - The form slug to export
     * @param {string} formTitle - The form title for filename
     */
    async function exportCsv(formSlug, formTitle) {
        if (!currentResponses || !currentResponses.length) {
            alert('No responses to export. Please load a form with responses first.');
            return;
        }

        const keys = Object.keys(currentResponses[0].data);
        let csv = "Submitted At," + keys.join(",") + "\n";

        currentResponses.forEach(r => {
            const row = [
                new Date(r.submitted_at).toISOString(),
                ...keys.map(k => {
                    const value = (r.data[k] || "").toString();
                    // Escape quotes and wrap in quotes if contains comma/newline
                    if (value.includes(',') || value.includes('\n') || value.includes('"')) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                })
            ];
            csv += row.join(",") + "\n";
        });

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `responses_${formTitle.replace(/[^a-z0-9]/gi, '_')}_${timestamp}.csv`;

        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();

        URL.revokeObjectURL(url);
    }

    /**
     * Export responses as PDF file
     * @param {string} formSlug - The form slug to export
     * @param {string} formTitle - The form title for the report
     */
    async function exportPdf(formSlug, formTitle) {
        if (!currentResponses || !currentResponses.length) {
            alert('No responses to export. Please load a form with responses first.');
            return;
        }

        if (!window.jspdf || !window.jspdf.jsPDF) {
            alert('PDF library not loaded. Please refresh the page and try again.');
            return;
        }

        try {
            // Fetch form schema
            const formRes = await fetch(`${API_BASE}/api/forms/${formSlug}`);
            if (!formRes.ok) throw new Error('Form not found');
            const form = await formRes.json();
            const formFields = (form.config || form.fields || []).filter(f =>
                f.type !== 'description' && f.type !== 'success_link'
            );

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            let yPosition = 20;
            const pageHeight = doc.internal.pageSize.height;
            const margin = 20;
            const lineHeight = 7;

            // Title
            doc.setFontSize(18);
            doc.setFont(undefined, 'bold');
            doc.text(formTitle, margin, yPosition);
            yPosition += 10;

            // Metadata
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(100);
            doc.text(`Total Responses: ${currentResponses.length}`, margin, yPosition);
            yPosition += 6;
            doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPosition);
            yPosition += 12;

            // Responses
            doc.setTextColor(0);
            currentResponses.forEach((response, index) => {
                // Check if we need a new page
                if (yPosition > pageHeight - 40) {
                    doc.addPage();
                    yPosition = 20;
                }

                // Response header
                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text(`Response #${index + 1}`, margin, yPosition);
                yPosition += lineHeight;

                doc.setFontSize(9);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(100);
                doc.text(`Submitted: ${new Date(response.submitted_at).toLocaleString()}`, margin, yPosition);
                yPosition += lineHeight + 2;

                // Use schema for questions
                doc.setTextColor(0);
                formFields.forEach(field => {
                    if (yPosition > pageHeight - 20) {
                        doc.addPage();
                        yPosition = 20;
                    }

                    doc.setFont(undefined, 'bold');
                    doc.setFontSize(10);
                    doc.text(`${field.label || field.id}:`, margin, yPosition);
                    yPosition += lineHeight;

                    doc.setFont(undefined, 'normal');
                    doc.setFontSize(9);

                    const value = response.data[field.id];
                    let answer = '';
                    if (Array.isArray(value)) {
                        answer = value.length > 0 ? value.join(', ') : 'No answer';
                    } else if (typeof value === 'boolean') {
                        answer = value ? 'Yes' : 'No';
                    } else if (value === null || value === undefined || value === '') {
                        answer = 'No answer';
                    } else {
                        answer = value.toString();
                    }

                    const lines = doc.splitTextToSize(answer, 170);
                    lines.forEach(line => {
                        if (yPosition > pageHeight - 20) {
                            doc.addPage();
                            yPosition = 20;
                        }
                        doc.text(line, margin + 5, yPosition);
                        yPosition += lineHeight;
                    });
                    yPosition += 2;
                });

                yPosition += 5; // Space between responses
            });

            const timestamp = new Date().toISOString().slice(0, 10);
            const filename = `responses_${formTitle.replace(/[^a-z0-9]/gi, '_')}_${timestamp}.pdf`;
            doc.save(filename);

        } catch (err) {
            console.error('PDF export error:', err);
            alert(`Failed to export PDF: ${err.message}`);
        }
    }

    // --- CLOUDINARY HELP ---
    const cloudinaryHelpLink = document.getElementById('cloudinaryHelpLink');
    const cloudinaryHelpModal = document.getElementById('cloudinaryHelpModal');

    if (cloudinaryHelpLink && cloudinaryHelpModal) {
        cloudinaryHelpLink.addEventListener('click', (e) => {
            e.preventDefault();
            cloudinaryHelpModal.classList.add('show');
        });

        // Close on click outside
        cloudinaryHelpModal.addEventListener('click', (e) => {
            if (e.target === cloudinaryHelpModal) {
                cloudinaryHelpModal.classList.remove('show');
            }
        });
    }

    // ===== RESPONSES DASHBOARD (GLOBAL) =====
    window.closeResponses = function () {
        // Switch back to Library tab
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

        const libraryTab = document.querySelector('.nav-item[data-tab="library"]');
        const libraryPane = document.getElementById('library');
        if (libraryTab) libraryTab.classList.add('active');
        if (libraryPane) libraryPane.classList.add('active');

        currentResponses = []; // Clear stored responses

        // Restore Add Form button if we are in library tab
        const addFormBtn = document.getElementById('addFormBtn');
        if (addFormBtn) {
            addFormBtn.style.display = 'block';
        }

        const panel = document.getElementById("responsesPanel");
        if (panel) panel.style.display = 'none';
    };


    /**
     * Opens the responses panel and fetches data from D1 via Worker API
     * @param {string} slug - The form slug to fetch responses for
     */
    window.openResponsesPanel = async function (slug) {
        console.log(`[Responses] Attempting to open panel for slug: ${slug}`);

        const panel = document.getElementById("responsesPanel");
        const metaEl = document.getElementById("responsesMeta");
        const tableEl = document.getElementById("responsesTable");

        if (!panel || !metaEl || !tableEl) {
            console.error('[Responses] Critical UI elements missing in DOM');
            return;
        }

        if (panel) panel.style.display = "block";

        // Use centralized tab switcher - simpler and cleaner
        if (window.switchTab) {
            window.switchTab('responses');
        }

        metaEl.innerHTML = '<div style="padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading form schema...</div>';
        tableEl.innerHTML = '<div style="text-align:center; padding:50px; opacity:0.3;"><i class="fa-solid fa-table fa-2x"></i></div>';

        // Hide Add Form button while responses are open
        const addFormBtn = document.getElementById('addFormBtn');
        if (addFormBtn) addFormBtn.style.display = 'none';

        try {
            // 1. Fetch form schema FIRST
            const formRes = await fetch(`${API_BASE}/api/forms/${slug}`);
            if (!formRes.ok) {
                throw new Error(`Form not found: ${formRes.status} ${formRes.statusText}`);
            }
            const form = await formRes.json();

            // Extract form fields (handle both 'config' and 'fields' property names)
            const formFields = form.config || form.fields || [];
            const formTitle = form.title || form.name || 'Untitled Form';

            // Update loading message
            metaEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading responses...';

            // 2. Fetch responses
            const respRes = await fetch(`${API_BASE}/api/forms/${slug}/responses`);
            if (!respRes.ok) {
                throw new Error(`Failed to fetch responses: ${respRes.status} ${respRes.statusText}`);
            }
            const responses = await respRes.json();

            // Store for exports
            currentResponses = responses;
            currentFormSlug = slug;
            currentDesign.formTitle = formTitle;

            // 3. Render using schema
            console.log(`Rendering ${responses.length} responses with ${formFields.length} fields`);
            renderResponsesTable(responses, formFields);

        } catch (err) {
            console.error('Error fetching responses:', err);
            metaEl.innerHTML = '';
            tableEl.innerHTML = `
            <div style="text-align:center; padding:40px; color:var(--danger);">
                <i class="fa-solid fa-exclamation-triangle" style="font-size:2rem; margin-bottom:10px;"></i>
                <p><strong>Failed to load responses</strong></p>
                <p style="font-size:0.9rem; color:var(--text-muted); margin-top:8px;">${err.message}</p>
                <button onclick="openResponsesPanel('${slug}')" class="btn btn-primary" style="margin-top:15px;">
                    <i class="fa-solid fa-rotate"></i> Retry
                </button>
            </div>
        `;
        }
    };


    function renderResponsesTable(responses, formFields) {
        const tableEl = document.getElementById("responsesTable");
        const metaEl = document.getElementById("responsesMeta");

        if (!responses || responses.length === 0) {
            metaEl.innerHTML = "";
            tableEl.innerHTML = `
            <div style="text-align:center; padding:60px 20px; color:var(--text-muted);">
                <i class="fa-regular fa-folder-open" style="font-size:3rem; margin-bottom:15px; opacity:0.5;"></i>
                <p style="font-size:1.1rem; font-weight:500; margin-bottom:8px;">No responses yet</p>
                <p style="font-size:0.9rem;">Responses will appear here once users submit the form.</p>
            </div>
        `;
            return;
        }

        // Meta info
        metaEl.innerHTML = `<b>Total Responses:</b> ${responses.length}`;

        // Build table using form schema
        let html = "<table><thead><tr>";
        html += "<th>Submitted At</th>";

        // Use form fields for headers (show labels, not IDs)
        formFields.forEach(field => {
            // Skip non-input fields
            if (field.type === 'description' || field.type === 'success_link') {
                return;
            }
            html += `<th>${field.label || field.id}</th>`;
        });

        // Add Actions column
        html += "<th>Actions</th>";

        html += "</tr></thead><tbody>";

        // Render rows
        responses.forEach(response => {
            html += `<tr data-id="${response.id}">`;
            html += `<td>${new Date(response.submitted_at).toLocaleString()}</td>`;

            // Map response data using field IDs from schema
            formFields.forEach(field => {
                // Skip non-input fields
                if (field.type === 'description' || field.type === 'success_link') {
                    return;
                }

                const value = response.data[field.id];
                let displayValue = '';

                // Handle different data types
                if (Array.isArray(value)) {
                    // Checkbox groups return arrays
                    displayValue = value.length > 0 ? value.join(', ') : '-';
                } else if (typeof value === 'boolean') {
                    // Single checkboxes return booleans
                    displayValue = value ? 'Yes' : 'No';
                } else if (value === null || value === undefined || value === '') {
                    displayValue = '-';
                } else {
                    displayValue = value.toString();
                }

                html += `<td>${displayValue}</td>`;
            });

            // Add Edit and Delete buttons for this row
            html += `
            <td style="text-align:center; min-width: 100px;">
                <button class="btn btn-outline-primary btn-sm edit-response-row" data-id="${response.id}" title="Edit this response">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn btn-outline-danger btn-sm delete-response-row" data-id="${response.id}" title="Delete this response">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;

            html += "</tr>";
        });

        html += "</tbody></table>";
        tableEl.innerHTML = html;

        // Wire up individual delete buttons
        tableEl.querySelectorAll('.delete-response-row').forEach(btn => {
            btn.onclick = async () => {
                const responseId = btn.dataset.id;
                if (confirm('Delete this individual response? This cannot be undone.')) {
                    try {
                        btn.disabled = true;
                        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

                        const token = localStorage.getItem('adminToken');
                        const res = await fetch(`${API_BASE}/api/forms/${currentFormSlug}/responses/${responseId}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });

                        if (!res.ok) throw new Error('Failed to delete response');

                        // Refresh table
                        openResponsesPanel(currentFormSlug);

                    } catch (err) {
                        console.error('Delete individual response error:', err);
                        alert(`Failed to delete response: ${err.message}`);
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                    }
                }
            };
        });

        // Wire up individual edit buttons
        tableEl.querySelectorAll('.edit-response-row').forEach(btn => {
            btn.onclick = () => {
                const responseId = btn.dataset.id;
                const response = responses.find(r => r.id == responseId);
                if (response) {
                    openEditResponseModal(response, formFields);
                }
            };
        });
    }

    /**
     * Opens the Edit Response modal with dynamic fields
     * @param {object} response - The response object to edit
     * @param {array} formFields - The form schema fields
     */
    function openEditResponseModal(response, formFields) {
        const modal = document.getElementById('editResponseModal');
        const fieldsContainer = document.getElementById('editResponseFields');

        if (!modal || !fieldsContainer) return;

        fieldsContainer.innerHTML = '';

        formFields.forEach(field => {
            if (field.type === 'description' || field.type === 'success_link') return;

            const group = document.createElement('div');
            group.className = 'form-group';
            group.style.marginBottom = '15px';

            let html = `<label style="display:block; margin-bottom:5px; font-weight:500;">${field.label || field.id}</label>`;

            const value = response.data[field.id] || '';

            if (field.type === 'textarea') {
                html += `<textarea class="form-input edit-field-input" data-id="${field.id}" rows="3" style="width:100%">${value}</textarea>`;
            } else if (field.type === 'select') {
                html += `<select class="form-input edit-field-input" data-id="${field.id}" style="width:100%">
                <option value="">Select...</option>
                ${(field.options || []).map(opt => `<option value="${opt.value}" ${opt.value == value ? 'selected' : ''}>${opt.label}</option>`).join('')}
            </select>`;
            } else if (field.type === 'radio') {
                html += `<div class="radio-group">
                ${(field.options || []).map(opt => `
                    <label style="display:block; margin-bottom:5px;">
                        <input type="radio" class="edit-field-input" name="edit_${field.id}" value="${opt.value}" data-id="${field.id}" ${opt.value == value ? 'checked' : ''}> ${opt.label}
                    </label>
                `).join('')}
            </div>`;
            } else if (field.type === 'checkbox_group') {
                const checkedValues = Array.isArray(value) ? value : [];
                html += `<div class="checkbox-group">
                ${(field.options || []).map(opt => `
                    <label style="display:block; margin-bottom:5px;">
                        <input type="checkbox" class="edit-field-input checkbox-option" value="${opt.value}" data-id="${field.id}" ${checkedValues.includes(opt.value) ? 'checked' : ''}> ${opt.label}
                    </label>
                `).join('')}
            </div>`;
            } else if (field.type === 'checkbox') {
                html += `<label style="display:block; margin-bottom:5px;">
                <input type="checkbox" class="edit-field-input" data-id="${field.id}" ${value === true ? 'checked' : ''}> ${field.label}
            </label>`;
            } else {
                // text, email, tel
                html += `<input type="${field.type}" class="form-input edit-field-input" data-id="${field.id}" value="${value}" style="width:100%">`;
            }

            group.innerHTML = html;
            fieldsContainer.appendChild(group);
        });

        modal.classList.add('show');

        // Handle Save
        const saveBtn = document.getElementById('saveEditResponse');
        const cancelBtn = document.getElementById('cancelEditResponse');

        saveBtn.onclick = async () => {
            const newData = {};
            const inputs = fieldsContainer.querySelectorAll('.edit-field-input');

            formFields.forEach(field => {
                if (field.type === 'description' || field.type === 'success_link') return;

                if (field.type === 'checkbox_group') {
                    const checked = Array.from(fieldsContainer.querySelectorAll(`.edit-field-input[data-id="${field.id}"]:checked`)).map(i => i.value);
                    newData[field.id] = checked;
                } else if (field.type === 'radio') {
                    const selected = fieldsContainer.querySelector(`.edit-field-input[data-id="${field.id}"]:checked`);
                    newData[field.id] = selected ? selected.value : '';
                } else if (field.type === 'checkbox') {
                    const checked = fieldsContainer.querySelector(`.edit-field-input[data-id="${field.id}"]`).checked;
                    newData[field.id] = checked;
                } else {
                    const input = fieldsContainer.querySelector(`.edit-field-input[data-id="${field.id}"]`);
                    newData[field.id] = input ? input.value : '';
                }
            });

            try {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

                const token = localStorage.getItem('adminToken');
                const res = await fetch(`${API_BASE}/api/forms/${currentFormSlug}/responses/${response.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ data: newData })
                });

                if (!res.ok) throw new Error('Failed to update response');

                modal.classList.remove('show');
                openResponsesPanel(currentFormSlug); // Refresh table

            } catch (err) {
                console.error('Update response error:', err);
                alert(`Failed to update response: ${err.message}`);
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = 'Save Changes';
            }
        };

        cancelBtn.onclick = () => {
            modal.classList.remove('show');
        };
    }

    // ===== EXPORT BUTTONS (Responses Panel) =====
    document.getElementById('exportCsvBtn')?.addEventListener('click', () => {
        if (!currentFormSlug || !currentDesign.formTitle) {
            alert('No form context available. Please open responses from a form first.');
            return;
        }
        if (!currentResponses || !currentResponses.length) {
            alert('No responses to export.');
            return;
        }
        exportCsv(currentFormSlug, currentDesign.formTitle);
    });

    document.getElementById('exportPdfBtn')?.addEventListener('click', () => {
        if (!currentFormSlug || !currentDesign.formTitle) {
            alert('No form context available. Please open responses from a form first.');
            return;
        }
        if (!currentResponses || !currentResponses.length) {
            alert('No responses to export.');
            return;
        }
        exportPdf(currentFormSlug, currentDesign.formTitle);
    });

    document.getElementById('clearResponsesBtn')?.addEventListener('click', async () => {
        if (!currentFormSlug) return;

        if (confirm('Are you ABSOLUTELY sure you want to clear ALL responses for this form? This action is permanent and cannot be reversed.')) {
            try {
                const btn = document.getElementById('clearResponsesBtn');
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Clearing...';

                const token = localStorage.getItem('adminToken');
                const res = await fetch(`${API_BASE}/api/forms/${currentFormSlug}/responses`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!res.ok) throw new Error('Failed to clear responses');

                alert('All responses have been cleared.');
                openResponsesPanel(currentFormSlug);

            } catch (err) {
                console.error('Clear responses error:', err);
                alert(`Failed to clear responses: ${err.message}`);
            } finally {
                const btn = document.getElementById('clearResponsesBtn');
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Clear All';
            }
        }
    });

    // Add keyboard shortcut: ESC to close responses panel (returns to library)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const responsesPane = document.getElementById('responses');
            if (responsesPane && responsesPane.classList.contains('active')) {
                window.closeResponses();
            }
        }
    });
});
