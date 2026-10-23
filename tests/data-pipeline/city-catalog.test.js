const assert = require("assert");
const fs = require("fs");

const catalog = JSON.parse(fs.readFileSync("data/cities.json", "utf8"));
const dataWindow = {};
new Function("window", fs.readFileSync("subway_data.js", "utf8"))(dataWindow);

const catalogKeys = catalog.map(city => city.key);
assert.strictEqual(new Set(catalogKeys).size, catalogKeys.length, "city keys must be unique");
assert.deepStrictEqual(catalogKeys, Object.keys(dataWindow.subwayDataMap),
    "the build catalog and the checked-in data must contain the same cities");
for (const city of catalog) {
    assert(city.name && city.adcode && city.pinyin, `incomplete catalog entry: ${city.key}`);
    assert(dataWindow.subwayDataMap[city.key].nodes.length > 0, `${city.key} has no stations`);
    assert(dataWindow.subwayDataMap[city.key].edges.length > 0, `${city.key} has no sections`);
}

console.log("city catalog contract ok");
