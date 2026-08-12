const assert = require("assert");
const fs = require("fs");

const windowLike = {};
new Function("window", fs.readFileSync("calculation-topology.js", "utf8"))(windowLike);

const { create } = windowLike.CalculationTopology;
const nodes = [
    { name: "站马屯" },
    { name: "南四环(郑州航空港站)" },
    { name: "南四环(贾河)" },
    { name: "十八里河" }
];
const edges = [
    { u: "站马屯", v: "南四环(郑州航空港站)", line: "2号线", straightLengthKm: 2.339 },
    { u: "南四环(贾河)", v: "十八里河", line: "城郊线", straightLengthKm: 1.645 }
];

const topology = create("zhengzhou", nodes, edges);
assert.strictEqual(topology.nodes.length, 3);
assert.strictEqual(topology.normalizeStation("南四环(郑州航空港站)"), "南四环");
assert.strictEqual(topology.normalizeStation("南四环(贾河)"), "南四环");
assert.deepStrictEqual(topology.getMapStationNames("南四环"), ["南四环(郑州航空港站)", "南四环(贾河)"]);
assert.strictEqual(topology.edges[0].v, "南四环");
assert.strictEqual(topology.edges[1].u, "南四环");
assert.strictEqual(topology.edges[0].mapV, "南四环(郑州航空港站)");
assert.strictEqual(topology.edges[1].mapU, "南四环(贾河)");
assert.strictEqual(topology.isThroughServiceTransition(topology.edges[0], topology.edges[1]), true);
assert.strictEqual(topology.isThroughServiceTransition(topology.edges[0], topology.edges[0]), false);

const untouched = create("guangzhou", nodes, edges);
assert.strictEqual(untouched.nodes.length, 4);
assert.strictEqual(untouched.normalizeStation("南四环(贾河)"), "南四环(贾河)");

const dataWindow = {};
new Function("window", fs.readFileSync("subway_data.js", "utf8"))(dataWindow);
const zhengzhou = dataWindow.subwayDataMap.zhengzhou;
const realTopology = create("zhengzhou", zhengzhou.nodes, zhengzhou.edges);
assert.strictEqual(realTopology.nodes.length, zhengzhou.nodes.length - 1);
assert(realTopology.nodes.some(node => node.name === "南四环"));
assert(!realTopology.nodes.some(node => node.name === "南四环(郑州航空港站)"));
assert(!realTopology.nodes.some(node => node.name === "南四环(贾河)"));
assert(realTopology.edges.some(edge => edge.mapV === "南四环(郑州航空港站)" && edge.v === "南四环"));
assert(realTopology.edges.some(edge => edge.mapU === "南四环(贾河)" && edge.u === "南四环"));
assert(zhengzhou.nodes.some(node => node.name === "南四环(郑州航空港站)"));
assert(zhengzhou.nodes.some(node => node.name === "南四环(贾河)"));
assert(zhengzhou.edges.some(edge => edge.u === "站马屯" && edge.v === "南四环(郑州航空港站)"));
assert(zhengzhou.edges.some(edge => edge.u === "南四环(贾河)" && edge.v === "十八里河"));

const bajiaoNodes = [
    { name: "古城", lines: ["1号线八通线"] },
    {
        name: "八角游乐园",
        lines: ["1号线八通线"],
        wiki: {
            operationalStatus: {
                state: "temporarily_closed",
                calculation: {
                    mode: "pass_through",
                    line: "1号线八通线",
                    from: "古城",
                    to: "八宝山"
                }
            }
        }
    },
    { name: "八宝山", lines: ["1号线八通线"] }
];
const bajiaoEdges = [
    { u: "古城", v: "八角游乐园", line: "1号线八通线", color: "#CC0000", straightLengthKm: 1.906 },
    { u: "八角游乐园", v: "八宝山", line: "1号线八通线", color: "#CC0000", straightLengthKm: 1.984 }
];
const bajiaoTopology = create("beijing", bajiaoNodes, bajiaoEdges);
assert.strictEqual(bajiaoTopology.isStationUnavailable("八角游乐园"), true);
assert.strictEqual(bajiaoTopology.nodes.some(node => node.name === "八角游乐园"), false);
assert.strictEqual(bajiaoTopology.edges.some(edge => edge.u === "八角游乐园" || edge.v === "八角游乐园"), false);
const bypassEdge = bajiaoTopology.edges[0];
assert.strictEqual(bypassEdge.u, "古城");
assert.strictEqual(bypassEdge.v, "八宝山");
assert.strictEqual(bypassEdge.logicalLine, "1号线/八通线");
assert.strictEqual(bypassEdge.straightLengthKm, 3.89);
assert.strictEqual(bypassEdge.throughService, true);
assert.deepStrictEqual(bypassEdge.skippedStations, ["八角游乐园"]);
assert.deepStrictEqual(bajiaoTopology.getMapSegments(bypassEdge), [
    { u: "古城", v: "八角游乐园", line: "1号线八通线", color: "#CC0000" },
    { u: "八角游乐园", v: "八宝山", line: "1号线八通线", color: "#CC0000" }
]);

console.log("calculation topology contract ok");
