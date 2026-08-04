const assert = require("assert");
const fs = require("fs");

const windowLike = {};
new Function("window", fs.readFileSync("solver-progress.js", "utf8"))(windowLike);

const { createPromptScheduler, formatElapsed } = windowLike.SolverProgress;

assert.strictEqual(formatElapsed(0), "00:00");
assert.strictEqual(formatElapsed(181000), "03:01");
assert.strictEqual(formatElapsed(3661000), "61:01");

let nowMs = 0;
let nextIntervalId = 0;
const intervals = new Map();
const elapsedTicks = [];
const prompts = [];
const scheduler = createPromptScheduler({
    now: () => nowMs,
    setIntervalFn(callback) {
        const id = ++nextIntervalId;
        intervals.set(id, callback);
        return id;
    },
    clearIntervalFn(id) {
        intervals.delete(id);
    },
    onTick(elapsed) {
        elapsedTicks.push(elapsed);
    },
    onPrompt(elapsed) {
        prompts.push(elapsed);
    }
});

function tickAt(milliseconds) {
    nowMs = milliseconds;
    for (const callback of intervals.values()) callback();
}

scheduler.start();
assert.deepStrictEqual(elapsedTicks, [0]);
assert.strictEqual(intervals.size, 1);

tickAt(179000);
assert.deepStrictEqual(prompts, []);
tickAt(180000);
assert.deepStrictEqual(prompts, [180000]);
tickAt(181000);
assert.deepStrictEqual(prompts, [180000], "An open decision must not duplicate prompts");

scheduler.continueWaiting();
tickAt(240000);
assert.deepStrictEqual(prompts, [180000]);
tickAt(241000);
assert.deepStrictEqual(prompts, [180000, 241000]);

scheduler.stop();
assert.strictEqual(intervals.size, 0);
console.log("solver progress contract ok");
