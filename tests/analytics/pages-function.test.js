const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const config = fs.readFileSync(path.join(root, "analytics-config.js"), "utf8");
const adapter = fs.readFileSync(path.join(root, "functions/analytics-api/[[path]].js"), "utf8");

if (!config.includes('endpoint: "https://subway-longest-loop.290573525.workers.dev"')) throw new Error("dashboard must use the deployed Worker endpoint");
if (!adapter.includes('replace(/^\\/analytics-api(?=\\/|$)/')) throw new Error("Pages adapter must strip its route prefix");
if (!adapter.includes("createWorker")) throw new Error("Pages adapter must reuse the Worker implementation");
if (!adapter.includes("headers.set(\"origin\", sourceUrl.origin)")) throw new Error("Pages adapter must establish the trusted same-origin request");
console.log("Pages analytics function contract tests passed");
