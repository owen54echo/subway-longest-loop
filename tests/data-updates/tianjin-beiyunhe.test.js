const assert = require("assert");
const fs = require("fs");

const dataWindow = {};
new Function("window", fs.readFileSync("subway_data.js", "utf8"))(dataWindow);

const tianjin = dataWindow.subwayDataMap.tianjin;
const station = tianjin.nodes.find(node => node.name === "北运河");
assert(station, "天津 6 号线应包含北运河站");
assert.deepStrictEqual(station.lines, ["6号线"]);
assert.strictEqual(station.x, 447);
assert.strictEqual(station.y, 566);
assert.strictEqual(station.lng, 117.178231);
assert.strictEqual(station.lat, 39.16441);

const lineSixEdges = tianjin.edges.filter(edge => edge.line === "6号线");
assert(lineSixEdges.some(edge => edge.u === "天泰路" && edge.v === "北运河" && edge.straightLengthKm === 0.61));
assert(lineSixEdges.some(edge => edge.u === "北运河" && edge.v === "北竹林" && edge.straightLengthKm === 0.667));
assert(!lineSixEdges.some(edge => edge.u === "天泰路" && edge.v === "北竹林"),
    "北运河开通后不能保留跨站直连区间");

const resultWindow = {};
new Function("window", fs.readFileSync("city_extremes_results.js", "utf8"))(resultWindow);
const tianjinExtremes = resultWindow.cityExtremeResults.tianjin;
assert.strictEqual(Object.keys(tianjinExtremes).length, 8, "天津应保留全部八组预计算结果");
for (const [rule, entry] of Object.entries(tianjinExtremes)) {
    const stations = entry.result.path_stations;
    const edges = entry.result.path_edges;
    assert.strictEqual(stations.length, edges.length + 1, `${rule} 的路径长度应匹配`);
    edges.forEach((edgeIndex, index) => {
        const edge = tianjin.edges[edgeIndex];
        assert(edge, `${rule} 不应引用不存在的边 ${edgeIndex}`);
        const connects = (edge.u === stations[index] && edge.v === stations[index + 1]) ||
            (edge.v === stations[index] && edge.u === stations[index + 1]);
        assert(connects, `${rule} 不应引用北运河更新前的边索引`);
    });
}

console.log("Tianjin Beiyunhe station data contract ok");
