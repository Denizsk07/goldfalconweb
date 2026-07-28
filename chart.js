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
// same look as a proper TradingView "sessions" indicator. Everything else
// (PDH/PDL, daily high, weekly high/low) is a single price with no time
// range, so it's a plain line across the whole chart.

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

const GF_LINE_LEVELS_TODAY = {
    daily_high_today: { label: "Tageshoch", color: "#F2CE7B", style: "Solid" },
    weekly_high: { label: "Wochenhoch", color: "#8A6E31", style: "Solid" },
    weekly_low: { label: "Wochentief", color: "#8A6E31", style: "Solid" },
};

const GF_LINE_LEVELS_YESTERDAY = {
    PDH: { label: "PDH", color: "#F2CE7B", style: "Dashed" },
    PDL: { label: "PDL", color: "#F2CE7B", style: "Dashed" },
};

function gfAddLineLevels(series, levels, defs) {
    Object.entries(defs).forEach(([key, def]) => {
        const price = levels[key];
        if (!price) return;
        series.createPriceLine({
            price,
            color: def.color,
            lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle[def.style],
            axisLabelVisible: true,
            title: def.label,
        });
    });
}

// Session ranges get a shaded CSS box over the chart, anchored to both
// their price range (series.priceToCoordinate) and their real session time
// window (chart.timeScale().timeToCoordinate) — lightweight-charts v4 has
// no native rectangle primitive, so this is redrawn on every pan/zoom.
function gfBuildBoxes(levels, windows, boxDefs, overlay) {
    const boxes = [];
    boxDefs.forEach((def) => {
        const high = levels[def.highKey];
        const low = levels[def.lowKey];
        const win = windows[def.windowKey];
        if (!high || !low || !win) return;

        const el = document.createElement("div");
        el.className = "gf-zone-box gf-zone-" + def.cls;
        overlay.appendChild(el);

        boxes.push({ el, high, low, startTs: win.start, endTs: win.end });
    });
    return boxes;
}

function gfClampToVisibleRange(chart, ts) {
    const range = chart.timeScale().getVisibleRange();
    if (!range) return ts;
    return Math.max(range.from, Math.min(range.to, ts));
}

function gfPositionBoxes(chart, series, boxes, overlay) {
    try {
        overlay.style.right = chart.priceScale("right").width() + "px";
    } catch (e) {}
    boxes.forEach(({ el, high, low, startTs, endTs }) => {
        const yHigh = series.priceToCoordinate(high);
        const yLow = series.priceToCoordinate(low);
        const xStart = chart.timeScale().timeToCoordinate(gfClampToVisibleRange(chart, startTs));
        const xEnd = chart.timeScale().timeToCoordinate(gfClampToVisibleRange(chart, endTs));
        if (yHigh === null || yLow === null || xStart === null || xEnd === null || xEnd <= xStart) {
            el.style.display = "none";
            return;
        }
        el.style.display = "block";
        el.style.top = Math.min(yHigh, yLow) + "px";
        el.style.height = Math.max(2, Math.abs(yLow - yHigh)) + "px";
        el.style.left = xStart + "px";
        el.style.width = (xEnd - xStart) + "px";
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

    let candles = [];
    let todayLevels = {};
    let yesterdayLevels = {};
    let todayWindows = {};
    let yesterdayWindows = {};

    try {
        const [candlesRes, todayRes, yesterdayRes] = await Promise.all([
            fetch(window.GF_API_BASE + "/api/chart/candles"),
            fetch(window.GF_API_BASE + "/api/zones/today"),
            fetch(window.GF_API_BASE + "/api/zones/yesterday"),
        ]);
        const candlesJson = await candlesRes.json();
        const todayJson = await todayRes.json();
        const yesterdayJson = await yesterdayRes.json();
        candles = candlesJson.candles || [];
        todayLevels = todayJson.levels || {};
        yesterdayLevels = yesterdayJson.levels || {};
        todayWindows = todayJson.session_windows || {};
        yesterdayWindows = yesterdayJson.session_windows || {};
    } catch (e) {
        mount.hidden = true;
        if (emptyEl) emptyEl.hidden = false;
        return;
    }

    if (!candles.length) {
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

    series.setData(candles);

    gfAddLineLevels(series, todayLevels, GF_LINE_LEVELS_TODAY);
    gfAddLineLevels(series, yesterdayLevels, GF_LINE_LEVELS_YESTERDAY);

    const boxes = [
        ...gfBuildBoxes(todayLevels, todayWindows, GF_SESSION_BOXES, overlay),
        ...gfBuildBoxes(yesterdayLevels, yesterdayWindows, GF_SESSION_BOXES_YESTERDAY, overlay),
    ];

    const redraw = () => gfPositionBoxes(chart, series, boxes, overlay);
    chart.timeScale().subscribeVisibleLogicalRangeChange(redraw);
    window.addEventListener("resize", () => setTimeout(redraw, 60));

    chart.timeScale().fitContent();
    requestAnimationFrame(redraw);
    setTimeout(redraw, 150);
}

document.addEventListener("DOMContentLoaded", gfInitChart);
