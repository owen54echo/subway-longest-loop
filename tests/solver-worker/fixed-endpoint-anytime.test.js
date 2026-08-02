const assert = require("assert");
const fs = require("fs");

const dataWindow = {};
new Function("window", fs.readFileSync("subway_data.js", "utf8"))(dataWindow);

const workerCode = fs.readFileSync("solver-worker.js", "utf8");
let result = null;
const context = {
    postMessage(message) {
        if (message.type === "result") result = message;
    },
    onmessage: null
};

new Function(`
    const postMessage = this.postMessage;
    let onmessage = null;
    ${workerCode}
    this.onmessage = onmessage;
`).call(context);

const city = dataWindow.subwayDataMap.shenzhen;
context.onmessage({
    data: {
        start_station: "车公庙",
        end_station: "岗厦北",
        mode: "path",
        allow_station_reuse: false,
        max_transfers: null,
        max_lines: null,
        waypoints: [],
        optimize_metric: "edges",
        nodes: city.nodes,
        edges: city.edges,
        timeout: 1
    }
});

assert.ok(result?.timeout_reached, "The fixed-endpoint benchmark must exercise the anytime result path");
assert.strictEqual(result.path_stations[0], "车公庙");
assert.strictEqual(result.path_stations.at(-1), "岗厦北");
assert.strictEqual(new Set(result.path_stations).size, result.path_stations.length, "The seed route must not repeat stations");
assert.ok(result.path_edges.length >= 100, `Expected a high-quality seed route, got ${result.path_edges.length} intervals`);

console.log("fixed endpoint anytime contract ok");
