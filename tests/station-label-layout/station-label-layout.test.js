const assert = require("assert");
const fs = require("fs");

const windowLike = {};
new Function("window", fs.readFileSync("station-label-layout.js", "utf8"))(windowLike);

const { place, intersects } = windowLike.StationLabelLayout;
const candidates = [
    { id: "transfer", x: 100, y: 100, width: 38, height: 12, priority: 100 },
    { id: "local-a", x: 103, y: 101, width: 34, height: 12, priority: 10 },
    { id: "local-b", x: 106, y: 102, width: 34, height: 12, priority: 10 }
];

const layout = place(candidates, []);
assert.ok(layout.placed.some(item => item.id === "transfer"));
for (let index = 0; index < layout.placed.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < layout.placed.length; nextIndex += 1) {
        assert.ok(!intersects(layout.placed[index].rect, layout.placed[nextIndex].rect));
    }
}
assert.ok(layout.deferred.every(id => !layout.placed.some(item => item.id === id)));

const blocked = [{ left: 80, top: 70, right: 150, bottom: 130 }];
assert.strictEqual(
    place([{ id: "only", x: 100, y: 100, width: 30, height: 10, priority: 1 }], blocked).placed.length,
    0
);
assert.deepStrictEqual(
    place([...candidates].reverse(), []).placed.map(item => item.id),
    layout.placed.map(item => item.id)
);

console.log("station label layout contract ok");
