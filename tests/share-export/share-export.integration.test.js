const assert = require("assert");
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("styles.css", "utf8");

assert.ok(html.includes('id="btn-roadbook-share"'), "Roadbook share trigger is missing");
assert.ok(html.includes('id="share-sheet"'), "Share sheet is missing");
assert.ok(html.includes('data-share-mode="compact"'), "Compact share mode is missing");
assert.ok(html.includes('data-share-mode="normal"'), "Normal share mode is missing");
assert.ok(html.includes('data-share-mode="complete"'), "Complete share mode is missing");
assert.ok(html.includes('data-share-mode="normal" role="tab">详细'), "Normal share mode should be renamed to detailed");
assert.ok(html.includes("function openShareSheet()"), "Share sheet open flow is missing");
assert.ok(html.includes("function exportShareImage("), "PNG export flow is missing");
assert.ok(html.includes("function printCompleteShare()"), "Print-to-PDF flow is missing");
assert.ok(html.includes("function createShareThumbnailMap("), "Route-focused thumbnail map is missing");
assert.ok(html.includes("function wrapShareText("), "Long share text wrapping is missing");
assert.ok(html.includes("MAX_THUMBNAIL_LABELS"), "Thumbnail label density limit is missing");
assert.ok(html.includes("thumbnailHeight = hasThumbnail ? 300 : 0"), "Detailed share should use the larger share-card layout");
assert.ok(html.includes("function createCompleteShareSvg("), "Complete share needs a dedicated wide export canvas");
assert.ok(html.includes('id="btn-share-expand"'), "Complete share needs an original-size viewer trigger");
assert.ok(html.includes('id="route-approximation-badge"'), "The route book must expose the approximation marker");
assert.ok(html.includes("isApproximate: result.isApproximate"), "Share snapshots must receive approximation state from the displayed route");
assert.ok(html.includes('hidden = !Boolean(result.isApproximate)'), "Exact route rendering must hide the approximation marker");
assert.ok(html.includes('class="route-approximation-ring"'), "The route book must use the dashed-ring current-best marker");
assert.ok(html.includes('stroke-dasharray="5 4"'), "Shared SVG cards must use the static dashed-ring marker");
assert.ok(!html.includes('font-family="STKaiti, KaiTi, cursive"'), "Shared SVG cards must not render the retired handwriting marker");
assert.ok(css.includes(".route-approximation-badge"), "The route book approximation marker needs dedicated styling");
assert.ok(css.includes(".share-sheet :is(.share-mode-tab, .share-sheet-actions button, .drawer-close)"), "Share sheet controls need their own glass surface");
assert.ok(css.includes(".share-sheet .share-mode-tab.active"), "Share mode active state needs a glass treatment");
assert.ok(css.includes(".share-sheet .share-sheet-actions .btn-primary"), "Share sheet primary action needs a glass treatment");
assert.ok(css.includes("justify-content: center"), "Share controls need centered text alignment");

console.log("route share integration contract ok");
