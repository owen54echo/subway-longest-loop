const assert = require("assert");
const fs = require("fs");

const ignore = fs.readFileSync(".gitignore", "utf8");
const config = fs.readFileSync("analytics-config.js", "utf8");
const workerConfig = fs.readFileSync("analytics-worker/wrangler.toml", "utf8");

assert.match(ignore, /analytics-worker\/\.dev\.vars/);
assert.match(ignore, /analytics-worker\/\*\.sqlite/);
assert.match(ignore, /analytics-worker\/\.wrangler\//);
assert.match(workerConfig, /database_id\s*=\s*"REPLACE_WITH_D1_DATABASE_ID"/);
assert.doesNotMatch(workerConfig, /ANALYTICS_(?:ADMIN_PASSWORD|TOKEN_SECRET|VISITOR_HMAC_KEY)\s*=\s*[^\s<]/);
assert.match(config, /endpoint:\s*"\/analytics-api"/);

console.log("analytics release safety tests passed");
