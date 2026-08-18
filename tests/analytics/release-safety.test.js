const assert = require("assert");
const fs = require("fs");

const ignore = fs.readFileSync(".gitignore", "utf8");
const config = fs.readFileSync("site-runtime.js", "utf8");
const indexHtml = fs.readFileSync("index.html", "utf8");
const dashboardHtml = fs.readFileSync("analytics-dashboard.html", "utf8");
const workerConfig = fs.readFileSync("analytics-worker/wrangler.toml", "utf8");
const workerSource = fs.readFileSync("analytics-worker/src/index.mjs", "utf8");

assert.match(ignore, /analytics-worker\/\.dev\.vars/);
assert.match(ignore, /analytics-worker\/\*\.sqlite/);
assert.match(ignore, /analytics-worker\/\.wrangler\//);
assert.match(workerConfig, /database_id\s*=\s*"REPLACE_WITH_D1_DATABASE_ID"/);
assert.doesNotMatch(workerConfig, /ANALYTICS_(?:ADMIN_PASSWORD|TOKEN_SECRET|VISITOR_HMAC_KEY)\s*=\s*[^\s<]/);
assert.match(workerSource, /ANALYTICS_ALLOWED_ORIGINS/);
assert.match(workerSource, /ANALYTICS_VISITOR_HMAC_KEY/);
assert.doesNotMatch(workerSource, /ANALYTICS_ADMIN_PASSWORD|ANALYTICS_TOKEN_SECRET|\/admin\/login|\/admin\/stats/);
assert.match(config, /endpoint:\s*"https:\/\/subway-longest-loop\.290573525\.workers\.dev"/);
assert.match(indexHtml, /<script src="site-runtime\.js"><\/script>/);
assert.match(dashboardHtml, /<script src="site-runtime\.js"><\/script>/);
assert.doesNotMatch(indexHtml, /analytics-config\.js/);
assert.doesNotMatch(dashboardHtml, /analytics-config\.js/);

console.log("analytics release safety tests passed");
