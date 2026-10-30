const assert = require("assert");
const fs = require("fs");

const dataWindow = {};
new Function("window", fs.readFileSync("subway_data.js", "utf8"))(dataWindow);

const chengdu = dataWindow.subwayDataMap.chengdu;
assert(chengdu, "成都线网数据应存在");

const stationIndex = chengdu.nodes.findIndex(node => node.name === "龙泉驿火车站");
assert(stationIndex >= 0, "成都2号线应包含龙泉驿火车站");
assert.deepStrictEqual(chengdu.nodes[stationIndex].lines, ["2号线"]);
assert.strictEqual(chengdu.nodes[stationIndex].lng, 104.189261);
assert.strictEqual(chengdu.nodes[stationIndex].lat, 30.599484);
assert.strictEqual(chengdu.nodes[stationIndex - 1].name, "成都行政学院");
assert.strictEqual(chengdu.nodes[stationIndex + 1].name, "大面铺");

const lineTwoEdges = chengdu.edges.filter(edge => edge.line === "2号线");
assert(lineTwoEdges.some(edge => edge.u === "成都行政学院" && edge.v === "龙泉驿火车站"),
    "成都行政学院和龙泉驿火车站之间应有2号线区间");
assert(lineTwoEdges.some(edge => edge.u === "龙泉驿火车站" && edge.v === "大面铺"),
    "龙泉驿火车站和大面铺之间应有2号线区间");
assert(!lineTwoEdges.some(edge => edge.u === "成都行政学院" && edge.v === "大面铺"),
    "新增车站后不能保留跨站直连区间");
for (const edge of lineTwoEdges.filter(edge =>
    (edge.u === "成都行政学院" && edge.v === "龙泉驿火车站")
    || (edge.u === "龙泉驿火车站" && edge.v === "大面铺"))) {
    assert(Number.isFinite(edge.straightLengthKm) && edge.straightLengthKm > 0,
        "新增区间应有预估距离");
}

const existingStation = chengdu.nodes.find(node => node.name === "龙泉驿火车站南");
assert(existingStation, "龙泉驿火车站南应继续保留");
assert.deepStrictEqual(existingStation.lines, ["30号线"], "龙泉驿火车站南不应并入2号线");

const resultWindow = {};
new Function("window", fs.readFileSync("city_extremes_results.js", "utf8"))(resultWindow);
const results = resultWindow.cityExtremeResults.chengdu;
assert(results, "成都应有更新后的预计算结果");
for (const [rule, entry] of Object.entries(results)) {
    assert.strictEqual(entry.total, chengdu.nodes.length, `${rule} 的车站总数应匹配`);
    assert(entry.result && entry.result.weight >= 0, `${rule} 应包含可用路线`);
    assert(entry.result.path_stations.length === entry.result.path_edges.length + 1,
        `${rule} 的站点和区间数量应匹配`);
    assert(entry.result.path_edges.every(index => Number.isInteger(index)
        && index >= 0 && index < chengdu.edges.length), `${rule} 不应引用旧区间索引`);
}

console.log("Chengdu Longquanyi Railway Station data contract ok");
