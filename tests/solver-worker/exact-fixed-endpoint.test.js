const assert = require("assert");
const fs = require("fs");

const workerCode = fs.readFileSync("solver-worker.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");

assert(workerCode.includes("config.timeout === null ? Infinity"), "Worker must support an unbounded exact-search timeout");
assert(html.includes("timeout: null"), "Interactive planning must request unbounded exact search");
assert(
    /if \(msg\.timeout_reached\)[\s\S]{0,500}cleanupSolverSession\(\);[\s\S]{0,300}return;[\s\S]{0,500}if \(msg\.weight > \(bestResult\?\.weight \?\? -1\)\) bestResult = msg;/.test(html),
    "Interactive planning must discard a timed-out root result before it can become the final route"
);

console.log("exact fixed-endpoint contract ok");
