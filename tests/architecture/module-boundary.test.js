const assert = require("assert");
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");
const scriptOrder = [
    "topology-rules.js",
    "route-rules.js",
    "solver-contract.js",
    "city-registry.js",
    "calculation-topology.js",
    "custom-route.js"
];
let previousIndex = -1;
for (const script of scriptOrder) {
    const index = html.indexOf(`src="${script}"`);
    assert(index > previousIndex, `${script} must be loaded after its dependencies`);
    previousIndex = index;
}
assert(!fs.existsSync("longest_path_solver.py"), "legacy Python solver must not be part of the active project");
assert(!fs.existsSync("run_regression_tests.py"), "legacy Python regression runner must not be part of the active project");

console.log("architecture boundary contract ok");
