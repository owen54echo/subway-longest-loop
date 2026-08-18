(function initAnalyticsDashboard(window, document) {
    "use strict";

    const tabNames = { rules: "规划", constraints: "约束", roadbook: "路书", analysis: "分析", "custom-route": "自定义" };
    const countryNames = { CN: "中国", HK: "中国香港", MO: "中国澳门", TW: "中国台湾", US: "美国", JP: "日本", SG: "新加坡", GB: "英国", ZZ: "未知地区", "未知地区": "未知地区" };
    const status = document.getElementById("analytics-status");
    const customRange = document.getElementById("custom-range");
    const fromInput = document.getElementById("analytics-range-from");
    const toInput = document.getElementById("analytics-range-to");
    let activeRange = "7";

    function endpoint() {
        return String(window.SUBWAY_ANALYTICS_CONFIG?.endpoint || "").replace(/\/$/, "");
    }

    function formatShanghaiDate(date) {
        const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
        const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
        return `${values.year}-${values.month}-${values.day}`;
    }

    function defaultRange(days) {
        const now = new Date();
        return { from: formatShanghaiDate(new Date(now.getTime() - (days - 1) * 86400000)), to: formatShanghaiDate(now) };
    }

    function setStatus(message, tone = "") {
        status.textContent = message;
        status.dataset.tone = tone;
    }

    function formatNumber(value) {
        return Number(value || 0).toLocaleString("zh-CN");
    }

    function clear(element) {
        while (element.firstChild) element.removeChild(element.firstChild);
    }

    function addText(parent, tag, text, className = "") {
        const child = document.createElement(tag);
        child.textContent = text;
        if (className) child.className = className;
        parent.appendChild(child);
        return child;
    }

    function renderRanking(elementId, rows, nameFor, valueFor) {
        const list = document.getElementById(elementId);
        clear(list);
        if (!rows.length) {
            addText(list, "li", "暂无数据", "analytics-empty-row");
            return;
        }
        rows.forEach((row, index) => {
            const item = document.createElement("li");
            addText(item, "span", String(index + 1).padStart(2, "0"), "analytics-rank-index");
            addText(item, "span", nameFor(row), "analytics-rank-name");
            addText(item, "strong", formatNumber(valueFor(row)), "analytics-rank-value");
            list.appendChild(item);
        });
    }

    function renderDevices(devices) {
        const target = document.getElementById("device-breakdown");
        clear(target);
        const total = Number(devices.mobile || 0) + Number(devices.desktop || 0);
        [["手机端", devices.mobile, "cyan"], ["桌面端", devices.desktop, "pink"]].forEach(([name, value, tone]) => {
            const row = document.createElement("div");
            row.className = "analytics-device-row";
            const label = addText(row, "span", name);
            label.dataset.tone = tone;
            addText(row, "strong", `${total ? Math.round(Number(value || 0) / total * 100) : 0}%`);
            const track = document.createElement("div");
            track.className = "analytics-device-track";
            const fill = document.createElement("i");
            fill.dataset.tone = tone;
            fill.style.width = `${total ? Number(value || 0) / total * 100 : 0}%`;
            track.appendChild(fill);
            row.appendChild(track);
            target.appendChild(row);
        });
    }

    function renderTrend(rows) {
        const chart = document.getElementById("analytics-trend-chart");
        clear(chart);
        const width = 720;
        const height = 250;
        const left = 42;
        const right = 18;
        const top = 20;
        const bottom = 34;
        const max = Math.max(1, ...rows.flatMap(row => [Number(row.page_views || 0), Number(row.route_generations || 0)]));
        const x = index => rows.length < 2 ? width / 2 : left + index * (width - left - right) / (rows.length - 1);
        const y = value => height - bottom - value / max * (height - top - bottom);
        const namespace = "http://www.w3.org/2000/svg";
        for (let step = 0; step < 4; step++) {
            const line = document.createElementNS(namespace, "line");
            const position = top + step * (height - top - bottom) / 3;
            line.setAttribute("x1", String(left)); line.setAttribute("x2", String(width - right));
            line.setAttribute("y1", String(position)); line.setAttribute("y2", String(position));
            line.setAttribute("class", "analytics-chart-grid");
            chart.appendChild(line);
        }
        [["page_views", "analytics-chart-line-cyan"], ["route_generations", "analytics-chart-line-pink"]].forEach(([field, className]) => {
            const path = document.createElementNS(namespace, "path");
            path.setAttribute("class", className);
            path.setAttribute("d", rows.map((row, index) => `${index ? "L" : "M"}${x(index)} ${y(Number(row[field] || 0))}`).join(" "));
            chart.appendChild(path);
        });
        rows.forEach((row, index) => {
            if (rows.length > 8 && index % Math.ceil(rows.length / 6) !== 0 && index !== rows.length - 1) return;
            const label = document.createElementNS(namespace, "text");
            label.setAttribute("x", String(x(index))); label.setAttribute("y", String(height - 10));
            label.setAttribute("text-anchor", "middle"); label.setAttribute("class", "analytics-chart-label");
            label.textContent = String(row.report_date || "").slice(5);
            chart.appendChild(label);
        });
    }

    function renderStats(data) {
        const totals = data.totals || {};
        const mobile = Number(totals.mobile_page_views || 0);
        const desktop = Number(totals.desktop_page_views || 0);
        document.getElementById("metric-page-views").textContent = formatNumber(totals.page_views);
        document.getElementById("metric-visitors").textContent = formatNumber(totals.approx_unique_visitors);
        document.getElementById("metric-routes").textContent = formatNumber(totals.route_generations);
        document.getElementById("metric-mobile-share").textContent = `${mobile + desktop ? Math.round(mobile / (mobile + desktop) * 100) : 0}%`;
        renderTrend(data.daily || []);
        renderDevices(data.devices || {});
        renderRanking("country-ranking", data.countries || [], row => countryNames[row.country_code] || row.country_code, row => row.page_views);
        renderRanking("tab-usage-list", data.tabs || [], row => tabNames[row.tab_id] || row.tab_id, row => row.open_count);
        renderRanking("hour-usage-list", data.hours || [], row => `${String(row.hour_shanghai).padStart(2, "0")}:00`, row => row.page_views);
    }

    function selectedRange() {
        return activeRange === "custom" ? { from: fromInput.value, to: toInput.value } : defaultRange(Number(activeRange));
    }

    async function loadStats() {
        const range = selectedRange();
        if (!range.from || !range.to) return;
        if (!endpoint()) return setStatus("数据服务尚未配置", "error");
        setStatus("正在读取统计…");
        const response = await window.fetch(`${endpoint()}/stats?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`).catch(() => null);
        if (!response?.ok) return setStatus("暂时无法读取统计，请稍后重试", "error");
        renderStats(await response.json());
        setStatus(`${range.from} 至 ${range.to}`);
    }

    document.querySelectorAll("[data-range]").forEach(button => button.addEventListener("click", () => {
        activeRange = button.dataset.range;
        document.querySelectorAll("[data-range]").forEach(item => item.classList.toggle("active", item === button));
        customRange.hidden = activeRange !== "custom";
        if (activeRange !== "custom") loadStats();
    }));
    customRange.addEventListener("submit", event => { event.preventDefault(); loadStats(); });
    const initialRange = defaultRange(7);
    fromInput.value = initialRange.from;
    toInput.value = initialRange.to;
    loadStats();
})(window, document);
