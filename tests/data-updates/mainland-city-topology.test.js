const assert = require("assert");
const fs = require("fs");

const dataWindow = {};
new Function("window", fs.readFileSync("subway_data.js", "utf8"))(dataWindow);
const topologyWindow = {};
new Function("window", `${fs.readFileSync("topology-rules.js", "utf8")}\n${fs.readFileSync("route-rules.js", "utf8")}\n${fs.readFileSync("calculation-topology.js", "utf8")}`)(topologyWindow);

for (const cityKey of ["xiamen", "qingdao", "ningbo", "changsha"]) {
    const city = dataWindow.subwayDataMap[cityKey];
    const topology = topologyWindow.CalculationTopology.create(cityKey, city.nodes, city.edges);
    assert.strictEqual(topology.nodes.length, city.nodes.length, `${cityKey} 不应丢失可计算车站`);
    assert.strictEqual(topology.edges.length, city.edges.length, `${cityKey} 不应丢失可计算区间`);
    assert(topology.edges.every(edge => edge.logicalLine === edge.line), `${cityKey} 不应错误合并未核对的线路`);
}

console.log("Mainland cities topology contract ok");
