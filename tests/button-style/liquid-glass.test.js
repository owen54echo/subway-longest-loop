const assert = require("assert");
const fs = require("fs");

const css = fs.readFileSync("styles.css", "utf8");

assert.ok(css.includes("--button-glass-surface"), "Liquid Glass surface token is missing");
assert.ok(css.includes("--button-glass-edge"), "Liquid Glass edge token is missing");
assert.ok(css.includes(".button-glass-surface"), "Shared Liquid Glass button layer is missing");
assert.ok(css.includes("backdrop-filter: blur(18px) saturate(130%)"), "Button glass blur is missing");
assert.ok(css.includes("scale(1.02)"), "Button hover scale is missing");
assert.ok(css.includes("scale(0.96)"), "Button active scale is missing");
assert.ok(css.includes(".button-glass-surface:disabled"), "Button disabled state is missing");
assert.ok(css.includes("prefers-reduced-motion: reduce"), "Reduced motion handling is missing");
assert.ok(css.includes("--button-glass-primary"), "Primary glass state token is missing");
assert.ok(css.includes(".city-tab"), "City tabs must retain their dedicated selector");

console.log("liquid glass button contract ok");
