const assert = require("assert");
const fs = require("fs");

const dataWindow = {};
new Function("window", fs.readFileSync("subway_data.js", "utf8"))(dataWindow);

const nanjing = dataWindow.subwayDataMap.nanjing;
const expectedStations = [
    "南京南站", "夹岗", "机场跑道旧址", "市中医院", "应天东街",
    "中和桥", "光华门", "明故宫", "富贵山", "岗子村",
    "花园路", "红山新城", "营苑南路", "万寿", "燕江新城",
    "兴学路", "兴智街", "十月广场", "金陵石化", "栖霞山"
];

assert.strictEqual(nanjing.nodes.length, 263, "南京更新后应有 263 个唯一车站");
assert.strictEqual(nanjing.edges.length, 288, "南京更新后应有 288 个相邻区间");

const lineSixEdges = nanjing.edges.filter(edge => edge.line === "6号线");
assert.strictEqual(lineSixEdges.length, 19, "6 号线应包含 19 个相邻区间");
assert.deepStrictEqual(
    [lineSixEdges[0].u, ...lineSixEdges.map(edge => edge.v)],
    expectedStations,
    "6 号线站序应为南京南站至栖霞山"
);

for (const name of expectedStations) {
    const station = nanjing.nodes.find(node => node.name === name);
    assert(station, `南京 6 号线缺少 ${name}`);
    assert(station.lines.includes("6号线"), `${name} 应标记为 6 号线车站`);
    assert(Number.isFinite(station.x) && Number.isFinite(station.y), `${name} 应有地图坐标`);
    assert(Number.isFinite(station.lng) && Number.isFinite(station.lat), `${name} 应有经纬度`);
}

for (const edge of lineSixEdges) {
    assert.strictEqual(edge.color, "#00AD8E", "6 号线应使用青绿色线路色");
    assert(edge.straightLengthKm > 0, `${edge.u} 至 ${edge.v} 应有估算距离`);
}

assert(!nanjing.edges.some(edge => edge.line === "6号线" && edge.u === edge.v), "6 号线不应包含自环");

console.log("Nanjing line 6 data contract ok");
