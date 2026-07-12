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
    cloudName: "dc9dkwuhy",
    preset: "ml_default",
  },
};

let backendForms = [];
let currentFields = [];
let currentFormId = null;

// Responses State
let filteredResponses = [];
let responseSearchQuery = "";
let activeFilters = {};
let responseViewMode = "table";
let responseSortOrder = "desc"; // Default Newest First
let currentIndividualIndex = 0;
let currentFormFields = []; // Current schema for responses panel

document.addEventListener("DOMContentLoaded", () => {
  // Auth
  const token = localStorage.getItem("adminToken");
  if (!token && !window.location.pathname.includes("index.html")) {
    window.location.href = "index.html";
    return;
  }

  // --- Decode JWT to get role & username (no library needed) ---
  let currentUserRole = "admin";
  let currentUsername = "";
  try {
    const payloadB64 = token.split(".")[1];
    const decoded = JSON.parse(
      atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")),
    );
    currentUserRole = decoded.role || "admin";
    currentUsername = decoded.username || "";
  } catch (_) {
    /* keep defaults */
  }

  // --- 3-Minute Idle Timeout (Admin Security) ---
  let idleTimer;
  const IDLE_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

  function resetIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      // Log out due to inactivity
      localStorage.removeItem("adminToken");
      alert("You have been logged out due to inactivity.");
      window.location.href = "index.html";
    }, IDLE_TIMEOUT_MS);
  }

  // Set initial timer
  resetIdleTimer();

  // Reset timer on any user activity
  const activityEvents = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
  activityEvents.forEach(evt => {
    document.addEventListener(evt, resetIdleTimer, true);
  });

  // --- Banner Upload UI Logic ---
  {
    const bannerUpload = document.getElementById("bannerUpload");
    const bannerUploadLabel = document.getElementById("bannerUploadLabel");
    if (bannerUpload && bannerUploadLabel) {
      bannerUpload.addEventListener("change", function () {
        const span = bannerUploadLabel.querySelector(".file-name");
        if (this.files && this.files.length > 0) {
          span.textContent = this.files[0].name;
          bannerUploadLabel.classList.add("has-file");
        } else {
          span.textContent = "Click to upload banner";
          bannerUploadLabel.classList.remove("has-file");
        }
      });
      const removeBannerBtn = document.getElementById("removeBanner");
      if (removeBannerBtn) {
        removeBannerBtn.addEventListener("click", () => {
          setTimeout(() => {
            if (!bannerUpload.value) {
              bannerUploadLabel.querySelector(".file-name").textContent =
                "Click to upload banner";
              bannerUploadLabel.classList.remove("has-file");
            }
          }, 10);
        });
      }
    }
  }

  // --- Logo Upload UI Logic ---
  {
    const logoLightUpload = document.getElementById("logoLightUpload");
    const logoLightUploadLabel = document.getElementById(
      "logoLightUploadLabel",
    );
    if (logoLightUpload && logoLightUploadLabel) {
      logoLightUpload.addEventListener("change", function () {
        const span = logoLightUploadLabel.querySelector(".file-name");
        if (this.files && this.files.length > 0) {
          span.textContent = this.files[0].name;
          logoLightUploadLabel.classList.add("has-file");
        } else {
          span.textContent = "Click to upload light logo";
          logoLightUploadLabel.classList.remove("has-file");
        }
      });
    }

    const logoDarkUpload = document.getElementById("logoDarkUpload");
    const logoDarkUploadLabel = document.getElementById("logoDarkUploadLabel");
    if (logoDarkUpload && logoDarkUploadLabel) {
      logoDarkUpload.addEventListener("change", function () {
        const span = logoDarkUploadLabel.querySelector(".file-name");
        if (this.files && this.files.length > 0) {
          span.textContent = this.files[0].name;
          logoDarkUploadLabel.classList.add("has-file");
        } else {
          span.textContent = "Click to upload dark logo";
          logoDarkUploadLabel.classList.remove("has-file");
        }
      });
    }
  }

  // --- Role-based UI gating ---
  const isSuperAdmin = currentUserRole === "superadmin";

  // Show Team tab for superadmin
  document.querySelectorAll(".superadmin-only").forEach((el) => {
    el.style.display = isSuperAdmin ? "" : "none";
  });

  // Logout logic
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminRole");
      localStorage.removeItem("adminUsername");
      window.location.href = "index.html";
    });
  }

  // Change Password logic
  const changePasswordBtn = document.getElementById("changePasswordBtn");
  const changePasswordModal = document.getElementById("changePasswordModal");
  const closeChangePasswordBtn = document.getElementById("closeChangePasswordBtn");
  const cancelPasswordBtn = document.getElementById("cancelPasswordBtn");
  const submitPasswordBtn = document.getElementById("submitPasswordBtn");
  const newPasswordInput = document.getElementById("newPasswordInput");
  const confirmPasswordInput = document.getElementById("confirmPasswordInput");
  const passwordError = document.getElementById("passwordError");

  function closePasswordModal() {
    changePasswordModal.classList.remove("show");
    newPasswordInput.value = "";
    confirmPasswordInput.value = "";
    passwordError.style.display = "none";
  }

  if (changePasswordBtn && changePasswordModal) {
    // Hide the button for Super Admin since their password isn't in the DB
    if (isSuperAdmin) {
      changePasswordBtn.style.display = "none";
    }

    changePasswordBtn.addEventListener("click", () => {
      changePasswordModal.classList.add("show");
    });

    closeChangePasswordBtn.addEventListener("click", closePasswordModal);
    cancelPasswordBtn.addEventListener("click", closePasswordModal);

    submitPasswordBtn.addEventListener("click", async () => {
      const newPwd = newPasswordInput.value;
      const confirmPwd = confirmPasswordInput.value;

      if (!newPwd || newPwd.length < 8) {
        passwordError.textContent = "Password must be at least 8 characters.";
        passwordError.style.display = "block";
        return;
      }
      if (newPwd !== confirmPwd) {
        passwordError.textContent = "Passwords do not match.";
        passwordError.style.display = "block";
        return;
      }

      try {
        submitPasswordBtn.disabled = true;
        submitPasswordBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';
        passwordError.style.display = "none";

        const res = await fetch(API_BASE + "/api/admin/password", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword: newPwd })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update password");

        alert("Password updated successfully! Please log in again with your new password.");
        closePasswordModal();
        logoutBtn.click(); // Log them out to verify new password
      } catch (err) {
        passwordError.textContent = err.message;
        passwordError.style.display = "block";
      } finally {
        submitPasswordBtn.disabled = false;
        submitPasswordBtn.innerHTML = "Update Password";
      }
    });
  }

  // Standardized API Fetch with Auth
  const originalFetch = window.fetch;
  window.fetch = function (url, options = {}) {
    const token = localStorage.getItem("adminToken");
    const urlString = url.toString();
    // Only inject token for our own API calls, bypass for Cloudinary/external to prevent CORS errors
    const isOurApi =
      urlString.startsWith(API_BASE) ||
      urlString.startsWith("/") ||
      urlString.startsWith("./") ||
      urlString.includes("localhost") ||
      urlString.includes("127.0.0.1");

    if (token && isOurApi && !urlString.includes("cloudinary.com")) {
      options.headers = {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      };
    }
    return originalFetch(url, options).then((response) => {
      if (response.status === 401) {
        // Ignore 401 on login attempts (obviously)
        if (!url.toString().includes("/api/login")) {
          console.warn("Session expired (401). Redirecting to login...");
          localStorage.removeItem("adminToken");
          localStorage.removeItem("adminRole");
          localStorage.removeItem("adminUsername");
          // Store current URL to redirect back after login if possible
          sessionStorage.setItem(
            "redirectAfterLogin",
            window.location.pathname + window.location.search,
          );
          window.location.href = "index.html?expired=true";
        }
      }
      if (response.status === 403 && !url.toString().includes("/api/login")) {
        console.error("Access restricted (403).");
      }
      return response;
    });
  };

  // Initialize
  loadFormsFromBackend();
  // checkAndRestoreDraft moved to after initialization

  function cleanInvalidBranching() {
    const validSectionIds = new Set();
    currentFields.forEach((f) => {
      if (f.type === "section_break") validSectionIds.add(f.id);
    });

    let removedCount = 0;

    if (
      currentDesign.section1Goto &&
      currentDesign.section1Goto !== "continue" &&
      currentDesign.section1Goto !== "submit" &&
      currentDesign.section1Goto !== "exit" &&
      !currentDesign.section1Goto.startsWith("exit:") &&
      !validSectionIds.has(currentDesign.section1Goto)
    ) {
      currentDesign.section1Goto = "continue";
      removedCount++;
    }

    currentFields.forEach((f) => {
      if (
        f.type === "section_break" &&
        f.goto &&
        f.goto !== "continue" &&
        f.goto !== "submit" &&
        f.goto !== "exit" &&
        !f.goto.startsWith("exit:") &&
        !validSectionIds.has(f.goto)
      ) {
        f.goto = "continue";
        removedCount++;
      }
      if (f.options) {
        f.options.forEach((opt) => {
          if (
            typeof opt === "object" &&
            opt.goto &&
            opt.goto !== "continue" &&
            opt.goto !== "submit" &&
            opt.goto !== "exit" &&
            !opt.goto.startsWith("exit:") &&
            !validSectionIds.has(opt.goto)
          ) {
            opt.goto = "continue";
            removedCount++;
          }
        });
      }
    });

    if (removedCount > 0) {
      console.warn(
        `Cleaned up ${removedCount} invalid branching destinations.`,
      );
    }
  }

  // --- AUTOSAVE LOGIC ---
  function getDraftKey() {
    return "form_builder_draft_" + (currentUsername || "unknown");
  }

  function saveDraft() {
    if (!currentDesign.formTitle && currentFields.length === 0) return;
    cleanInvalidBranching();
    const draft = {
      design: currentDesign,
      fields: currentFields,
      formId: currentFormId,
      mode: formMode,
      timestamp: Date.now(),
    };
    localStorage.setItem(getDraftKey(), JSON.stringify(draft));
    console.log("Draft autosaved at " + new Date().toLocaleTimeString());
  }

  function clearDraft() {
    localStorage.removeItem(getDraftKey());
  }

  async function checkAndRestoreDraft() {
    const rawDraft = localStorage.getItem(getDraftKey());
    if (!rawDraft) return;

    try {
      const draft = JSON.parse(rawDraft);
      const timeAgo = Math.round((Date.now() - draft.timestamp) / 1000 / 60);

      if (timeAgo > 60 * 24) {
        // Don't restore drafts older than 24 hours
        clearDraft();
        return;
      }

      if (
        await CustomDialog.confirm(
          `You have an unsaved draft from ${timeAgo} minutes ago. Would you like to restore it?`,
        )
      ) {
        currentDesign = draft.design;
        currentFields = draft.fields;
        currentFormId = draft.formId;
        formMode = draft.mode;

        // Sync UI
        if (formTitleInput)
          formTitleInput.value = currentDesign.formTitle || "";
        if (formDescInput)
          formDescInput.value = currentDesign.formDescription || "";
        if (webTitleInput) webTitleInput.value = currentDesign.webTitle || "";
        if (responseLimitInput)
          responseLimitInput.value = currentDesign.responseLimit || "";
        if (colorValueInput)
          colorValueInput.value = currentDesign.themeColor || "#db4437";
        if (themeColorSwatch)
          themeColorSwatch.style.background =
            currentDesign.themeColor || "#db4437";
        if (colorPicker) {
          try {
            colorPicker.value = currentDesign.themeColor || "#db4437";
          } catch (e) {}
        }

        renderFieldBuilder();
        updatePreview();
        showFormTabs();
        switchTab("builder");
      } else {
        clearDraft();
      }
    } catch (e) {
      console.error("Failed to parse draft", e);
      clearDraft();
    }
  }

  // Debounce helper
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
  const debouncedSaveDraft = debounce(saveDraft, 2000);
  // State sync inputs
  const colorPicker = document.getElementById("themeColorPicker");
  const colorValueInput = document.getElementById("colorValueInput");
  const themeColorSwatch = document.getElementById("themeColorSwatch");
  const formTitleInput = document.getElementById("formTitleInput");
  const formDescInput = document.getElementById("formDescInput");
  const responseLimitInput = document.getElementById("responseLimitInput");
  const allowMultipleInput = document.getElementById(
    "allowMultipleResponsesInput",
  );
  const webTitleInput = document.getElementById("webTitleInput");
  const cloudNameInput = document.getElementById("cloudinaryCloudName");
  const cloudPresetInput = document.getElementById("cloudinaryPreset");

  // Action buttons & sections
  const libraryContainer = document.getElementById("formsLibraryList");
  const builderSection = document.getElementById("builder");
  const librarySection = document.getElementById("library");
  const addFormBtn = document.getElementById("addFormBtn");
  const refreshLibraryBtn = document.getElementById("refreshLibraryBtn");
  const saveToLibraryBtn = document.getElementById("saveToLibraryBtn");

  // Media & Assets
  const manageLogoBtn = document.getElementById("manageLogoBtn");
  const logoUploadSection = document.getElementById("logoUploadSection");
  const logoLightUpload = document.getElementById("logoLightUpload");
  const logoDarkUpload = document.getElementById("logoDarkUpload");
  const removeLogosBtn = document.getElementById("removeLogosBtn");
  const bannerUpload = document.getElementById("bannerUpload");
  const removeBannerBtn = document.getElementById("removeBanner");

  // Mobile Menu
  const mobileMenuToggle = document.getElementById("mobileMenuToggle");
  const mainSidebar = document.querySelector(".sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");

  // Field Editor Sidebar
  const editorSidebar = document.getElementById("editorSidebar");
  const closeSidebarBtn = document.querySelector(".close-sidebar");
  const addFieldBtn = document.getElementById("openAddSidebarBtn");
  const addSectionBtn = document.getElementById("addSectionBtn");
  const fieldList = document.getElementById("fieldBuilderList");
  const editLabel = document.getElementById("editLabel");
  const editType = document.getElementById("editType");
  const editRequired = document.getElementById("editRequired");
  const editLinkUrl = document.getElementById("editLinkUrl");
  const linkUrlContainer = document.getElementById("linkUrlContainer");
  const optionsContainer = document.getElementById("optionsContainer");
  const optionsList = document.getElementById("optionsList");
  const addOptionBtn = document.getElementById("addOptionBtn");
  const saveFieldBtn = document.getElementById("saveFieldBtn");
  const deleteFieldBtn = document.getElementById("deleteFieldBtn");
  const mediaUrlContainer = document.getElementById("mediaUrlContainer");
  const editMediaUrl = document.getElementById("editMediaUrl");
  const editImageUpload = document.getElementById("editImageUpload");
  const imageUploadStatus = document.getElementById("imageUploadStatus");
  const sidebarImagePreview = document.getElementById("sidebarImagePreview");
  const sidebarImagePreviewContainer = document.getElementById(
    "sidebarImagePreviewContainer",
  );

  const previewContainer = null; // Reserved for future use

  // Initialize
  loadFormsFromBackend();
  checkAndRestoreDraft();

  // Color picker
  if (colorPicker && colorValueInput) {
    colorPicker.addEventListener("input", (e) => {
      currentDesign.themeColor = e.target.value;
      colorValueInput.value = e.target.value;
      if (themeColorSwatch) themeColorSwatch.style.background = e.target.value;
      debouncedSaveDraft();
    });

    colorValueInput.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      currentDesign.themeColor = val;
      if (themeColorSwatch) themeColorSwatch.style.background = val;

      // Try to set native picker if it's a valid hex
      if (val.match(/^#[0-9a-fA-F]{6}$/)) {
        colorPicker.value = val;
      }
      debouncedSaveDraft();
    });
  }

  // Sync form title
  if (formTitleInput) {
    formTitleInput.addEventListener("input", (e) => {
      currentDesign.formTitle = e.target.value;
      debouncedSaveDraft();
    });
  }

  // Sync web title
  if (webTitleInput) {
    webTitleInput.addEventListener("input", (e) => {
      currentDesign.webTitle = e.target.value;
    });
  }

  // Sync form description
  if (formDescInput) {
    formDescInput.addEventListener("input", (e) => {
      currentDesign.formDescription = e.target.value;
      debouncedSaveDraft();
    });
  }

  // Sync response limit
  if (responseLimitInput) {
    responseLimitInput.addEventListener("input", (e) => {
      currentDesign.responseLimit = e.target.value
        ? parseInt(e.target.value)
        : null;
    });
  }

  // Sync allow multiple responses
  if (allowMultipleInput) {
    allowMultipleInput.addEventListener("change", (e) => {
      currentDesign.allowMultipleResponses = e.target.checked;
    });
  }

  // Cloudinary config listeners

  if (cloudNameInput) {
    cloudNameInput.addEventListener("input", (e) => {
      if (!currentDesign.cloudinary)
        currentDesign.cloudinary = {
          cloudName: "dc9dkwuhy",
          preset: "ml_default",
        };
      currentDesign.cloudinary.cloudName = e.target.value.trim();
    });
  }

  if (cloudPresetInput) {
    cloudPresetInput.addEventListener("input", (e) => {
      if (!currentDesign.cloudinary)
        currentDesign.cloudinary = {
          cloudName: "dc9dkwuhy",
          preset: "ml_default",
        };
      currentDesign.cloudinary.preset = e.target.value.trim();
    });
  }

  // Image Upload (Sidebar)
  let editingFieldIndex = null; // Track which field we are editing

  if (editImageUpload) {
    editImageUpload.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        imageUploadStatus.textContent = "Uploading image...";
        imageUploadStatus.style.color = "var(--primary)";

        // Use the shared uploadAsset function (handles Cloudinary + Base64 fallback)
        const urlOrBase64 = await uploadAsset(file);

        // Sync to text input
        if (editMediaUrl) {
          editMediaUrl.value = urlOrBase64;
          updateSidebarImagePreview(urlOrBase64);
        }

        imageUploadStatus.textContent = "Upload successful! 🎉";
        imageUploadStatus.style.color = "var(--success)";
        setTimeout(() => {
          if (imageUploadStatus) imageUploadStatus.textContent = "";
        }, 3000);
      } catch (err) {
        console.error("Upload Error:", err);
        imageUploadStatus.textContent = "Error: " + err.message;
        imageUploadStatus.style.color = "#dc2626";
      } finally {
        editImageUpload.value = ""; // Reset input
      }
    });
  }

  if (editMediaUrl) {
    editMediaUrl.addEventListener("input", (e) => {
      updateSidebarImagePreview(e.target.value.trim());
    });
  }

  function updateSidebarImagePreview(url) {
    if (!sidebarImagePreview || !sidebarImagePreviewContainer) return;
    if (url && (url.startsWith("http") || url.startsWith("data:"))) {
      sidebarImagePreview.src = url;
      sidebarImagePreviewContainer.style.display = "block";
    } else {
      sidebarImagePreview.src = "";
      sidebarImagePreviewContainer.style.display = "none";
    }
  }

  // Mobile Menu

  if (mobileMenuToggle && mainSidebar) {
    mobileMenuToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = mainSidebar.classList.toggle("mobile-open");
      if (sidebarOverlay) {
        sidebarOverlay.classList.toggle("show", isOpen);
      }
      const icon = mobileMenuToggle.querySelector("i");
      if (icon) {
        if (isOpen) {
          icon.className = "fa-solid fa-times";
        } else {
          icon.className = "fa-solid fa-bars";
        }
      }
    });

    // Combined Sidebar/Overlay closer
    const closeAllMenus = () => {
      if (mainSidebar) mainSidebar.classList.remove("mobile-open");
      if (editorSidebar) editorSidebar.classList.remove("show");
      if (sidebarOverlay) sidebarOverlay.classList.remove("show");
      const icon = mobileMenuToggle?.querySelector("i");
      if (icon) icon.className = "fa-solid fa-bars";
      editingFieldIndex = null;
    };

    if (sidebarOverlay) {
      sidebarOverlay.addEventListener("click", closeAllMenus);
    }

    // Close sidebar when clicking outside on mobile
    document.addEventListener("click", (e) => {
      if (window.innerWidth <= 768) {
        // If the sidebar is open, and we click outside BOTH the main sidebar AND the editor sidebar
        const isClickInsideMain = mainSidebar && mainSidebar.contains(e.target);
        const isClickInsideEditor =
          editorSidebar && editorSidebar.contains(e.target);
        const isClickOnToggle =
          mobileMenuToggle && mobileMenuToggle.contains(e.target);

        if (!isClickInsideMain && !isClickInsideEditor && !isClickOnToggle) {
          closeAllMenus();
        }
      }
    });

    // Close sidebar when nav item is clicked on mobile
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.addEventListener("click", () => {
        if (window.innerWidth <= 768) {
          closeAllMenus();
        }
      });
    });
  }

  function showFormTabs() {
    document
      .querySelectorAll(
        '.nav-item[data-tab="builder"], .nav-item[data-tab="responses"]',
      )
      .forEach((item) => item.classList.remove("hidden"));
  }

  function hideFormTabs() {
    document
      .querySelectorAll(
        '.nav-item[data-tab="builder"], .nav-item[data-tab="responses"]',
      )
      .forEach((item) => item.classList.add("hidden"));
  }

  window.showFormTabs = showFormTabs;
  window.hideFormTabs = hideFormTabs;

  // Tabs
  document.querySelectorAll(".nav-item").forEach((navItem) => {
    navItem.addEventListener("click", function () {
      const targetTab = this.getAttribute("data-tab");
      switchTab(targetTab);
    });
  });

  /**
   * Centralized function to switch between dashboard tabs
   * @param {string} tabId - The ID of the tab to activate
   */
  function switchTab(tabId) {
    // Hide all
    document
      .querySelectorAll(".nav-item")
      .forEach((item) => item.classList.remove("active"));
    document
      .querySelectorAll(".tab-pane")
      .forEach((pane) => pane.classList.remove("active"));

    // Show target
    const tab = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    const pane = document.getElementById(tabId);

    if (tab) tab.classList.add("active");
    if (pane) pane.classList.add("active");

    // Contextual visibility
    if (tabId === "library") {
      hideFormTabs();
    }

    // Load team tab data when switched to
    if (tabId === "team" && isSuperAdmin) {
      loadAdminUsers();
    }

    const addFormBtn = document.getElementById("addFormBtn");
    if (addFormBtn) {
      addFormBtn.style.display = tabId === "library" ? "block" : "none";
    }

    console.log(`Switched to tab: ${tabId}`);
  }
  window.switchTab = switchTab;

  function renderLibrary() {
    if (!libraryContainer) return;
    libraryContainer.innerHTML = "";

    if (backendForms.length === 0) {
      libraryContainer.innerHTML =
        '<p class="text-secondary" style="grid-column: 1/-1; text-align:center; padding: 40px;">No forms found. Create your first one!</p>';
      return;
    }

    backendForms.forEach((form) => {
      const card = document.createElement("div");
      card.className = "target-card";
      const isOpen = form.status !== "closed";

      const safeName = escapeHtml(form.name || "Untitled");
      const safeSlug = escapeHtml(form.slug);

      card.innerHTML = `
                <div class="target-card-header">
                    <h3>${safeName}</h3>
                    <span class="status-badge ${isOpen ? "status-open" : "status-closed"}">
                        ${isOpen ? "Accepting Responses" : "Closed"}
                    </span>
                </div>
                <div class="target-card-info">
                    <p>Slug: <code>${safeSlug}</code></p>
                    <p>Modified: ${form.date || "Unknown"}</p>
                    ${isSuperAdmin ? `<p>Created by: <strong>${escapeHtml(form.created_by || 'Super Admin')}</strong></p>` : ''}
                </div>
                <div class="target-card-actions">
                    <button class="btn-card-primary edit-form-btn" data-id="${form.id}">Edit</button>
                    <button class="btn-card-secondary toggle-status-btn" data-id="${form.id}">
                        ${isOpen ? "Close" : "Open"}
                    </button>
                    <button class="btn-card-secondary delete-form-btn" data-id="${form.id}" style="color: var(--danger)">Delete</button>
                    <a href="form.html?form=${safeSlug}" target="_blank" class="btn-card-secondary">View Live</a>
                    <button class="btn-card-secondary view-responses-btn" data-slug="${form.slug}">
                        <i class="fa-solid fa-chart-simple"></i> Responses
                    </button>
                </div>
            `;
      libraryContainer.appendChild(card);
    });

    document.querySelectorAll(".edit-form-btn").forEach(
      (btn) =>
        (btn.onclick = () => {
          const form = backendForms.find((f) => f.id === btn.dataset.id);
          if (form) loadFormIntoBuilder(form);
        }),
    );
    document
      .querySelectorAll(".toggle-status-btn")
      .forEach((btn) => (btn.onclick = () => toggleFormStatus(btn.dataset.id)));
    document
      .querySelectorAll(".delete-form-btn")
      .forEach((btn) => (btn.onclick = () => deleteForm(btn.dataset.id)));
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Library
  if (refreshLibraryBtn) {
    refreshLibraryBtn.addEventListener("click", () => loadFormsFromBackend());
  }

  async function loadFormsFromBackend() {
    const refreshBtn = document.getElementById("refreshLibraryBtn");

    try {
      if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      }

      const res = await fetch(API_BASE + "/api/forms/library/all");

      if (!res.ok) {
        throw new Error(
          `Failed to load forms: ${res.status} ${res.statusText}`,
        );
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
    const form = backendForms.find((f) => f.id === id);
    if (!form) return;

    const newStatus = form.status !== "closed" ? "closed" : "open";
    const btn = document.querySelector(`.toggle-status-btn[data-id="${id}"]`);
    const originalText = btn?.textContent;

    try {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      }

      const res = await fetch(API_BASE + `/api/forms/${form.slug}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
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
    const form = backendForms.find((f) => f.id === id);
    if (!form || !(await CustomDialog.confirm(`Delete form "${form.name}"?`)))
      return;

    // Find button for loading state
    const btn = document.querySelector(`.delete-form-btn[data-id="${id}"]`);

    try {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      }

      const res = await fetch(API_BASE + "/api/forms/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: form.slug }),
      });

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
        btn.textContent = "Delete";
      }
    }
  }

  // Builder

  // newTargetBtn removed - using addFormBtn instead

  // --- ADD FORM BUTTON ---
  document.getElementById("addFormBtn")?.addEventListener("click", () => {
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
        cloudName: "dc9dkwuhy",
        preset: "ml_default",
      },
    };

    // Update UI - Form Design
    document.getElementById("cloudinaryCloudName").value = "dc9dkwuhy";
    document.getElementById("cloudinaryPreset").value = "ml_default";
    const themePicker = document.getElementById("themeColorPicker");
    if (themePicker) {
      try {
        themePicker.value = "#db4437";
      } catch (e) {}
    }
    const colorInput = document.getElementById("colorValueInput");
    if (colorInput) colorInput.value = "#db4437";
    const colorSwatch = document.getElementById("themeColorSwatch");
    if (colorSwatch) colorSwatch.style.background = "#db4437";
    if (formTitleInput) formTitleInput.value = currentDesign.formTitle;
    if (webTitleInput) webTitleInput.value = currentDesign.webTitle || "";
    if (formDescInput) formDescInput.value = currentDesign.formDescription;
    document.getElementById("responseLimitInput").value = "";
    if (allowMultipleInput) allowMultipleInput.checked = true;

    // Clear file inputs
    const bannerUpload = document.getElementById("bannerUpload");
    const logoLightUpload = document.getElementById("logoLightUpload");
    const logoDarkUpload = document.getElementById("logoDarkUpload");
    if (bannerUpload) {
      bannerUpload.value = "";
      const bannerUploadLabel = document.getElementById("bannerUploadLabel");
      if (bannerUploadLabel) {
        bannerUploadLabel.querySelector(".file-name").textContent =
          "Click to upload banner";
        bannerUploadLabel.classList.remove("has-file");
      }
    }
    if (logoLightUpload) {
      logoLightUpload.value = "";
      const logoLightUploadLabel = document.getElementById(
        "logoLightUploadLabel",
      );
      if (logoLightUploadLabel) {
        logoLightUploadLabel.querySelector(".file-name").textContent =
          "Click to upload light logo";
        logoLightUploadLabel.classList.remove("has-file");
      }
    }
    if (logoDarkUpload) {
      logoDarkUpload.value = "";
      const logoDarkUploadLabel = document.getElementById(
        "logoDarkUploadLabel",
      );
      if (logoDarkUploadLabel) {
        logoDarkUploadLabel.querySelector(".file-name").textContent =
          "Click to upload dark logo";
        logoDarkUploadLabel.classList.remove("has-file");
      }
    }

    // Clear fields list
    renderFieldBuilder(); // Changed from renderFieldsList() to renderFieldBuilder() to match existing function name

    // Show tabs when creating new form
    showFormTabs();

    // Switch to Form Builder tab
    document
      .querySelectorAll(".nav-item")
      .forEach((item) => item.classList.remove("active"));
    document
      .querySelectorAll(".tab-pane")
      .forEach((pane) => pane.classList.remove("active"));

    const builderTab = document.querySelector('.nav-item[data-tab="builder"]');
    const builderPane = document.getElementById("builder");

    if (builderTab) builderTab.classList.add("active");
    if (builderPane) builderPane.classList.add("active");

    console.log("Add Form: Mode set to CREATE");
  });

  function loadFormIntoBuilder(form) {
    // Set state
    formMode = "edit";
    currentFormId = form.id;
    currentFormSlug = form.slug;
    currentFields = form.config || form.fields || [];
    currentDesign = form.design || {
      ...currentDesign,
      formTitle: form.title || form.name || "Untitled Form",
      formDescription: form.description || "",
    };

    // Handle legacy top-level props if design is missing
    if (!form.design) {
      currentDesign.formTitle = form.title || form.name || "Untitled";
      currentDesign.formDescription = form.description || "";
      currentDesign.responseLimit = form.responseLimit || null;
    }

    // Update UI
    if (document.getElementById("formTitleInput"))
      document.getElementById("formTitleInput").value =
        currentDesign.formTitle || "";
    if (document.getElementById("formDescInput"))
      document.getElementById("formDescInput").value =
        currentDesign.formDescription || "";
    if (document.getElementById("webTitleInput"))
      document.getElementById("webTitleInput").value =
        currentDesign.webTitle || "";
    if (document.getElementById("responseLimitInput"))
      document.getElementById("responseLimitInput").value =
        currentDesign.responseLimit || "";

    const allowMultipleInput = document.getElementById(
      "allowMultipleResponsesInput",
    );
    if (allowMultipleInput)
      allowMultipleInput.checked =
        currentDesign.allowMultipleResponses !== false;

    const colorPicker = document.getElementById("themeColorPicker");
    const colorValue = document.getElementById("colorValue");
    if (colorPicker) {
      colorPicker.value = currentDesign.themeColor || "#db4437";
      if (colorValue)
        colorValue.innerText = currentDesign.themeColor || "#db4437";
    }

    // Sync Cloudinary UI
    if (document.getElementById("cloudinaryCloudName"))
      document.getElementById("cloudinaryCloudName").value =
        currentDesign.cloudinary?.cloudName || "";
    if (document.getElementById("cloudinaryPreset"))
      document.getElementById("cloudinaryPreset").value =
        currentDesign.cloudinary?.preset || "";

    renderFieldBuilder();
    updatePreview();
    showFormTabs();
    switchTab("builder");

    console.log("Load Form: Mode set to EDIT, settings restored");
  }

  // Back to library functionality (handled by tab navigation in current HTML)

  // --- FIELD BUILDER ---

  function renderFieldBuilder() {
    if (!fieldList) return;
    fieldList.innerHTML = "";

    const sectionBreaks = currentFields.filter(
      (f) => f.type === "section_break",
    );
    const hasSections = sectionBreaks.length > 0;

    let currentSectionBreak = null;
    let sectionCounter = 1;

    function renderAfterSectionDropdown(targetSectionBreak, secNum) {
      // targetSectionBreak is null for Section 1, or the section_break object for subsequent sections
      const block = document.createElement("div");
      block.className = "after-section-block";
      block.style.background = "var(--bg-card)";
      block.style.padding = "16px 24px";
      block.style.borderRadius = "12px";
      block.style.marginTop = "8px";
      block.style.marginBottom = "32px";
      block.style.display = "flex";
      block.style.justifyContent = "space-between";
      block.style.alignItems = "center";
      block.style.border = "1px solid var(--border)";
      block.style.boxShadow = "0 4px 6px rgba(0,0,0,0.05)";

      let selectHtml = `<select class="after-section-select" data-section-id="${targetSectionBreak ? targetSectionBreak.id : "section1"}" style="padding: 10px 16px; border-radius: 8px; border: 1px solid var(--border); font-size: 0.95rem; background: var(--bg-body); color: var(--text-main); font-weight: 500; min-width: 300px; cursor: pointer; transition: all 0.2s ease; outline: none;">`;

      // Populate options
      selectHtml += `<option value="continue">Continue to next section</option>`;
      let optCounter = 2;
      currentFields.forEach((f) => {
        if (f.type === "section_break") {
          let lbl = f.label || "Untitled";
          if (lbl.length > 25) lbl = lbl.substring(0, 25) + "...";
          selectHtml += `<option value="${f.id}">Go to Section ${optCounter} (${lbl})</option>`;
          optCounter++;
        }
      });
      selectHtml += `<option value="submit">Submit Form</option>`;
      selectHtml += `<option value="exit">Exit Form (Custom Message)</option>`;
      selectHtml += `</select>`;

      block.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 4px; padding-right: 20px; flex-shrink: 0;">
                <span style="font-weight: 700; font-size: 1.1rem; color: var(--text-main);">After section ${secNum}</span>
                <span style="font-size: 0.9rem; color: var(--text-secondary);">Default routing for users finishing this section</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 300px;">
                ${selectHtml}
                <input type="text" class="exit-message-input" placeholder="Enter custom exit message..." style="display:none; height: 38px; padding: 0 12px; border-radius: 8px; border: 1px dashed var(--primary); font-size: 0.9rem; background: rgba(37,99,235,0.05); color: var(--text-main); width: 100%; box-sizing: border-box;">
            </div>
        `;

      // Set current value
      const currentVal = targetSectionBreak
        ? targetSectionBreak.goto || "continue"
        : currentDesign.section1Goto || "continue";
      setTimeout(() => {
        const sel = block.querySelector("select");
        const exitInput = block.querySelector(".exit-message-input");

        // If current value starts with 'exit:', set select to 'exit' and populate the message input
        if (currentVal.startsWith("exit:")) {
          sel.value = "exit";
          if (exitInput) {
            exitInput.style.display = "block";
            exitInput.value = currentVal.substring(5);
          }
        } else {
          sel.value = currentVal;
        }

        // Toggle exit message input visibility
        sel.onchange = (e) => {
          const val = e.target.value;
          if (val === "exit") {
            exitInput.style.display = "block";
            exitInput.focus();
            const exitMsg =
              exitInput.value.trim() ||
              "You do not meet the criteria for this form.";
            if (targetSectionBreak) {
              targetSectionBreak.goto = "exit:" + exitMsg;
            } else {
              currentDesign.section1Goto = "exit:" + exitMsg;
            }
          } else {
            exitInput.style.display = "none";
            if (targetSectionBreak) {
              targetSectionBreak.goto = val;
            } else {
              currentDesign.section1Goto = val;
            }
          }
          debouncedSaveDraft();
        };

        // Save exit message on input
        if (exitInput) {
          exitInput.oninput = () => {
            const msg =
              exitInput.value.trim() ||
              "You do not meet the criteria for this form.";
            if (targetSectionBreak) {
              targetSectionBreak.goto = "exit:" + msg;
            } else {
              currentDesign.section1Goto = "exit:" + msg;
            }
            debouncedSaveDraft();
          };
        }
      }, 0);

      fieldList.appendChild(block);
    }

    currentFields.forEach((field, index) => {
      if (hasSections && field.type === "section_break") {
        // Before rendering the new section break, render the "After Section" block for the PREVIOUS section
        renderAfterSectionDropdown(currentSectionBreak, sectionCounter);
        sectionCounter++;
        currentSectionBreak = field;
      }

      const fieldItem = document.createElement("div");
      fieldItem.className = "field-item";
      fieldItem.setAttribute("draggable", "true");
      fieldItem.dataset.index = index;

      let previewHtml = "";
      if (field.type === "image" && field.mediaUrl) {
        previewHtml = `<img src="${field.mediaUrl}" style="height:40px; border-radius:4px; margin-right:12px; object-fit:cover; border:1px solid var(--border);">`;
      }

      let fieldContentHtml = `
          <strong style="color: var(--primary);">${field.type.toUpperCase()}</strong>
          <div style="margin-top:4px; color: var(--text-main); font-weight: 500;">${field.label || (field.type === "section_break" ? "Untitled Section" : "Untitled Field")}</div>
          ${field.required ? '<span style="color: var(--danger); font-size:0.8rem;">* Required</span>' : ""}
      `;

      if (field.type === "section_break") {
        fieldItem.style.borderLeft = "6px solid var(--primary)";
        fieldItem.style.backgroundColor = "rgba(37,99,235,0.05)";
        fieldItem.style.marginTop = "20px";
        fieldContentHtml = `
              <strong style="color: var(--primary); font-size: 1.1rem;"><i class="fa-solid fa-layer-group"></i> SECTION BREAK</strong>
              <div style="margin-top:4px; color: var(--text-main); font-weight: 600; font-size: 1.2rem;">${field.label || "Untitled Section"}</div>
              <div style="color: var(--text-secondary); font-size: 0.9rem;">${field.description || ""}</div>
          `;
      }

      fieldItem.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:10px; width: 100%;">
                        <span class="drag-handle" title="Drag to reorder" style="
                            cursor: grab;
                            color: var(--text-muted, #9ca3af);
                            font-size: 1rem;
                            padding: 4px 6px;
                            border-radius: 4px;
                            flex-shrink: 0;
                            transition: color 0.15s;
                            user-select: none;
                        ">
                            <i class="fa-solid fa-grip-vertical"></i>
                        </span>
                        ${previewHtml}
                        <div style="flex-grow: 1;">
                            ${fieldContentHtml}
                        </div>
                    </div>
                    <button class="remove-field" data-index="${index}" style="color: var(--danger); border:none; background:none; cursor:pointer; padding:8px;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;

      // Click to edit (but not on the handle or trash)
      fieldItem.addEventListener("click", (e) => {
        e.stopPropagation();
        if (
          !e.target.closest(".remove-field") &&
          !e.target.closest(".drag-handle")
        ) {
          openSidebar(index);
        }
      });

      // --- Drag & Drop ---
      fieldItem.addEventListener("dragstart", (e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", index);
        // Slight delay so the ghost renders before we add opacity
        setTimeout(() => fieldItem.classList.add("dragging"), 0);
      });

      fieldItem.addEventListener("dragend", () => {
        fieldItem.classList.remove("dragging");
        document
          .querySelectorAll(".field-item")
          .forEach((el) => el.classList.remove("drag-over"));
      });

      fieldItem.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        document
          .querySelectorAll(".field-item")
          .forEach((el) => el.classList.remove("drag-over"));
        fieldItem.classList.add("drag-over");
      });

      fieldItem.addEventListener("dragleave", () => {
        fieldItem.classList.remove("drag-over");
      });

      fieldItem.addEventListener("drop", (e) => {
        e.preventDefault();
        fieldItem.classList.remove("drag-over");
        const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
        const toIndex = parseInt(fieldItem.dataset.index);
        if (fromIndex === toIndex) return;

        // Reorder the array
        const moved = currentFields.splice(fromIndex, 1)[0];
        currentFields.splice(toIndex, 0, moved);

        renderFieldBuilder();
        updatePreview();
        debouncedSaveDraft();
      });

      fieldList.appendChild(fieldItem);
    });

    // Render the final "After Section" block if there are sections
    if (hasSections) {
      renderAfterSectionDropdown(currentSectionBreak, sectionCounter);
    }

    // Wire up remove buttons
    document.querySelectorAll(".remove-field").forEach((btn) => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        if (await CustomDialog.confirm("Delete this field?")) {
          currentFields.splice(btn.dataset.index, 1);
          renderFieldBuilder();
          updatePreview();
        }
      };
    });
  }

  function closeSidebar() {
    if (editorSidebar) editorSidebar.classList.remove("show");
    if (sidebarOverlay) sidebarOverlay.classList.remove("show");
    document.body.style.overflow = ""; // Restore scroll
    editingFieldIndex = null;
  }
  function openSidebar(index = null) {
    editingFieldIndex = index;

    if (index !== null) {
      // Editing existing field
      const field = currentFields[index];
      if (document.getElementById("sidebarTitle"))
        document.getElementById("sidebarTitle").textContent = "Edit Field";
      if (editLabel) editLabel.value = field.label || "";
      const editDescription = document.getElementById("editDescription");
      if (editDescription) editDescription.value = field.description || "";
      if (editType) editType.value = field.type || "text";
      if (editRequired) editRequired.checked = field.required || false;
      if (editLinkUrl) editLinkUrl.value = field.linkUrl || "";
      const editLinkApp = document.getElementById("editLinkApp");
      if (editLinkApp) editLinkApp.value = field.linkApp || "whatsapp";
      const editScaleMin = document.getElementById("editScaleMin");
      if (editScaleMin)
        editScaleMin.value = field.scaleMin !== undefined ? field.scaleMin : 0;
      const editScaleLimit = document.getElementById("editScaleLimit");
      if (editScaleLimit)
        editScaleLimit.value =
          field.scaleLimit !== undefined ? field.scaleLimit : 10;

      // Render scale branching rules if any
      renderScaleBranching(
        field.scaleMin !== undefined ? field.scaleMin : 0,
        field.scaleLimit !== undefined ? field.scaleLimit : 10,
        field.scaleBranching || {},
      );

      if (editMediaUrl) {
        editMediaUrl.value = field.mediaUrl || "";
        updateSidebarImagePreview(field.mediaUrl);
      }

      // Handle options for radio/checkbox/select
      if (field.options) {
        renderOptions(field.options);
      }

      if (deleteFieldBtn) deleteFieldBtn.style.display = "block";
    } else {
      // Adding new field
      if (document.getElementById("sidebarTitle"))
        document.getElementById("sidebarTitle").textContent = "Add Field";
      if (editLabel) editLabel.value = "";
      const editDescription = document.getElementById("editDescription");
      if (editDescription) editDescription.value = "";
      if (editType) editType.value = "text";
      if (editRequired) editRequired.checked = false;
      if (editLinkUrl) editLinkUrl.value = "";
      const editLinkApp = document.getElementById("editLinkApp");
      if (editLinkApp) editLinkApp.value = "whatsapp";
      const editScaleMin = document.getElementById("editScaleMin");
      if (editScaleMin) editScaleMin.value = 0;
      const editScaleLimit = document.getElementById("editScaleLimit");
      if (editScaleLimit) editScaleLimit.value = 10;

      renderScaleBranching(0, 10, {});

      if (editMediaUrl) {
        editMediaUrl.value = "";
        updateSidebarImagePreview("");
      }
      if (optionsList) optionsList.innerHTML = "";
      if (deleteFieldBtn) deleteFieldBtn.style.display = "none";
    }

    updateFieldTypeUI();
    if (editorSidebar) {
      editorSidebar.classList.add("show");
      // Ensure sidebar is visible on mobile-first viewports
      if (window.innerWidth <= 768) {
        document.body.style.overflow = "hidden"; // Prevent background scroll
      }
    }
    if (sidebarOverlay) sidebarOverlay.classList.add("show");
  }

  function updateFieldTypeUI() {
    const type = editType.value;
    const scaleLimitContainer = document.getElementById("scaleLimitContainer");
    const scaleBranchingContainer = document.getElementById(
      "scaleBranchingContainer",
    );
    const editDescriptionContainer = document.getElementById(
      "editDescriptionContainer",
    );
    if (editDescriptionContainer) {
      editDescriptionContainer.style.display =
        type === "section_break" ? "block" : "none";
    }
    const editLabelTitle = document.getElementById("editLabelTitle");
    if (editLabelTitle) {
      editLabelTitle.textContent =
        type === "section_break" ? "Section Title" : "Field Label";
    }

    // Show/hide link URL for success_link type
    if (type === "success_link") {
      linkUrlContainer.style.display = "block";
    } else {
      linkUrlContainer.style.display = "none";
    }

    // Show/hide scale limit for scale type
    if (scaleLimitContainer) {
      scaleLimitContainer.style.display = type === "scale" ? "block" : "none";
    }

    // Show/hide image URL for image type
    if (type === "image") {
      if (mediaUrlContainer) {
        mediaUrlContainer.style.display = "block";
        // Force layout reflow for mobile
        mediaUrlContainer.offsetHeight;
      }
    } else {
      if (mediaUrlContainer) mediaUrlContainer.style.display = "none";
    }

    // Show/hide options for radio/checkbox/select
    if (["radio", "checkbox_group", "select"].includes(type)) {
      optionsContainer.style.display = "block";
      if (optionsList.children.length === 0) {
        renderOptions(["Option 1", "Option 2"]);
      }
    } else if (type === "scale") {
      optionsContainer.style.display = "none";
      scaleLimitContainer.style.display = "block";
      if (scaleBranchingContainer)
        scaleBranchingContainer.style.display = "block";
      mediaUrlContainer.style.display = "none";
    } else if (type === "image") {
      optionsContainer.style.display = "none";
      scaleLimitContainer.style.display = "none";
      if (scaleBranchingContainer)
        scaleBranchingContainer.style.display = "none";
      mediaUrlContainer.style.display = "block";
    } else if (type === "description" || type === "section_break") {
      optionsContainer.style.display = "none";
      scaleLimitContainer.style.display = "none";
      if (scaleBranchingContainer)
        scaleBranchingContainer.style.display = "none";
      mediaUrlContainer.style.display = "none";
    } else {
      optionsContainer.style.display = "none";
      scaleLimitContainer.style.display = "none";
      if (scaleBranchingContainer)
        scaleBranchingContainer.style.display = "none";
      mediaUrlContainer.style.display = "none";
    }
  }

  function renderScaleBranching(min, max, existingBranching = {}) {
    const scaleBranchingList = document.getElementById("scaleBranchingList");
    if (!scaleBranchingList) return;

    scaleBranchingList.innerHTML = "";
    let destinationHtml = `<option value="continue">Continue to next section</option>`;
    let sectionCount = 2;
    currentFields.forEach((f) => {
      if (f.type === "section_break") {
        let lbl = f.label || "Untitled";
        if (lbl.length > 25) lbl = lbl.substring(0, 25) + "...";
        destinationHtml += `<option value="${f.id}">Go to Section ${sectionCount} (${lbl})</option>`;
        sectionCount++;
      }
    });
    destinationHtml += `<option value="submit">Submit Form</option>`;
    destinationHtml += `<option value="exit">Exit Form (Custom Message)</option>`;

    // Convert to integers in case they are strings
    const minVal = parseInt(min) || 0;
    const maxVal = parseInt(max) || 10;

    for (let i = minVal; i <= maxVal; i++) {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.gap = "8px";
      row.style.alignItems = "center";

      const goto = existingBranching[i] || "continue";

      row.innerHTML = `
            <div style="width: 30px; text-align: center; font-weight: 600; color: var(--text-main);">${i}</div>
            <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
                <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;"><i class="fa-solid fa-arrow-turn-down" style="transform: rotate(-90deg);"></i> If chosen, navigate to:</div>
                <select class="scale-goto-select" data-value="${i}" style="width:100%; height: 40px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-body); font-size: 0.85rem; color: var(--text-main); font-weight: 500; outline: none; padding: 0 30px 0 12px; box-sizing: border-box; cursor: pointer; text-overflow: ellipsis;">
                    ${destinationHtml}
                </select>
                <input type="text" class="scale-exit-message" data-value="${i}" placeholder="Custom exit message..." style="display:none; height: 34px; padding: 0 10px; border-radius: 6px; border: 1px dashed var(--primary); font-size: 0.85rem; background: rgba(37,99,235,0.05); color: var(--text-main); width: 100%; box-sizing: border-box;">
            </div>
        `;

      // Wait for DOM
      setTimeout(() => {
        const sel = row.querySelector(".scale-goto-select");
        const exitInput = row.querySelector(".scale-exit-message");
        if (sel) {
          if (goto.startsWith("exit:")) {
            sel.value = "exit";
            if (exitInput) {
              exitInput.style.display = "block";
              exitInput.value = goto.substring(5);
            }
          } else {
            sel.value = goto;
          }

          sel.onchange = (e) => {
            if (e.target.value === "exit") {
              if (exitInput) exitInput.style.display = "block";
            } else {
              if (exitInput) exitInput.style.display = "none";
            }
          };
        }
      }, 0);

      scaleBranchingList.appendChild(row);
    }
  }

  function renderOptions(options = []) {
    optionsList.innerHTML = "";

    // Determine if we should show branching dropdowns
    const type = editType.value;
    const showBranching =
      type === "radio" || type === "select" || type === "checkbox_group";

    let destinationHtml = "";
    if (showBranching) {
      destinationHtml = `<option value="continue">Continue to next section</option>`;
      let sectionCount = 2;
      currentFields.forEach((f) => {
        if (f.type === "section_break") {
          let lbl = f.label || "Untitled";
          if (lbl.length > 25) lbl = lbl.substring(0, 25) + "...";
          destinationHtml += `<option value="${f.id}">Go to Section ${sectionCount} (${lbl})</option>`;
          sectionCount++;
        }
      });
      destinationHtml += `<option value="submit">Submit Form</option>`;
      destinationHtml += `<option value="exit">Exit Form (Custom Message)</option>`;
    }

    options.forEach((opt, i) => {
      const label = typeof opt === "object" ? opt.label || "" : opt;
      const value = typeof opt === "object" ? opt.value || label : opt;
      const goto =
        typeof opt === "object" ? opt.goto || "continue" : "continue";

      const row = document.createElement("div");
      row.className = "option-row";
      row.style.display = "flex";
      row.style.gap = "8px";
      row.style.marginBottom = "10px";
      row.style.alignItems = "flex-start";

      let html = `
        <div style="flex: 1; background: var(--bg-body); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; display: flex; align-items: center; gap: 8px; height: 40px; box-sizing: border-box;">
            <i class="fa-solid fa-grip-vertical" style="color: var(--text-muted); cursor: grab; font-size: 0.9rem; opacity: 0.5;"></i>
            <input type="text" value="${label}" class="option-label-input" data-index="${i}" placeholder="Option ${i + 1}" style="flex:1; border: none; background: transparent; font-size: 0.9rem; font-weight: 500; color: var(--text-main); outline: none; padding: 0; box-shadow: none; height: auto;">
        </div>`;

      if (showBranching) {
        html += `
        <div style="flex: 1; display: flex; flex-direction: column; gap: 6px;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-bottom: -2px;"><i class="fa-solid fa-arrow-turn-down" style="transform: rotate(-90deg);"></i> If chosen, navigate to:</div>
            <select class="option-goto-select" data-index="${i}" style="width:100%; height: 40px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-body); font-size: 0.85rem; color: var(--text-main); font-weight: 500; outline: none; padding: 0 30px 0 12px; box-sizing: border-box; cursor: pointer; text-overflow: ellipsis;">
                ${destinationHtml}
            </select>
            <input type="text" class="option-exit-message" data-index="${i}" placeholder="Custom exit message..." style="display:none; height: 34px; padding: 0 10px; border-radius: 6px; border: 1px dashed var(--primary); font-size: 0.85rem; background: rgba(37,99,235,0.05); color: var(--text-main); width: 100%; box-sizing: border-box;">
        </div>`;
      }

      html += `
        <button class="remove-option" data-index="${i}" style="flex-shrink:0; background: rgba(239, 68, 68, 0.05); color: var(--theme-error, #ef4444); border: 1px solid rgba(239, 68, 68, 0.1); width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; box-sizing: border-box;">
            <i class="fa-solid fa-xmark"></i>
        </button>`;

      row.innerHTML = html;
      optionsList.appendChild(row);

      // Set the select value after appending
      if (showBranching) {
        const selectEl = row.querySelector(".option-goto-select");
        const exitInput = row.querySelector(".option-exit-message");
        if (selectEl) {
          if (goto.startsWith("exit:")) {
            selectEl.value = "exit";
            if (exitInput) {
              exitInput.style.display = "block";
              exitInput.value = goto.substring(5);
            }
          } else {
            selectEl.value = goto;
          }

          selectEl.onchange = (e) => {
            if (e.target.value === "exit") {
              if (exitInput) exitInput.style.display = "block";
            } else {
              if (exitInput) exitInput.style.display = "none";
            }
          };
        }
      }
    });

    // Wire up remove buttons
    document.querySelectorAll(".remove-option").forEach((btn) => {
      btn.onclick = () => {
        const opts = getOptionsFromUI();
        opts.splice(btn.dataset.index, 1);
        renderOptions(opts);
      };
    });
  }

  function getOptionsFromUI() {
    const rows = Array.from(optionsList.querySelectorAll(".option-row"));
    return rows
      .map((row) => {
        const labelInput = row.querySelector(".option-label-input");
        const gotoSelect = row.querySelector(".option-goto-select");
        const exitInput = row.querySelector(".option-exit-message");
        const label = labelInput ? labelInput.value.trim() : "";
        if (!label) return null;

        if (gotoSelect) {
          let gotoVal = gotoSelect.value || "continue";
          if (gotoVal === "exit") {
            const msg = exitInput ? exitInput.value.trim() : "";
            if (msg) gotoVal = "exit:" + msg;
          }
          return {
            label: label,
            value: label,
            goto: gotoVal,
          };
        } else {
          return label; // Keep as string for checkbox_group to avoid schema changes if not needed
        }
      })
      .filter((v) => v !== null);
  }

  // Event listeners
  if (addFieldBtn) {
    addFieldBtn.onclick = (e) => {
      e.stopPropagation(); // Prevent bubbling to document
      openSidebar(null);
    };
  }

  if (addSectionBtn) {
    addSectionBtn.onclick = (e) => {
      e.stopPropagation();
      currentFields.push({
        id: `field_${Date.now()}`,
        type: "section_break",
        label: "Untitled Section",
        description: "",
      });
      renderFieldBuilder();
      updatePreview();
      debouncedSaveDraft();
    };
  }

  if (closeSidebarBtn) {
    closeSidebarBtn.onclick = () => closeSidebar();
  }

  if (sidebarOverlay) {
    sidebarOverlay.onclick = () => closeSidebar();
  }

  if (editType) {
    editType.onchange = updateFieldTypeUI;
  }

  const editScaleMin = document.getElementById("editScaleMin");
  const editScaleLimit = document.getElementById("editScaleLimit");
  if (editScaleMin) {
    editScaleMin.addEventListener("input", () => {
      if (editType.value === "scale") {
        const currentBranching = getScaleBranchingFromUI();
        renderScaleBranching(
          editScaleMin.value,
          editScaleLimit.value,
          currentBranching,
        );
      }
    });
  }
  if (editScaleLimit) {
    editScaleLimit.addEventListener("input", () => {
      if (editType.value === "scale") {
        const currentBranching = getScaleBranchingFromUI();
        renderScaleBranching(
          editScaleMin.value,
          editScaleLimit.value,
          currentBranching,
        );
      }
    });
  }

  function getScaleBranchingFromUI() {
    const mapping = {};
    document.querySelectorAll(".scale-goto-select").forEach((sel) => {
      const val = sel.getAttribute("data-value");
      if (val) {
        let gotoVal = sel.value;
        if (gotoVal === "exit") {
          const row = sel.closest("div").parentElement;
          const exitInput = row.querySelector(".scale-exit-message");
          const msg = exitInput ? exitInput.value.trim() : "";
          if (msg) gotoVal = "exit:" + msg;
        }
        mapping[val] = gotoVal;
      }
    });
    return mapping;
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
        id:
          editingFieldIndex !== null
            ? currentFields[editingFieldIndex].id
            : `field_${Date.now()}`,
        type: editType.value,
        label:
          editLabel.value ||
          (editType.value === "section_break"
            ? "Untitled Section"
            : "Untitled Field"),
        required: editRequired.checked,
        placeholder: editLabel.value || "",
      };

      if (fieldData.type === "section_break") {
        const editDescription = document.getElementById("editDescription");
        if (editDescription) fieldData.description = editDescription.value;
      }

      // Add options for radio/checkbox/select
      if (["radio", "checkbox_group", "select"].includes(fieldData.type)) {
        fieldData.options = getOptionsFromUI();
      }

      // Add link URL for success_link
      if (fieldData.type === "success_link") {
        fieldData.linkUrl = editLinkUrl.value;
        const editLinkApp = document.getElementById("editLinkApp");
        if (editLinkApp) fieldData.linkApp = editLinkApp.value;
      }

      // Add limit for scale
      if (fieldData.type === "scale") {
        const editScaleMin = document.getElementById("editScaleMin");
        fieldData.scaleMin = editScaleMin
          ? parseInt(editScaleMin.value) || 0
          : 0;
        const editScaleLimit = document.getElementById("editScaleLimit");
        fieldData.scaleLimit = editScaleLimit
          ? parseInt(editScaleLimit.value) || 10
          : 10;

        fieldData.scaleBranching = getScaleBranchingFromUI();
      }

      // Add image URL for image type
      if (fieldData.type === "image") {
        fieldData.mediaUrl = editMediaUrl.value || "";
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
      debouncedSaveDraft();
    };
  }

  if (deleteFieldBtn) {
    deleteFieldBtn.onclick = async () => {
      if (
        editingFieldIndex !== null &&
        (await CustomDialog.confirm("Delete this field?"))
      ) {
        currentFields.splice(editingFieldIndex, 1);
        renderFieldBuilder();
        updatePreview();
        closeSidebar();
        debouncedSaveDraft();
      }
    };
  }

  // --- PREVIEW & SYNC ---

  function updatePreview() {
    if (!previewContainer) return;
    previewContainer.innerHTML = "";

    const title =
      document.getElementById("formTitleInput")?.value || "Untitled Form";
    const desc = document.getElementById("formDescInput")?.value || "";

    const header = document.createElement("div");
    header.innerHTML = `<h2 style="color: ${currentDesign.themeColor}">${title}</h2><p>${desc}</p><hr style="margin: 20px 0; border: 0; border-top: 1px solid var(--theme-border);">`;
    previewContainer.appendChild(header);

    currentFields.forEach((field) => {
      const group = document.createElement("div");
      group.style.marginBottom = "15px";

      // Determine HTML based on type
      let inputHtml = "";
      switch (field.type) {
        case "textarea":
          inputHtml = `<textarea placeholder="${field.placeholder || ""}" disabled style="width:100%; padding:8px; border:1px solid var(--theme-border); border-radius:4px; min-height:80px;"></textarea>`;
          break;
        case "select":
          inputHtml = `<select disabled style="width:100%; padding:8px; border:1px solid var(--theme-border); border-radius:4px;">
                        <option>Select...</option>
                        ${(field.options || []).map((opt) => `<option>${opt}</option>`).join("")}
                    </select>`;
          break;
        case "radio":
          inputHtml = `<div style="display:flex; flex-direction:column; gap:6px;">
                        ${(field.options || [])
                          .map(
                            (opt) => `
                            <label style="display:inline-flex; align-items:center; gap:8px;">
                                <input type="radio" disabled> <span>${opt}</span>
                            </label>
                        `,
                          )
                          .join("")}
                    </div>`;
          break;
        case "checkbox_group":
          inputHtml = `<div style="display:flex; flex-direction:column; gap:6px;">
                        ${(field.options || [])
                          .map(
                            (opt) => `
                            <label style="display:inline-flex; align-items:center; gap:8px;">
                                <input type="checkbox" disabled> <span>${opt}</span>
                            </label>
                        `,
                          )
                          .join("")}
                    </div>`;
          break;
        case "checkbox":
          inputHtml = `<label style="display:inline-flex; align-items:center; gap:8px;">
                        <input type="checkbox" disabled ${field.value ? "checked" : ""}> <span>${field.label}</span>
                    </label>`;
          break;
        case "image":
          inputHtml = field.mediaUrl
            ? `<img src="${field.mediaUrl}" style="max-width:100%; border-radius:8px; display:block;">`
            : `<div style="padding:20px; text-align:center; background:#f5f5f5; border-radius:8px; color:#888;">Image Placeholder</div>`;
          break;
        case "description":
          inputHtml = `<div style="color:var(--text-secondary); white-space: pre-wrap;">${field.label}</div>`;
          break;
        case "success_link": {
          let icon = "fa-brands fa-whatsapp";
          let bg = "#e6fffa";
          let color = "#0e7490";
          if (field.linkApp === "telegram") {
            icon = "fa-brands fa-telegram";
            bg = "#e0f2fe";
            color = "#0284c7";
          } else if (field.linkApp === "instagram") {
            icon = "fa-brands fa-instagram";
            bg = "#fce7f3";
            color = "#be185d";
          } else if (field.linkApp === "youtube") {
            icon = "fa-brands fa-youtube";
            bg = "#fee2e2";
            color = "#b91c1c";
          } else if (field.linkApp === "custom") {
            icon = "fa-solid fa-link";
            bg = "#f3f4f6";
            color = "#374151";
          }

          inputHtml = `<div style="padding:10px; background:${bg}; color:${color}; border-radius:4px; font-size:0.9rem; font-weight:500;">
                        <i class="${icon}"></i> Finish Link: <a href="${field.linkUrl || "#"}" target="_blank" style="color:inherit; text-decoration:underline;">${field.label || "Action Link"}</a>
                     </div>`;
          break;
        }
        case "scale": {
          const min = field.scaleMin !== undefined ? field.scaleMin : 0;
          const max = field.scaleLimit !== undefined ? field.scaleLimit : 10;
          inputHtml = `<div style="display:flex; align-items:center; gap:15px;">
                        <input type="range" disabled min="${min}" max="${max}" value="${min}" style="flex:1;">
                        <span style="font-weight:600; width:30px; text-align:center; color:var(--primary);">${min}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-muted); margin-top:5px;">
                        <span>${min}</span><span>${max}</span>
                    </div>`;
          break;
        }
        default:
          // text, email, tel, date, etc.
          inputHtml = `<input type="${field.type === "email" ? "email" : "text"}" placeholder="${field.placeholder || ""}" disabled style="width:100%; padding:8px; border:1px solid var(--theme-border); border-radius:4px;">`;
      }

      // For single checkbox, description, and success_link, we might handle label differently
      // But for consistency let's just render standard label unless it's a descriptive type
      let labelHtml = `<label style="display:block; margin-bottom:5px; font-weight:500;">${field.label} ${field.required ? "*" : ""}</label>`;

      if (
        field.type === "checkbox" ||
        field.type === "description" ||
        field.type === "success_link" ||
        field.type === "image"
      ) {
        labelHtml = ""; // Hide standard label loop
      }

      group.innerHTML = `
                ${labelHtml}
                ${inputHtml}
            `;
      previewContainer.appendChild(group);
    });
  }

  // --- SAVE FORM TO LIBRARY ---
  if (saveToLibraryBtn) {
    saveToLibraryBtn.addEventListener("click", async () => {
      // Validation
      if (!currentDesign.formTitle || currentDesign.formTitle.trim() === "") {
        alert("Please enter a form title");
        return;
      }

      if (currentFields.length === 0) {
        alert("Please add at least one field to your form");
        return;
      }

      const allowMultipleInput = document.getElementById("allowMultipleResponsesInput");
      if (allowMultipleInput) {
          currentDesign.allowMultipleResponses = allowMultipleInput.checked;
      }
      
      const payload = {
        title: currentDesign.formTitle,
        description: currentDesign.formDescription || "",
        fields: currentFields,
        design: currentDesign,
        responseLimit: currentDesign.responseLimit
          ? parseInt(currentDesign.responseLimit)
          : null,
      };

      try {
        // Show loading state
        saveToLibraryBtn.disabled = true;
        saveToLibraryBtn.innerHTML =
          '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        let response;

        // Use formMode to determine create vs edit
        if (formMode === "edit" && currentFormId) {
          // UPDATE existing form
          console.log("Updating form:", currentFormId);
          const token = localStorage.getItem("adminToken");
          response = await fetch(`${API_BASE}/api/forms/${currentFormId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });
        } else {
          // CREATE new form
          console.log("Creating new form");
          const token = localStorage.getItem("adminToken");

          // Send Clean Builder Schema for Creation
          const createPayload = {
            title: currentDesign.formTitle || "Untitled Form",
            description: currentDesign.formDescription || "",
            fields: currentFields || [],
            design: currentDesign,
            responseLimit: currentDesign.responseLimit
              ? parseInt(currentDesign.responseLimit)
              : null,
          };

          response = await fetch(`${API_BASE}/api/forms`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(createPayload),
          });
        }

        if (!response.ok) {
          let errorMessage = "Failed to save form";
          try {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
              const errorData = await response.json();
              errorMessage = errorData.error || errorMessage;
            } else {
              errorMessage = (await response.text()) || errorMessage;
            }
          } catch (e) {
            console.error("Error parsing response:", e);
          }
          throw new Error(errorMessage);
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
        document
          .querySelectorAll(".nav-item")
          .forEach((item) => item.classList.remove("active"));
        document
          .querySelectorAll(".tab-pane")
          .forEach((pane) => pane.classList.remove("active"));

        const libraryTab = document.querySelector(
          '.nav-item[data-tab="library"]',
        );
        const libraryPane = document.getElementById("library");

        if (libraryTab) libraryTab.classList.add("active");
        if (libraryPane) libraryPane.classList.add("active");

        // Clear draft after successful save
        clearDraft();
      } catch (error) {
        console.error("Save form error:", error);
        alert(`Failed to save form: ${error.message}`);
      } finally {
        // Restore button state
        saveToLibraryBtn.disabled = false;
        saveToLibraryBtn.innerHTML =
          '<i class="fa-solid fa-floppy-disk"></i> Save to Library';
      }
    });
  }

  // Cloudinary Config Save Button
  const saveCloudinaryBtn = document.getElementById("saveCloudinaryBtn");
  if (saveCloudinaryBtn) {
    saveCloudinaryBtn.addEventListener("click", () => {
      const cloudName = document
        .getElementById("cloudinaryCloudName")
        .value.trim();
      const preset = document.getElementById("cloudinaryPreset").value.trim();

      if (!cloudName || !preset) {
        alert("Please enter both Cloud Name and Upload Preset to save.");
        return;
      }

      // 1. Explicitly update currentDesign
      if (!currentDesign.cloudinary) {
        currentDesign.cloudinary = {
          cloudName: "dc9dkwuhy",
          preset: "ml_default",
        };
      }
      currentDesign.cloudinary.cloudName = cloudName;
      currentDesign.cloudinary.preset = preset;

      // 2. Show temporary success state
      const originalText = saveCloudinaryBtn.innerHTML;
      saveCloudinaryBtn.innerHTML =
        '<i class="fa-solid fa-check-double"></i> Config Applied!';
      saveCloudinaryBtn.classList.replace("btn-primary", "btn-success");

      setTimeout(() => {
        saveCloudinaryBtn.innerHTML = originalText;
        saveCloudinaryBtn.classList.replace("btn-success", "btn-primary");
      }, 3000);
    });
  }

  // Cloudinary Help Modal Logic
  const openCloudinaryHelp = document.getElementById("openCloudinaryHelp");
  const cloudinaryHelpModal = document.getElementById("cloudinaryHelpModal");
  const closeCloudinaryHelpModal = document.getElementById(
    "closeCloudinaryHelpModal",
  );

  if (openCloudinaryHelp && cloudinaryHelpModal) {
    openCloudinaryHelp.addEventListener("click", () => {
      cloudinaryHelpModal.classList.add("show");
    });
    closeCloudinaryHelpModal.addEventListener("click", () => {
      cloudinaryHelpModal.classList.remove("show");
    });
    cloudinaryHelpModal.addEventListener("click", (e) => {
      if (e.target === cloudinaryHelpModal)
        cloudinaryHelpModal.classList.remove("show");
    });
  }

  // Media
  // Toggle logo upload section
  if (manageLogoBtn && logoUploadSection) {
    manageLogoBtn.addEventListener("click", () => {
      if (logoUploadSection.style.display === "none") {
        logoUploadSection.style.display = "block";
        manageLogoBtn.innerHTML =
          '<i class="fa-solid fa-chevron-up"></i> Hide Options';
      } else {
        logoUploadSection.style.display = "none";
        manageLogoBtn.innerHTML = '<i class="fa-solid fa-image"></i> Manage';
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
    if (
      currentDesign.cloudinary &&
      currentDesign.cloudinary.cloudName &&
      currentDesign.cloudinary.preset
    ) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", currentDesign.cloudinary.preset);

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${currentDesign.cloudinary.cloudName}/upload`,
          {
            method: "POST",
            body: formData,
          },
        );

        if (!res.ok) throw new Error("Cloudinary upload failed");
        const data = await res.json();
        return data.secure_url; // Return URL
      } catch (err) {
        console.error("Cloudinary upload error:", err);
        if (
          !(await CustomDialog.confirm(
            "Cloudinary upload failed. Fallback to local storage (slower)?",
          ))
        ) {
          throw err;
        }
      }
    } else {
      // Warn if no Cloudinary
      if (file.size > 500 * 1024) {
        // 500KB warning
        if (
          !(await CustomDialog.confirm(
            "Warning: You are uploading a large image without Cloudinary configured. This will slow down your form. Continue?",
          ))
        ) {
          throw new Error("Upload cancelled");
        }
      }
    }

    // 2. Fallback to Base64
    return await fileToBase64(file);
  }

  // Handle light mode logo upload
  if (logoLightUpload) {
    logoLightUpload.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const url = await uploadAsset(file);
          currentDesign.logoLight = url;
          updatePreview();
          alert("Light mode logo uploaded! Remember to save the form.");
        } catch (err) {
          console.error("Logo upload error:", err);
          if (err.message !== "Upload cancelled")
            alert("Failed to upload logo");
        }
      }
    });
  }

  // Handle dark mode logo upload
  if (logoDarkUpload) {
    logoDarkUpload.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const url = await uploadAsset(file);
          currentDesign.logoDark = url;
          updatePreview();
          alert("Dark mode logo uploaded! Remember to save the form.");
        } catch (err) {
          console.error("Logo upload error:", err);
          if (err.message !== "Upload cancelled")
            alert("Failed to upload logo");
        }
      }
    });
  }

  // Remove logos
  if (removeLogosBtn) {
    removeLogosBtn.addEventListener("click", async () => {
      if (await CustomDialog.confirm("Remove both logos?")) {
        currentDesign.logoLight = null;
        currentDesign.logoDark = null;
        logoLightUpload.value = "";
        logoDarkUpload.value = "";
        const logoLightLabel = document.getElementById("logoLightUploadLabel");
        const logoDarkLabel = document.getElementById("logoDarkUploadLabel");
        if (logoLightLabel) {
          logoLightLabel.querySelector(".file-name").textContent =
            "Click to upload light logo";
          logoLightLabel.classList.remove("has-file");
        }
        if (logoDarkLabel) {
          logoDarkLabel.querySelector(".file-name").textContent =
            "Click to upload dark logo";
          logoDarkLabel.classList.remove("has-file");
        }
        updatePreview();
        alert("Logos removed! Remember to save the form.");
      }
    });
  }

  // --- BANNER UPLOAD FUNCTIONALITY ---

  // Handle banner upload
  if (bannerUpload) {
    bannerUpload.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const url = await uploadAsset(file);
          currentDesign.banner = url;
          updatePreview();
          alert("Banner uploaded! Remember to save the form.");
        } catch (err) {
          console.error("Banner upload error:", err);
          if (err.message !== "Upload cancelled")
            alert("Failed to upload banner");
        }
      }
    });
  }

  // Remove banner
  if (removeBannerBtn) {
    removeBannerBtn.addEventListener("click", async () => {
      if (await CustomDialog.confirm("Remove banner?")) {
        currentDesign.banner = null;
        bannerUpload.value = "";
        updatePreview();
        alert("Banner removed! Remember to save the form.");
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
  const responsesNavItem = document.querySelector(
    '.nav-item[data-tab="responses"]',
  );
  if (responsesNavItem) {
    responsesNavItem.addEventListener("click", (e) => {
      // Check if hidden (usually means no form is active)
      if (responsesNavItem.classList.contains("hidden")) {
        e.preventDefault();
        alert(
          'Please select a form from "My Forms" and click the "Responses" button to view its responses.',
        );
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
    if (!filteredResponses || !filteredResponses.length) {
      alert(
        "No responses to export. Try clearing filters or loading a form first.",
      );
      return;
    }

    try {
      // Fetch form schema (prioritize local cache)
      let form = backendForms.find(
        (f) => f.slug === formSlug || f.id === formSlug,
      );

      if (!form) {
        const formRes = await fetch(`${API_BASE}/api/forms/${formSlug}`);
        if (!formRes.ok) throw new Error("Form not found");
        form = await formRes.json();
      }

      // STRICT SCHEMA: Get all fields that are not static text/display
      const formFields = (form.config || form.fields || []).filter(
        (f) => f.type !== "description" && f.type !== "success_link",
      );

      // BOM for Excel UTF-8 compatibility
      let csv = "\uFEFF";

      // Header - Strictly from schema labels
      const headers = [
        "Submitted At",
        ...formFields.map((f) => f.label || f.id),
      ];
      csv +=
        headers.map((h) => `"${h.toString().replace(/"/g, '""')}"`).join(",") +
        "\n";

      // Rows - Map every response row to the schema fields
      filteredResponses.forEach((r) => {
        const row = [
          `"${new Date(r.submitted_at).toLocaleString().replace(/"/g, '""')}"`,
          ...formFields.map((field) => {
            // Get value by field ID
            let value = r.data[field.id];

            // Handle missing data (strict requirement)
            if (value === null || value === undefined) {
              value = "";
            }

            // Formatting
            if (field.type === "file" && value && value.startsWith("http")) {
              value = getDisplayFilename(value, r, form.config || form.fields);
            } else if (Array.isArray(value)) {
              value = value.join(", ");
            } else if (typeof value === "boolean") {
              value = value ? "Yes" : "No";
            }

            return `"${String(value).replace(/"/g, '""')}"`;
          }),
        ];
        csv += row.join(",") + "\n";
      });

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Responses - ${formTitle}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("CSV export error:", err);
      alert("Failed to export CSV: " + err.message);
    }
  }

  /**
   * Export responses as XLSX (Excel) file using SheetJS
   * @param {string} formSlug - The form slug to export
   * @param {string} formTitle - The form title for filename
   */
  async function exportXlsx(formSlug, formTitle) {
    if (!filteredResponses || !filteredResponses.length) {
      alert("No responses to export. Try clearing filters first.");
      return;
    }

    if (typeof XLSX === "undefined") {
      alert("Excel library not loaded.");
      return;
    }

    try {
      // Fetch schema (prioritize local cache)
      let form = backendForms.find(
        (f) => f.slug === formSlug || f.id === formSlug,
      );

      if (!form) {
        const formRes = await fetch(`${API_BASE}/api/forms/${formSlug}`);
        if (!formRes.ok) throw new Error("Form not found");
        form = await formRes.json();
      }

      const formFields = (form.config || form.fields || []).filter(
        (f) => f.type !== "description" && f.type !== "success_link",
      );

      // Prepare data
      const data = filteredResponses.map((r) => {
        const row = {
          "Submitted At": new Date(r.submitted_at).toLocaleString(),
        };
        formFields.forEach((field) => {
          let value = r.data[field.id];
          if (field.type === "file" && value && value.startsWith("http")) {
            value = getDisplayFilename(value, r, formFields);
          } else if (Array.isArray(value)) {
            value = value.join(", ");
          } else if (typeof value === "boolean") {
            value = value ? "Yes" : "No";
          }
          row[field.label || field.id] = value || "";
        });
        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(data);

      // Auto-width columns
      const colWidths = Object.keys(data[0]).map((key) => {
        // Check header width
        let maxWidth = key.length;
        // Check cell widths (limit to 50 chars to prevent massive cols)
        data.forEach((row) => {
          const cellValue = String(row[key] || "");
          if (cellValue.length > maxWidth) maxWidth = cellValue.length;
        });
        return { wch: Math.min(maxWidth + 2, 50) };
      });
      worksheet["!cols"] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Responses");
      XLSX.writeFile(workbook, `Responses - ${formTitle}.xlsx`);
    } catch (err) {
      console.error("XLSX export error:", err);
      alert(`Failed to export Excel: ${err.message}`);
    }
  }

  /**
   * Export responses as PDF file using jsPDF AutoTable
   * @param {string} formSlug - The form slug to export
   * @param {string} formTitle - The form title for the report
   */
  async function exportPdf(formSlug, formTitle) {
    if (!filteredResponses || !filteredResponses.length) {
      alert("No responses to export. Try clearing filters first.");
      return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("PDF library not loaded.");
      return;
    }

    try {
      // Fetch schema (prioritize local cache)
      let form = backendForms.find(
        (f) => f.slug === formSlug || f.id === formSlug,
      );

      if (!form) {
        const formRes = await fetch(`${API_BASE}/api/forms/${formSlug}`);
        if (!formRes.ok) throw new Error("Form not found");
        form = await formRes.json();
      }

      const formFields = (form.config || form.fields || []).filter(
        (f) => f.type !== "description" && f.type !== "success_link",
      );

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "landscape" }); // Landscape for more space

      // Title and Metadata
      doc.setFontSize(18);
      doc.text(formTitle, 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
      doc.text(`Total Responses: ${currentResponses.length}`, 14, 33);

      // Prepare Table Data
      const head = [
        ["Submitted At", ...formFields.map((f) => f.label || f.id)],
      ];
      const body = currentResponses.map((r) => {
        return [
          new Date(r.submitted_at).toLocaleString(),
          ...formFields.map((field) => {
            let value = r.data[field.id];
            if (
              field.type === "file" &&
              value &&
              String(value).startsWith("http")
            ) {
              return getDisplayFilename(String(value), r, formFields);
            } else if (Array.isArray(value)) {
              return value.join(", ");
            } else if (typeof value === "boolean") {
              return value ? "Yes" : "No";
            }
            return value || "-";
          }),
        ];
      });

      // Generate Table
      doc.autoTable({
        head: head,
        body: body,
        startY: 40,
        styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak" },
        headStyles: {
          fillColor: [74, 144, 226],
          textColor: 255,
          fontStyle: "bold",
        }, // Brand blue
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { top: 40 },
      });

      doc.save(`Responses - ${formTitle}.pdf`);
    } catch (err) {
      console.error("PDF export error:", err);
      alert(`Failed to export PDF: ${err.message}`);
    }
  }

  // --- IMAGE PREVIEW MODAL ---
  const imagePreviewModal = document.getElementById("imagePreviewModal");
  const modalPreviewImage = document.getElementById("modalPreviewImage");
  const downloadPreviewLink = document.getElementById("downloadPreviewLink");
  const closeImagePreview = document.getElementById("closeImagePreview");
  const closePreviewBtn = document.getElementById("closePreviewBtn");

  window.openImagePreview = function (url, filename = "Preview") {
    if (!imagePreviewModal || !modalPreviewImage) return;
    modalPreviewImage.src = url;
    if (downloadPreviewLink) {
      downloadPreviewLink.href = url;
      downloadPreviewLink.download = filename;
    }
    if (document.getElementById("previewModalTitle")) {
      document.getElementById("previewModalTitle").textContent =
        `Preview: ${filename}`;
    }
    imagePreviewModal.classList.add("show");
  };

  function closeImagePreviewModal() {
    if (imagePreviewModal) imagePreviewModal.classList.remove("show");
    if (modalPreviewImage) modalPreviewImage.src = "";
  }

  if (closeImagePreview) closeImagePreview.onclick = closeImagePreviewModal;
  if (closePreviewBtn) closePreviewBtn.onclick = closeImagePreviewModal;
  if (imagePreviewModal) {
    imagePreviewModal.onclick = (e) => {
      if (e.target === imagePreviewModal) closeImagePreviewModal();
    };
  }

  // Helper: Extract filename from URL (Cloudinary or normal)
  function getFilenameFromUrl(url) {
    if (!url || typeof url !== "string") return "-";
    if (!url.startsWith("http")) return url;
    try {
      const parts = url.split("/");
      const lastPart = parts[parts.length - 1];
      // Remove Cloudinary versioning/params if any
      let filename = decodeURIComponent(lastPart.split("?")[0]);
      // Strip Cloudinary random suffix (_ followed by exactly 6 alphanumeric chars before extension)
      filename = filename.replace(/_[a-zA-Z0-9]{6}(\.[a-zA-Z0-9]+)$/, "$1");
      return filename;
    } catch (e) {
      return "file";
    }
  }

  // Helper: Get display filename using the "Name" field if available
  function getDisplayFilename(url, response, formFields) {
    const originalName = getFilenameFromUrl(url);
    if (!response || !formFields) return originalName;

    // Try to find a field that looks like a name
    const nameField = formFields.find(
      (f) =>
        (f.id.toLowerCase().includes("name") &&
          !f.id.toLowerCase().includes("file")) ||
        (f.label &&
          f.label.toLowerCase().includes("name") &&
          !f.label.toLowerCase().includes("file")),
    );

    if (nameField) {
      const nameValue = response.data[nameField.id];
      if (
        nameValue &&
        typeof nameValue === "string" &&
        nameValue.trim() !== ""
      ) {
        // Get extension from original filename
        const ext = originalName.includes(".")
          ? originalName.split(".").pop()
          : "jpg";
        // Sanitize name for filename
        const safeName = nameValue
          .replace(/[^a-zA-Z0-9-_ ]/g, "")
          .trim()
          .replace(/\s+/g, "_");
        return `${safeName}.${ext}`;
      }
    }
    return originalName;
  }

  // --- ADVANCED RESPONSES LOGIC ---

  function filterAndRenderResponses() {
    if (!currentResponses) return;

    filteredResponses = currentResponses.filter((r) => {
      // 1. Search filter (case-insensitive across all values)
      const searchMatch =
        !responseSearchQuery ||
        Object.values(r.data).some((val) =>
          String(val).toLowerCase().includes(responseSearchQuery.toLowerCase()),
        );

      if (!searchMatch) return false;

      // 2. Multi-field filters
      for (const [fieldId, filterValue] of Object.entries(activeFilters)) {
        if (filterValue && filterValue !== "__all__") {
          const cellValue = r.data[fieldId];
          // Handle arrays (checkbox groups)
          if (Array.isArray(cellValue)) {
            if (!cellValue.includes(filterValue)) return false;
          } else if (String(cellValue) !== String(filterValue)) {
            return false;
          }
        }
      }

      return true;
    });

    // 3. Sorting
    filteredResponses.sort((a, b) => {
      const dateA = new Date(a.submitted_at);
      const dateB = new Date(b.submitted_at);
      return responseSortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

    // Toggle UI modes
    const tableContainer = document.getElementById("responsesTable");
    const statsView = document.getElementById("statsView");
    const individualView = document.getElementById("individualView");

    if (responseViewMode === "stats") {
      if (tableContainer) tableContainer.style.display = "none";
      if (statsView) statsView.style.display = "block";
      if (individualView) individualView.style.display = "none";
      renderStatsView(filteredResponses, currentFormFields);
    } else if (responseViewMode === "individual") {
      if (tableContainer) tableContainer.style.display = "none";
      if (statsView) statsView.style.display = "none";
      if (individualView) individualView.style.display = "block";
      renderIndividualEntry(currentIndividualIndex);
    } else {
      if (tableContainer) tableContainer.style.display = "block";
      if (statsView) statsView.style.display = "none";
      if (individualView) individualView.style.display = "none";
      renderResponsesTable(filteredResponses, currentFormFields);
    }

    // Update meta info
    const metaEl = document.getElementById("responsesMeta");
    if (metaEl) {
      metaEl.innerHTML = `Showing ${filteredResponses.length} of ${currentResponses.length} responses`;
    }
  }

  function renderIndividualEntry(index) {
    if (!filteredResponses.length) {
      const container = document.getElementById("individualEntryContent");
      if (container)
        container.innerHTML =
          '<div style="text-align:center; padding:40px; color:var(--text-muted);">No responses match the criteria.</div>';
      return;
    }

    // Bound index
    if (index < 0) index = 0;
    if (index >= filteredResponses.length) index = filteredResponses.length - 1;
    currentIndividualIndex = index;

    const response = filteredResponses[index];
    const counter = document.getElementById("entryCounter");
    const timestamp = document.getElementById("entryTimestamp");
    const content = document.getElementById("individualEntryContent");

    if (counter)
      counter.innerText = `Entry ${index + 1} of ${filteredResponses.length}`;
    if (timestamp)
      timestamp.innerText = `Submitted: ${new Date(response.submitted_at).toLocaleString()}`;

    if (content) {
      let html = '<div style="display:flex; flex-direction:column; gap:25px;">';

      // Standard ID field
      html += `
                <div style="border-bottom:1px solid var(--border); padding-bottom:15px;">
                    <label style="display:block; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:5px;">Response ID</label>
                    <div style="font-family:monospace; font-size:0.9rem; color:var(--text-main);">${response.id}</div>
                </div>
            `;

      currentFormFields.forEach((field) => {
        if (field.type === "description" || field.type === "success_link")
          return;

        let value = response.data[field.id];
        let displayHtml = "";

        if (field.type === "file" && value && value.startsWith("http")) {
          const filename = getDisplayFilename(
            value,
            response,
            currentFormFields,
          );
          displayHtml = `
                        <div style="display:flex; align-items:center; gap:10px; background:var(--bg-secondary); padding:10px; border-radius:8px; border:1px solid var(--border);">
                            <i class="fa-solid fa-file" style="color:var(--primary);"></i>
                            <span style="flex:1; font-size:0.9rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${filename}</span>
                            <button onclick="downloadSingleFile('${value}', '${filename}')" class="btn btn-sm btn-primary">Download</button>
                        </div>
                    `;
        } else if (Array.isArray(value)) {
          displayHtml = value.length
            ? value
                .map(
                  (v) =>
                    `<span style="display:inline-block; background:var(--bg-secondary); padding:4px 10px; border-radius:15px; font-size:0.85rem; border:1px solid var(--border); margin:2px;">${v}</span>`,
                )
                .join(" ")
            : '<span style="color:var(--text-muted); font-style:italic;">No selection</span>';
        } else if (typeof value === "boolean") {
          displayHtml = `<span style="font-weight:600; color:${value ? "var(--success)" : "var(--danger)"};">${value ? "Yes" : "No"}</span>`;
        } else if (!value) {
          displayHtml =
            '<span style="color:var(--text-muted); font-style:italic;">(Empty)</span>';
        } else {
          displayHtml = `<div style="white-space:pre-wrap; line-height:1.5;">${value}</div>`;
        }

        html += `
                    <div style="border-bottom:1px solid var(--border); padding-bottom:15px;">
                        <label style="display:block; font-size:0.85rem; font-weight:700; color:var(--text-main); margin-bottom:8px;">${field.label || field.id}</label>
                        <div style="color:var(--text-secondary);">${displayHtml}</div>
                    </div>
                `;
      });

      html += "</div>";
      content.innerHTML = html;
    }

    // Update button states
    const prevBtn = document.getElementById("prevEntryBtn");
    const nextBtn = document.getElementById("nextEntryBtn");
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.disabled = index === filteredResponses.length - 1;
  }

  function renderStatsView(responses, formFields) {
    const statsContent = document.getElementById("statsContent");
    if (!statsContent) return;
    statsContent.innerHTML = "";

    if (!responses.length) {
      statsContent.innerHTML =
        '<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--text-muted);">No responses match the criteria.</div>';
      return;
    }

    // Only show stats for fields that make sense (radio, select, checkbox_group)
    const statFields = formFields.filter((f) =>
      ["radio", "select", "checkbox_group", "checkbox"].includes(f.type),
    );

    if (!statFields.length) {
      statsContent.innerHTML =
        '<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--text-muted);">This form has no categorical fields to analyze.</div>';
      return;
    }

    statFields.forEach((field) => {
      const counts = {};
      let total = 0;

      responses.forEach((r) => {
        let val = r.data[field.id];
        if (val === undefined || val === null) return;

        if (Array.isArray(val)) {
          val.forEach((v) => {
            counts[v] = (counts[v] || 0) + 1;
            total++;
          });
        } else {
          counts[val] = (counts[val] || 0) + 1;
          total++;
        }
      });

      const card = document.createElement("div");
      card.className = "card";
      card.style.padding = "20px";
      card.style.margin = "0";
      card.style.display = "flex";
      card.style.flexDirection = "column";
      card.style.gap = "20px";

      // Header and Layout
      card.innerHTML = `
                <h4 style="margin:0; font-size:1.1rem; color:var(--text-main); border-bottom:1px solid var(--border); padding-bottom:12px;">${field.label || field.id}</h4>
                <div style="display:flex; flex-direction:row; flex-wrap:wrap; gap:30px; align-items:center; justify-content:center;">
                    <div style="width:220px; height:220px; position:relative;">
                        <canvas id="chart-${field.id}"></canvas>
                    </div>
                    <div id="legend-${field.id}" style="flex:1; min-width:200px;"></div>
                </div>
            `;

      statsContent.appendChild(card);

      const sortedOptions = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const labels = sortedOptions.map((o) => o[0]);
      const data = sortedOptions.map((o) => o[1]);

      // Google Forms inspired colors
      const colors = [
        "#4285F4",
        "#DB4437",
        "#F4B400",
        "#0F9D58",
        "#AB47BC",
        "#00ACC1",
        "#FF7043",
        "#9E9E9E",
        "#5C6BC0",
        "#26A69A",
      ];

      // Initialize Chart
      try {
        const ctx = document
          .getElementById(`chart-${field.id}`)
          .getContext("2d");
        new Chart(ctx, {
          type: "pie",
          data: {
            labels: labels,
            datasets: [
              {
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 1,
                borderColor: "var(--bg-card)",
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }, // Custom legend below
            },
          },
        });
      } catch (chartErr) {
        console.warn(`Chart.js failed for field ${field.id}:`, chartErr);
        const chartContainer = document.getElementById(
          `chart-${field.id}`,
        ).parentElement;
        if (chartContainer) {
          chartContainer.innerHTML =
            '<div style="font-size:0.8rem; color:var(--text-muted); text-align:center; padding-top:80px;">Chart unavailable</div>';
        }
      }

      // Build custom legend
      const legendEl = document.getElementById(`legend-${field.id}`);
      let legendHtml =
        '<div style="display:flex; flex-direction:column; gap:8px;">';
      sortedOptions.forEach(([opt, count], i) => {
        const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
        legendHtml += `
                    <div style="display:flex; align-items:center; gap:10px; font-size:0.9rem;">
                        <div style="width:12px; height:12px; border-radius:3px; background:${colors[i % colors.length]};"></div>
                        <div style="flex:1; color:var(--text-main);">${opt}</div>
                        <div style="color:var(--text-muted); font-weight:500;">${count} (${percentage}%)</div>
                    </div>
                `;
      });
      legendHtml += "</div>";
      legendEl.innerHTML = legendHtml;
    });
  }

  function initFilters(responses, formFields) {
    const filterList = document.getElementById("filterList");
    const panel = document.getElementById("filterPanel");
    if (!filterList) return;
    filterList.innerHTML = "";

    // Only categorical fields get filters
    const filterableFields = formFields.filter((f) =>
      ["radio", "select", "checkbox_group"].includes(f.type),
    );

    if (!filterableFields.length) {
      if (panel) panel.style.display = "none";
      return;
    }

    filterableFields.forEach((field) => {
      const select = document.createElement("select");
      select.className = "modal-input filter-select";

      let html = `<option value="__all__">All ${field.label || field.id}</option>`;

      // Get unique options from responses
      const uniqueOptions = new Set();
      responses.forEach((r) => {
        const val = r.data[field.id];
        if (Array.isArray(val)) {
          val.forEach((v) => uniqueOptions.add(v));
        } else if (val) {
          uniqueOptions.add(val);
        }
      });

      [...uniqueOptions].sort().forEach((opt) => {
        html += `<option value="${opt}" ${activeFilters[field.id] === opt ? "selected" : ""}>${opt}</option>`;
      });

      select.innerHTML = html;
      select.onchange = (e) => {
        if (e.target.value === "__all__") {
          delete activeFilters[field.id];
        } else {
          activeFilters[field.id] = e.target.value;
        }
        filterAndRenderResponses();
      };
      filterList.appendChild(select);
    });
  }

  // ===== RESPONSES DASHBOARD (GLOBAL) =====
  window.closeResponses = function () {
    // Switch back to Library tab
    document
      .querySelectorAll(".nav-item")
      .forEach((item) => item.classList.remove("active"));
    document
      .querySelectorAll(".tab-pane")
      .forEach((pane) => pane.classList.remove("active"));

    const libraryTab = document.querySelector('.nav-item[data-tab="library"]');
    const libraryPane = document.getElementById("library");
    if (libraryTab) libraryTab.classList.add("active");
    if (libraryPane) libraryPane.classList.add("active");

    currentResponses = []; // Clear stored responses

    // Restore Add Form button if we are in library tab
    const addFormBtn = document.getElementById("addFormBtn");
    if (addFormBtn) {
      addFormBtn.style.display = "block";
    }

    const panel = document.getElementById("responsesPanel");
    if (panel) panel.style.display = "none";
  };

  /**
   * Opens the responses panel and fetches data from D1 via Worker API
   * @param {string} slug - The form slug to fetch responses for
   */
  window.openResponsesPanel = async function (slug) {
    console.log(`[Responses] Attempting to open panel for slug:`, slug);

    const panel = document.getElementById("responsesPanel");
    const metaEl = document.getElementById("responsesMeta");
    const tableEl = document.getElementById("responsesTable");
    const filterPanel = document.getElementById("filterPanel");
    const searchInput = document.getElementById("responseSearchInput");

    if (!slug) {
      console.error("[Responses] No slug provided!");
      if (metaEl)
        metaEl.innerHTML =
          '<div style="padding:20px; color:var(--danger);">Error: No form selected.</div>';
      return;
    }

    // Reset state for new form
    currentResponses = [];
    filteredResponses = [];
    activeFilters = {};
    responseSearchQuery = "";
    if (searchInput) searchInput.value = "";
    if (filterPanel) filterPanel.style.display = "none";

    if (!panel || !metaEl || !tableEl) {
      console.error("[Responses] Critical UI elements missing in DOM");
      return;
    }

    if (panel) panel.style.display = "block";

    // Use centralized tab switcher - simpler and cleaner
    if (window.switchTab) {
      window.switchTab("responses");
    }

    metaEl.innerHTML =
      '<div style="padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading form schema...</div>';
    tableEl.innerHTML =
      '<div style="text-align:center; padding:50px; opacity:0.3;"><i class="fa-solid fa-table fa-2x"></i></div>';

    // Hide Add Form button while responses are open
    const addFormBtn = document.getElementById("addFormBtn");
    if (addFormBtn) addFormBtn.style.display = "none";

    try {
      // 1. Fetch form schema (try local cache first for speed and reliability)
      let form = backendForms.find((f) => f.slug === slug || f.id === slug);

      if (!form) {
        console.log(
          `[Responses] Form not in local cache, fetching from API...`,
        );
        const formRes = await fetch(`${API_BASE}/api/forms/${slug}`);
        if (!formRes.ok) {
          throw new Error(
            `Form not found: ${formRes.status} ${formRes.statusText}`,
          );
        }
        form = await formRes.json();
      }

      // Extract form fields (handle both 'config' and 'fields' property names)
      const formFields = form.config || form.fields || [];
      const formTitle = form.title || form.name || "Untitled Form";

      // Update loading message
      metaEl.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Loading responses...';

      // 2. Fetch responses
      const respRes = await fetch(`${API_BASE}/api/forms/${slug}/responses`);
      if (!respRes.ok) {
        throw new Error(
          `Failed to fetch responses: ${respRes.status} ${respRes.statusText}`,
        );
      }
      const responses = await respRes.json();

      // Store for filters and exports
      currentResponses = responses;
      currentFormSlug = slug;
      currentFormFields = formFields;
      currentDesign.formTitle = formTitle;

      // 3. Initialize filters and initial render
      initFilters(currentResponses, formFields);
      filterAndRenderResponses();
    } catch (err) {
      console.error("Error fetching responses:", err);
      metaEl.innerHTML = "";
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
    formFields.forEach((field) => {
      // Skip non-input fields
      if (field.type === "description" || field.type === "success_link") {
        return;
      }
      let headerExtra = "";
      if (field.type === "file") {
        headerExtra = `
                    <button class="icon-btn download-column-zip" onclick="downloadColumnAsZip('${field.id}')" title="Download all files in this column as ZIP" style="margin-left:5px; color:var(--primary);">
                         <i class="fa-solid fa-cloud-arrow-down"></i>
                    </button>`;
      }
      html += `<th><div style="display:flex; align-items:center; justify-content:center; gap:4px;">${field.label || field.id} ${headerExtra}</div></th>`;
    });

    // Add Actions column
    html += "<th>Actions</th>";

    html += "</tr></thead><tbody>";

    // Render rows
    responses.forEach((response) => {
      html += `<tr data-id="${response.id}">`;
      html += `<td>${new Date(response.submitted_at).toLocaleString()}</td>`;

      // Map response data using field IDs from schema
      formFields.forEach((field) => {
        // Skip non-input fields
        if (field.type === "description" || field.type === "success_link") {
          return;
        }

        const value = response.data[field.id];
        let displayValue = "";

        // Handle different data types
        if (field.type === "file" && value && value.startsWith("http")) {
          const filename = getDisplayFilename(value, response, formFields);
          const isImg = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(filename);
          // For preview/download, we still use the actual URL, but we show the nice name
          // And for single file download, we might want to suggest the nice name if possible
          // The downloadSingleFile function logic handles blob download, we can't easily force name there without extra work,
          // but let's pass it if we update that function too. For now, just display name.

          displayValue = `
        <div style="display:flex; align-items:center; gap:8px;">
            <a href="${value}" target="_blank" class="file-link" title="${filename}" style="color:var(--primary); text-decoration:none; font-weight:500;">
                <i class="fa-solid ${isImg ? "fa-image" : "fa-file-lines"}"></i> ${filename}
            </a>
             <div class="file-actions" style="display:flex; gap:4px;">
                 ${
                   isImg
                     ? `
                     <button class="icon-btn preview-file" onclick="openImagePreview('${value}', '${filename}')" title="Preview Image">
                         <i class="fa-solid fa-eye"></i>
                     </button>`
                     : ""
                 }
                 <button class="icon-btn" onclick="downloadSingleFile('${value}', '${filename}')" title="Download File">
                     <i class="fa-solid fa-download"></i>
                 </button>
             </div>
        </div>
    `;
        } else if (Array.isArray(value)) {
          // Checkbox groups return arrays
          displayValue = value.length > 0 ? value.join(", ") : "-";
        } else if (typeof value === "boolean") {
          // Single checkboxes return booleans
          displayValue = value ? "Yes" : "No";
        } else if (value === null || value === undefined || value === "") {
          displayValue = "-";
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

    // Wire up individual edit buttons
    tableEl.querySelectorAll(".edit-response-row").forEach((btn) => {
      btn.onclick = () => {
        const responseId = btn.dataset.id;
        const response = responses.find((r) => r.id == responseId);
        if (response) {
          openEditResponseModal(response, formFields);
        }
      };
    });

    tableEl.querySelectorAll(".delete-response-row").forEach((btn) => {
      btn.onclick = async (e) => {
        const responseId = btn.dataset.id;
        if (
          await CustomDialog.confirm(
            "Delete this individual response? This cannot be undone.",
          )
        ) {
          try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            const token = localStorage.getItem("adminToken");
            const res = await fetch(
              `${API_BASE}/api/forms/${currentFormSlug}/responses/${responseId}`,
              {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              },
            );

            if (!res.ok) throw new Error("Failed to delete response");

            // Refresh table
            openResponsesPanel(currentFormSlug);
          } catch (err) {
            console.error("Delete individual response error:", err);
            alert(`Failed to delete response: ${err.message} `);
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-trash"></i>';
          }
        }
      };
    });
  }

  // --- COLUMN ZIP DOWNLOAD ---
  window.downloadColumnAsZip = async function (fieldId) {
    console.log(`[Zip] Starting download for column: ${fieldId}`);

    if (!window.JSZip) {
      alert(
        "JSZip library not loaded. Please wait a moment or refresh the page.",
      );
      return;
    }

    // Find the column button to show loading state
    const btn = document.querySelector(
      `button[onclick="downloadColumnAsZip('${fieldId}')"]`,
    );
    const originalIcon = btn
      ? btn.innerHTML
      : '<i class="fa-solid fa-cloud-arrow-down"></i>';

    if (btn) {
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      btn.disabled = true;
    }

    try {
      // Check scope of currentResponses
      if (!currentResponses || !Array.isArray(currentResponses)) {
        throw new Error(
          "Response data is not available. Please refresh the table.",
        );
      }

      const zip = new JSZip();
      let count = 0;
      const validResponses = currentResponses.filter(
        (r) =>
          r.data[fieldId] &&
          typeof r.data[fieldId] === "string" &&
          r.data[fieldId].startsWith("http"),
      );

      console.log(`[Zip] Found ${validResponses.length} valid files`);

      if (validResponses.length === 0) {
        alert("No files found in this column to download.");
        if (btn) {
          btn.innerHTML = originalIcon;
          btn.disabled = false;
        }
        return;
      }

      // Get schema fields to find name
      let formFields = [];
      try {
        const res = await fetch(`${API_BASE}/api/forms/${currentFormSlug}`);
        const form = await res.json();
        formFields = form.config || form.fields || [];
      } catch (e) {
        console.warn("Could not fetch schema for naming", e);
      }

      // Toast notification
      const toast = document.createElement("div");
      toast.style.cssText =
        "position:fixed; bottom:20px; right:20px; background:var(--bg-card); padding:15px; border-radius:8px; box-shadow:var(--shadow-lg); z-index:10000; display:flex; gap:10px; align-items:center; border-left:4px solid var(--primary); font-family:sans-serif;";
      toast.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Zipping ${validResponses.length} files...</span>`;
      document.body.appendChild(toast);

      const filePromises = validResponses.map(async (response) => {
        const url = response.data[fieldId];
        try {
          // Fetch blob with CORS safeguards
          const res = await fetch(url, {
            mode: "cors",
            credentials: "omit",
            cache: "no-cache",
          });
          if (!res.ok)
            throw new Error(`Failed to fetch ${url} (Status: ${res.status})`);
          const blob = await res.blob();

          // Use new naming logic
          const displayName = getDisplayFilename(url, response, formFields);

          // Add to zip (ensure unique names if duplicates exist handling is out of scope for now, zip will overwrite or we can append id if needed, but request asked for specific naming.
          // To be safe against overwrites of same name people, let's prefix ID strictly if collisions?
          // User asked: "name entry ... must be image name".
          // Let's stick to their request. If John Doe uploads twice, it might overwrite.
          // Better: Name_ID.ext

          // Actually, let's just use the display name as requested, but maybe prepend ID if we really want safety?
          // User said: "rename ... as the name entry".
          // I will stick to getDisplayFilename which returns "Name.ext".
          // But wait, if 2 people have same name, we lose one.
          // Let's modify getDisplayFilename slightly or handle it here?
          // I'll stick to the function I wrote: getDisplayFilename uses Name.ext.
          // I'll add the ID prefix back just to be safe while keeping the name distinct.
          // Actually, let's just rely on getDisplayFilename returning a good name.
          // Wait, previous code had: `${response.id.substring(0, 4)}_${originalName}`
          // I will prioritize the "Name" request.

          zip.file(displayName, blob);
          count++;
        } catch (e) {
          console.error(`[Zip] Failed to process ${url}:`, e);
        }
      });

      await Promise.all(filePromises);

      if (count === 0) {
        throw new Error(
          "Could not download any files. Check console for CORS or network errors.",
        );
      }

      toast.innerHTML = `<i class="fa-solid fa-box-archive"></i> <span>Generating Zip...</span>`;

      const content = await zip.generateAsync({ type: "blob" });

      // Trigger download
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `${fieldId}_files.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast.innerHTML = `<i class="fa-solid fa-check" style="color:var(--success);"></i> <span>Download Started!</span>`;
      setTimeout(() => toast.remove(), 3000);
    } catch (err) {
      console.error("[Zip] Generation failed:", err);
      alert("Failed to generate zip file: " + err.message);
    } finally {
      if (btn) {
        btn.innerHTML = originalIcon;
        btn.disabled = false;
      }
    }
  };
  /**
   * Opens the Edit Response modal with dynamic fields
   * @param {object} response - The response object to edit
   * @param {array} formFields - The form schema fields
   */
  function openEditResponseModal(response, formFields) {
    const modal = document.getElementById("editResponseModal");
    const fieldsContainer = document.getElementById("editResponseFields");

    if (!modal || !fieldsContainer) return;

    fieldsContainer.innerHTML = "";

    formFields.forEach((field) => {
      if (field.type === "description" || field.type === "success_link") return;

      const group = document.createElement("div");
      group.className = "form-group";
      group.style.marginBottom = "15px";

      let html = `<label style="display:block; margin-bottom:5px; font-weight:500;">${field.label || field.id}</label>`;

      const value = response.data[field.id] || "";

      if (field.type === "textarea") {
        html += `<textarea class="form-input edit-field-input" data-id="${field.id}" rows="3" style="width:100%">${value}</textarea>`;
      } else if (field.type === "select") {
        html += `<select class="form-input edit-field-input" data-id="${field.id}" style="width:100%">
                    <option value="">Select...</option>
                ${(field.options || [])
                  .map((opt) => {
                    const label = typeof opt === "object" ? opt.label : opt;
                    const val = typeof opt === "object" ? opt.value : opt;
                    return `<option value="${val}" ${val == value ? "selected" : ""}>${label}</option>`;
                  })
                  .join("")}
            </select>`;
      } else if (field.type === "radio") {
        html += `<div class="radio-group">
                    ${(field.options || [])
                      .map((opt) => {
                        const label = typeof opt === "object" ? opt.label : opt;
                        const val = typeof opt === "object" ? opt.value : opt;
                        return `
                    <label style="display:block; margin-bottom:5px;">
                        <input type="radio" class="edit-field-input" name="edit_${field.id}" value="${val}" data-id="${field.id}" ${val == value ? "checked" : ""}> ${label}
                    </label>
                `;
                      })
                      .join("")}
            </div>`;
      } else if (field.type === "checkbox_group") {
        const checkedValues = Array.isArray(value) ? value : [];
        html += `<div class="checkbox-group">
                    ${(field.options || [])
                      .map((opt) => {
                        const label = typeof opt === "object" ? opt.label : opt;
                        const val = typeof opt === "object" ? opt.value : opt;
                        return `
                    <label style="display:block; margin-bottom:5px;">
                        <input type="checkbox" class="edit-field-input checkbox-option" value="${val}" data-id="${field.id}" ${checkedValues.includes(val) ? "checked" : ""}> ${label}
                    </label>
                `;
                      })
                      .join("")}
            </div>`;
      } else if (field.type === "checkbox") {
        html += `<label style="display:block; margin-bottom:5px;">
                    <input type="checkbox" class="edit-field-input" data-id="${field.id}" ${value === true ? "checked" : ""}> ${field.label}
                    </label>`;
      } else {
        // text, email, tel
        html += `<input type="${field.type}" class="form-input edit-field-input" data-id="${field.id}" value="${value}" style="width:100%">`;
      }

      group.innerHTML = html;
      fieldsContainer.appendChild(group);
    });

    modal.classList.add("show");

    // Handle Save
    const saveBtn = document.getElementById("saveEditResponse");
    const cancelBtn = document.getElementById("cancelEditResponse");

    saveBtn.onclick = async () => {
      const newData = {};
      const inputs = fieldsContainer.querySelectorAll(".edit-field-input");

      formFields.forEach((field) => {
        if (field.type === "description" || field.type === "success_link")
          return;

        if (field.type === "checkbox_group") {
          const checked = Array.from(
            fieldsContainer.querySelectorAll(
              `.edit-field-input[data-id="${field.id}"]:checked`,
            ),
          ).map((i) => i.value);
          newData[field.id] = checked;
        } else if (field.type === "radio") {
          const selected = fieldsContainer.querySelector(
            `.edit-field-input[data-id="${field.id}"]:checked`,
          );
          newData[field.id] = selected ? selected.value : "";
        } else if (field.type === "checkbox") {
          const checked = fieldsContainer.querySelector(
            `.edit-field-input[data-id="${field.id}"]`,
          ).checked;
          newData[field.id] = checked;
        } else {
          const input = fieldsContainer.querySelector(
            `.edit-field-input[data-id="${field.id}"]`,
          );
          newData[field.id] = input ? input.value : "";
        }
      });

      try {
        saveBtn.disabled = true;
        saveBtn.innerHTML =
          '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        const token = localStorage.getItem("adminToken");
        const res = await fetch(
          `${API_BASE}/api/forms/${currentFormSlug}/responses/${response.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ data: newData }),
          },
        );

        if (!res.ok) throw new Error("Failed to update response");

        modal.classList.remove("show");
        openResponsesPanel(currentFormSlug); // Refresh table
      } catch (err) {
        console.error("Update response error:", err);
        alert(`Failed to update response: ${err.message}`);
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = "Save Changes";
      }
    };

    cancelBtn.onclick = () => {
      modal.classList.remove("show");
    };
  }

  // Unified Export Handlers
  const exportDropdownBtn = document.getElementById("exportDropdownBtn");
  const exportMenu = document.getElementById("exportMenu");

  if (exportDropdownBtn && exportMenu) {
    exportDropdownBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      exportMenu.classList.toggle("show");
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (!exportDropdownBtn.contains(e.target)) {
        exportMenu.classList.remove("show");
      }
    });

    // CSV Export
    document.getElementById("exportCsvBtn")?.addEventListener("click", () => {
      exportMenu.classList.remove("show");
      if (!currentFormSlug || !currentDesign.formTitle)
        return alert("No form context available.");
      if (!currentResponses?.length) return alert("No responses to export.");
      exportCsv(currentFormSlug, currentDesign.formTitle);
    });

    // XLSX Export
    document.getElementById("exportExcelBtn")?.addEventListener("click", () => {
      exportMenu.classList.remove("show");
      if (!currentFormSlug || !currentDesign.formTitle)
        return alert("No form context available.");
      if (!currentResponses?.length) return alert("No responses to export.");
      exportXlsx(currentFormSlug, currentDesign.formTitle);
    });

    // PDF Export
    document.getElementById("exportPdfBtn")?.addEventListener("click", () => {
      exportMenu.classList.remove("show");
      if (!currentFormSlug || !currentDesign.formTitle)
        return alert("No form context available.");
      if (!currentResponses?.length) return alert("No responses to export.");
      exportPdf(currentFormSlug, currentDesign.formTitle);
    });
  }

  document
    .getElementById("clearResponsesBtn")
    ?.addEventListener("click", async () => {
      if (!currentFormSlug) return;

      if (
        await CustomDialog.confirm(
          "Are you ABSOLUTELY sure you want to clear ALL responses for this form? This action is permanent and cannot be reversed.",
        )
      ) {
        try {
          const btn = document.getElementById("clearResponsesBtn");
          btn.disabled = true;
          btn.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Clearing...';

          const token = localStorage.getItem("adminToken");
          const res = await fetch(
            `${API_BASE}/api/forms/${currentFormSlug}/responses`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          );

          if (!res.ok) throw new Error("Failed to clear responses");

          alert("All responses have been cleared.");
          openResponsesPanel(currentFormSlug);
        } catch (err) {
          console.error("Clear responses error:", err);
          alert(`Failed to clear responses: ${err.message}`);
        } finally {
          const btn = document.getElementById("clearResponsesBtn");
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Clear All';
        }
      }
    });

  /**
   * Downloads a single file by fetching it as a blob (bypassing CORS link issues)
   * @param {string} url - The URL to download
   * @param {string} forcedName - Optional filename to use
   */
  window.downloadSingleFile = async function (url, forcedName = null) {
    if (!url) return;

    try {
      const toast = document.createElement("div");
      toast.style.cssText =
        "position:fixed; bottom:20px; right:20px; background:var(--bg-card); padding:15px; border-radius:8px; box-shadow:var(--shadow-lg); z-index:10000; display:flex; gap:10px; align-items:center; border-left:4px solid var(--primary); font-family:sans-serif;";
      toast.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Downloading...</span>`;
      document.body.appendChild(toast);

      // Use CORS mode 'cors' and 'omit' credentials to avoid opaque responses if possible
      const res = await fetch(url, {
        mode: "cors",
        credentials: "omit",
        cache: "no-cache",
      });
      if (!res.ok) throw new Error("Failed to fetch file");

      const blob = await res.blob();

      // Extract filename
      let filename = forcedName;
      if (!filename) {
        try {
          const parts = url.split("/");
          filename = decodeURIComponent(parts[parts.length - 1].split("?")[0]);
        } catch (e) {
          filename = "download";
        }
      }

      // Create download link
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);

      toast.innerHTML = `<i class="fa-solid fa-check" style="color:var(--success);"></i> <span>Downloaded!</span>`;
      setTimeout(() => toast.remove(), 2000);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Could not download file directly. Opening in new tab instead.");
      window.open(url, "_blank");
    }
  };

  // Add keyboard shortcut: ESC to close responses panel (returns to library)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const responsesPane = document.getElementById("responses");
      if (responsesPane && responsesPane.classList.contains("active")) {
        window.closeResponses();
      }
    }
  });
  // Response Search & View Toggles
  const responseSearchInput = document.getElementById("responseSearchInput");
  const viewTableBtn = document.getElementById("viewTableBtn");
  const viewStatsBtn = document.getElementById("viewStatsBtn");
  const toggleFilterBtn = document.getElementById("toggleFilterBtn");
  const filterPanel = document.getElementById("filterPanel");
  const clearFiltersBtn = document.getElementById("clearFiltersBtn");

  if (responseSearchInput) {
    responseSearchInput.addEventListener("input", (e) => {
      responseSearchQuery = e.target.value.trim();
      filterAndRenderResponses();
    });
  }

  const viewIndividualBtn = document.getElementById("viewIndividualBtn");

  if (viewTableBtn && viewStatsBtn && viewIndividualBtn) {
    viewTableBtn.addEventListener("click", () => {
      responseViewMode = "table";
      viewTableBtn.classList.add("active");
      viewStatsBtn.classList.remove("active");
      viewIndividualBtn.classList.remove("active");
      filterAndRenderResponses();
    });

    viewStatsBtn.addEventListener("click", () => {
      responseViewMode = "stats";
      viewStatsBtn.classList.add("active");
      viewTableBtn.classList.remove("active");
      viewIndividualBtn.classList.remove("active");
      filterAndRenderResponses();
    });

    viewIndividualBtn.addEventListener("click", () => {
      responseViewMode = "individual";
      viewIndividualBtn.classList.add("active");
      viewTableBtn.classList.remove("active");
      viewStatsBtn.classList.remove("active");
      currentIndividualIndex = 0; // Reset to first found response
      filterAndRenderResponses();
    });
  }

  // Individual View Navigation
  const prevEntryBtn = document.getElementById("prevEntryBtn");
  const nextEntryBtn = document.getElementById("nextEntryBtn");

  if (prevEntryBtn) {
    prevEntryBtn.addEventListener("click", () => {
      if (currentIndividualIndex > 0) {
        currentIndividualIndex--;
        renderIndividualEntry(currentIndividualIndex);
      }
    });
  }

  if (nextEntryBtn) {
    nextEntryBtn.addEventListener("click", () => {
      if (currentIndividualIndex < filteredResponses.length - 1) {
        currentIndividualIndex++;
        renderIndividualEntry(currentIndividualIndex);
      }
    });
  }

  if (toggleFilterBtn && filterPanel) {
    toggleFilterBtn.addEventListener("click", () => {
      const isHidden = filterPanel.style.display === "none";
      filterPanel.style.display = isHidden ? "block" : "none";
      toggleFilterBtn.classList.toggle("active", isHidden);
      if (isHidden) initFilters(currentResponses, currentFormFields);
    });
  }

  const responseSortOrderInput = document.getElementById("responseSortOrder");
  if (responseSortOrderInput) {
    responseSortOrderInput.addEventListener("change", (e) => {
      responseSortOrder = e.target.value;
      filterAndRenderResponses();
    });
  }

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
      activeFilters = {};
      initFilters(currentResponses, currentFormFields);
      filterAndRenderResponses();
    });
  }

  // ===================================================================
  // TEAM MANAGEMENT (Superadmin only)
  // ===================================================================

  let currentTeamMembers = [];

  if (isSuperAdmin) {
    const createAdminUserBtn = document.getElementById("createAdminUserBtn");
    const refreshTeamBtn = document.getElementById("refreshTeamBtn");
    const teamSearchInput = document.getElementById("teamSearchInput");

    if (createAdminUserBtn) {
      createAdminUserBtn.addEventListener("click", () => createAdminUser());
    }
    if (refreshTeamBtn) {
      refreshTeamBtn.addEventListener("click", () => loadAdminUsers());
    }
    if (teamSearchInput) {
      teamSearchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = currentTeamMembers.filter((user) =>
          user.username.toLowerCase().includes(query),
        );
        renderAdminUsers(filtered);
      });
    }
  }

  async function loadAdminUsers() {
    const listEl = document.getElementById("teamMembersList");
    if (!listEl) return;
    listEl.innerHTML =
      '<p style="color:var(--text-muted); text-align:center; padding:20px 0;"><i class="fa-solid fa-spinner fa-spin"></i> Loading\u2026</p>';

    try {
      const res = await fetch(API_BASE + "/api/admin/users");
      if (!res.ok) throw new Error(`Failed to load users: ${res.status}`);
      const users = await res.json();
      currentTeamMembers = users;
      renderAdminUsers(currentTeamMembers);
    } catch (err) {
      console.error("loadAdminUsers error:", err);
      listEl.innerHTML = `<p style="color:var(--danger); text-align:center; padding:20px 0;">${err.message}</p>`;
    }
  }

  function renderAdminUsers(users) {
    const listEl = document.getElementById("teamMembersList");
    if (!listEl) return;

    if (!users || users.length === 0) {
      listEl.innerHTML =
        '<p style="color:var(--text-muted); text-align:center; padding:20px 0;">No team members yet. Create one above.</p>';
      return;
    }

    const table = document.createElement("table");
    table.style.cssText =
      "width:100%; border-collapse:collapse; font-size:0.9rem;";
    table.innerHTML = `
            <thead>
                <tr style="border-bottom:2px solid var(--border);">
                    <th style="text-align:left; padding:10px 8px; font-weight:600; color:var(--text-muted);">Username</th>
                    <th style="text-align:left; padding:10px 8px; font-weight:600; color:var(--text-muted);">Created</th>
                    <th style="text-align:right; padding:10px 8px;"></th>
                </tr>
            </thead>
            <tbody id="teamUsersBody"></tbody>
        `;

    const tbody = table.querySelector("#teamUsersBody");
    users.forEach((user) => {
      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid var(--border)";
      const created = user.created_at
        ? new Date(user.created_at).toLocaleDateString()
        : "Unknown";
      tr.innerHTML = `
                <td style="padding:12px 8px;">
                    <i class="fa-solid fa-user-shield" style="color:var(--primary); margin-right:8px;"></i>
                    <strong>${escapeHtml(user.username)}</strong>
                </td>
                <td style="padding:12px 8px; color:var(--text-muted);">${created}</td>
                <td style="padding:12px 8px; text-align:right;">
                    <button class="btn btn-sm btn-outline-danger delete-admin-user-btn" data-id="${user.id}" data-username="${escapeHtml(user.username)}">
                        <i class="fa-solid fa-trash-can"></i> Remove
                    </button>
                </td>
            `;
      tbody.appendChild(tr);
    });

    listEl.innerHTML = "";
    listEl.appendChild(table);

    // Wire delete buttons
    listEl.querySelectorAll(".delete-admin-user-btn").forEach((btn) => {
      btn.addEventListener("click", () =>
        deleteAdminUser(btn.dataset.id, btn.dataset.username),
      );
    });
  }

  async function createAdminUser() {
    const usernameInput = document.getElementById("newAdminUsername");
    const passwordInput = document.getElementById("newAdminPassword");
    const errorEl = document.getElementById("teamCreateError");
    const successEl = document.getElementById("teamCreateSuccess");
    const btn = document.getElementById("createAdminUserBtn");

    const username = (usernameInput?.value || "").trim().toLowerCase();
    const password = passwordInput?.value || "";

    // Hide previous messages
    if (errorEl) errorEl.style.display = "none";
    if (successEl) successEl.style.display = "none";

    // Client-side validation
    if (!username || username.length < 3) {
      showTeamError("Username must be at least 3 characters.");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      showTeamError(
        "Username can only contain letters, numbers, and underscores.",
      );
      return;
    }
    if (!password || password.length < 8) {
      showTeamError("Password must be at least 8 characters.");
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Creating\u2026';
    }

    try {
      const res = await fetch(API_BASE + "/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        showTeamError(data.error || "Failed to create user.");
        return;
      }

      // Clear inputs
      if (usernameInput) usernameInput.value = "";
      if (passwordInput) passwordInput.value = "";

      if (successEl) {
        successEl.textContent = `\u2713 User "${data.username}" created successfully.`;
        successEl.style.display = "block";
        setTimeout(() => {
          if (successEl) successEl.style.display = "none";
        }, 4000);
      }

      // Refresh the list
      await loadAdminUsers();
    } catch (err) {
      showTeamError("Network error. Please try again.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Create User';
      }
    }
  }

  async function deleteAdminUser(id, username) {
    if (
      !(await CustomDialog.confirm(
        `Remove admin access for "${username}"?\n\nThey will no longer be able to log in.`,
      ))
    )
      return;

    const btn = document.querySelector(
      `.delete-admin-user-btn[data-id="${id}"]`,
    );
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }

    try {
      const res = await fetch(API_BASE + `/api/admin/users/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to remove user.");
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Remove';
        }
        return;
      }
      await loadAdminUsers();
    } catch (err) {
      alert("Network error. Please try again.");
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Remove';
      }
    }
  }

  function showTeamError(message) {
    const errorEl = document.getElementById("teamCreateError");
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = "block";
    }
  }
});
