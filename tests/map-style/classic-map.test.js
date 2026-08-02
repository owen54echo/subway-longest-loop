const assert = require("assert");
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("styles.css", "utf8");

assert.ok(!html.includes("guangzhou_basemap.js"), "Guangzhou geography script is still loaded");
assert.ok(!html.includes("geography-water-group"), "Geography SVG groups are still rendered");
assert.ok(!css.includes("--geography-"), "Geography theme tokens are still present");

assert.ok(html.includes('line.setAttribute("class", "metro-line")'), "Shared metro-line class is missing");
assert.ok(html.includes('line.setAttribute("stroke-width", "4.5")'), "Classic base line width is missing");
assert.ok(html.includes('line.setAttribute("stroke-linecap", "round")'), "Classic line caps are missing");
assert.ok(html.includes('showOfficialLineColors ? "0.92" : "0.78"'), "Gray network contrast is too low");
assert.ok(css.includes("--base-line-color: #686a70"), "Dark gray network token is too dark");
assert.ok(html.includes('circle.setAttribute("r", "4.2")'), "Classic ordinary station radius is missing");
assert.ok(html.includes('circle.setAttribute("r", "6.5")'), "Classic transfer station radius is missing");
assert.ok(html.includes("station-marker-inner"), "Transfer inner ring is missing");
assert.ok(html.includes("station-label-transfer"), "Transfer label class is missing");
assert.ok(!html.includes("map-style-a") && !html.includes("map-style-b"), "Withdrawn A/B switch leaked into the renderer");
assert.ok(html.includes('id="nav-custom-route"'), "Custom route navigation is missing");
assert.ok(html.includes('id="pane-custom-route"'), "Custom route editor pane is missing");
assert.ok(html.includes('src="mobile-map-interaction.js"'), "Mobile map interaction helper is not loaded");
assert.ok(html.includes('src="custom-route.js"'), "Custom route module is not loaded");
assert.ok(html.includes('id="btn-custom-route-drawer-toggle"'), "Custom route compact drawer toggle is missing");
assert.ok(html.includes('id="custom-route-compact-count"'), "Compact custom route station count is missing");
assert.ok(html.includes('hitArea.setAttribute("class", "station-hit-area")'), "Transparent mobile station hit area is missing");
assert.ok(html.includes("drawer-custom-route-collapsed"), "Compact custom drawer state is not integrated");
assert.ok(html.includes('src="station-label-layout.js"'), "Label layout module is not loaded");
assert.ok(html.includes("function refreshStationLabels()"), "Collision-aware label refresh hook is missing");
assert.ok(html.includes("window.StationLabelLayout.place"), "Map does not use collision-free label layout");
assert.ok(!html.includes('leader.setAttribute("class", "station-label-leader")'), "Station label leader lines should not be rendered");
assert.ok(css.includes(".station-hit-area"), "Station touch target style is missing");
assert.ok(css.includes("drawer-custom-route-active.drawer-custom-route-collapsed"), "Compact custom drawer style is missing");
assert.ok(css.includes("height: 96px"), "Compact custom drawer height is missing");

console.log("classic shared map contract ok");
