const assert = require("assert");
const SolverContract = require("../../solver-contract.js");

function baseConfig(overrides = {}) {
    return {
        start_station: "A",
        end_station: "C",
        mode: "path",
        allow_station_reuse: false,
        allow_line_reuse: true,
        max_transfers: null,
        max_lines: null,
        waypoints: [],
        optimize_metric: "edges",
        nodes: [{ name: "A" }, { name: "B" }, { name: "C" }],
        edges: [
            { u: "A", v: "B", line: "1号线" },
            { u: "B", v: "C", line: "1号线" }
        ],
        ...overrides
    };
}

const valid = SolverContract.validateRequest(baseConfig());
assert.strictEqual(valid.ok, true);

const unknownEnd = SolverContract.validateRequest(baseConfig({ end_station: "不存在" }));
assert.strictEqual(unknownEnd.ok, false);
assert(unknownEnd.errors.some(item => item.code === "UNKNOWN_END_STATION"));

const unknownWaypoint = SolverContract.validateRequest(baseConfig({ waypoints: ["不存在"] }));
assert(unknownWaypoint.errors.some(item => item.code === "UNKNOWN_WAYPOINT"));

const danglingEdge = SolverContract.validateRequest(baseConfig({
    edges: [{ u: "A", v: "不存在", line: "1号线" }]
}));
assert(danglingEdge.errors.some(item => item.code === "DANGLING_EDGE"));

const distanceMissing = SolverContract.validateRequest(baseConfig({ optimize_metric: "distance" }));
assert(distanceMissing.errors.some(item => item.code === "MISSING_DISTANCE"));

const invalidBoolean = SolverContract.validateRequest(baseConfig({ allow_line_reuse: "true" }));
assert(invalidBoolean.errors.some(item => item.code === "INVALID_BOOLEAN"));

const result = {
    path_edges: [0, 1],
    path_stations: ["A", "B", "C"],
    weight: 2
};
const verified = SolverContract.verifyResult(baseConfig(), result);
assert.strictEqual(verified.ok, true);
assert.strictEqual(verified.metrics.transfers, 0);

const invalidPath = SolverContract.verifyResult(baseConfig(), {
    path_edges: [0],
    path_stations: ["A", "B"],
    weight: 1
});
assert(invalidPath.errors.some(item => item.code === "INVALID_PATH_END"));

const tieA = { weight: 2, path_edges: [1] };
const tieB = { weight: 2, path_edges: [2] };
assert.strictEqual(SolverContract.compareResults(tieA, tieB), 1);
assert.strictEqual(SolverContract.compareResults(tieB, tieA), -1);

console.log("solver contract tests passed");
