# Mobile Custom Route Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make mobile custom-route planning map-first, easier to select stations from, and responsive when the map is zoomed out.

**Architecture:** Keep route calculation in `custom-route.js` unchanged. Add a small `mobile-map-interaction.js` browser helper that owns deferred station-label refresh scheduling and mobile drawer state decisions; the existing inline application script consumes that helper. CSS applies the compact drawer layout only below the existing mobile breakpoint.

**Tech Stack:** Static HTML, CSS, browser Pointer Events, SVG, Node.js `assert` tests.

## Global Constraints

- Preserve custom-route station ordering, repeated-station support, minimum-stop auto-fill, and roadbook confirmation behavior.
- Do not add dependencies or change desktop map interaction.
- Do not alter `custom-route.js` graph calculation or confirmation contracts.
- Keep the mobile compact drawer at about 96px high, with station count, undo, and confirm available.
- Defer label layout while a map gesture is active; refresh after a 120ms pause or immediately when the final pointer ends.

---

## File Structure

- Create: `mobile-map-interaction.js` - pure helpers for deferred label refresh and compact-drawer eligibility.
- Create: `tests/mobile-map-interaction/mobile-map-interaction.test.js` - direct Node contract tests for the new helper.
- Modify: `index.html` - loads the helper, renders a transparent station hit target, integrates deferred refresh, compact drawer state, and compact summary UI.
- Modify: `styles.css` - mobile-only compact custom-route drawer and invisible SVG hit target styles.
- Modify: `tests/map-style/classic-map.test.js` - static integration contract for the helper, compact drawer markup, and hit target.

### Task 1: Testable Mobile Interaction Helper

**Files:**
- Create: `tests/mobile-map-interaction/mobile-map-interaction.test.js`
- Create: `mobile-map-interaction.js`

**Interfaces:**
- Produces: `window.MobileMapInteraction.createDeferredRefresh(refresh, options)` returning `{ schedule(), flush(), cancel() }`.
- Produces: `window.MobileMapInteraction.shouldUseCompactCustomDrawer(isCustomRouteMode, viewportWidth)` returning a boolean.
- Consumes: injected `setTimeout` and `clearTimeout` functions for deterministic tests.

- [ ] **Step 1: Write the failing helper contract test**

```js
const assert = require("assert");
const fs = require("fs");

const windowLike = {};
new Function("window", fs.readFileSync("mobile-map-interaction.js", "utf8"))(windowLike);

const { createDeferredRefresh, shouldUseCompactCustomDrawer } = windowLike.MobileMapInteraction;
let nextTimerId = 0;
const timers = new Map();
let refreshCount = 0;
const refresh = createDeferredRefresh(() => { refreshCount += 1; }, {
    delay: 120,
    setTimeout(callback) { const id = ++nextTimerId; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); }
});

refresh.schedule();
refresh.schedule();
assert.strictEqual(timers.size, 1);
[...timers.values()][0]();
assert.strictEqual(refreshCount, 1);
refresh.schedule();
refresh.flush();
assert.strictEqual(refreshCount, 2);
assert.strictEqual(timers.size, 0);
assert.strictEqual(shouldUseCompactCustomDrawer(true, 390), true);
assert.strictEqual(shouldUseCompactCustomDrawer(true, 1025), false);
assert.strictEqual(shouldUseCompactCustomDrawer(false, 390), false);

console.log("mobile map interaction contract ok");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/mobile-map-interaction/mobile-map-interaction.test.js`

Expected: failure because `mobile-map-interaction.js` does not exist.

- [ ] **Step 3: Write the minimal helper**

```js
(function (global) {
    function createDeferredRefresh(refresh, options = {}) {
        const delay = options.delay ?? 120;
        const setTimer = options.setTimeout || window.setTimeout.bind(window);
        const clearTimer = options.clearTimeout || window.clearTimeout.bind(window);
        let timerId = null;

        function run() {
            timerId = null;
            refresh();
        }

        return {
            schedule() {
                if (timerId !== null) clearTimer(timerId);
                timerId = setTimer(run, delay);
            },
            flush() {
                if (timerId !== null) clearTimer(timerId);
                if (timerId !== null) {
                    timerId = null;
                    refresh();
                }
            },
            cancel() {
                if (timerId !== null) clearTimer(timerId);
                timerId = null;
            }
        };
    }

    function shouldUseCompactCustomDrawer(isCustomRouteMode, viewportWidth) {
        return Boolean(isCustomRouteMode && viewportWidth <= 1024);
    }

    global.MobileMapInteraction = { createDeferredRefresh, shouldUseCompactCustomDrawer };
})(window);
```

- [ ] **Step 4: Run the helper test to verify it passes**

Run: `node tests/mobile-map-interaction/mobile-map-interaction.test.js`

Expected: `mobile map interaction contract ok`.

- [ ] **Step 5: Commit**

```bash
git add mobile-map-interaction.js tests/mobile-map-interaction/mobile-map-interaction.test.js
git commit -m "feat: add mobile map interaction helpers"
```

### Task 2: Integrate Map-First Custom Route Interaction

**Files:**
- Modify: `index.html:322-334`
- Modify: `index.html:620-622`
- Modify: `index.html:747-852`
- Modify: `index.html:977-1105`
- Modify: `index.html:1245-1415`
- Modify: `tests/map-style/classic-map.test.js`

**Interfaces:**
- Consumes: `window.MobileMapInteraction.createDeferredRefresh` and `shouldUseCompactCustomDrawer` from Task 1.
- Produces: `.drawer-custom-route-collapsed` when a mobile custom-route drawer is compact.
- Produces: `#custom-route-compact-count` and `#btn-custom-route-drawer-toggle`.

- [ ] **Step 1: Extend the existing static map contract before implementation**

Add these assertions to `tests/map-style/classic-map.test.js`:

```js
assert.ok(html.includes('src="mobile-map-interaction.js"'), "Mobile map interaction helper is not loaded");
assert.ok(html.includes('id="btn-custom-route-drawer-toggle"'), "Custom route compact drawer toggle is missing");
assert.ok(html.includes('id="custom-route-compact-count"'), "Compact custom route station count is missing");
assert.ok(html.includes('class="station-hit-area"'), "Transparent mobile station hit area is missing");
assert.ok(html.includes("drawer-custom-route-collapsed"), "Compact custom drawer state is not integrated");
```

- [ ] **Step 2: Run the static contract to verify it fails**

Run: `node tests/map-style/classic-map.test.js`

Expected: failure stating that the mobile helper is not loaded.

- [ ] **Step 3: Add the compact UI and integrate the helper**

Load the helper immediately before `custom-route.js`:

```html
<script src="mobile-map-interaction.js"></script>
<script src="custom-route.js"></script>
```

Add this compact summary as the first child of `#pane-custom-route`:

```html
<button id="btn-custom-route-drawer-toggle" class="custom-route-compact-summary" type="button">
    <span id="custom-route-compact-count">已选 0 站</span>
    <span aria-hidden="true">展开</span>
</button>
```

Before appending the visible station marker in `renderSvgMap`, append a transparent group-level target:

```js
const hitArea = document.createElementNS("http://www.w3.org/2000/svg", "circle");
hitArea.setAttribute("cx", node.x);
hitArea.setAttribute("cy", node.y);
hitArea.setAttribute("r", isTransfer ? "14" : "12");
hitArea.setAttribute("class", "station-hit-area");
stationGroup.appendChild(hitArea);
```

After `refreshStationLabels` is declared, add:

```js
const deferredLabelRefresh = window.MobileMapInteraction.createDeferredRefresh(refreshStationLabels);

function updateMapDuringGesture() {
    updateViewportTransform({ refreshLabels: false });
    deferredLabelRefresh.schedule();
}

function setCustomRouteDrawerCollapsed(collapsed) {
    const compact = collapsed && window.MobileMapInteraction.shouldUseCompactCustomDrawer(isCustomRouteMode, window.innerWidth);
    drawer.classList.toggle("drawer-custom-route-collapsed", compact);
}
```

Update `updateViewportTransform` to accept `{ refreshLabels = true } = {}` and call label layout only when requested. Replace pointer-move and wheel refreshes with `updateMapDuringGesture()`. When the last pointer ends, call `deferredLabelRefresh.flush()`; retain immediate layout refreshes for buttons, rendering, and selection changes.

In `refreshCustomRouteEditor`, update the compact count using the same confirmed path count shown in the expanded statistics:

```js
document.getElementById("custom-route-compact-count").textContent =
    `已选 ${confirmed?.path_stations.length || (customRouteDraft.start ? 1 : 0)} 站`;
```

When `openDrawer("drawer-custom-route", ...)` runs, call `setCustomRouteDrawerCollapsed(true)`. Remove the compact class when closing or leaving custom mode. Bind the compact summary click to expand and extend the existing drawer-header swipe handling: upward expands and downward collapses the custom drawer.

- [ ] **Step 4: Run focused contracts**

```bash
node tests/mobile-map-interaction/mobile-map-interaction.test.js
node tests/map-style/classic-map.test.js
```

Expected: both commands exit with code `0`.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/map-style/classic-map.test.js
git commit -m "feat: prioritize mobile custom route map"
```

### Task 3: Apply Mobile Drawer and Hit-Target Styling

**Files:**
- Modify: `styles.css:1100-1160`
- Modify: `styles.css:1350-1410`
- Modify: `styles.css:1510-1585`

**Interfaces:**
- Consumes: `.drawer-custom-route-active`, `.drawer-custom-route-collapsed`, `.custom-route-compact-summary`, and `.station-hit-area`.
- Produces: an approximately 96px tall mobile compact drawer, with only station count, undo, and confirm visible.

- [ ] **Step 1: Add mobile-only CSS for the compact drawer and transparent target**

Add base styles outside media queries:

```css
.station-hit-area {
    fill: transparent;
    stroke: transparent;
    pointer-events: all;
}

.custom-route-compact-summary {
    display: none;
}
```

Within the existing `@media (max-width: 1024px)` block, add:

```css
.floating-drawer.drawer-custom-route-active.drawer-custom-route-collapsed {
    height: 96px;
    overflow: hidden;
}

.drawer-custom-route-collapsed .drawer-header,
.drawer-custom-route-collapsed #custom-route-summary,
.drawer-custom-route-collapsed #pane-custom-route .stats-grid,
.drawer-custom-route-collapsed #btn-custom-clear {
    display: none !important;
}

.drawer-custom-route-collapsed #pane-custom-route {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 8px;
    height: 100%;
}

.drawer-custom-route-collapsed .custom-route-compact-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-width: 0;
    padding: 8px 10px;
    font-size: 12px;
}

.drawer-custom-route-collapsed .custom-route-actions {
    display: contents;
}

.drawer-custom-route-collapsed #btn-custom-undo,
.drawer-custom-route-collapsed #btn-custom-confirm {
    min-height: 44px;
    white-space: nowrap;
}
```

- [ ] **Step 2: Run the static map contract after styling**

Run: `node tests/map-style/classic-map.test.js`

Expected: exit code `0`.

- [ ] **Step 3: Run the full regression suite**

```bash
node tests/custom-route/custom-route.test.js
node tests/station-label-layout/station-label-layout.test.js
node tests/mobile-map-interaction/mobile-map-interaction.test.js
node tests/share-export/share-export.test.js
node tests/share-export/share-export.integration.test.js
node tests/map-style/classic-map.test.js
node tests/map-style/cruise-mode.test.js
node run_regression_tests.js
```

Expected: every command exits with code `0`; the solver regression command reports all cases successful.

- [ ] **Step 4: Verify responsive interaction in a browser**

At 390px and 430px widths:

1. Enter 自定义 mode and confirm the drawer opens compact, with a larger visible map.
2. Select a dense-map station through the enlarged target; confirm the selected count changes.
3. Click the compact summary to expand; swipe the drawer header down to compact it again.
4. Zoom out to the minimum, drag continuously, then release; confirm the map tracks the finger without label-layout jank and labels refresh on release.
5. Confirm a draft route and verify normal 路书 opens.

At a desktop width above 1024px, confirm the custom-route drawer remains expanded and station interaction remains unchanged.

- [ ] **Step 5: Commit after verification**

```bash
git add styles.css
git commit -m "style: optimize mobile custom route drawer"
```

## Plan Self-Review

- Spec coverage: Task 2 provides compact state, map gesture deferral, station hit areas, and route confirmation preservation. Task 3 provides the mobile layout and responsive verification. Task 1 provides direct behavioral coverage for timing logic.
- Placeholder scan: no unresolved implementation placeholders remain.
- Type consistency: `MobileMapInteraction`, `createDeferredRefresh`, and `shouldUseCompactCustomDrawer` use the same names in all tasks.
