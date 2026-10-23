const assert = require("assert");
const rules = require("../../route-rules.js");

const throughEdges = [
    {
        u: "南四环", v: "A", line: "2号线", logicalLine: "2号线",
        mapU: "南四环(郑州航空港站)", mapV: "A",
        throughServiceGroups: ["南四环"],
        throughServiceEndpointGroups: { "南四环(郑州航空港站)": "南四环" },
        straightLengthKm: 2.3
    },
    {
        u: "南四环", v: "B", line: "城郊线", logicalLine: "城郊线",
        mapU: "南四环(贾河)", mapV: "B",
        throughServiceGroups: ["南四环"],
        throughServiceEndpointGroups: { "南四环(贾河)": "南四环" },
        straightLengthKm: 1.6
    },
    { u: "B", v: "C", line: "城郊线", logicalLine: "城郊线", straightLengthKm: 2 }
];

assert.strictEqual(rules.edgeDistance(throughEdges[0]), 2.3);
assert.strictEqual(rules.logicalLine({ line: "支线", logicalLine: "主线" }), "主线");
assert.strictEqual(rules.isThroughServiceTransition(throughEdges[0], throughEdges[1]), true);
assert.strictEqual(rules.countTransfers(throughEdges), 0);
assert.strictEqual(rules.totalDistance(throughEdges), 5.9);

console.log("route rules contract ok");
