const assert = require("assert");
const fs = require("fs");

const windowLike = {};
new Function("window", fs.readFileSync("share-export.js", "utf8"))(windowLike);

const { createSnapshot, createCardModel, createPrintHtml, calculateSegmentLayout } = windowLike.RouteShare;
const snapshot = createSnapshot({
    cityName: "广州",
    source: "custom",
    path_stations: ["A", "B", "C"],
    path_edges: [0, 1],
    distanceKm: 4.2,
    transfers: 1,
    segments: [
        { line: "1号线", color: "#f00", stations: ["A", "B"] },
        { line: "2号线", color: "#0a0", stations: ["B", "C"] }
    ]
});
const approximateSnapshot = createSnapshot({
    cityName: "广州",
    source: "solver",
    path_stations: ["A", "B"],
    path_edges: [0],
    distanceKm: 1.2,
    transfers: 0,
    segments: [{ line: "1号线", color: "#f00", stations: ["A", "B"] }],
    isApproximate: true
});

assert.deepStrictEqual(snapshot.stats, {
    stationCount: 3,
    edgeCount: 2,
    transferCount: 1,
    distanceKm: 4.2
});
assert.ok(!JSON.stringify(snapshot).match(/location|token|url/i));
assert.strictEqual(createCardModel(snapshot, "compact").stations.length, 2);
assert.strictEqual(createCardModel(snapshot, "normal").segments.length, 2);
assert.strictEqual(createCardModel(snapshot, "complete").stations.length, 3);
assert.strictEqual(approximateSnapshot.isApproximate, true, "An unfinished result must preserve its approximation state in the share snapshot");
assert.strictEqual(createCardModel(approximateSnapshot, "normal").isApproximate, true, "All share card modes must preserve approximation state");
const printHtml = createPrintHtml(createCardModel(snapshot, "complete"));
assert.ok(printHtml.includes("@media print"));
assert.ok(printHtml.includes("1号线"), "Complete print output should include route segments");
assert.ok(createPrintHtml(createCardModel(approximateSnapshot, "complete")).includes("近似"), "Approximate print output must carry the compact approximation marker");

assert.strictEqual(typeof calculateSegmentLayout, "function", "Share exports need a segment layout helper");
const normalLayout = calculateSegmentLayout([
    { line: "14号线支线(知识城线)" },
    { line: "南海有轨电车1号线" }
], { lineX: 116, defaultRouteX: 300, maxRouteX: 460, lineFontSize: 24, gap: 28 });
assert(normalLayout.routeX >= 396, "Long route names must move station names to the right");
assert(normalLayout.routeX <= 460, "Station text needs a bounded reading area");

const completeLayout = calculateSegmentLayout([
    { line: "14号线支线(知识城线)" }
], { lineX: 170, defaultRouteX: 390, maxRouteX: 650, lineFontSize: 30, gap: 34 });
assert(completeLayout.routeX >= 518, "Complete exports need the same long-name clearance");

console.log("route share contract ok");
