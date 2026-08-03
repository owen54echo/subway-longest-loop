const assert = require("assert");
const fs = require("fs");

const workerCode = fs.readFileSync("solver-worker.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");

function runSolver(config) {
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
    context.onmessage({ data: config });
    return result;
}

function config(nodes, edges, overrides = {}) {
    return {
        start_station: "A",
        end_station: null,
        mode: "path",
        allow_station_reuse: true,
        allow_line_reuse: true,
        max_transfers: null,
        max_lines: null,
        waypoints: [],
        optimize_metric: "edges",
        nodes: nodes.map(name => ({ name })),
        edges: edges.map(([u, v]) => ({ u, v, line: "1号线", straightLengthKm: 1 })),
        timeout: null,
        ...overrides
    };
}

function bruteForce(config) {
    const stationId = new Map(config.nodes.map((node, index) => [node.name, index]));
    const adjacency = Array.from({ length: config.nodes.length }, () => []);
    config.edges.forEach((edge, id) => {
        const u = stationId.get(edge.u);
        const v = stationId.get(edge.v);
        adjacency[u].push({ id, to: v });
        adjacency[v].push({ id, to: u });
    });
    const start = stationId.get(config.start_station);
    const end = config.end_station ? stationId.get(config.end_station) : undefined;
    const used = new Uint8Array(config.edges.length);
    let best = -1;

    function visit(node, length) {
        if (config.mode === "loop") {
            if (node === start && length > 0) {
                best = Math.max(best, length);
                return;
            }
        } else if (end === undefined || node === end) {
            if (length > 0) best = Math.max(best, length);
            if (end !== undefined) return;
        }
        for (const edge of adjacency[node]) {
            if (used[edge.id]) continue;
            used[edge.id] = 1;
            visit(edge.to, length + 1);
            used[edge.id] = 0;
        }
    }

    visit(start, 0);
    return best;
}

function assertMatchesBruteForce(fixture) {
    const result = runSolver(fixture);
    assert.strictEqual(
        result.weight,
        bruteForce(fixture),
        "Bridge optimization must preserve the independent exhaustive optimum"
    );
}

const bridgeLoop = config(
    ["A", "B", "C", "D"],
    [["A", "B"], ["B", "C"], ["C", "D"], ["D", "B"]],
    { start_station: "B", mode: "loop" }
);
const loopResult = runSolver(bridgeLoop);
assert.strictEqual(loopResult.weight, 3, "Exact loop search must exclude a one-way bridge and retain its cycle");
assert.strictEqual(loopResult.search_stats.bridge_count, 1, "Worker must identify original graph bridges for exact bounds");
assert(loopResult.search_stats.bridge_edge_rejections > 0, "Loop search must reject bridge edges before entering them");
assertMatchesBruteForce(bridgeLoop);

assertMatchesBruteForce(config(
    ["A", "B", "C", "D", "E", "F"],
    [["A", "B"], ["B", "C"], ["C", "A"], ["C", "D"], ["D", "E"], ["E", "F"], ["F", "D"]],
    { end_station: "F" }
));

const fixedEndpointBridge = config(
    ["A", "B", "C", "D", "E"],
    [["A", "B"], ["B", "C"], ["C", "D"], ["B", "E"]],
    { end_station: "D" }
);
const fixedEndpointResult = runSolver(fixedEndpointBridge);
assert.strictEqual(fixedEndpointResult.weight, 3, "Fixed-endpoint path must retain the required bridge chain");
assert(fixedEndpointResult.search_stats.bridge_edge_rejections > 0, "Fixed-endpoint search must reject off-route bridge branches");
assertMatchesBruteForce(fixedEndpointBridge);

const rootSplit = config(
    ["A", "B", "C", "D", "E"],
    [["A", "B"], ["B", "C"], ["C", "D"], ["A", "E"]]
);
const fullResult = runSolver(rootSplit);
const shortBranchResult = runSolver({ ...rootSplit, root_edge_ids: [3] });
assert.strictEqual(fullResult.weight, 3, "Reference exact search must retain the longest root branch");
assert.strictEqual(shortBranchResult.weight, 1, "A root-worker must search only its assigned first edge");
assert.deepStrictEqual(shortBranchResult.path_edges, [3], "Assigned root branch must be preserved in the result");
assert(!workerCode.includes("if (rootEdgeMask || mode"), "Fixed-endpoint root workers must retain an assigned-branch seed search");
assert(!workerCode.includes("getBridgeRayUpperBound"), "Bridge filtering must not recurse through the bridge forest at every DFS state");

assert(html.includes("const activeWorkers = new Set()"), "UI must track every active exact-search worker");
assert(html.includes("navigator.hardwareConcurrency"), "UI must cap parallelism using the device concurrency hint");
assert(/root_edge_ids:\s*rootEdgeGroups\[workerIndex\]/.test(html), "UI must assign each worker a disjoint root-edge group");
assert(html.includes("completedWorkers === rootEdgeGroups.length"), "UI must wait for every exact root branch before showing a result");

console.log("exact optimization contract ok");
