// Live XAUUSD candlestick chart with the bot's own key-level zones drawn
// directly on the chart as price-line overlays.
//
// Uses TradingView's free, open-source lightweight-charts library instead
// of the hosted iframe widget, because the iframe widget cannot be
// annotated from the outside — there is no way to draw our zones on top
// of it. lightweight-charts renders from our own OHLC data (exported by
// the bot from its own MT5 feed) so we have full control over the canvas.

const GF_CHART_COLORS_TODAY = {
    daily_high_today: "#F2CE7B",
    daily_low_today: "#F2CE7B",
    asia_high: "#7ec8e3",
    asia_low: "#7ec8e3",
    london_high: "#D9AE4E",
    london_low: "#D9AE4E",
    ny_high: "#46D690",
    ny_low: "#46D690",
};

const GF_CHART_LABELS_TODAY = {
    daily_high_today: "Tageshoch",
    daily_low_today: "Tagestief",
    asia_high: "Asia H",
    asia_low: "Asia L",
    london_high: "London H",
    london_low: "London L",
    ny_high: "NY H",
    ny_low: "NY L",
};

const GF_CHART_COLORS_YESTERDAY = {
    PDH: "#F2CE7B",
    PDL: "#F2CE7B",
    AsiaH: "#7ec8e3",
    AsiaL: "#7ec8e3",
    LondonH: "#D9AE4E",
    LondonL: "#D9AE4E",
    NYH: "#46D690",
    NYL: "#46D690",
};

const GF_CHART_LABELS_YESTERDAY = {
    PDH: "PDH",
    PDL: "PDL",
    AsiaH: "y-Asia H",
    AsiaL: "y-Asia L",
    LondonH: "y-London H",
    LondonL: "y-London L",
    NYH: "y-NY H",
    NYL: "y-NY L",
};

function gfAddZonePriceLines(series, levels, labels, colors, style) {
    Object.entries(levels || {}).forEach(([key, price]) => {
        if (!labels[key] || !price) return;
        series.createPriceLine({
            price,
            color: colors[key] || "#D9AE4E",
            lineWidth: 1,
            lineStyle: style,
            axisLabelVisible: true,
            title: labels[key],
        });
    });
}

async function gfInitChart() {
    const mount = document.getElementById("gf-chart");
    const emptyEl = document.getElementById("gf-chart-empty");
    if (!mount || !window.LightweightCharts) return;

    let candles = [];
    let todayLevels = {};
    let yesterdayLevels = {};

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

    gfAddZonePriceLines(series, todayLevels, GF_CHART_LABELS_TODAY, GF_CHART_COLORS_TODAY, LightweightCharts.LineStyle.Solid);
    gfAddZonePriceLines(series, yesterdayLevels, GF_CHART_LABELS_YESTERDAY, GF_CHART_COLORS_YESTERDAY, LightweightCharts.LineStyle.Dashed);

    chart.timeScale().fitContent();
}

document.addEventListener("DOMContentLoaded", gfInitChart);
