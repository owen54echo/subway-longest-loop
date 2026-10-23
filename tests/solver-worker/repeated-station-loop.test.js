const assert = require("assert");
const fs = require("fs");

const workerCode = fs.readFileSync("solver-worker.js", "utf8");

function runSolver(allowStationReuse) {
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
    context.onmessage({
        data: {
            start_station: "A",
            end_station: null,
            mode: "loop",
            allow_station_reuse: allowStationReuse,
            allow_line_reuse: true,
            max_transfers: null,
            max_lines: null,
            waypoints: [],
            optimize_metric: "edges",
            nodes: ["A", "B", "C", "D", "E"].map(name => ({ name })),
            edges: [["A", "B"], ["B", "C"], ["C", "A"], ["A", "D"], ["D", "E"], ["E", "A"]]
                .map(([u, v]) => ({ u, v, line: "1号线" })),
            timeout: null
        }
    });
    return result;
}

const reusable = runSolver(true);
assert.strictEqual(reusable.weight, 6, "reusable stations must allow two cycles through the start");
assert.strictEqual(reusable.path_stations[0], "A");
assert.strictEqual(reusable.path_stations.at(-1), "A");

const simple = runSolver(false);
assert.strictEqual(simple.weight, 3, "simple loop must stop after one cycle");
assert.deepStrictEqual(runSolver(true).path_edges, reusable.path_edges,
    "the same exact request must produce a deterministic trail");

console.log("repeated station loop contract ok");
