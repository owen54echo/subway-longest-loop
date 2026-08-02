const assert = require("assert");
const fs = require("fs");

const windowLike = {};
new Function("window", fs.readFileSync("mobile-map-interaction.js", "utf8"))(windowLike);

const { createDeferredRefresh, shouldUseCompactCustomDrawer, getPanUnitsPerCssPixel } = windowLike.MobileMapInteraction;
let nextTimerId = 0;
const timers = new Map();
let refreshCount = 0;
const refresh = createDeferredRefresh(() => { refreshCount += 1; }, {
    delay: 120,
    setTimeout(callback) {
        const id = ++nextTimerId;
        timers.set(id, callback);
        return id;
    },
    clearTimeout(id) {
        timers.delete(id);
    }
});

refresh.schedule();
refresh.schedule();
assert.strictEqual(timers.size, 1);
const [scheduledTimerId, scheduledCallback] = timers.entries().next().value;
timers.delete(scheduledTimerId);
scheduledCallback();
assert.strictEqual(refreshCount, 1);

refresh.schedule();
refresh.flush();
assert.strictEqual(refreshCount, 2);
assert.strictEqual(timers.size, 0);

assert.strictEqual(shouldUseCompactCustomDrawer(true, 390), true);
assert.strictEqual(shouldUseCompactCustomDrawer(true, 1025), false);
assert.strictEqual(shouldUseCompactCustomDrawer(false, 390), false);

assert.deepStrictEqual(
    getPanUnitsPerCssPixel({ width: 1200, height: 900 }, { width: 400, height: 300 }),
    { x: 3, y: 3 }
);
assert.deepStrictEqual(getPanUnitsPerCssPixel(null, { width: 400, height: 300 }), { x: 1, y: 1 });

console.log("mobile map interaction contract ok");
