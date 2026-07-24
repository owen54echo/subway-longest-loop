const assert = require("assert");
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("styles.css", "utf8");

assert.ok(html.includes("function setCruiseMapMode(isActive)"), "Cruise map-mode helper is missing");
assert.ok(/function stopCruise\(\)[\s\S]{0,300}setCruiseMapMode\(false\)/.test(html), "Cruise exit does not restore the map");
assert.ok(/function startCruise\(\)[\s\S]{0,3000}setCruiseMapMode\(true\)/.test(html), "Cruise start does not focus the map");
assert.ok(html.includes('id="cruise-progress-bar"'), "Cruise progress bar is missing");
assert.ok(html.includes('role="progressbar"'), "Cruise progress is not accessible");
assert.ok(html.includes("train-marker-core"), "Classic train marker is missing");
assert.ok(!html.includes("animated-flow-line"), "Withdrawn dashed route animation remains");
assert.ok(css.includes(".map-section.cruise-map-mode"), "Cruise map focus styles are missing");
assert.ok(
    html.includes('appContainer.classList.toggle("cruise-map-mode", isActive)'),
    "Cruise mode is not applied to the shared app shell"
);
assert.ok(
    css.includes(".app-container.cruise-map-mode .bottom-nav-bar"),
    "Cruise mode cannot hide controls outside the map section"
);
assert.ok(
    /function focusMapOn\(tx, ty\)[\s\S]{0,300}viewBox\.baseVal/.test(html),
    "Cruise tracking mixes CSS pixels with SVG viewBox coordinates"
);
assert.ok(html.includes("cruisePreviousViewport"), "Cruise mode does not preserve the previous map viewport");
assert.ok(html.includes("const CRUISE_MIN_SCALE = 4.0"), "Cruise mode does not provide an immersive local-route zoom");
assert.ok(
    /function stopCruise\(\)[\s\S]{0,500}cruisePreviousViewport[\s\S]{0,300}updateViewportTransform\(\)/.test(html),
    "Cruise exit does not restore the previous map viewport"
);

console.log("classic cruise mode contract ok");
