const assert = require("assert");
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("styles.css", "utf8");

assert.ok(html.includes("viewport-fit=cover"), "Viewport metadata must expose the safe-area inset");
assert.ok(css.includes("--app-viewport-height: 100dvh"), "Dynamic viewport height fallback is missing");
assert.ok(css.includes("height: var(--app-viewport-height)"), "App shell must use the dynamic viewport height");
assert.ok(css.includes("--mobile-bottom-inset: max(12px, calc(env(safe-area-inset-bottom) + 12px))"), "Mobile bottom safe-area inset is missing");
assert.ok(css.includes("bottom: var(--mobile-bottom-inset)"), "Bottom navigation must honor the mobile inset");
assert.ok(css.includes("bottom: var(--mobile-bottom-nav-clearance)"), "Mobile drawer must clear the bottom navigation");

console.log("iOS bottom toolbar viewport contract ok");
