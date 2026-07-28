const assert = require("assert");
const fs = require("fs");

const windowLike = {};
new Function("window", fs.readFileSync("share-export.js", "utf8"))(windowLike);

const { createSnapshot, createCardModel, createPrintHtml } = windowLike.RouteShare;
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
const printHtml = createPrintHtml(createCardModel(snapshot, "complete"));
assert.ok(printHtml.includes("@media print"));
assert.ok(printHtml.includes("1号线"), "Complete print output should include route segments");

console.log("route share contract ok");
