const assert = require("assert");
const fs = require("fs");

const workerCode = fs.readFileSync("solver-worker.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");

assert(workerCode.includes("config.timeout === null ? Infinity"), "Worker must support an unbounded exact-search timeout");
assert(html.includes("timeout: null"), "Interactive planning must request unbounded exact search");
assert(
    html.includes("finishCurrentBestSearch") && html.includes("isApproximate: true"),
    "Interactive planning must expose the current-best route as a valid fallback"
);

console.log("exact fixed-endpoint contract ok");
