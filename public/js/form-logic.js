/* --- form-logic.js --- */
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("registrationForm");
    const container = document.getElementById("formFieldsContainer");
    const submitBtn = document.getElementById("submitBtn");
    const successMessage = document.getElementById("successMessage");
    const registerAnotherBtn = document.getElementById("registerAnother");

    if (!form || !container) return; // Guard clause

    // --- CLOSE BUTTON FUNCTIONALITY ---
    const closeFormBtn = document.getElementById("closeFormBtn");
    if (closeFormBtn) {
        closeFormBtn.addEventListener("click", () => {
            // Try to go back to admin page, or close window if opened in new tab
            const urlParams = new URLSearchParams(window.location.search);
            const formId = urlParams.get('id');

            // If opened from admin (has form ID), go back to admin
            if (formId || document.referrer.includes('admin.html')) {
                window.location.href = 'admin.html';
            } else {
                // Try to close the window/tab
                window.close();

                // If window.close() doesn't work (not opened by script), redirect to admin
                setTimeout(() => {
                    if (!window.closed) {
                        window.location.href = 'admin.html';
                    }
                }, 100);
            }
        });
    }


    // --- CHECK FORM STATUS ---
    const formClosedMessage = document.getElementById("formClosedMessage");
    const formStatus = (window.formContext && window.formContext.status) || "open";

    if (formStatus === "closed") {
        // Hide the form and show closed message
        if (form) form.style.display = "none";
        if (formClosedMessage) formClosedMessage.classList.add("show");

        // Hide header controls except theme toggle
        const closeFormBtn = document.getElementById("closeFormBtn");
        if (closeFormBtn) closeFormBtn.style.display = "none";

        console.log("Form is closed. Not accepting responses.");
        return; // Stop execution - don't render the form
    }

    // --- RESPONSE LIMIT CHECK ---
    const responseLimit = window.formContext && window.formContext.design && window.formContext.design.responseLimit;
    if (responseLimit && parseInt(responseLimit) > 0) {
        checkResponseLimit(parseInt(responseLimit));
    }

    async function checkResponseLimit(limit) {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const identifier = urlParams.get('form') || urlParams.get('id');
            if (!identifier) return;

            const res = await fetch(`/api/form-stats?id=${identifier}`);
            if (res.ok) {
                const stats = await res.json();
                if (stats.count >= limit) {
                    if (form) form.style.display = "none";
                    if (formClosedMessage) {
                        formClosedMessage.classList.add("show");
                        // Optional: Update text to be specific
                        const msg = formClosedMessage.querySelector('h2');
                        if (msg) msg.textContent = "Form Limit Reached";
                        const p = formClosedMessage.querySelector('p');
                        if (p) p.textContent = "Thank you for your interest. This form is no longer accepting responses.";
                    }
                    const closeFormBtn = document.getElementById("closeFormBtn");
                    if (closeFormBtn) closeFormBtn.style.display = "none";
                    console.log("Form limit reached:", limit);
                }
            }
        } catch (e) {
            console.warn("Response limit check skipped (Backend offline)", e);
        }
    }


    // --- DEFAULT CONFIGURATION (Fallback) ---
    const defaultConfig = [
        { id: "fullName", label: "Full Name", type: "text", placeholder: "Your answer", required: true },
        { id: "email", label: "Email", type: "email", placeholder: "Your answer", required: true },
        {
            id: "branch", label: "Branch", type: "radio", required: true,
            options: [
                { value: "CSE", label: "AI/ML" },
                { value: "ECE", label: "CS" },
                { value: "EEE", label: "EC" },
                { value: "ME", label: "EEE" }
            ]
        },
        {
            id: "year", label: "Year", type: "radio", required: true,
            options: [
                { value: "1", label: "1st Year" },
                { value: "2", label: "2nd Year" },
                { value: "3", label: "3rd Year" },
                { value: "4", label: "4th Year" }
            ]
        },
        { id: "phone", label: "WhatsApp Number", type: "tel", placeholder: "Your answer", required: true },
        { id: "confirmation", label: "I confirm the details are correct", type: "checkbox", required: true }
    ];

    // Load Config (Dynamic Context or Fallback)
    // Note: form-loader.js MUST run before this and set window.formContext
    let formConfig = (window.formContext && window.formContext.config)
        ? window.formContext.config
        : (JSON.parse(localStorage.getItem("formConfig")) || defaultConfig);

    // --- RENDER ENGINE ---
    function renderForm() {
        container.innerHTML = "";

        formConfig.forEach(field => {
            if (field.type === 'success_link') return;

            const wrapper = document.createElement("div");
            wrapper.className = "form-group";

            // Allow override class for visual separation
            // if (field.type === "description") wrapper.className = "form-section-description"; 

            let html = "";
            const isReq = field.required ? " *" : "";

            switch (field.type) {
                case "text":
                case "email":
                case "tel":
                    html = `
                        <label class="form-label">${field.label}${isReq}</label>
                        <input type="${field.type}" id="${field.id}" name="${field.id}" class="form-input" 
                               placeholder="${field.placeholder || 'Your answer'}" ${field.required ? "required" : ""}>
                    `;
                    break;

                case "textarea":
                    html = `
                        <label class="form-label">${field.label}${isReq}</label>
                        <textarea id="${field.id}" name="${field.id}" class="form-input" rows="3"
                               placeholder="${field.placeholder || 'Your answer'}" ${field.required ? "required" : ""}></textarea>
                    `;
                    break;

                case "radio":
                    html = `
                        <label class="form-label">${field.label}${isReq}</label>
                        <div class="radio-group" id="${field.id}Group">
                            ${(field.options || []).map(opt => `
                                <label class="radio-option">
                                    <input type="radio" name="${field.id}" value="${opt.value}" ${field.required ? "required" : ""}> 
                                    <span>${opt.label}</span>
                                </label>
                            `).join('')}
                        </div>
                    `;
                    break;

                case "checkbox_group": // Multi-select checkboxes
                    html = `
                        <label class="form-label">${field.label}${isReq}</label>
                        <div class="radio-group" id="${field.id}Group">
                            ${(field.options || []).map(opt => `
                                <label class="checkbox-option" style="display:flex; align-items:center; margin-bottom:8px; cursor:pointer;">
                                    <input type="checkbox" name="${field.id}" value="${opt.value}" style="width:18px; height:18px; margin-right:10px;"> 
                                    <span>${opt.label}</span>
                                </label>
                            `).join('')}
                        </div>
                    `;
                    break;

                case "select":
                    html = `
                        <label class="form-label">${field.label}${isReq}</label>
                         <select id="${field.id}" name="${field.id}" class="form-input" ${field.required ? "required" : ""}>
                            <option value="">Select an option</option>
                            ${(field.options || []).map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
                        </select>
                    `;
                    break;

                case "checkbox": // Single Confirmation Checkbox
                    html = `
                        <label class="checkbox-label" style="display:flex; align-items:center;">
                            <input type="checkbox" id="${field.id}" name="${field.id}" ${field.required ? "required" : ""} 
                                   style="width:18px; height:18px; margin-right:10px;">
                            <span>${field.label}${isReq}</span>
                        </label>
                    `;
                    break;

                case "description": // Static text
                    html = `
                        <h3 style="font-size:1.1rem; margin-bottom:8px;">${field.label}</h3>
                        <p style="color:var(--theme-text-secondary); white-space: pre-line;">${field.placeholder || ''}</p>
                    `;
                    break;
            }

            // Error span for all except static descriptions
            if (field.type !== 'description') {
                html += `<span class="error-message" id="${field.id}Error"></span>`;
            }

            wrapper.innerHTML = html;
            container.appendChild(wrapper);
        });
    }

    // Initial Render
    renderForm();

    // Custom Validation (Dynamic)
    function showError(id, show) {
        const el = document.getElementById(id + "Error");
        if (!el) return;
        el.style.display = show ? "flex" : "none";
        el.innerText = show ? "This is a required question" : "";
    }

    function getRadioValue(name) {
        const checked = form.querySelector(`input[name="${name}"]:checked`);
        return checked ? checked.value : "";
    }

    function getCheckboxGroupValue(name) {
        const checked = form.querySelectorAll(`input[name="${name}"]:checked`);
        return Array.from(checked).map(cb => cb.value).join(", ");
    }

    function validate() {
        let ok = true;
        const data = collectData(); // reuse collection for checking

        formConfig.forEach(field => {
            if (field.type === 'description' || field.type === 'success_link') return; // Skip validation

            let valid = true;
            const val = data[field.id];

            if (field.required) {
                if (field.type === "checkbox") valid = val === "Yes";
                else if (!val || val === "") valid = false;
            }

            // Regex / Constraints
            if (field.id === "phone") valid = /^[6-9]\d{9}$/.test(val);
            if (field.type === "email") valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

            // UI Feedback
            if (field.type !== 'radio' && field.type !== 'checkbox_group' && field.type !== 'checkbox') {
                const el = document.getElementById(field.id);
                if (el) el.style.borderBottomColor = valid ? "var(--theme-border)" : "var(--theme-error)";
            }

            showError(field.id, !valid);
            if (!valid) ok = false;
        });

        return ok;
    }

    function collectData() {
        // Priority: Dynamic Context > LocalStorage > Default
        let sheetName = (window.formContext && window.formContext.sheetName)
        const data = {};

        // Add sheetName from context (CRITICAL for multi-form support!)
        if (window.formContext && window.formContext.sheetName) {
            data.sheetName = window.formContext.sheetName;
        } else {
            // Fallback to localStorage
            data.sheetName = localStorage.getItem("sheetName") || "FormResponses";
        }

        console.log("Sheet Name being sent:", data.sheetName);

        formConfig.forEach(field => {
            if (field.type === 'description' || field.type === 'success_link') return;

            // Some fields (radio/checkbox group) use ID + "Group" suffix in HTML
            const input = document.getElementById(field.id) || document.getElementById(field.id + "Group");
            if (!input) return;

            if (field.type === 'checkbox') {
                data[field.id] = input.checked ? "Yes" : "No";
            } else if (field.type === 'checkbox_group') {
                const checked = Array.from(input.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
                data[field.id] = checked.join(", ");
            } else if (field.type === 'radio') {
                const selected = input.querySelector('input[type="radio"]:checked');
                data[field.id] = selected ? selected.value : "";
            } else {
                data[field.id] = input.value;
            }
        });

        return data;
    }

    // --- SUBMISSION ---
    form.addEventListener("submit", async e => {
        e.preventDefault();
        if (!validate()) return;

        submitBtn.disabled = true;
        submitBtn.querySelector(".btn-text").textContent = "Submitting...";
        const data = collectData();

        const validUrl = (window.formContext && window.formContext.scriptUrl)
            ? window.formContext.scriptUrl
            : localStorage.getItem("globalSheetUrl");

        const submitUrl = validUrl && validUrl.startsWith("http")
            ? validUrl
            : "https://script.google.com/macros/s/AKfycbxQxuJ_ct0PL0ffpY7VJhD9FpK6jilFpcc0ZjQdbtrOPNX1mFU6PQHKrzu8CspLGXWh/exec";

        console.log("Submitting to:", submitUrl);
        console.log("Data:", data);

        try {
            await fetch(
                submitUrl,
                {
                    method: "POST",
                    mode: "no-cors",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                }
            );
            form.style.display = "none";
            successMessage.classList.add("show");

            // Increment Response Count (Backend)
            const urlParams = new URLSearchParams(window.location.search);
            const identifier = urlParams.get('form') || urlParams.get('id');
            if (identifier) {
                fetch(`/api/form-stats?id=${identifier}&action=increment`, { method: 'POST' }).catch(() => { });
            }

            // Dynamic Success Link
            const linkField = formConfig.find(f => f.type === 'success_link');
            const waContainer = document.querySelector(".whatsapp-group-container");
            const waBtn = document.getElementById("whatsappLink");

            if (linkField && linkField.linkUrl) {
                if (waContainer) waContainer.style.display = "block";
                if (waBtn) {
                    waBtn.href = linkField.linkUrl;
                    // Preserve icon, update text
                    // waBtn.innerHTML = `<svg ...> ... </svg> ${linkField.label}`; 
                    // Simplest way to keep icon is to regex replace text or rebuild HTML
                    const iconSvg = `<svg viewBox="0 0 32 32" width="20" height="20" fill="white"><path d="M16 2C8.28 2 2 8.28 2 16c0 2.82.74 5.45 2.03 7.74L2 30l6.45-2.03A13.94 13.94 0 0016 30c7.72 0 14-6.28 14-14S23.72 2 16 2z"/></svg>`;
                    waBtn.innerHTML = `${iconSvg} ${linkField.label || "Join WhatsApp Group"}`;
                }
            } else {
                if (waContainer) waContainer.style.display = "none";
            }
        } catch (error) {
            alert("Submission failed. Try again.");
            submitBtn.disabled = false;
            submitBtn.querySelector(".btn-text").textContent = "Submit";
        }
    });

    if (registerAnotherBtn) {
        registerAnotherBtn.addEventListener("click", () => {
            form.reset();
            successMessage.classList.remove("show");
            form.style.display = "block";
            submitBtn.disabled = false;
            submitBtn.querySelector(".btn-text").textContent = "Submit";
            document.querySelectorAll(".error-message").forEach(el => el.style.display = "none");
        });
    }
});
