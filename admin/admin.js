// Shared admin auth helpers. Requires config.js to be loaded first.
const GF_TOKEN_KEY = "gf_admin_token";

function gfGetToken() {
    return sessionStorage.getItem(GF_TOKEN_KEY);
}

function gfSetToken(token) {
    sessionStorage.setItem(GF_TOKEN_KEY, token);
}

function gfClearToken() {
    sessionStorage.removeItem(GF_TOKEN_KEY);
}

function gfLogout() {
    gfClearToken();
    window.location.href = "login.html";
}

// Fetch wrapper that attaches the bearer token and redirects to login on 401.
async function gfApiFetch(path, options = {}) {
    const token = gfGetToken();
    const headers = Object.assign({}, options.headers || {}, {
        Authorization: token ? `Bearer ${token}` : "",
    });
    const res = await fetch(window.GF_API_BASE + path, { ...options, headers });
    if (res.status === 401) {
        gfClearToken();
        window.location.href = "login.html";
        throw new Error("Not authenticated");
    }
    if (!res.ok) {
        let detail = res.statusText;
        try {
            const body = await res.json();
            detail = body.detail || detail;
        } catch (_) {}
        throw new Error(detail);
    }
    return res.json();
}

// Call at the top of any protected page.
async function gfRequireAuth() {
    const token = gfGetToken();
    if (!token) {
        window.location.href = "login.html";
        return null;
    }
    try {
        return await gfApiFetch("/api/auth/me");
    } catch (e) {
        return null;
    }
}
