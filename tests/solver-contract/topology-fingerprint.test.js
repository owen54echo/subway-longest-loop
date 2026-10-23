const assert = require("assert");
const contract = require("../../solver-contract.js");

const nodes = [{ name: "A" }, { name: "B" }];
const first = [{ u: "A", v: "B", line: "1号线", straightLengthKm: 1.234 }];
const reversed = [{ u: "B", v: "A", line: "1号线", straightLengthKm: 1.234 }];
const changed = [{ u: "A", v: "B", line: "1号线", straightLengthKm: 1.235 }];

assert.strictEqual(contract.topologyFingerprint(nodes, first), contract.topologyFingerprint(nodes, reversed));
assert.notStrictEqual(contract.topologyFingerprint(nodes, first), contract.topologyFingerprint(nodes, changed));
console.log("topology fingerprint contract ok");
