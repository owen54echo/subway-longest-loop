const assert = require("assert");
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");

assert(html.includes('<script src="calculation-topology.js"></script>'));
assert(html.includes('window.CalculationTopology.create(selectedCity, data.nodes, data.edges)'));
assert(html.includes('nodes: calculationTopology.nodes'));
assert(html.includes('edges: calculationEdges'));
assert(html.includes('calculationTopology.normalizeStation(stationName)'));
assert(html.includes('calculationTopology.isThroughServiceTransition(previousEdge, edge)'));
assert(html.includes("无需下车，直通"));
assert(html.includes('edge.mapU || edge.u'));

console.log("calculation topology page integration contract ok");
