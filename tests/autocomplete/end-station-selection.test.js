const assert = require("assert");
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");

assert(html.includes("function setupAutocomplete(inputId, boxId, getSearchItemsFn, selectCallback, clearAfterSelection = true)"));
assert(html.includes("if (clearAfterSelection) input.value = \"\";"));
assert(html.includes('setupAutocomplete("search-end-input", "end-suggestions", () => stationNames, setEndStation, false)'));

console.log("end station autocomplete contract ok");
