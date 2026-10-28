const assert = require("assert");
const fs = require("fs");

const dataWindow = {};
new Function("window", fs.readFileSync("subway_data.js", "utf8"))(dataWindow);
const city = dataWindow.subwayDataMap.wuhan;
const phase2 = [
    "十里铺", "汉钢", "汉西路南", "双墩", "汉西路北", "华安里",
    "汉口站北广场", "石桥", "中一路", "后湖四路", "兴业路", "百步亭",
    "丹水池", "科普公园",
];
const line12 = city.edges.filter(edge => edge.line === "12号线");
const line12Stations = new Set();
for (const edge of line12) {
    line12Stations.add(edge.u);
    line12Stations.add(edge.v);
}

assert.strictEqual(line12Stations.size, 37, "武汉12号线二期预置后应形成37座车站的环线");
for (const station of phase2) {
    assert(line12Stations.has(station), `12号线二期应包含${station}`);
    const node = city.nodes.find(item => item.name === station);
    assert(node, `武汉线网应包含${station}`);
    assert(node.lines.includes("12号线"), `${station} 应挂载12号线`);
    assert(Number.isFinite(node.lng) && Number.isFinite(node.lat), `${station} 应有经纬度`);
}
const hangang = city.nodes.find(item => item.name === "汉钢");
assert.strictEqual(hangang.lng, 114.234248, "汉钢应使用已核对的高德经度");
assert.strictEqual(hangang.lat, 30.565434, "汉钢应使用已核对的高德纬度");

const requiredConnections = ["墨水湖公园", ...phase2, "钢都花园"];
for (let index = 0; index < requiredConnections.length - 1; index += 1) {
    const left = requiredConnections[index];
    const right = requiredConnections[index + 1];
    assert(line12.some(edge => edge.u === left && edge.v === right
        || edge.u === right && edge.v === left), `${left}和${right}之间应有12号线区间`);
}

console.log("Wuhan Line 12 phase II topology contract ok");
