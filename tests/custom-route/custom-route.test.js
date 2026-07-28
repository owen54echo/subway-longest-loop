const assert = require("assert");
const fs = require("fs");

const windowLike = {};
new Function("window", fs.readFileSync("custom-route.js", "utf8"))(windowLike);

const {
    createGraph,
    createDraft,
    appendSelection,
    undoDraft,
    confirmDraft,
    findMinimumStopPath
} = windowLike.CustomRoute;

const nodes = ["A", "B", "C", "D", "E"].map(name => ({ name }));
const edges = [
    { u: "A", v: "B", line: "L1", straightLengthKm: 2 },
    { u: "B", v: "D", line: "L1", straightLengthKm: 2 },
    { u: "A", v: "C", line: "L2", straightLengthKm: 1 },
    { u: "C", v: "D", line: "L2", straightLengthKm: 1 },
    { u: "D", v: "E", line: "L3", straightLengthKm: 3 }
];

const graph = createGraph(nodes, edges);
assert.deepStrictEqual(findMinimumStopPath(graph, "A", "D").edgeIndices, [2, 3]);
let draft = createDraft("A");
const manual = appendSelection(draft, "B", graph);
assert.strictEqual(manual.ok, true);
assert.strictEqual(manual.addedSegment.kind, "manual");

draft = manual.draft;
const jump = appendSelection(draft, "E", graph);
assert.strictEqual(jump.ok, true);
assert.strictEqual(jump.addedSegment.kind, "jump");
assert.deepStrictEqual(jump.addedSegment.stations, ["B", "D", "E"]);

const confirmed = confirmDraft(jump.draft, graph);
assert.deepStrictEqual(confirmed.path_stations, ["A", "B", "D", "E"]);
assert.deepStrictEqual(confirmed.path_edges, [0, 1, 4]);
assert.strictEqual(confirmed.transfers, 1);
assert.strictEqual(confirmed.distanceKm, 7);
assert.strictEqual(undoDraft(jump.draft).segments.length, 1);

let repeatDraft = appendSelection(createDraft("A"), "B", graph).draft;
repeatDraft = appendSelection(repeatDraft, "A", graph).draft;
assert.deepStrictEqual(confirmDraft(repeatDraft, graph).path_stations, ["A", "B", "A"]);

console.log("custom route contract ok");
