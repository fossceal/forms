# 📝 KumoFumi  – Serverless Form Builder

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/) 
[![Cloudflare D1](https://img.shields.io/badge/Cloudflare-D1-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://www.cloudflare.com/products/d1/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

A production-grade, serverless form builder inspired by Google Forms. Built for the modern web using **Cloudflare Workers**, **D1 (SQLite)**, and **Cloudflare Pages**. It features a secure, themeable admin panel and a lightning-fast public form renderer.

---

## ✨ Key Features

- **🔨 Powerful Builder**: Drag-and-drop-style form creation with support for multiple input types (Text, Email, Radio, Checkbox, File Uploads).
- **🎨 Themeable UI**: Instant dark mode support and customizable theme colors.
- **🛡️ SaaS-Grade Security**: JWT-based authentication, server-side validation, and Cloudflare Turnstile integration.
- **📊 Response Management**: Real-time response tracking with CSV/XLSX/PDF export capabilities.
- **🚀 Edge-Powered**: Globally distributed serverless architecture for sub-100ms response times.

---

## 🛠️ Tech Stack

### **Frontend**
- **Vanilla JS & CSS3**: Zero-dependency, lightweight, and blazing fast.
- **Cloudflare Pages**: High-performance static hosting at the edge.
- **Font Awesome**: Professional iconography.

### **Backend**
- **Cloudflare Workers**: High-performance serverless environment.
- **Cloudflare D1**: SQL database for reliable data storage.
- **Cloudflare KV**: High-speed key-value storage for rate limiting.

### **Security**
- **JWT Auth**: Secure admin session management.
- **Cloudflare Secrets**: Zero-exposure secret management.
- **CORS Hardening**: Strict origin-based access control.

---

## 📁 Project Structure

```text
KumoFumi /
├── api/               # Cloudflare Worker (Backend)
│   ├── src/           # Business logic & authentication
│   ├── schema.sql     # D1 database initialization
│   └── wrangler.toml  # Worker configuration
├── css/               # Modular frontend styles
├── js/                # Client-side logic (Admin & Form)
├── index.html         # Public Form Renderer
├── admin.html         # Secure Admin Dashboard
└── login.html         # Admin Authentication Portal
```

---

## 🔒 Security & Architecture

This project follows a **Backend-First Security Model**. All sensitive logic is isolated in the Worker, ensuring the frontend remains thin and secure.

### **Secret Management**
> [!IMPORTANT]
> Secrets are NEVER stored in GitHub or the source code. They are injected at runtime via Cloudflare Environment Variables.

<details>
<summary>🔑 View Production Secret Commands</summary>

```bash
# How to set production secrets
wrangler secret put ADMIN_PASSWORD
wrangler secret put JWT_SECRET
wrangler secret put TURNSTILE_SECRET
```
</details>

### **Validation Flow**
1. **Frontend**: UX-focused validation (immediate feedback).
2. **Backend**: Strict schema validation (Zod-like logic), rate limiting, and size enforcement.
3. **Database**: SQL-level integrity checks.

---

## 🚀 Deployment

### **Backend Deployment**
```bash
cd api
npm install
wrangler deploy --env production
```

### **Frontend Deployment**
Push to any branch connected to **Cloudflare Pages**. Routing is handled automatically for `index.html`, `admin.html`, and `login.html`.

---

## 💻 Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ZEON-07/Custom-Form.git
   cd Custom-Form
   ```

2. **Setup API**:
   ```bash
   cd api
   npm install
   ```

3. **Configure local secrets**:
   Create a `.dev.vars` file in the `api/` directory:
   <details>
   <summary>📂 View Local Environment Example</summary>

   ```env
   ADMIN_PASSWORD=your-local-pass
   JWT_SECRET=your-local-secret
   ```
   </details>

4. **Run local environment**:
   ```bash
   wrangler dev
   ```

---

## 🗺️ Roadmap

- [ ] **PDF Export**: Generate professional PDF reports for each submission.
- [ ] **Analytics**: Visual charts for data distribution.
- [ ] **Webhooks**: Direct integration with Discord/Slack.
- [ ] **Multi-Admin**: RBAC support for larger teams.
- [ ] **Scheduling**: Auto-open/close forms based on timestamps.

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

> [!TIP]
> This architecture is designed to scale to millions of requests at near-zero cost. It’s not just a tool—it's a production-ready serverless platform.