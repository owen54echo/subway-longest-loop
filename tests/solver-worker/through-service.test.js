const assert = require("assert");
const fs = require("fs");

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

const edges = [
    {
        u: "站马屯", v: "南四环", mapU: "站马屯", mapV: "南四环(郑州航空港站)",
        throughServiceGroups: ["南四环"], throughServiceEndpointGroups: { "南四环(郑州航空港站)": "南四环" },
        line: "2号线", straightLengthKm: 2.339
    },
    {
        u: "南四环", v: "十八里河", mapU: "南四环(贾河)", mapV: "十八里河",
        throughServiceGroups: ["南四环"], throughServiceEndpointGroups: { "南四环(贾河)": "南四环" },
        line: "城郊线", straightLengthKm: 1.645
    }
];

context.onmessage({
    data: {
        start_station: "站马屯",
        end_station: "十八里河",
        mode: "path",
        allow_station_reuse: false,
        max_transfers: 0,
        max_lines: null,
        waypoints: [],
        optimize_metric: "edges",
        nodes: [{ name: "站马屯" }, { name: "南四环" }, { name: "十八里河" }],
        edges,
        timeout: 1
    }
});

assert.ok(result && result.weight > -1, "Through-service route must be reachable with zero transfers");
assert.deepStrictEqual(result.path_stations, ["站马屯", "南四环", "十八里河"]);
assert.deepStrictEqual(result.path_edges, [0, 1]);

console.log("solver through-service contract ok");
