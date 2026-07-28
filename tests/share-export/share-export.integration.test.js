const assert = require("assert");
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");

assert.ok(html.includes('id="btn-roadbook-share"'), "Roadbook share trigger is missing");
assert.ok(html.includes('id="share-sheet"'), "Share sheet is missing");
assert.ok(html.includes('data-share-mode="compact"'), "Compact share mode is missing");
assert.ok(html.includes('data-share-mode="normal"'), "Normal share mode is missing");
assert.ok(html.includes('data-share-mode="complete"'), "Complete share mode is missing");
assert.ok(html.includes("function openShareSheet()"), "Share sheet open flow is missing");
assert.ok(html.includes("function exportShareImage("), "PNG export flow is missing");
assert.ok(html.includes("function printCompleteShare()"), "Print-to-PDF flow is missing");
assert.ok(html.includes("function createShareThumbnailMap("), "Route-focused thumbnail map is missing");
assert.ok(html.includes("function wrapShareText("), "Long share text wrapping is missing");
assert.ok(html.includes("MAX_THUMBNAIL_LABELS"), "Thumbnail label density limit is missing");
assert.ok(html.includes('thumbnailHeight = hasThumbnail ? (model.mode === "complete" ? 340 : 300) : 0'), "Thumbnail should use the larger share-card layout");

console.log("route share integration contract ok");
