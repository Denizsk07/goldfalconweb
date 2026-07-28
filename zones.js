// Public zones panel — fetches today's/yesterday's key levels from the
// read-only GoldFalcon API. No auth required, no user data involved.

const GF_ZONE_LABELS_TODAY = {
    daily_high_today: "Tageshoch",
    daily_low_today: "Tagestief",
    daily_open: "Tages-Open",
    asia_high: "Asia High",
    asia_low: "Asia Low",
    asia_open: "Asia Open",
    london_high: "London High",
    london_low: "London Low",
    london_open: "London Open",
    ny_high: "New York High",
    ny_low: "New York Low",
    ny_open: "New York Open",
    weekly_high: "Wochenhoch",
    weekly_low: "Wochentief",
    weekly_open: "Wochen-Open",
};

const GF_ZONE_LABELS_YESTERDAY = {
    PDH: "Vortageshoch (PDH)",
    PDL: "Vortagestief (PDL)",
    AsiaH: "Asia High",
    AsiaL: "Asia Low",
    LondonH: "London High",
    LondonL: "London Low",
    NYH: "New York High",
    NYL: "New York Low",
};

function gfRenderZones(containerId, levels, labelMap) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const entries = Object.entries(levels || {}).filter(([, v]) => typeof v === "number" && v > 0);
    if (!entries.length) {
        el.innerHTML = '<div class="zones-empty">Noch keine Zonen für diesen Zeitraum.</div>';
        return;
    }
    el.innerHTML = entries
        .map(([key, price]) => {
            const label = labelMap[key] || key;
            return `<div class="zone-row"><span class="zone-label">${label}</span><span class="zone-price">${price.toFixed(2)}</span></div>`;
        })
        .join("");
}

async function gfLoadZones() {
    try {
        const [todayRes, yesterdayRes] = await Promise.all([
            fetch(window.GF_API_BASE + "/api/zones/today"),
            fetch(window.GF_API_BASE + "/api/zones/yesterday"),
        ]);
        const today = await todayRes.json();
        const yesterday = await yesterdayRes.json();
        gfRenderZones("zones-today", today.levels, GF_ZONE_LABELS_TODAY);
        gfRenderZones("zones-yesterday", yesterday.levels, GF_ZONE_LABELS_YESTERDAY);
    } catch (e) {
        ["zones-today", "zones-yesterday"].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<div class="zones-empty">Zonen aktuell nicht verfügbar.</div>';
        });
    }
}

const GF_SESSION_LABELS = { asia: "Asia", london: "London", new_york: "New York" };

function gfRenderSessionPerf(sessions) {
    const el = document.getElementById("session-perf-grid");
    if (!el) return;
    if (!sessions || !sessions.length) {
        el.innerHTML = '<div class="zones-empty">Performance-Daten folgen in Kürze.</div>';
        return;
    }
    el.innerHTML = sessions
        .map((s) => {
            const pipsStr = (s.pips >= 0 ? "+" : "") + Number(s.pips).toLocaleString("de-DE", { maximumFractionDigits: 0 });
            return `<div class="session-perf-box session-${s.session}">
                <div class="session-perf-label">${GF_SESSION_LABELS[s.session] || s.label}</div>
                <div class="session-perf-winrate">${s.winrate}%</div>
                <div class="session-perf-pips ${s.pips >= 0 ? "pos" : "neg"}">${pipsStr} Pips</div>
            </div>`;
        })
        .join("");
}

async function gfLoadStatsBar() {
    const bar = document.getElementById("performance-section");
    if (!bar) return;
    try {
        const res = await fetch(window.GF_API_BASE + "/api/public/stats-summary");
        const data = await res.json();
        document.getElementById("stat-total-pips").textContent = "+" + Number(data.total_pips || 0).toLocaleString("de-DE", { maximumFractionDigits: 0 });
        document.getElementById("stat-winrate").textContent = (data.winrate || 0).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + "%";
        document.getElementById("stat-since").textContent = data.start_date
            ? `Live-Zahlen seit ${data.start_date}`
            : "Live-Zahlen aus dem laufenden System";
        gfRenderSessionPerf(data.sessions);
    } catch (e) {
        bar.hidden = true;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    gfLoadZones();
    gfLoadStatsBar();
});
