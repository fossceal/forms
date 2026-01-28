#!/usr/bin/env node

/**
 * Local Development Server
 * Simulates Cloudflare Worker locally for testing
 */

import { readFileSync } from 'fs';
import { createServer } from 'http';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// In-memory storage (simulates D1)
const db = {
    forms: new Map(),
    responses: new Map(),
    images: new Map(),
    stats: new Map()
};

const sessions = new Map();
const ADMIN_PASSWORD = 'admin123'; // Change this

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
};

function sendJSON(res, data, status = 200) {
    res.writeHead(status, corsHeaders);
    res.end(JSON.stringify(data));
}

function isAuthenticated(req) {
    const auth = req.headers.authorization;
    if (!auth) return false;
    const token = auth.replace('Bearer ', '');
    return sessions.has(token);
}

const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200, corsHeaders);
        res.end();
        return;
    }

    // Collect body
    let body = '';
    req.on('data', chunk => body += chunk);
    await new Promise(resolve => req.on('end', resolve));

    try {
        // LOGIN
        if (url.pathname === '/api/login' && req.method === 'POST') {
            const { password } = JSON.parse(body);
            if (password !== ADMIN_PASSWORD) {
                return sendJSON(res, { error: 'Invalid password' }, 401);
            }
            const token = crypto.randomUUID();
            sessions.set(token, Date.now());
            return sendJSON(res, { token });
        }

        // GET FORM (PUBLIC)
        if (url.pathname.match(/^\/api\/forms\/[^\/]+$/) && req.method === 'GET') {
            const slug = url.pathname.split('/').pop();
            const form = db.forms.get(slug);
            if (!form) {
                res.writeHead(404, corsHeaders);
                res.end('Form not found');
                return;
            }
            return sendJSON(res, form);
        }

        // GET ALL FORMS (PROTECTED)
        if (url.pathname === '/api/forms/library/all' && req.method === 'GET') {
            if (!isAuthenticated(req)) {
                res.writeHead(401, corsHeaders);
                res.end('Unauthorized');
                return;
            }
            return sendJSON(res, Array.from(db.forms.values()));
        }

        // SAVE FORM (PROTECTED)
        if (url.pathname === '/api/forms' && req.method === 'POST') {
            if (!isAuthenticated(req)) {
                res.writeHead(401, corsHeaders);
                res.end('Unauthorized');
                return;
            }
            const formData = JSON.parse(body);
            const form = {
                id: formData.id || crypto.randomUUID(),
                slug: formData.slug,
                name: formData.name,
                config: formData.config || [],
                design: formData.design || {},
                scriptUrl: formData.scriptUrl || '',
                spreadsheetUrl: formData.spreadsheetUrl || '',
                sheetTab: formData.sheetTab || formData.name,
                status: formData.status || 'open',
                date: new Date().toLocaleDateString()
            };
            db.forms.set(form.slug, form);
            console.log(`✅ Form saved: ${form.slug}`);
            return sendJSON(res, { status: 'success', slug: form.slug });
        }

        // DELETE FORM (PROTECTED)
        if (url.pathname === '/api/forms/delete' && req.method === 'POST') {
            if (!isAuthenticated(req)) {
                res.writeHead(401, corsHeaders);
                res.end('Unauthorized');
                return;
            }
            const { slug } = JSON.parse(body);
            db.forms.delete(slug);
            console.log(`🗑️  Form deleted: ${slug}`);
            return sendJSON(res, { status: 'deleted' });
        }

        // SUBMIT RESPONSE (PUBLIC)
        if (url.pathname.match(/^\/api\/forms\/[^\/]+\/responses$/) && req.method === 'POST') {
            const slug = url.pathname.split('/')[3];
            const form = db.forms.get(slug);
            if (!form) {
                res.writeHead(404, corsHeaders);
                res.end('Form not found');
                return;
            }
            if (form.status === 'closed') {
                res.writeHead(403, corsHeaders);
                res.end('Form is closed');
                return;
            }
            const responseData = JSON.parse(body);
            const responseId = crypto.randomUUID();
            if (!db.responses.has(slug)) {
                db.responses.set(slug, []);
            }
            db.responses.get(slug).push({
                id: responseId,
                data: responseData,
                submittedAt: Date.now()
            });
            console.log(`📝 Response submitted to: ${slug}`);
            return sendJSON(res, { status: 'success' });
        }

        // UPLOAD IMAGE (PROTECTED)
        if (url.pathname === '/api/upload' && req.method === 'POST') {
            if (!isAuthenticated(req)) {
                res.writeHead(401, corsHeaders);
                res.end('Unauthorized');
                return;
            }
            // Simulate image upload
            const imageId = crypto.randomUUID();
            const url = `https://placeholder.com/${imageId}.jpg`;
            console.log(`🖼️  Image uploaded: ${imageId}`);
            return sendJSON(res, { url, id: imageId });
        }

        // STATS
        if (url.pathname === '/api/form-stats' && req.method === 'GET') {
            const formId = url.searchParams.get('id');
            const responses = db.responses.get(formId) || [];
            return sendJSON(res, { count: responses.length });
        }

        // Serve static files
        if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
            try {
                let filePath = join(__dirname, '..', 'public', url.pathname);
                if (url.pathname === '/') filePath = join(__dirname, '..', 'public', 'admin.html');
                const content = readFileSync(filePath);
                const ext = filePath.split('.').pop();
                const contentTypes = {
                    'html': 'text/html',
                    'js': 'application/javascript',
                    'css': 'text/css',
                    'json': 'application/json'
                };
                res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
                res.end(content);
                return;
            } catch (e) {
                res.writeHead(404);
                res.end('Not found');
                return;
            }
        }

        res.writeHead(404, corsHeaders);
        res.end('Not found');
    } catch (error) {
        console.error('Error:', error);
        sendJSON(res, { error: error.message }, 500);
    }
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`
🚀 Local Development Server Running

📍 Admin Panel: http://localhost:${PORT}/admin.html
📍 API Endpoint: http://localhost:${PORT}/api/

🔑 Admin Password: ${ADMIN_PASSWORD}

📊 In-Memory Database:
   - Forms: ${db.forms.size}
   - Responses: ${Array.from(db.responses.values()).reduce((a, b) => a + b.length, 0)}

Press Ctrl+C to stop
    `);
});
