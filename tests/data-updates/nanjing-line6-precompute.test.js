const assert = require("assert");
const fs = require("fs");

const dataWindow = {};
new Function("window", fs.readFileSync("subway_data.js", "utf8"))(dataWindow);
const resultWindow = {};
new Function("window", fs.readFileSync("city_extremes_results.js", "utf8"))(resultWindow);

const nanjing = dataWindow.subwayDataMap.nanjing;
const results = resultWindow.cityExtremeResults.nanjing;
const expectedRules = [
    "path-reuse", "loop-reuse", "path-simple", "loop-simple",
    "path-reuse-distance", "loop-reuse-distance",
    "path-simple-distance", "loop-simple-distance"
];

assert.deepStrictEqual(Object.keys(results).sort(), expectedRules.sort(), "南京应有完整的 8 组预计算结果");

for (const rule of expectedRules) {
    const entry = results[rule];
    assert.strictEqual(entry.total, 263, `${rule} 应基于更新后的 263 个车站计算`);
    assert(entry.result && entry.result.weight >= 0, `${rule} 应包含可用路线`);
    assert(Array.isArray(entry.result.path_edges), `${rule} 应包含区间序列`);
    assert(Array.isArray(entry.result.path_stations), `${rule} 应包含车站序列`);
    assert(entry.result.path_edges.every(index => Number.isInteger(index) && index >= 0 && index < nanjing.edges.length),
        `${rule} 的区间索引应落在当前南京线网范围内`);
}

console.log("Nanjing line 6 precompute contract ok");
