const assert = require("assert");
const fs = require("fs");

const workerCode = fs.readFileSync("solver-worker.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");

assert(workerCode.includes("config.timeout === null ? Infinity"), "Worker must support an unbounded exact-search timeout");
assert(html.includes("timeout: null"), "Interactive planning must request unbounded exact search");
assert(
    /if \(result\.timeout_reached\)[\s\S]{0,500}return;[\s\S]{0,600}displayResults\(result, solverConfig\.edges\)/.test(html),
    "Interactive planning must not display a timed-out candidate as the final route"
);

console.log("exact fixed-endpoint contract ok");
