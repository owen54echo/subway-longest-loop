const assert = require("assert");
const fs = require("fs");

const dataWindow = {};
new Function("window", fs.readFileSync("subway_data.js", "utf8"))(dataWindow);

const expectedLines = {
    xiamen: ["1号线", "2号线", "3号线", "4号线", "6号线"],
    qingdao: ["1号线", "2号线", "3号线", "4号线", "6号线", "8号线", "蓝谷快线", "西海岸快线"],
    ningbo: ["1号线", "2号线", "3号线", "4号线", "5号线", "6号线", "7号线", "8号线", "12号线"],
    changsha: ["1号线", "2号线", "3号线", "4号线", "5号线", "6号线", "S2线"]
};

for (const [cityKey, lines] of Object.entries(expectedLines)) {
    const city = dataWindow.subwayDataMap[cityKey];
    assert(city, `${cityKey} 应接入地铁数据`);

    const actualLines = [...new Set(city.edges.map(edge => edge.line))].sort();
    assert.deepStrictEqual(actualLines, [...lines].sort(), `${cityKey} 只能包含正式运营线路`);

    for (const node of city.nodes) {
        assert(Number.isFinite(node.x) && Number.isFinite(node.y), `${cityKey} 的 ${node.name} 应有地图坐标`);
        assert(Number.isFinite(node.lng) && Number.isFinite(node.lat), `${cityKey} 的 ${node.name} 应有经纬度`);
        assert(node.lines.every(line => lines.includes(line)), `${cityKey} 的 ${node.name} 不应关联未运营线路`);
    }

    for (const edge of city.edges) {
        assert.notStrictEqual(edge.u, edge.v, `${cityKey} 不应包含自环`);
        assert(edge.straightLengthKm > 0, `${cityKey} 的 ${edge.u} 至 ${edge.v} 应有估算距离`);
    }
}

console.log("Mainland cities operational data contract ok");
