const assert = require("assert");
const fs = require("fs");

const dataWindow = {};
new Function("window", fs.readFileSync("subway_data.js", "utf8"))(dataWindow);
const resultWindow = {};
new Function("window", fs.readFileSync("city_extremes_results.js", "utf8"))(resultWindow);

const expectedRules = [
    "path-reuse", "loop-reuse", "path-simple", "loop-simple",
    "path-reuse-distance", "loop-reuse-distance", "path-simple-distance", "loop-simple-distance"
];

for (const cityKey of ["xiamen", "qingdao", "ningbo", "changsha"]) {
    const city = dataWindow.subwayDataMap[cityKey];
    const results = resultWindow.cityExtremeResults[cityKey];
    assert(results, `${cityKey} 应有预计算结果`);
    assert.deepStrictEqual(Object.keys(results).sort(), expectedRules.sort(), `${cityKey} 应有完整规则结果`);
    for (const [ruleKey, entry] of Object.entries(results)) {
        assert.strictEqual(entry.total, city.nodes.length, `${cityKey}/${ruleKey} 的车站总数应匹配`);
        assert(entry.result && entry.result.weight >= 0, `${cityKey}/${ruleKey} 应有可用路线`);
        assert(entry.result.path_stations.length === entry.result.path_edges.length + 1,
            `${cityKey}/${ruleKey} 的站点和区间数量应匹配`);
        assert(entry.result.path_edges.every(index => Number.isInteger(index) && index >= 0 && index < city.edges.length),
            `${cityKey}/${ruleKey} 不应引用其他城市区间`);
    }
}

console.log("Mainland cities precompute contract ok");
