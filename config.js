// Shared config for all pages. Loaded before script.js / admin.js.
//
// Local dev (opened via a local dev server on localhost/127.0.0.1) talks to
// the API running on your machine; everywhere else talks to the real API.
// Replace GF_API_BASE_PROD once the API subdomain is live (see api/README.md).
window.GF_API_BASE_PROD = "https://api.goldfalcon.de";
window.GF_API_BASE_LOCAL = "http://127.0.0.1:8000";

window.GF_API_BASE = (
    location.hostname === "localhost" || location.hostname === "127.0.0.1"
) ? window.GF_API_BASE_LOCAL : window.GF_API_BASE_PROD;
