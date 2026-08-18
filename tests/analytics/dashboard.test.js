const assert = require("assert");
const fs = require("fs");

const html = fs.readFileSync("analytics-dashboard.html", "utf8");
const script = fs.readFileSync("analytics-dashboard.js", "utf8");
const css = fs.readFileSync("analytics-dashboard.css", "utf8");

assert.match(html, /id="analytics-app"/);
assert.doesNotMatch(html, /analytics-login-form|analytics-sign-out/);
assert.match(html, /id="metric-page-views"/);
assert.match(html, /id="analytics-trend-chart"/);
assert.match(html, /id="country-ranking"/);
assert.match(html, /id="tab-usage-list"/);
assert.match(html, /id="hour-usage-list"/);
assert.match(html, /data-range="7"/);
assert.match(html, /data-range="30"/);
assert.match(script, /textContent/);
assert.match(script, /\/stats\?from=/);
assert.doesNotMatch(script, /Authorization|sessionStorage|\/admin\/login|\/admin\/stats/);
assert.match(script, /custom-range/);
assert.match(script, /data\.hours/);
assert.doesNotMatch(html, /analytics-client\.js/);
assert.match(css, /--analytics-accent-cyan/);
assert.match(css, /@media \(max-width: 700px\)/);

console.log("analytics dashboard contract tests passed");
