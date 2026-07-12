import { API_BASE } from "./api.js";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("registrationForm");
    const container = document.getElementById("formFieldsContainer");
    const submitBtn = document.getElementById("submitBtn");
    const successMessage = document.getElementById("successMessage");
    const registerAnotherBtn = document.getElementById("registerAnother");
    const formClosedMessage = document.getElementById("formClosedMessage");

    const urlParams = new URLSearchParams(window.location.search);
    const formSlug = urlParams.get('form') || urlParams.get('id');

    // --- 3-Minute Idle Timeout (Privacy Security for Shared Devices) ---
    let userIdleTimer;
    const USER_IDLE_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

    function resetUserIdleTimer() {
        clearTimeout(userIdleTimer);
        userIdleTimer = setTimeout(() => {
            // Do not reset if the form is already successfully submitted or closed
            if (form.style.display !== "none") {
                alert("Your session has timed out due to inactivity. The form has been reset for your privacy.");
                window.location.reload();
            }
        }, USER_IDLE_TIMEOUT_MS);
    }

    // Set initial timer
    resetUserIdleTimer();

    // Reset timer on any user activity
    const activityEvents = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    activityEvents.forEach(evt => {
        document.addEventListener(evt, resetUserIdleTimer, true);
    });

    // Regional
    const countryData = [
        { name: "Afghanistan", code: "AF", dial: "+93", flag: "🇦🇫", len: [9] },
        { name: "Albania", code: "AL", dial: "+355", flag: "🇦🇱", len: [9] },
        { name: "Algeria", code: "DZ", dial: "+213", flag: "🇩🇿", len: [9] },
        { name: "Andorra", code: "AD", dial: "+376", flag: "🇦🇩", len: [6] },
        { name: "Angola", code: "AO", dial: "+244", flag: "🇦🇴", len: [9] },
        { name: "Argentina", code: "AR", dial: "+54", flag: "🇦🇷", len: [10] },
        { name: "Armenia", code: "AM", dial: "+374", flag: "🇦🇲", len: [8] },
        { name: "Australia", code: "AU", dial: "+61", flag: "🇦🇺", len: [9] },
        { name: "Austria", code: "AT", dial: "+43", flag: "🇦🇹", len: [10, 11] },
        { name: "Azerbaijan", code: "AZ", dial: "+994", flag: "🇦🇿", len: [9] },
        { name: "Bahrain", code: "BH", dial: "+973", flag: "🇧🇭", len: [8] },
        { name: "Bangladesh", code: "BD", dial: "+880", flag: "🇧🇩", len: [10] },
        { name: "Belarus", code: "BY", dial: "+375", flag: "🇧🇾", len: [9] },
        { name: "Belgium", code: "BE", dial: "+32", flag: "🇧🇪", len: [9] },
        { name: "Bhutan", code: "BT", dial: "+975", flag: "🇧🇹", len: [8] },
        { name: "Bolivia", code: "BO", dial: "+591", flag: "🇧🇴", len: [8] },
        { name: "Bosnia and Herzegovina", code: "BA", dial: "+387", flag: "🇧🇦", len: [8] },
        { name: "Botswana", code: "BW", dial: "+267", flag: "🇧🇼", len: [8] },
        { name: "Brazil", code: "BR", dial: "+55", flag: "🇧🇷", len: [10, 11] },
        { name: "Bulgaria", code: "BG", dial: "+359", flag: "🇧🇬", len: [8, 9] },
        { name: "Cambodia", code: "KH", dial: "+855", flag: "🇰🇭", len: [8, 9] },
        { name: "Cameroon", code: "CM", dial: "+237", flag: "🇨🇲", len: [9] },
        { name: "Canada", code: "CA", dial: "+1", flag: "🇨🇦", len: [10] },
        { name: "Chile", code: "CL", dial: "+56", flag: "🇨🇱", len: [9] },
        { name: "China", code: "CN", dial: "+86", flag: "🇨🇳", len: [11] },
        { name: "Colombia", code: "CO", dial: "+57", flag: "🇨🇴", len: [10] },
        { name: "Costa Rica", code: "CR", dial: "+506", flag: "🇨🇷", len: [8] },
        { name: "Croatia", code: "HR", dial: "+385", flag: "🇭🇷", len: [8, 9] },
        { name: "Cuba", code: "CU", dial: "+53", flag: "🇨🇺", len: [8] },
        { name: "Cyprus", code: "CY", dial: "+357", flag: "🇨🇾", len: [8] },
        { name: "Czech Republic", code: "CZ", dial: "+420", flag: "🇨🇿", len: [9] },
        { name: "Denmark", code: "DK", dial: "+45", flag: "🇩🇰", len: [8] },
        { name: "Dominican Republic", code: "DO", dial: "+1", flag: "🇩🇴", len: [10] },
        { name: "Ecuador", code: "EC", dial: "+593", flag: "🇪🇨", len: [9] },
        { name: "Egypt", code: "EG", dial: "+20", flag: "🇪🇬", len: [10] },
        { name: "El Salvador", code: "SV", dial: "+503", flag: "🇸🇻", len: [8] },
        { name: "Estonia", code: "EE", dial: "+372", flag: "🇪🇪", len: [7, 8] },
        { name: "Ethiopia", code: "ET", dial: "+251", flag: "🇪🇹", len: [9] },
        { name: "Fiji", code: "FJ", dial: "+679", flag: "🇫🇯", len: [7] },
        { name: "Finland", code: "FI", dial: "+358", flag: "🇫🇮", len: [5, 12] },
        { name: "France", code: "FR", dial: "+33", flag: "🇫🇷", len: [9] },
        { name: "Georgia", code: "GE", dial: "+995", flag: "🇬🇪", len: [9] },
        { name: "Germany", code: "DE", dial: "+49", flag: "🇩🇪", len: [11] },
        { name: "Ghana", code: "GH", dial: "+233", flag: "🇬🇭", len: [9] },
        { name: "Greece", code: "GR", dial: "+30", flag: "🇬🇷", len: [10] },
        { name: "Guatemala", code: "GT", dial: "+502", flag: "🇬🇹", len: [8] },
        { name: "Honduras", code: "HN", dial: "+504", flag: "🇭🇳", len: [8] },
        { name: "Hong Kong", code: "HK", dial: "+852", flag: "🇭🇰", len: [8] },
        { name: "Hungary", code: "HU", dial: "+36", flag: "🇭🇺", len: [9] },
        { name: "Iceland", code: "IS", dial: "+354", flag: "🇮🇸", len: [7] },
        { name: "India", code: "IN", dial: "+91", flag: "🇮🇳", len: [10] },
        { name: "Indonesia", code: "ID", dial: "+62", flag: "🇮🇩", len: [9, 12] },
        { name: "Iran", code: "IR", dial: "+98", flag: "🇮🇷", len: [10] },
        { name: "Iraq", code: "IQ", dial: "+964", flag: "🇮🇶", len: [10] },
        { name: "Ireland", code: "IE", dial: "+353", flag: "🇮🇪", len: [9] },
        { name: "Israel", code: "IL", dial: "+972", flag: "🇮🇱", len: [9] },
        { name: "Italy", code: "IT", dial: "+39", flag: "🇮🇹", len: [10] },
        { name: "Jamaica", code: "JM", dial: "+1", flag: "🇯🇲", len: [10] },
        { name: "Japan", code: "JP", dial: "+81", flag: "🇯🇵", len: [10] },
        { name: "Jordan", code: "JO", dial: "+962", flag: "🇯🇴", len: [9] },
        { name: "Kazakhstan", code: "KZ", dial: "+7", flag: "🇰🇿", len: [10] },
        { name: "Kenya", code: "KE", dial: "+254", flag: "🇰🇪", len: [9] },
        { name: "Kuwait", code: "KW", dial: "+965", flag: "🇰🇼", len: [8] },
        { name: "Kyrgyzstan", code: "KG", dial: "+996", flag: "🇰🇬", len: [9] },
        { name: "Laos", code: "LA", dial: "+856", flag: "🇱🇦", len: [10] },
        { name: "Latvia", code: "LV", dial: "+371", flag: "🇱🇻", len: [8] },
        { name: "Lebanon", code: "LB", dial: "+961", flag: "🇱🇧", len: [7, 8] },
        { name: "Libya", code: "LY", dial: "+218", flag: "🇱🇾", len: [9] },
        { name: "Lithuania", code: "LT", dial: "+370", flag: "🇱🇹", len: [8] },
        { name: "Luxembourg", code: "LU", dial: "+352", flag: "🇱🇺", len: [9] },
        { name: "Macau", code: "MO", dial: "+853", flag: "🇲🇴", len: [8] },
        { name: "Macedonia", code: "MK", dial: "+389", flag: "🇲🇰", len: [8] },
        { name: "Madagascar", code: "MG", dial: "+261", flag: "🇲🇬", len: [9] },
        { name: "Malaysia", code: "MY", dial: "+60", flag: "🇲🇾", len: [9, 10] },
        { name: "Maldives", code: "MV", dial: "+960", flag: "🇲🇻", len: [7] },
        { name: "Malta", code: "MT", dial: "+356", flag: "🇲🇹", len: [8] },
        { name: "Mexico", code: "MX", dial: "+52", flag: "🇲🇽", len: [10] },
        { name: "Moldova", code: "MD", dial: "+373", flag: "🇲🇩", len: [8] },
        { name: "Monaco", code: "MC", dial: "+377", flag: "🇲🇨", len: [8, 9] },
        { name: "Mongolia", code: "MN", dial: "+976", flag: "🇲🇳", len: [8] },
        { name: "Montenegro", code: "ME", dial: "+382", flag: "🇲🇪", len: [8] },
        { name: "Morocco", code: "MA", dial: "+212", flag: "🇲🇦", len: [9] },
        { name: "Myanmar", code: "MM", dial: "+95", flag: "🇲🇲", len: [8, 9] },
        { name: "Namibia", code: "NA", dial: "+264", flag: "🇳🇦", len: [8, 9] },
        { name: "Nepal", code: "NP", dial: "+977", flag: "🇳🇵", len: [10] },
        { name: "Netherlands", code: "NL", dial: "+31", flag: "🇳🇱", len: [9] },
        { name: "New Zealand", code: "NZ", dial: "+64", flag: "🇳🇿", len: [8, 10] },
        { name: "Nicaragua", code: "NI", dial: "+505", flag: "🇳🇮", len: [8] },
        { name: "Nigeria", code: "NG", dial: "+234", flag: "🇳🇬", len: [10] },
        { name: "Norway", code: "NO", dial: "+47", flag: "🇳🇴", len: [8] },
        { name: "Oman", code: "OM", dial: "+968", flag: "🇴🇲", len: [8] },
        { name: "Pakistan", code: "PK", dial: "+92", flag: "🇵🇰", len: [10] },
        { name: "Palestine", code: "PS", dial: "+970", flag: "🇵🇸", len: [9] },
        { name: "Panama", code: "PA", dial: "+507", flag: "🇵🇦", len: [7, 8] },
        { name: "Paraguay", code: "PY", dial: "+595", flag: "🇵🇾", len: [9] },
        { name: "Peru", code: "PE", dial: "+51", flag: "🇵🇪", len: [9] },
        { name: "Philippines", code: "PH", dial: "+63", flag: "🇵🇭", len: [10] },
        { name: "Poland", code: "PL", dial: "+48", flag: "🇵🇱", len: [9] },
        { name: "Portugal", code: "PT", dial: "+351", flag: "🇵🇹", len: [9] },
        { name: "Puerto Rico", code: "PR", dial: "+1", flag: "🇵🇷", len: [10] },
        { name: "Qatar", code: "QA", dial: "+974", flag: "🇶🇦", len: [8] },
        { name: "Romania", code: "RO", dial: "+40", flag: "🇷🇴", len: [9] },
        { name: "Russia", code: "RU", dial: "+7", flag: "🇷🇺", len: [10] },
        { name: "Saudi Arabia", code: "SA", dial: "+966", flag: "🇸🇦", len: [9] },
        { name: "Senegal", code: "SN", dial: "+221", flag: "🇸🇳", len: [9] },
        { name: "Serbia", code: "RS", dial: "+381", flag: "🇷🇸", len: [8, 9] },
        { name: "Singapore", code: "SG", dial: "+65", flag: "🇸🇬", len: [8] },
        { name: "Slovakia", code: "SK", dial: "+421", flag: "🇸🇰", len: [9] },
        { name: "Slovenia", code: "SI", dial: "+386", flag: "🇸🇮", len: [8] },
        { name: "South Africa", code: "ZA", dial: "+27", flag: "🇿🇦", len: [9] },
        { name: "South Korea", code: "KR", dial: "+82", flag: "🇰🇷", len: [9, 10] },
        { name: "Spain", code: "ES", dial: "+34", flag: "🇪🇸", len: [9] },
        { name: "Sri Lanka", code: "LK", dial: "+94", flag: "🇱🇰", len: [9] },
        { name: "Sweden", code: "SE", dial: "+46", flag: "🇸🇪", len: [7, 9] },
        { name: "Switzerland", code: "CH", dial: "+41", flag: "🇨🇭", len: [9] },
        { name: "Taiwan", code: "TW", dial: "+886", flag: "🇹🇼", len: [9] },
        { name: "Tajikistan", code: "TJ", dial: "+992", flag: "🇹🇯", len: [9] },
        { name: "Tanzania", code: "TZ", dial: "+255", flag: "🇹🇿", len: [9] },
        { name: "Thailand", code: "TH", dial: "+66", flag: "🇹🇭", len: [9] },
        { name: "Tunisia", code: "TN", dial: "+216", flag: "🇹🇳", len: [8] },
        { name: "Turkey", code: "TR", dial: "+90", flag: "🇹🇷", len: [10] },
        { name: "Turkmenistan", code: "TM", dial: "+993", flag: "🇹🇲", len: [8] },
        { name: "Uganda", code: "UG", dial: "+256", flag: "🇺🇬", len: [9] },
        { name: "Ukraine", code: "UA", dial: "+380", flag: "🇺🇦", len: [9] },
        { name: "United Arab Emirates", code: "AE", dial: "+971", flag: "🇦🇪", len: [9] },
        { name: "United Kingdom", code: "GB", dial: "+44", flag: "🇬🇧", len: [10] },
        { name: "United States", code: "US", dial: "+1", flag: "🇺🇸", len: [10] },
        { name: "Uruguay", code: "UY", dial: "+598", flag: "🇺🇾", len: [8] },
        { name: "Uzbekistan", code: "UZ", dial: "+998", flag: "🇺🇿", len: [9] },
        { name: "Vatican City", code: "VA", dial: "+39", flag: "🇻🇦", len: [10] },
        { name: "Venezuela", code: "VE", dial: "+58", flag: "🇻🇪", len: [10] },
        { name: "Vietnam", code: "VN", dial: "+84", flag: "🇻🇳", len: [9] },
        { name: "Yemen", code: "YE", dial: "+967", flag: "🇾🇪", len: [9] },
        { name: "Zambia", code: "ZM", dial: "+260", flag: "🇿🇲", len: [9] },
        { name: "Zimbabwe", code: "ZW", dial: "+263", flag: "🇿🇼", len: [9] }
    ];

    if (!form || !container) return;

    // Initialization
    async function init() {
        if (!window.formContext) {
            // Wait for form-loader.js if it's still fetching
            setTimeout(init, 100);
            return;
        }

        // Generate device fingerprint in background
        window.deviceFingerprint = await generateDeviceFingerprint();

        // Status check
        if (window.formContext.status === "closed") {
            enforceClosedUI("Form is Closed", "This form is no longer accepting responses.");
            return;
        }

        // Limits check
        await checkLimitsLocally();

        // Render
        window.renderForm();
    }

    async function checkLimitsLocally() {
        const limit = parseInt(window.formContext?.design?.responseLimit);
        if (!limit || limit <= 0) return;

        try {
            const slug = formSlug;
            const res = await fetch(API_BASE + `/api/form-stats?id=${slug}`);
            if (res.ok) {
                const { count } = await res.json();
                if (count >= limit) {
                    enforceClosedUI("Form Limit Reached", "Thank you for your interest. This form is full.");
                }
            }
        } catch (e) { console.warn("Limit pre-check failed:", e); }
    }

    function enforceClosedUI(title, message) {
        form.style.display = "none";
        if (formClosedMessage) {
            formClosedMessage.classList.add("show");
            const h2 = formClosedMessage.querySelector('h2');
            const p = formClosedMessage.querySelector('p');
            if (h2) h2.textContent = title;
            if (p) p.textContent = message;
        }
        const closeBtn = document.getElementById("closeFormBtn");
        if (closeBtn) closeBtn.style.display = "none";
    }

    async function generateDeviceFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.textBaseline = "top";
            ctx.font = "14px 'Arial'";
            ctx.textBaseline = "alphabetic";
            ctx.fillStyle = "#f60";
            ctx.fillRect(125,1,62,20);
            ctx.fillStyle = "#069";
            ctx.fillText("KumoFumi,123", 2, 15);
            ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
            ctx.fillText("KumoFumi,123", 4, 17);
            
            const dataStr = canvas.toDataURL() + navigator.userAgent + screen.colorDepth + screen.width + screen.height + new Date().getTimezoneOffset();
            
            // Basic hash
            let hash = 0;
            for (let i = 0; i < dataStr.length; i++) {
                const char = dataStr.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return Math.abs(hash).toString(16);
        } catch(e) {
            return "unknown-device-" + Math.random().toString(36).substring(7);
        }
    }

    // Rendering
    window.renderForm = function renderForm() {
        if (formSlug) {
            const hasResponded = localStorage.getItem(`form_submitted_${formSlug}`);
            if (hasResponded && window.formContext?.design?.allowMultipleResponses === false) {
                enforceClosedUI("Already Submitted", "You have already submitted this form.");
                return;
            }
        }

        container.innerHTML = "";
        const config = window.formContext?.config || [];

        if (config.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding:20px; color:var(--theme-text-secondary);">This form has no fields.</p>';
            return;
        }

        let currentSectionDiv = document.createElement("div");
        currentSectionDiv.className = "form-section-page";
        container.appendChild(currentSectionDiv);

        config.forEach(field => {
            if (field.type === 'success_link') return;

            if (field.type === 'section_break') {
                currentSectionDiv = document.createElement("div");
                currentSectionDiv.className = "form-section-page";
                currentSectionDiv.style.display = "none";
                
                if (field.label || field.description) {
                    const header = document.createElement("div");
                    header.className = "section-header";
                    header.style.marginBottom = "25px";
                    header.style.paddingBottom = "15px";
                    header.style.borderBottom = "1px solid var(--theme-border)";
                    
                    if (field.label) {
                        header.innerHTML += `<h2 style="font-size:1.5rem; color:var(--theme-text-main); margin:0 0 8px 0;">${field.label}</h2>`;
                    }
                    if (field.description) {
                        header.innerHTML += `<p style="font-size:1rem; color:var(--theme-text-secondary); margin:0; white-space:pre-wrap;">${field.description}</p>`;
                    }
                    currentSectionDiv.appendChild(header);
                }

                container.appendChild(currentSectionDiv);
                return;
            }

            const wrapper = document.createElement("div");
            wrapper.className = "form-group";
            const isReq = field.required ? " *" : "";

            if (field.type === 'image') {
                const img = document.createElement("img");
                img.src = field.mediaUrl || "";
                img.alt = field.label;
                img.className = "display-image-field";
                img.style.maxWidth = "100%";
                img.style.borderRadius = "8px";
                img.style.marginBottom = "15px";
                img.style.display = "block";
                wrapper.appendChild(img);
                currentSectionDiv.appendChild(wrapper);
                return;
            }

            let html = "";
            // Render label for standard fields, but skip for those that handle their own labels or have no label
            if (field.type !== 'checkbox' && field.type !== 'description' && field.type !== 'success_link' && field.type !== 'image') {
                html += `<label class="form-label">${field.label}${isReq}</label>`;
            }

            switch (field.type) {
                case "email":
                    html += `<input type="email" id="${field.id}" name="${field.id}" class="form-input" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''} pattern="[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$" title="Please enter a valid email address (e.g., user@example.com)">`;
                    break;
                case "text":
                    html += `<input type="text" id="${field.id}" name="${field.id}" class="form-input" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''}>`;
                    break;
                case "tel":
                    html += `
                        <div class="phone-input-wrapper">
                            <div class="country-picker-container" id="${field.id}_picker">
                                <button type="button" class="country-picker-btn" id="${field.id}_picker_btn">
                                    <span class="current-flag">🇮🇳</span>
                                    <span class="current-code">+91</span>
                                </button>
                                <div class="country-picker-dropdown" id="${field.id}_picker_dropdown">
                                    <div class="country-search-wrapper">
                                        <input type="text" class="country-search-input" placeholder="Search country..." id="${field.id}_search">
                                    </div>
                                    <div class="country-list" id="${field.id}_country_list">
                                        <!-- Countries populated by JS -->
                                    </div>
                                </div>
                                <input type="hidden" id="${field.id}_prefix" value="+91">
                            </div>
                            <input type="tel" id="${field.id}" name="${field.id}" class="form-input" 
                                placeholder="${field.placeholder || '1234567890'}" 
                                ${field.required ? 'required' : ''} 
                                inputmode="numeric"
                                title="Please enter a valid phone number for the selected country">
                        </div>`;
                    break;
                case "textarea":
                    html += `<textarea id="${field.id}" name="${field.id}" class="form-input" rows="3" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''}></textarea>`;
                    break;
                case "radio":
                    html += `<div class="radio-group">
                        ${(field.options || []).map(opt => {
                        const label = typeof opt === 'object' ? (opt.label || '') : opt;
                        const value = typeof opt === 'object' ? (opt.value || label) : opt;
                        const goto = typeof opt === 'object' ? (opt.goto || 'continue') : 'continue';
                        return `
                                <label class="radio-option">
                                    <input type="radio" name="${field.id}" value="${value}" data-goto="${goto}" ${field.required ? 'required' : ''}> <span>${label}</span>
                                </label>
                            `;
                    }).join('')}
                    </div>`;
                    break;
                case "select":
                    html += `<select id="${field.id}" name="${field.id}" class="form-input" ${field.required ? 'required' : ''}>
                        <option value="" data-goto="continue">Select...</option>
                        ${(field.options || []).map(opt => {
                        const label = typeof opt === 'object' ? (opt.label || '') : opt;
                        const value = typeof opt === 'object' ? (opt.value || label) : opt;
                        const goto = typeof opt === 'object' ? (opt.goto || 'continue') : 'continue';
                        return `<option value="${value}" data-goto="${goto}">${label}</option>`;
                    }).join('')}
                    </select>`;
                    break;
                case "date":
                    html += `<input type="date" id="${field.id}" name="${field.id}" class="form-input" ${field.required ? 'required' : ''}>`;
                    break;
                case "checkbox_group":
                    // Added support for multiple checkboxes
                    // Use label above (rendered by default logic if we didn't exclude it, but we did exclude 'checkbox', not 'checkbox_group')
                    // Actually, for checkbox_group, we DO want the label above.
                    // My previous if condition: if (field.type !== 'checkbox' ...)
                    // So checkbox_group WILL have the label above. Good.
                    html += `<div class="checkbox-group">
                        ${(field.options || []).map(opt => {
                        const label = typeof opt === 'object' ? opt.label : opt;
                        const value = typeof opt === 'object' ? opt.value : opt;
                        const goto = typeof opt === 'object' ? (opt.goto || 'continue') : 'continue';
                        return `
                                <label class="checkbox-option">
                                    <input type="checkbox" name="${field.id}" value="${value}" data-goto="${goto}"> <span>${label}</span>
                                </label>
                            `;
                    }).join('')}
                    </div>`;
                    break;
                case "checkbox":
                    // Single checkbox - label is next to box
                    html += `<div class="checkbox-group">
                        <label class="checkbox-option">
                            <input type="checkbox" id="${field.id}" name="${field.id}" ${field.required ? 'required' : ''}> <span>${field.label}${isReq}</span>
                        </label>
                    </div>`;
                    break;
                case "description":
                    html += `<div style="font-size:1rem; color:var(--theme-text-main); line-height:1.5; white-space: pre-wrap; margin-bottom:10px;">${field.label}</div>`;
                    break;
                case "file":
                    html += `<input type="file" id="${field.id}" name="${field.id}" class="form-input" ${field.required ? 'required' : ''} style="font-size: 0.9rem; padding: 10px 0;">
                             <p class="hint" style="font-size: 0.75rem; color: var(--theme-text-secondary); margin-top: 4px;">Max size 10MB. IMG, PDF supported.</p>`;
                    break;
                case "scale":
                    const min = field.scaleMin !== undefined ? field.scaleMin : 0;
                    const max = field.scaleLimit !== undefined ? field.scaleLimit : 10;
                    const scaleBranchingStr = field.scaleBranching ? JSON.stringify(field.scaleBranching).replace(/'/g, "&#39;") : "{}";
                    html += `
                    <div style="display:flex; align-items:center; gap:15px; margin-top:5px;">
                        <input type="range" id="${field.id}" name="${field.id}" min="${min}" max="${max}" value="${min}" style="flex:1; cursor:pointer;" 
                               data-scale-branching='${scaleBranchingStr}'
                               oninput="document.getElementById('${field.id}_val').textContent = this.value">
                        <span id="${field.id}_val" style="font-weight:700; width:35px; text-align:center; font-size:1.1rem; color:var(--primary); background:var(--bg-body); padding:4px 0; border-radius:4px; border:1px solid var(--theme-border);">${min}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--theme-text-secondary); margin-top:5px;">
                        <span>${min}</span><span>${max}</span>
                    </div>`;
                    break;
            }

            html += `<span class="error-message" id="${field.id}Error" style="display:none; color: #dc2626; font-size: 0.85rem; margin-top: 4px;">This field is required</span>`;
            wrapper.innerHTML = html;
            currentSectionDiv.appendChild(wrapper);

            // Setup dynamic phone validation & searchable picker
            if (field.type === 'tel') {
                const pickerBtn = document.getElementById(`${field.id}_picker_btn`);
                const dropdown = document.getElementById(`${field.id}_picker_dropdown`);
                const searchInput = document.getElementById(`${field.id}_search`);
                const countryList = document.getElementById(`${field.id}_country_list`);
                const prefixInput = document.getElementById(`${field.id}_prefix`);
                const phoneInput = document.getElementById(field.id);

                if (pickerBtn && dropdown && countryList && prefixInput && phoneInput) {
                    // Populate list
                    const renderList = (filter = "") => {
                        const filtered = countryData.filter(c =>
                            c.name.toLowerCase().includes(filter.toLowerCase()) ||
                            c.dial.includes(filter)
                        );

                        countryList.innerHTML = filtered.map(c => `
                            <div class="country-item" data-dial="${c.dial}" data-flag="${c.flag}" data-min="${Math.min(...c.len)}" data-max="${Math.max(...c.len)}">
                                <span class="flag">${c.flag}</span>
                                <span class="name">${c.name}</span>
                                <span class="dial-code">${c.dial}</span>
                            </div>
                        `).join('');

                        // Click handlers for items
                        countryList.querySelectorAll('.country-item').forEach(item => {
                            item.onclick = () => {
                                const dial = item.dataset.dial;
                                const flag = item.dataset.flag;
                                const min = item.dataset.min;
                                const max = item.dataset.max;

                                prefixInput.value = dial;
                                pickerBtn.querySelector('.current-flag').textContent = flag;
                                pickerBtn.querySelector('.current-code').textContent = dial;

                                phoneInput.minLength = min;
                                phoneInput.maxLength = max;
                                phoneInput.pattern = `\\d{${min === max ? min : min + ',' + max}}`;

                                dropdown.classList.remove('show');
                            };
                        });
                    };

                    // Initial render
                    renderList();

                    // Toggle dropdown
                    pickerBtn.onclick = (e) => {
                        e.stopPropagation();
                        // Close other open pickers first
                        document.querySelectorAll('.country-picker-dropdown').forEach(d => {
                            if (d !== dropdown) d.classList.remove('show');
                        });
                        dropdown.classList.toggle('show');
                        if (dropdown.classList.contains('show')) searchInput.focus();
                    };

                    // Search logic
                    searchInput.oninput = (e) => renderList(e.target.value);
                    searchInput.onclick = (e) => e.stopPropagation();

                    // Close on click outside
                    document.addEventListener('click', (e) => {
                        if (!dropdown.contains(e.target) && e.target !== pickerBtn) {
                            dropdown.classList.remove('show');
                        }
                    });

                    // Set default attributes for India
                    phoneInput.minLength = 10;
                    phoneInput.maxLength = 10;
                    phoneInput.pattern = "\\d{10}";
                }
            }
        });

        // Initialize section navigation
        initSectionNavigation();
    };

    window.currentSectionIndex = 0;
    window.sectionHistory = [];

    function initSectionNavigation() {
        const sections = document.querySelectorAll('.form-section-page');
        const backBtn = document.getElementById('backBtn');
        const nextBtn = document.getElementById('nextBtn');
        const submitBtn = document.getElementById('submitBtn');
        const progressContainer = document.getElementById('formProgressContainer');
        const currentPageIndicator = document.getElementById('currentPageIndicator');
        const totalPagesIndicator = document.getElementById('totalPagesIndicator');

        const config = window.formContext?.config || [];
        const design = window.formContext?.design || {};
        
        // Build map of sections: index => { defaultGoto: "...", id: "..." }
        const sectionMeta = [];
        sectionMeta.push({ id: 'section1', defaultGoto: design.section1Goto || 'continue' });
        
        config.forEach(f => {
            if (f.type === 'section_break') {
                sectionMeta.push({ id: f.id, defaultGoto: f.goto || 'continue' });
            }
        });

        if (sections.length > 1) {
            progressContainer.style.display = 'block';
            totalPagesIndicator.textContent = sections.length;
        } else {
            progressContainer.style.display = 'none';
        }
        
        function navigateTo(targetGoto) {
            window.navigateToSection = navigateTo; // Expose for submit interceptor
            
            if (targetGoto === 'submit') {
                // hide all sections, show submit btn, hide next btn
                sections.forEach(sec => sec.style.display = 'none');
                if (nextBtn) nextBtn.style.display = 'none';
                if (submitBtn) submitBtn.style.display = 'block';
                if (progressContainer) progressContainer.style.display = 'none';
                if (backBtn) backBtn.style.display = 'block'; // allow going back from submit screen
                window.sectionHistory.push(window.currentSectionIndex);
                window.currentSectionIndex = -1; // -1 means submit screen
                window.scrollTo(0, 0);
                return;
            }
            
            // Handle exit with custom message
            if (targetGoto === 'exit' || targetGoto.startsWith('exit:')) {
                const exitMessage = targetGoto.startsWith('exit:') ? targetGoto.substring(5) : '';
                const displayMessage = exitMessage || 'You do not meet the criteria for this form.';
                sections.forEach(sec => sec.style.display = 'none');
                if (nextBtn) nextBtn.style.display = 'none';
                if (submitBtn) submitBtn.style.display = 'none';
                if (progressContainer) progressContainer.style.display = 'none';
                
                // Show exit message in a dedicated container
                let exitContainer = document.getElementById('formExitMessage');
                if (!exitContainer) {
                    exitContainer = document.createElement('div');
                    exitContainer.id = 'formExitMessage';
                    exitContainer.className = 'form-exit-message';
                    form.parentNode.insertBefore(exitContainer, form.nextSibling);
                }
                exitContainer.innerHTML = `
                    <div class="exit-icon-wrapper">
                        <i class="fa-solid fa-circle-xmark"></i>
                    </div>
                    <h2 class="exit-title">${displayMessage}</h2>
                `;
                exitContainer.style.display = 'block';
                
                // Hide the form and header
                form.style.display = 'none';
                const headerCard = document.getElementById("formHeaderCard");
                if (headerCard) headerCard.style.display = "none";
                
                window.scrollTo(0, 0);
                return;
            }
            
            let nextIndex = window.currentSectionIndex + 1;
            if (targetGoto !== 'continue') {
                const foundIndex = sectionMeta.findIndex(m => m.id === targetGoto);
                if (foundIndex !== -1) {
                    nextIndex = foundIndex;
                }
            }
            
            if (nextIndex < sections.length) {
                window.sectionHistory.push(window.currentSectionIndex);
                window.currentSectionIndex = nextIndex;
                showSection(window.currentSectionIndex);
                window.scrollTo(0, 0);
            } else {
                // If it goes past the end, just go to submit
                navigateTo('submit');
            }
        }

        function showSection(index) {
            if (index === -1) return; // handled by navigateTo submit
            
            sections.forEach((sec, i) => {
                sec.style.display = (i === index) ? 'block' : 'none';
            });
            
            if (progressContainer) progressContainer.style.display = sections.length > 1 ? 'block' : 'none';
            if (currentPageIndicator) currentPageIndicator.textContent = index + 1;

            if (window.sectionHistory.length === 0) {
                if (backBtn) backBtn.style.display = 'none';
            } else {
                if (backBtn) backBtn.style.display = 'block';
            }

            const isLast = (index === sections.length - 1);
            const defaultGoto = sectionMeta[index]?.defaultGoto || 'continue';
            const defaultIsSubmit = defaultGoto === 'submit';
            const defaultIsExit = defaultGoto === 'exit' || defaultGoto.startsWith('exit:');
            
            if (defaultIsExit) {
                // Exit sections always show Next (clicking Next triggers the exit screen)
                if (nextBtn) nextBtn.style.display = 'block';
                if (submitBtn) submitBtn.style.display = 'none';
            } else if (isLast || defaultIsSubmit) {
                if (nextBtn) nextBtn.style.display = 'none';
                if (submitBtn) submitBtn.style.display = 'block';
            } else {
                if (nextBtn) nextBtn.style.display = 'block';
                if (submitBtn) submitBtn.style.display = 'none';
            }
        }

        if (nextBtn) {
            nextBtn.onclick = () => {
                const currentSection = sections[window.currentSectionIndex];
                const inputs = currentSection.querySelectorAll('input, select, textarea');
                let isValid = true;
                
                // Trigger HTML5 validation for fields in current section
                for (let input of inputs) {
                    if (!input.checkValidity()) {
                        input.reportValidity();
                        isValid = false;
                        break; // Stop at first error
                    }
                }

                if (isValid) {
                    let targetGoto = sectionMeta[window.currentSectionIndex]?.defaultGoto || 'continue';
                    
                    const branchingInputs = currentSection.querySelectorAll('input[type="radio"]:checked, select, input[type="checkbox"]:checked, input[type="range"]');
                    for (const input of branchingInputs) {
                        let gotoVal = null;
                        if (input.tagName === 'SELECT') {
                            const selectedOpt = input.options[input.selectedIndex];
                            if (selectedOpt && selectedOpt.value) {
                                gotoVal = selectedOpt.getAttribute('data-goto');
                            }
                        } else if (input.type === 'radio' || input.type === 'checkbox') {
                            gotoVal = input.getAttribute('data-goto');
                        } else if (input.type === 'range') {
                            const branchingStr = input.getAttribute('data-scale-branching');
                            if (branchingStr) {
                                try {
                                    const branchingObj = JSON.parse(branchingStr);
                                    gotoVal = branchingObj[input.value];
                                } catch(e) {}
                            }
                        }
                        
                        if (gotoVal && gotoVal !== 'continue') {
                            targetGoto = gotoVal;
                            break; 
                        }
                    }
                    
                    navigateTo(targetGoto);
                }
            };
        }

        if (backBtn) {
            backBtn.onclick = () => {
                if (window.sectionHistory.length > 0) {
                    window.currentSectionIndex = window.sectionHistory.pop();
                    showSection(window.currentSectionIndex);
                    window.scrollTo(0, 0);
                }
            };
        }

        showSection(window.currentSectionIndex);
    }

    // Trigger initial render if context exists

    // Submission
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        // 0. Intercept if branching overrides the submit action (e.g. Exit Form)
        const sectionsList = document.querySelectorAll('.form-section-page');
        const currSec = sectionsList[window.currentSectionIndex];
        if (currSec) {
            let interceptGoto = null;
            const branchingInputs = currSec.querySelectorAll('input[type="radio"]:checked, select, input[type="checkbox"]:checked, input[type="range"]');
            for (const input of branchingInputs) {
                let gotoVal = null;
                if (input.tagName === 'SELECT') {
                    const selectedOpt = input.options[input.selectedIndex];
                    if (selectedOpt && selectedOpt.value) gotoVal = selectedOpt.getAttribute('data-goto');
                } else if (input.type === 'radio' || input.type === 'checkbox') {
                    gotoVal = input.getAttribute('data-goto');
                } else if (input.type === 'range') {
                    const branchingStr = input.getAttribute('data-scale-branching');
                    if (branchingStr) {
                        try {
                            const branchingObj = JSON.parse(branchingStr);
                            gotoVal = branchingObj[input.value];
                        } catch(err) {}
                    }
                }
                
                if (gotoVal && gotoVal !== 'continue' && gotoVal !== 'submit') {
                    interceptGoto = gotoVal;
                    break;
                }
            }

            if (interceptGoto && window.navigateToSection) {
                let isValidHTML5 = form.checkValidity();
                if (!isValidHTML5) {
                    form.reportValidity();
                    return;
                }
                window.navigateToSection(interceptGoto);
                return; // Stop form submission
            }
        }

        // 1. Identify which sections were actually visited
        const sections = document.querySelectorAll('.form-section-page');
        const visitedSections = window.sectionHistory ? [...window.sectionHistory] : [];
        if (window.currentSectionIndex !== undefined && window.currentSectionIndex !== -1) {
            visitedSections.push(window.currentSectionIndex);
        }

        // 2. Disable required validation for unvisited sections
        sections.forEach((sec, idx) => {
            if (!visitedSections.includes(idx)) {
                const inputs = sec.querySelectorAll('input, select, textarea');
                inputs.forEach(inp => {
                    if (inp.required) {
                        inp.dataset.wasRequired = 'true';
                        inp.required = false;
                    }
                });
            }
        });

        // 3. Use Native HTML5 Validation (Google Forms Style)
        let isValidHTML5 = form.checkValidity();
        if (!isValidHTML5) {
            form.reportValidity();
        }

        // 4. Restore required attributes for form state integrity
        sections.forEach((sec, idx) => {
            if (!visitedSections.includes(idx)) {
                const inputs = sec.querySelectorAll('input, select, textarea');
                inputs.forEach(inp => {
                    if (inp.dataset.wasRequired === 'true') {
                        inp.required = true;
                        delete inp.dataset.wasRequired;
                    }
                });
            }
        });

        if (!isValidHTML5) return;

        // Custom validation for non-native cases if any
        if (!validateForm()) return;

        submitBtn.disabled = true;
        const btnText = submitBtn.querySelector(".btn-text");
        if (btnText) btnText.textContent = "Uploading...";

        // Handle File Uploads to Cloudinary
        const config = window.formContext?.config || [];
        const design = window.formContext?.design || {};
        const fileUrls = {};

        try {
            for (const field of config) {
                if (field.type === 'file') {
                    const input = document.getElementById(field.id);
                    if (input && input.files.length > 0) {
                        const file = input.files[0];
                        const cloudName = design.cloudinary?.cloudName;
                        const preset = design.cloudinary?.preset;

                        if (!cloudName || !preset) {
                            throw new Error("Cloudinary not configured. Contact admin.");
                        }

                        // Upload to Cloudinary
                        const formData = new FormData();
                        formData.append("file", file);
                        formData.append("upload_preset", preset);

                        const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/upload`, {
                            method: 'POST',
                            body: formData
                        });

                        if (!uploadRes.ok) {
                            const errData = await uploadRes.json().catch(()=>({}));
                            console.error("Cloudinary Error:", errData);
                            throw new Error(errData.error?.message || "File upload failed. Ensure your Cloudinary Preset is 'Unsigned'.");
                        }
                        const uploadResult = await uploadRes.json();
                        fileUrls[field.id] = uploadResult.secure_url;
                    }
                }
            }
        } catch (err) {
            alert(`Upload Error: ${err.message}`);
            submitBtn.disabled = false;
            if (btnText) btnText.textContent = "Submit";
            return;
        }

        if (btnText) btnText.textContent = "Submitting...";

        // Collect names of all inputs within visited sections to filter them
        const validFields = new Set();
        sections.forEach((sec, idx) => {
            if (visitedSections.includes(idx)) {
                sec.querySelectorAll('input, select, textarea').forEach(inp => {
                    if (inp.name) validFields.add(inp.name);
                });
            }
        });

        const formData = collectData(fileUrls, validFields);

        const slug = formSlug;

        try {
            const reqHeaders = { 'Content-Type': 'application/json' };
            if (window.deviceFingerprint) {
                reqHeaders['X-Device-Fingerprint'] = window.deviceFingerprint;
            }

            const res = await fetch(API_BASE + `/api/forms/${slug}/submit`, {
                method: 'POST',
                headers: reqHeaders,
                body: JSON.stringify(formData)
            });

            const result = await res.json();

            if (res.status === 403) {
                alert(`Cannot Submit: ${result.error || "Form is closed"}`);
                enforceClosedUI("Status Changed", result.error || "This form is no longer accepting responses.");
                return;
            }

            if (!res.ok) throw new Error(result.error || "Submission failed");

            const headerCard = document.getElementById("formHeaderCard");
            if (headerCard) headerCard.style.display = "none";
            form.style.display = "none";
            successMessage.classList.add("show");
            handleSuccessLink();

            // Record submission locally
            localStorage.setItem(`form_submitted_${slug}`, "true");

            // Set up "Submit another response" button
            const allowMultiple = window.formContext?.design?.allowMultipleResponses !== false;
            if (registerAnotherBtn) {
                registerAnotherBtn.style.display = allowMultiple ? "block" : "none";
                if (allowMultiple) {
                    registerAnotherBtn.onclick = () => window.location.reload();
                }
            }

        } catch (err) {
            alert(err.message);
            submitBtn.disabled = false;
            if (btnText) btnText.textContent = "Submit";
        }
    });

    function collectData(fileUrls = {}, validFields = null) {
        const data = {};
        const config = window.formContext?.config || [];

        config.forEach(field => {
            if (field.type === 'description' || field.type === 'success_link' || field.type === 'image' || field.type === 'section_break') return;
            
            // If validFields is provided and this field's ID is not in it, skip it.
            if (validFields && !validFields.has(field.id)) return;

            if (field.type === 'checkbox_group') {
                const checked = form.querySelectorAll(`input[name="${field.id}"]:checked`);
                data[field.id] = Array.from(checked).map(cb => cb.value);
            } else if (field.type === 'checkbox') {
                const checkbox = document.getElementById(field.id);
                data[field.id] = checkbox ? checkbox.checked : false;
            } else if (field.type === 'radio') {
                const selected = form.querySelector(`input[name="${field.id}"]:checked`);
                data[field.id] = selected ? selected.value : '';
            } else if (field.type === 'tel') {
                const input = document.getElementById(field.id);
                const prefix = document.getElementById(`${field.id}_prefix`);
                if (input && prefix) {
                    const val = input.value.trim();
                    data[field.id] = val ? `${prefix.value} ${val}` : '';
                } else {
                    data[field.id] = input ? input.value.trim() : '';
                }
            } else if (field.type === 'file') {
                const input = document.getElementById(field.id);
                data[field.id] = fileUrls[field.id] || (input?.files?.length > 0 ? 'file-staged' : '');
            } else {
                const input = document.getElementById(field.id);
                data[field.id] = input ? input.value.trim() : '';
            }
        });
        return data;
    }

    function validateForm() {
        let ok = true;
        const config = window.formContext?.config || [];
        const currentData = collectData();

        config.forEach(field => {
            if (field.type === 'description' || field.type === 'success_link' || field.type === 'image') return;

            const val = currentData[field.id];
            const err = document.getElementById(field.id + "Error");
            let fieldOk = true;

            // Check required (Native handles most but we keep this for visual consistency)
            if (field.required && (!val || (Array.isArray(val) && val.length === 0) || val === false)) {
                fieldOk = false;
            }

            // Email format check
            if (fieldOk && field.type === 'email' && val) {
                const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                if (!emailRegex.test(val)) {
                    fieldOk = false;
                    if (err) err.textContent = "Please enter a valid email address (e.g., name@domain.com)";
                }
            }

            if (!fieldOk) {
                if (err) {
                    err.style.display = "block";
                }
                ok = false;
            } else if (err) {
                err.style.display = "none";
            }
        });
        return ok;
    }

    function handleSuccessLink() {
        const config = window.formContext?.config || [];
        const link = config.find(f => f.type === 'success_link');
        const waBtn = document.getElementById("whatsappLink");
        if (link && waBtn) {
            waBtn.href = link.linkUrl;
            
            let icon = '<i class="fa-brands fa-whatsapp"></i>';
            let bg = '#25D366';
            let text = link.label || 'Join WhatsApp Group';
            
            if (link.linkApp === 'telegram') { icon = '<i class="fa-brands fa-telegram"></i>'; bg = '#0088cc'; text = link.label || 'Join Telegram Group'; }
            else if (link.linkApp === 'instagram') { icon = '<i class="fa-brands fa-instagram"></i>'; bg = '#E1306C'; text = link.label || 'Follow on Instagram'; }
            else if (link.linkApp === 'youtube') { icon = '<i class="fa-brands fa-youtube"></i>'; bg = '#FF0000'; text = link.label || 'Subscribe on YouTube'; }
            else if (link.linkApp === 'custom') { icon = '<i class="fa-solid fa-link"></i>'; bg = 'var(--primary)'; text = link.label || 'Action Link'; }

            waBtn.style.background = bg;
            waBtn.innerHTML = `${icon} ${text}`;
            waBtn.parentNode.style.display = "block";
            
            const groupText = waBtn.parentNode.querySelector('p');
            if (groupText && link.linkApp) {
                groupText.textContent = link.linkApp === 'custom' ? 'Next step:' : 'Please connect with us for updates:';
            }
        }
    }
    init();
});

