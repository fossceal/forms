const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
export const API_BASE = isLocal 
    ? "http://127.0.0.1:8787" 
    : "https://custom-forms-api.mr-adhi125.workers.dev";
