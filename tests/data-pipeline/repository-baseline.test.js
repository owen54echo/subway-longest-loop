const assert = require("assert");
const fs = require("fs");

const source = fs.readFileSync("subway_data.js", "utf8");
const dataWindow = {};
new Function("window", source)(dataWindow);

const cityMap = dataWindow.subwayDataMap;
assert.ok(cityMap && typeof cityMap === "object", "subwayDataMap must be available");
assert.strictEqual(Object.keys(cityMap).length, 17, "baseline must contain 17 cities");
assert.ok(fs.existsSync("city_extremes_results.js"), "precomputed results must exist");
assert.ok(!fs.existsSync(".env"), "plaintext environment files must not be committed");

for (const [cityKey, city] of Object.entries(cityMap)) {
    assert.ok(Array.isArray(city.nodes) && city.nodes.length > 0, `${cityKey} must have nodes`);
    assert.ok(Array.isArray(city.edges) && city.edges.length > 0, `${cityKey} must have edges`);
}

console.log("repository baseline passed");
