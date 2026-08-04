const assert = require("assert");
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("styles.css", "utf8");

assert.ok(html.includes('<script src="solver-progress.js"></script>'), "The page must load the calculation timer module");
assert.ok(html.includes('id="solver-elapsed-time"'), "The loading overlay must show elapsed calculation time");
assert.ok(html.includes('id="solver-decision-dialog"'), "The loading overlay must contain the current-best decision dialog");
assert.ok(html.includes('id="btn-use-current-best"'), "A valid candidate must be selectable from the decision dialog");
assert.ok(html.includes('id="btn-continue-solver"'), "The decision dialog must let the user continue waiting");
assert.ok(html.includes('id="btn-cancel-decision"'), "The decision dialog must support cancelling when no candidate exists");
assert.ok(html.includes('function cleanupSolverSession()'), "Calculation cleanup must be shared by cancel, accept, error, and completion flows");
assert.ok(html.includes('function finishCurrentBestSearch()'), "The current-best action must have a dedicated terminal flow");
assert.ok(html.includes('msg.type === "incumbent"'), "The page must aggregate improved Worker candidates");
assert.ok(html.includes('isApproximate: true'), "Accepted candidates must be marked before entering the normal route-book renderer");
assert.ok(css.includes('.solver-decision-dialog'), "The decision dialog needs its own responsive visual treatment");
assert.ok(css.includes('@media (max-width: 480px)'), "The decision dialog needs a narrow mobile layout");

console.log("solver progress page integration contract ok");
