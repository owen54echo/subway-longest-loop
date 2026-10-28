const assert = require("assert");
const fs = require("fs");

const windowLike = {};
new Function("window", fs.readFileSync("line-badge-layout.js", "utf8"))(windowLike);
const { place, intersects } = windowLike.LineBadgeLayout;

const candidates = [
    { id: "red-a", line: "1号线", x: 100, y: 100, width: 42, height: 18, priority: 80, slots: [[0, -22], [0, 22]] },
    { id: "red-b", line: "1号线", x: 130, y: 100, width: 42, height: 18, priority: 70, slots: [[0, -22], [0, 22]] },
    { id: "blue-a", line: "2号线", x: 190, y: 100, width: 42, height: 18, priority: 60, slots: [[0, -22], [0, 22]] }
];

const result = place(candidates, [{ left: 70, top: 60, right: 160, bottom: 90 }], { maxPerLine: 1 });
assert.strictEqual(result.placed.filter(item => item.line === "1号线").length, 1);
assert.strictEqual(result.placed.filter(item => item.line === "2号线").length, 1);
for (let index = 0; index < result.placed.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < result.placed.length; nextIndex += 1) {
        assert.ok(!intersects(result.placed[index].rect, result.placed[nextIndex].rect));
    }
}
assert.ok(result.deferred.includes("red-b"));

const segmentResult = place([
    { id: "segment", line: "3号线", x: 100, y: 100, width: 30, height: 14, priority: 1, slots: [[0, 0, "on-line"], [0, 40, "safe"]] }
], [], {
    maxPerLine: 1,
    blockedSegments: [{ x1: 80, y1: 100, x2: 120, y2: 100, padding: 2 }]
});
assert.strictEqual(segmentResult.placed[0].slot, "safe");
console.log("line badge layout contract ok");
