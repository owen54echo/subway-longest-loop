(function() {
    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function createSnapshot(route) {
        const distanceKm = Number(Number(route.distanceKm || 0).toFixed(1));
        return Object.freeze({
            cityName: route.cityName,
            source: route.source === "custom" ? "自定义路线" : "规划路线",
            stations: [...route.path_stations],
            edges: [...route.path_edges],
            segments: clone(route.segments || []),
            stats: {
                stationCount: route.path_stations.length,
                edgeCount: route.path_edges.length,
                transferCount: Number(route.transfers || 0),
                distanceKm
            }
        });
    }

    function createCardModel(snapshot, mode) {
        const base = {
            cityName: snapshot.cityName,
            source: snapshot.source,
            stats: snapshot.stats,
            start: snapshot.stations[0],
            end: snapshot.stations[snapshot.stations.length - 1]
        };

        if (mode === "compact") {
            return { ...base, mode, stations: [base.start, base.end], segments: [] };
        }
        if (mode === "normal") {
            return { ...base, mode, stations: [base.start, base.end], segments: clone(snapshot.segments) };
        }
        return { ...base, mode: "complete", stations: [...snapshot.stations], segments: clone(snapshot.segments) };
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function createPrintHtml(model) {
        const stations = model.stations
            .map((name, index) => `<li><span>${index + 1}</span>${escapeHtml(name)}</li>`)
            .join("");

        return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(model.cityName)}地铁路线</title>
<style>
@page { margin: 12mm; }
* { box-sizing: border-box; }
body { color: #161a18; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
h1 { margin: 0; font-size: 24px; }
.summary { color: #52605a; margin: 8px 0 20px; }
ol { margin: 0; padding: 0; list-style: none; }
li { display: flex; gap: 10px; min-height: 26px; align-items: center; border-bottom: 1px solid #d7ddd8; }
li span { color: #1d8b68; font-variant-numeric: tabular-nums; width: 24px; }
@media print { .page-break { break-before: page; } }
</style></head><body>
<h1>${escapeHtml(model.cityName)} · ${escapeHtml(model.source)}</h1>
<p class="summary">${escapeHtml(model.start)} - ${escapeHtml(model.end)} · ${model.stats.stationCount} 站 · ${model.stats.transferCount} 次换乘 · ${model.stats.distanceKm.toFixed(1)} km</p>
<ol>${stations}</ol>
</body></html>`;
    }

    async function svgToPngBlob(svgText, width, height) {
        const image = new Image();
        const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));

        try {
            await new Promise((resolve, reject) => {
                image.onload = resolve;
                image.onerror = reject;
                image.src = url;
            });
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            canvas.getContext("2d").drawImage(image, 0, 0, width, height);
            return await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    window.RouteShare = { createSnapshot, createCardModel, createPrintHtml, svgToPngBlob };
})();
