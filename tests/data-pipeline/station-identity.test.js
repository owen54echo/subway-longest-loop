const assert = require("assert");
const fs = require("fs");

const dataWindow = {};
new Function("window", fs.readFileSync("subway_data.js", "utf8"))(dataWindow);

for (const [cityKey, city] of Object.entries(dataWindow.subwayDataMap)) {
    const ids = city.nodes.map(node => node.stationId);
    assert(ids.every(id => typeof id === "string" && id.startsWith(`${cityKey}:`)),
        `${cityKey} stations must expose stable city-scoped identities`);
    assert.strictEqual(new Set(ids).size, ids.length, `${cityKey} station identities must be unique`);
}

console.log("station identity contract ok");
