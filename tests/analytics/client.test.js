const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const indexHtml = fs.readFileSync("index.html", "utf8");

function createStorage() {
    const store = new Map();
    return {
        getItem(key) { return store.has(key) ? store.get(key) : null; },
        setItem(key, value) { store.set(key, String(value)); },
        removeItem(key) { store.delete(key); }
    };
}

function createButton() {
    const listeners = new Map();
    return {
        addEventListener(type, handler) { listeners.set(type, handler); },
        click() { listeners.get("click")?.({ preventDefault() {} }); }
    };
}

function loadClient({ endpoint = "https://analytics.example.test", now = () => 1000 } = {}) {
    const sent = [];
    const location = { assigned: null, assign(value) { this.assigned = value; } };
    const context = {
        crypto: { randomUUID: () => "visitor-1" },
        fetch(url, init) {
            sent.push({ url, headers: init.headers, body: JSON.parse(init.body) });
            return Promise.resolve({ ok: true });
        },
        localStorage: createStorage(),
        sessionStorage: createStorage(),
        Date: { now },
        location,
        setTimeout,
        clearTimeout,
        window: null,
        SUBWAY_ANALYTICS_CONFIG: { endpoint }
    };
    context.window = context;
    vm.runInNewContext(fs.readFileSync("analytics-client.js", "utf8"), context);
    return { context, sent, location };
}

{
    const { context, sent } = loadClient();
    context.SiteAnalytics.trackPageView();
    context.SiteAnalytics.trackRouteGenerated();
    context.SiteAnalytics.trackTabOpen("rules");
    context.SiteAnalytics.trackTabOpen("invalid-tab");

    assert.deepStrictEqual(sent.map(item => item.body), [
        { event_type: "page_view", tab_id: null },
        { event_type: "route_generated", tab_id: null },
        { event_type: "tab_open", tab_id: "rules" }
    ]);
    assert.ok(sent.every(item => Object.keys(item.body).every(key => ["event_type", "tab_id"].includes(key))));
    assert.ok(sent.every(item => item.headers["x-subway-visitor"] === "visitor-1"));
    assert.strictEqual(context.localStorage.getItem("subway_analytics_visitor_id"), "visitor-1");
}

assert.match(
    indexHtml,
    /function displayResults\(result, filteredEdges, \{ trackGeneration = false \} = \{\}\)[\s\S]{0,500}if \(trackGeneration\) window\.SiteAnalytics\?\.trackRouteGenerated\(\);/,
    "route events must be opt-in so redraws do not inflate generation counts"
);
assert.match(indexHtml, /displayResults\(confirmed, calculationTopology\.edges, \{ trackGeneration: true \}\)/);
assert.match(indexHtml, /displayResults\(\{ \.\.\.bestCandidateResult, isApproximate: true \}, solverConfig\.edges, \{ trackGeneration: true \}\)/);
assert.match(indexHtml, /displayResults\(bestResult, solverConfig\.edges, \{ trackGeneration: true \}\)/);
assert.match(indexHtml, /displayResults\(currentConfirmedResult\.result, currentConfirmedResult\.edges\);/);

{
    let now = 5000;
    const { context, location } = loadClient({ now: () => now });
    const button = createButton();
    context.SiteAnalytics.bindPrivateEntry(button);

    for (let click = 0; click < 6; click++) button.click();
    assert.strictEqual(location.assigned, null);

    now += 100;
    button.click();
    assert.strictEqual(location.assigned, "analytics-dashboard.html");
}

{
    let now = 5000;
    const { context, location } = loadClient({ now: () => now });
    const button = createButton();
    context.SiteAnalytics.bindPrivateEntry(button);

    for (let click = 0; click < 6; click++) button.click();
    now += 10_001;
    button.click();
    assert.strictEqual(location.assigned, null);
}

console.log("analytics client tests passed");
