const assert = require("assert");
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");

assert(html.includes('<script src="calculation-topology.js"></script>'));
assert(html.includes('calculationTopology = getCalculationCityData(selectedCity).topology'));
assert(html.includes('window.CalculationTopology.create(cityKey, city.nodes, city.edges)'));
assert(html.includes('nodes: calculationTopology.nodes'));
assert(html.includes('edges: calculationEdges'));
assert(html.includes('calculationTopology.normalizeStation(stationName)'));
assert(html.includes('calculationTopology.isThroughServiceTransition(previousEdge, edge)'));
assert(html.includes("无需下车，直通"));
assert(html.includes('calculationTopology.getMapSegments(edge)'));

console.log("calculation topology page integration contract ok");
