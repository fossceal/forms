(function () {
  window.CustomDialog = {
    alert: function (message) {
      return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "custom-dialog-overlay";

        const dialog = document.createElement("div");
        dialog.className = "custom-dialog-box";

        dialog.innerHTML = `
            <div style="text-align:center; margin-bottom: 20px; color: var(--theme-error, #ef4444);">
                <i class="fa-solid fa-circle-exclamation" style="font-size: 3rem; opacity: 0.9;"></i>
            </div>
            <div class="custom-dialog-content">${message}</div>
            <div class="custom-dialog-actions" style="justify-content: center;">
                <button class="custom-dialog-btn custom-dialog-btn-primary custom-dialog-ok">OK</button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const okBtn = dialog.querySelector(".custom-dialog-ok");
        okBtn.focus();

        const close = () => {
          overlay.classList.add("fade-out");
          setTimeout(() => {
            if (document.body.contains(overlay)) {
              document.body.removeChild(overlay);
            }
            resolve();
          }, 200);
        };

        okBtn.addEventListener("click", close);
      });
    },

    confirm: function (message) {
      return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "custom-dialog-overlay";

        const dialog = document.createElement("div");
        dialog.className = "custom-dialog-box";

        dialog.innerHTML = `
            <div style="text-align:center; margin-bottom: 20px; color: var(--primary, #3b82f6);">
                <i class="fa-solid fa-circle-question" style="font-size: 3rem; opacity: 0.9;"></i>
            </div>
            <div class="custom-dialog-content">${message}</div>
            <div class="custom-dialog-actions">
                <button class="custom-dialog-btn custom-dialog-btn-secondary custom-dialog-cancel">Cancel</button>
                <button class="custom-dialog-btn custom-dialog-btn-primary custom-dialog-ok">OK</button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const okBtn = dialog.querySelector(".custom-dialog-ok");
        const cancelBtn = dialog.querySelector(".custom-dialog-cancel");
        okBtn.focus();

        const close = (result) => {
          overlay.classList.add("fade-out");
          setTimeout(() => {
            if (document.body.contains(overlay)) {
              document.body.removeChild(overlay);
            }
            resolve(result);
          }, 200);
        };

        okBtn.addEventListener("click", () => close(true));
        cancelBtn.addEventListener("click", () => close(false));
      });
    },
  };

  // Add fade out animation style dynamically
  const style = document.createElement("style");
  style.innerHTML = `
        .custom-dialog-overlay.fade-out {
            animation: fadeOut 0.2s forwards;
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
  document.head.appendChild(style);

  // Override native alert to seamlessly integrate
  window.alert = function (message) {
    CustomDialog.alert(message);
  };
})();
