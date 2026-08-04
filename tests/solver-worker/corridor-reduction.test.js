const assert = require("assert");
const fs = require("fs");

const workerCode = fs.readFileSync("solver-worker.js", "utf8");

function runSolverWithMessages(config) {
    let result = null;
    const messages = [];
    const context = {
        postMessage(message) {
            messages.push(message);
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
    return { result, messages };
}

function runSolver(config) {
    return runSolverWithMessages(config).result;
}

function config(nodes, edges, overrides = {}) {
    return {
        start_station: "A",
        end_station: null,
        mode: "loop",
        allow_station_reuse: false,
        allow_line_reuse: true,
        max_transfers: null,
        max_lines: null,
        waypoints: [],
        optimize_metric: "edges",
        nodes: nodes.map(name => ({ name })),
        edges: edges.map(([u, v, line = "1号线"]) => ({ u, v, line, logicalLine: line, straightLengthKm: 1 })),
        timeout: null,
        ...overrides
    };
}

function bruteForceLoop(fixture) {
    const idByName = new Map(fixture.nodes.map((node, id) => [node.name, id]));
    const start = idByName.get(fixture.start_station);
    const adjacency = Array.from({ length: fixture.nodes.length }, () => []);
    fixture.edges.forEach((edge, id) => {
        const u = idByName.get(edge.u);
        const v = idByName.get(edge.v);
        adjacency[u].push({ id, to: v });
        adjacency[v].push({ id, to: u });
    });

    const usedEdges = new Uint8Array(fixture.edges.length);
    const visitedStations = new Uint8Array(fixture.nodes.length);
    visitedStations[start] = 1;
    let best = 0;

    function visit(node, length) {
        if (node === start && length > 0) {
            best = Math.max(best, length);
            return;
        }
        for (const edge of adjacency[node]) {
            if (usedEdges[edge.id]) continue;
            if (edge.to !== start && visitedStations[edge.to]) continue;
            usedEdges[edge.id] = 1;
            if (edge.to !== start) visitedStations[edge.to] = 1;
            visit(edge.to, length + 1);
            if (edge.to !== start) visitedStations[edge.to] = 0;
            usedEdges[edge.id] = 0;
        }
    }

    visit(start, 0);
    return best;
}

const sameLineCorridor = config(
    ["A", "B", "C", "D"],
    [["A", "B"], ["B", "C"], ["C", "D"], ["D", "A"]],
    { allow_line_reuse: false }
);
const corridorResult = runSolver(sameLineCorridor);
assert.strictEqual(corridorResult.weight, bruteForceLoop(sameLineCorridor));
assert.strictEqual(corridorResult.weight, 4, "The raw corridor cycle must remain available to the exact solver");
assert.strictEqual(corridorResult.path_edges.length, 4, "The result must retain every original edge for route-book rendering");
assert(corridorResult.search_stats.forced_corridor_edges > 0, "Same-line degree-two stations should be advanced in one search decision");

const incumbentRun = runSolverWithMessages(sameLineCorridor);
const incumbents = incumbentRun.messages.filter(message => message.type === "incumbent");
assert(incumbents.length > 0, "A Worker must emit a candidate when it improves its local best route");
assert(incumbents.every((message, index) => index === 0 || message.weight > incumbents[index - 1].weight), "Worker candidates must be strictly improving");
assert.strictEqual(incumbents.at(-1).weight, incumbentRun.result.weight, "The final Worker result must match its latest candidate");
assert.deepStrictEqual(incumbents.at(-1).path_edges, incumbentRun.result.path_edges, "Candidate paths must use the normal raw-edge result format");

const noStartReuseInPath = config(
    ["A", "B", "C"],
    [["A", "B"], ["B", "C"], ["C", "A"]],
    { mode: "path" }
);
const pathResult = runSolver(noStartReuseInPath);
assert.strictEqual(pathResult.weight, 2, "A non-repeating path must not auto-advance through the already visited start station");
assert.strictEqual(new Set(pathResult.path_stations).size, pathResult.path_stations.length, "The path result must keep its no-station-reuse contract");

const offStartBlockCycle = config(
    ["A", "B", "C", "D", "E"],
    [["A", "B"], ["B", "C"], ["C", "A"], ["C", "D"], ["D", "E"], ["E", "C"]]
);
const blockResult = runSolver(offStartBlockCycle);
assert.strictEqual(blockResult.weight, bruteForceLoop(offStartBlockCycle));
assert.strictEqual(blockResult.weight, 3, "A simple loop through A cannot include a different block through articulation C");
assert(blockResult.search_stats.biconnected_edge_rejections > 0, "Loop search should reject edges outside the start station's biconnected block");

console.log("corridor and biconnected reduction contract ok");
