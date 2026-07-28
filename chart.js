// Live XAUUSD candlestick chart with the bot's own key-level zones drawn
// directly on the chart.
//
// Uses TradingView's free, open-source lightweight-charts library instead
// of the hosted iframe widget, because the iframe widget cannot be
// annotated from the outside — there is no way to draw our zones on top
// of it. lightweight-charts renders from our own OHLC data (exported by
// the bot from its own MT5 feed) so we have full control over the canvas.
//
// Session ranges (Asia/London/NY high-low) are drawn as shaded boxes
// anchored to their actual session time window (not the full chart width) —
// same look as a proper TradingView "sessions" indicator.
//
// FVG/Order-Block zones are timeframe-specific (an H1 FVG drawn on M15
// candles doesn't correspond to anything real on screen), so the chart has
// an M15/H1 toggle — switching it refetches BOTH the candles and the POIs
// for that timeframe together, never one without the other.

const GF_REFRESH_INTERVAL_MS = 60000;
const GF_TIMEFRAMES = ["M15", "H1"];
const GF_DEFAULT_TIMEFRAME = "M15";

const GF_SESSION_BOXES = [
    { key: "asia", highKey: "asia_high", lowKey: "asia_low", windowKey: "asia", cls: "asia" },
    { key: "london", highKey: "london_high", lowKey: "london_low", windowKey: "london", cls: "london" },
    { key: "ny", highKey: "ny_high", lowKey: "ny_low", windowKey: "ny", cls: "ny" },
];

const GF_SESSION_BOXES_YESTERDAY = [
    { key: "y-asia", highKey: "AsiaH", lowKey: "AsiaL", windowKey: "asia", cls: "asia-y" },
    { key: "y-london", highKey: "LondonH", lowKey: "LondonL", windowKey: "london", cls: "london-y" },
    { key: "y-ny", highKey: "NYH", lowKey: "NYL", windowKey: "ny", cls: "ny-y" },
];

// Only PDH/PDL are drawn as plain lines now — daily/weekly high-low were
// dropped per feedback (too much clutter on top of the session boxes,
// which already show today's/yesterday's range).
const GF_LINE_LEVELS_YESTERDAY = {
    PDH: { label: "PDH", color: "#F2CE7B", style: "Dashed" },
    PDL: { label: "PDL", color: "#F2CE7B", style: "Dashed" },
};

// Returns the created price-line handles so a later refresh can remove them
// again before drawing the next batch (series.setData() alone doesn't
// touch price lines — they'd otherwise pile up on every refresh).
function gfAddLineLevels(series, levels, defs) {
    const lines = [];
    Object.entries(defs).forEach(([key, def]) => {
        const price = levels[key];
        if (!price) return;
        lines.push(
            series.createPriceLine({
                price,
                color: def.color,
                lineWidth: 1,
                lineStyle: LightweightCharts.LineStyle[def.style],
                axisLabelVisible: true,
                title: def.label,
            })
        );
    });
    return lines;
}

const GF_BOX_LABELS = {
    asia: "ASIA", london: "LONDON", ny: "NY",
    "asia-y": "ASIA", "london-y": "LONDON", "ny-y": "NY",
};

// Session ranges get a shaded CSS box over the chart, anchored to both
// their price range (series.priceToCoordinate) and their real session time
// window (chart.timeScale().timeToCoordinate) — lightweight-charts v4 has
// no native rectangle primitive, so this is redrawn continuously (see
// gfStartRedrawLoop) to track the chart's own pan/zoom animation frame by
// frame instead of only on "settled" range-change events.
function gfBuildBoxes(levels, windows, boxDefs, overlay) {
    const boxes = [];
    boxDefs.forEach((def) => {
        const high = levels[def.highKey];
        const low = levels[def.lowKey];
        const win = windows[def.windowKey];
        if (!high || !low || !win) return;

        const el = document.createElement("div");
        el.className = "gf-zone-box gf-zone-" + def.cls;
        const label = document.createElement("span");
        label.className = "gf-zone-box-label";
        label.textContent = GF_BOX_LABELS[def.cls] || "";
        el.appendChild(label);
        overlay.appendChild(el);

        boxes.push({ el, label, high, low, startTs: win.start, endTs: win.end });
    });
    return boxes;
}

// FVG/Order-Block zones from the bot's own market-memory POI tracking.
// These don't have a natural "end" time (they stay active until mitigated,
// and we only ever fetch unmitigated ones) — drawn from creation time out
// to the last candle, same convention as "still open" zones on ICT/SMC
// TradingView indicators.
function gfParseIsoToUnix(iso) {
    if (!iso) return null;
    const withZone = /[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : iso + "Z";
    const t = Date.parse(withZone);
    return isNaN(t) ? null : Math.floor(t / 1000);
}

// Unmitigated zones have no natural "end" time, but drawing them all the
// way out to the last candle makes an old, still-open FVG stretch across
// most of the visible chart (a gap from 2 days ago on a ~4-day M15 window
// covers ~40% of the width) — real ICT/SMC indicators cap how far a zone
// extends instead of dragging it out indefinitely. Capped to a fixed number
// of bars from creation so it stays a "zone", not a wallpaper stripe.
const GF_POI_MAX_EXTEND_BARS = 30;

function gfBuildPoiBoxes(pois, lastCandleTime, barIntervalSec, overlay) {
    const boxes = [];
    const maxExtend = GF_POI_MAX_EXTEND_BARS * (barIntervalSec || 900);
    (pois || []).forEach((p) => {
        const startTs = gfParseIsoToUnix(p.created_at);
        if (!startTs || !p.high || !p.low) return;
        const bullish = p.direction === "bullish";

        const el = document.createElement("div");
        el.className = "gf-poi-box " + (bullish ? "gf-poi-bull" : "gf-poi-bear");
        const label = document.createElement("span");
        label.className = "gf-poi-box-label";
        label.textContent = (p.type || "").toUpperCase();
        el.appendChild(label);
        overlay.appendChild(el);

        const endTs = Math.min(lastCandleTime, startTs + maxExtend);
        boxes.push({ el, label, high: p.high, low: p.low, startTs, endTs });
    });
    return boxes;
}

function gfSetTrendBadge(elId, value) {
    const el = document.getElementById(elId);
    if (!el) return;
    const v = (value || "CHOP").toUpperCase();
    el.textContent = v;
    el.classList.remove("bull", "bear", "chop");
    el.classList.add(v === "BULL" ? "bull" : v === "BEAR" ? "bear" : "chop");
}

function gfClampToVisibleRange(chart, ts) {
    const range = chart.timeScale().getVisibleRange();
    if (!range) return ts;
    return Math.max(range.from, Math.min(range.to, ts));
}

function gfPositionBoxes(chart, series, boxes, overlay) {
    try {
        overlay.style.right = chart.priceScale("right").width() + "px";
    } catch (e) {
        return;
    }
    boxes.forEach(({ el, label, high, low, startTs, endTs }) => {
        const yHigh = series.priceToCoordinate(high);
        const yLow = series.priceToCoordinate(low);
        const xStart = chart.timeScale().timeToCoordinate(gfClampToVisibleRange(chart, startTs));
        const xEnd = chart.timeScale().timeToCoordinate(gfClampToVisibleRange(chart, endTs));
        if (yHigh === null || yLow === null || xStart === null || xEnd === null || xEnd <= xStart) {
            el.style.display = "none";
            return;
        }
        const width = xEnd - xStart;
        el.style.display = "block";
        el.style.top = Math.min(yHigh, yLow) + "px";
        el.style.height = Math.max(2, Math.abs(yLow - yHigh)) + "px";
        el.style.left = xStart + "px";
        el.style.width = width + "px";
        // Hide the label once the box gets too narrow for it to fit cleanly.
        label.style.display = width >= 46 ? "block" : "none";
    });
}

// Keep the DOM box overlay glued to the chart on every rendered frame,
// including mid-animation frames during a mouse-wheel zoom or drag-pan —
// lightweight-charts eases those internally, and relying only on the
// "settled" subscribeVisibleLogicalRangeChange event left the boxes visibly
// lagging behind the candles while the chart was still animating.
// Reads state.boxes on every frame (rather than closing over a fixed array)
// so a later refresh/timeframe switch can swap in a new box set without
// restarting the loop.
function gfStartRedrawLoop(chart, series, state, overlay) {
    let running = true;
    function loop() {
        if (!running) return;
        gfPositionBoxes(chart, series, state.boxes, overlay);
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    return () => {
        running = false;
    };
}

// tf only affects candles + POIs — session boxes/PDH-PDL are the same
// regardless of which timeframe's candles are on screen.
async function gfFetchChartData(tf) {
    const [candlesRes, todayRes, yesterdayRes, poisRes, trendRes] = await Promise.all([
        fetch(window.GF_API_BASE + "/api/chart/candles?tf=" + tf),
        fetch(window.GF_API_BASE + "/api/zones/today"),
        fetch(window.GF_API_BASE + "/api/zones/yesterday"),
        fetch(window.GF_API_BASE + "/api/chart/pois?tf=" + tf),
        fetch(window.GF_API_BASE + "/api/chart/trend"),
    ]);
    const todayJson = await todayRes.json();
    const yesterdayJson = await yesterdayRes.json();
    return {
        candles: (await candlesRes.json()).candles || [],
        todayLevels: todayJson.levels || {},
        yesterdayLevels: yesterdayJson.levels || {},
        todayWindows: todayJson.session_windows || {},
        yesterdayWindows: yesterdayJson.session_windows || {},
        pois: (await poisRes.json()).pois || [],
        trend: await trendRes.json(),
    };
}

// (Re-)draws candles, price lines, zone boxes and the trend badges from a
// freshly fetched data snapshot. Safe to call repeatedly on the same
// chart/series — clears out the previous batch of price lines and box
// elements first so nothing piles up across auto-refreshes/tf switches.
function gfRenderChartData(chart, series, overlay, state, data) {
    state.priceLines.forEach((line) => {
        try {
            series.removePriceLine(line);
        } catch (e) {}
    });
    overlay.innerHTML = "";
    state.priceLines = [];
    state.boxes = [];

    series.setData(data.candles);

    state.priceLines.push(...gfAddLineLevels(series, data.yesterdayLevels, GF_LINE_LEVELS_YESTERDAY));

    const lastCandleTime = data.candles[data.candles.length - 1].time;
    const barIntervalSec =
        data.candles.length > 1 ? data.candles[1].time - data.candles[0].time : 900;
    state.boxes = [
        ...gfBuildBoxes(data.todayLevels, data.todayWindows, GF_SESSION_BOXES, overlay),
        ...gfBuildBoxes(data.yesterdayLevels, data.yesterdayWindows, GF_SESSION_BOXES_YESTERDAY, overlay),
        ...gfBuildPoiBoxes(data.pois, lastCandleTime, barIntervalSec, overlay),
    ];

    gfSetTrendBadge("gf-trend-h1", data.trend.h1);
    gfSetTrendBadge("gf-trend-m15", data.trend.m15);
}

function gfSetupTimeframeToggle(onChange) {
    const toggle = document.getElementById("gf-tf-toggle");
    if (!toggle) return;
    toggle.querySelectorAll(".gf-tf-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const tf = btn.dataset.tf;
            if (!GF_TIMEFRAMES.includes(tf) || btn.classList.contains("active")) return;
            toggle.querySelectorAll(".gf-tf-btn").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            onChange(tf);
        });
    });
}

async function gfInitChart() {
    const mount = document.getElementById("gf-chart");
    const emptyEl = document.getElementById("gf-chart-empty");
    const overlay = document.getElementById("gf-chart-zones");
    if (!mount || !window.LightweightCharts) return;

    // Reset to the "loading" default in case this page came from bfcache
    // (browser back/forward) with a stale empty-state left over.
    mount.hidden = false;
    if (emptyEl) emptyEl.hidden = true;
    overlay.innerHTML = "";

    const state = { boxes: [], priceLines: [], timeframe: GF_DEFAULT_TIMEFRAME };

    const data = await gfFetchChartData(state.timeframe).catch(() => null);
    if (!data || !data.candles.length) {
        mount.hidden = true;
        if (emptyEl) emptyEl.hidden = false;
        return;
    }

    const chart = LightweightCharts.createChart(mount, {
        layout: { background: { color: "#131722" }, textColor: "#d1d4dc" },
        grid: {
            vertLines: { color: "#2a2e39" },
            horzLines: { color: "#2a2e39" },
        },
        timeScale: { timeVisible: true, secondsVisible: false, borderColor: "#2a2e39" },
        rightPriceScale: { borderColor: "#2a2e39" },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        autoSize: true,
    });

    const series = chart.addCandlestickSeries({
        upColor: "#46D690",
        downColor: "#E4574F",
        borderVisible: false,
        wickUpColor: "#46D690",
        wickDownColor: "#E4574F",
    });

    gfRenderChartData(chart, series, overlay, state, data);
    gfStartRedrawLoop(chart, series, state, overlay);
    chart.timeScale().fitContent();

    // Switching M15/H1 is a full data-range change (different candle set
    // entirely), so — unlike the auto-refresh below — this DOES reset the
    // view via fitContent().
    gfSetupTimeframeToggle(async (tf) => {
        state.timeframe = tf;
        const fresh = await gfFetchChartData(tf).catch(() => null);
        if (fresh && fresh.candles.length) {
            gfRenderChartData(chart, series, overlay, state, fresh);
            chart.timeScale().fitContent();
        }
    });

    // Auto-refresh: refetch and redraw every 60s so the chart stays live
    // without a manual page reload. Deliberately skips fitContent() here —
    // a visitor who zoomed/panned shouldn't get yanked back on every tick.
    setInterval(async () => {
        const fresh = await gfFetchChartData(state.timeframe).catch(() => null);
        if (fresh && fresh.candles.length) {
            gfRenderChartData(chart, series, overlay, state, fresh);
        }
    }, GF_REFRESH_INTERVAL_MS);
}

document.addEventListener("DOMContentLoaded", gfInitChart);
