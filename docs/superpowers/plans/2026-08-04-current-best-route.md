# Current Best Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users accept a valid current-best route after three minutes of exact browser computation while retaining the exact-result flow for calculations that finish.

**Architecture:** `solver-worker.js` emits a full incumbent only when its local optimum improves. A small `solver-progress.js` module owns elapsed time and the three-minute/one-minute decision schedule. `index.html` aggregates incumbent messages across root Workers, owns terminal session cleanup, and routes an accepted candidate through the existing `displayResults` pipeline with `isApproximate: true`.

**Tech Stack:** Vanilla JavaScript, Web Workers, CSS, Node `assert` tests.

## Global Constraints

- A route selected before all Workers finish is valid under every selected route rule but is not a proven global optimum.
- The visible unfinished-result marker is only a compact framed handwriting-style `近似` label; explanatory text is available through accessible labels/tooltips.
- First prompt is at 180 seconds; after `继续计算`, the next prompt is 60 seconds later.
- Exact completed results keep their existing rendering and do not show the `近似` label.
- No external dependency, server, or new font download is introduced.
- Starting another calculation, cancelling, accepting a candidate, erroring, or completing clears every session timer and ignores late Worker messages.

---

### Task 1: Worker incumbent messages and timer controller

**Files:**
- Create: `solver-progress.js`
- Create: `tests/solver-progress/solver-progress.test.js`
- Modify: `solver-worker.js:519-780`
- Modify: `tests/solver-worker/corridor-reduction.test.js`

**Interfaces:**
- Produces `window.SolverProgress.formatElapsed(milliseconds): string`.
- Produces `window.SolverProgress.createPromptScheduler(options)` with `start()`, `continueWaiting()`, and `stop()`.
- Produces Worker messages `{ type: "incumbent", path_edges, path_stations, weight, search_stats }` only for a strict incumbent improvement.

- [x] **Step 1: Write failing timer and incumbent tests**

```js
const { createPromptScheduler, formatElapsed } = windowLike.SolverProgress;
assert.strictEqual(formatElapsed(181000), "03:01");

const scheduler = createPromptScheduler({ now, setInterval, clearInterval, onTick, onPrompt });
scheduler.start();
advanceTo(180000);
assert.deepStrictEqual(prompts, [180000]);
scheduler.continueWaiting();
advanceTo(240000);
assert.deepStrictEqual(prompts, [180000, 240000]);
scheduler.stop();
assert.strictEqual(activeIntervals.size, 0);

assert(incumbentMessages.length > 0);
assert.strictEqual(incumbentMessages.at(-1).weight, result.weight);
```

- [x] **Step 2: Run the tests before implementation**

Run: `node tests/solver-progress/solver-progress.test.js && node tests/solver-worker/corridor-reduction.test.js`

Expected: FAIL because `solver-progress.js` and `incumbent` messages do not exist.

- [x] **Step 3: Implement the small deterministic timer module**

```js
function createPromptScheduler({ now = () => Date.now(), setIntervalFn = setInterval, clearIntervalFn = clearInterval, onTick, onPrompt }) {
    let startedAt = 0;
    let nextPromptAt = 180000;
    let intervalId = null;
    let promptOpen = false;
    function tick() {
        const elapsed = Math.max(0, now() - startedAt);
        onTick(elapsed);
        if (!promptOpen && elapsed >= nextPromptAt) {
            promptOpen = true;
            onPrompt(elapsed);
        }
    }
    return {
        start() { startedAt = now(); nextPromptAt = 180000; promptOpen = false; intervalId = setIntervalFn(tick, 1000); tick(); },
        continueWaiting() { promptOpen = false; nextPromptAt = Math.max(0, now() - startedAt) + 60000; },
        stop() { if (intervalId !== null) clearIntervalFn(intervalId); intervalId = null; promptOpen = false; }
    };
}
```

At each existing `bestPath`/`bestWeight` update, call an `emitIncumbent()` helper that copies the same raw path data used by the final result. Track `lastReportedWeight` so equal candidates do not generate messages.

- [x] **Step 4: Run focused tests**

Run: `node tests/solver-progress/solver-progress.test.js && node tests/solver-worker/corridor-reduction.test.js`

Expected: PASS; timer prompt occurs at 180,000 ms and 60,000 ms after continuing, while Worker incumbents are strictly improving valid routes.

- [x] **Step 5: Commit the Worker and timer contract**

```bash
git add solver-progress.js solver-worker.js tests/solver-progress/solver-progress.test.js tests/solver-worker/corridor-reduction.test.js
git commit -m "feat: report current best route candidates"
```

### Task 2: Calculation overlay and candidate decision flow

**Files:**
- Modify: `index.html:394-404, 637-640, 2010-2160`
- Modify: `styles.css:1148-1320`
- Create: `tests/solver-progress/index-integration.test.js`

**Interfaces:**
- Consumes `SolverProgress.createPromptScheduler` and Worker `incumbent` messages.
- Produces `finishCurrentBestSearch()` that accepts `bestCandidateResult` and invokes `displayResults({ ...bestCandidateResult, isApproximate: true }, solverConfig.edges)`.
- Produces `cleanupSolverSession()` that terminates Workers and stops the scheduler exactly once.

- [x] **Step 1: Write failing integration assertions**

```js
assert.ok(html.includes('id="solver-elapsed-time"'));
assert.ok(html.includes('id="solver-decision-dialog"'));
assert.ok(html.includes('id="btn-use-current-best"'));
assert.ok(html.includes('function cleanupSolverSession()'));
assert.ok(html.includes('function finishCurrentBestSearch()'));
assert.ok(html.includes('msg.type === "incumbent"'));
assert.ok(css.includes('.solver-decision-dialog'));
```

- [x] **Step 2: Run the integration test before implementation**

Run: `node tests/solver-progress/index-integration.test.js`

Expected: FAIL because the elapsed display, decision dialog, and session functions are absent.

- [x] **Step 3: Implement a single calculation-session lifecycle**

Add a visible elapsed element to the existing loading overlay and an accessible in-page dialog with `继续计算`, `使用当前最佳路线`, and a conditional `取消计算` state. Include `solver-progress.js` before the main inline script.

Inside the solver click handler, create one scheduler and one terminal guard:

```js
let bestCandidateResult = null;
let terminal = false;
function cleanupSolverSession() {
    if (terminal) return;
    terminal = true;
    scheduler.stop();
    terminateSolverWorkers();
    document.getElementById("solver-decision-dialog").style.display = "none";
}
function acceptIncumbent(candidate) {
    if (candidate.weight > (bestCandidateResult?.weight ?? -1)) bestCandidateResult = candidate;
}
function finishCurrentBestSearch() {
    if (!bestCandidateResult) return;
    cleanupSolverSession();
    loadingOverlay.style.display = "none";
    displayResults({ ...bestCandidateResult, isApproximate: true }, solverConfig.edges);
    openDrawer("drawer-roadbook", "路书");
}
```

When no candidate exists, hide the accept button and expose the existing cancel action. Existing normal Worker `result` handling must call `cleanupSolverSession()` only after all root groups are complete, then call `displayResults(bestResult, solverConfig.edges)` without `isApproximate`.

- [x] **Step 4: Run integration assertions and browser-free interaction checks**

Run: `node tests/solver-progress/index-integration.test.js && node tests/mobile-viewport/ios-bottom-toolbar.test.js && node tests/button-style/liquid-glass.test.js`

Expected: PASS; the decision controls exist, loading lifecycle is centralized, and existing mobile/layering contracts stay intact.

- [x] **Step 5: Commit the calculation decision flow**

```bash
git add index.html styles.css tests/solver-progress/index-integration.test.js
git commit -m "feat: let users use current best route"
```

### Task 3: Approximation label in route book and sharing

**Files:**
- Modify: `index.html:317-322, 2200-2220, 2479-2614`
- Modify: `share-export.js:6-40, 53-90`
- Modify: `styles.css:823-870`
- Modify: `tests/share-export/share-export.test.js`
- Modify: `tests/share-export/share-export.integration.test.js`

**Interfaces:**
- Consumes `result.isApproximate` from `displayResults`.
- Extends share snapshots and card models with `isApproximate: boolean`.
- Produces a `.route-approximation-badge`/SVG `近似` marker only when `isApproximate` is true.

- [x] **Step 1: Write failing share and page assertions**

```js
const approximateSnapshot = createSnapshot({ ...route, isApproximate: true });
assert.strictEqual(approximateSnapshot.isApproximate, true);
assert.strictEqual(createCardModel(approximateSnapshot, "normal").isApproximate, true);
assert.ok(html.includes('id="route-approximation-badge"'));
assert.ok(css.includes('.route-approximation-badge'));
```

- [x] **Step 2: Run the tests before implementation**

Run: `node tests/share-export/share-export.test.js && node tests/share-export/share-export.integration.test.js`

Expected: FAIL because snapshots and the roadbook do not have approximation state.

- [x] **Step 3: Implement compact, accessible label propagation**

Render the roadbook badge once in the title row:

```html
<span id="route-approximation-badge" class="route-approximation-badge" hidden
      title="当前最佳路线，计算未完成" aria-label="当前最佳路线，计算未完成">近似</span>
```

`displayResults` toggles `hidden` from `Boolean(result.isApproximate)`. `buildShareSnapshot` passes `isApproximate` into `RouteShare.createSnapshot`; snapshot/model cloning preserves it. Both SVG card generators and print HTML render the same small framed label only when `model.isApproximate` is true.

```css
.route-approximation-badge {
    display: inline-flex;
    align-items: center;
    min-height: 18px;
    padding: 1px 5px;
    border: 1px solid var(--text-muted);
    border-radius: 3px;
    color: var(--text-secondary);
    font: 700 12px/1 "STKaiti", "KaiTi", cursive;
}
.route-approximation-badge[hidden] { display: none; }
```

- [x] **Step 4: Run share and visual-contract tests**

Run: `node tests/share-export/share-export.test.js && node tests/share-export/share-export.integration.test.js && node tests/station-label-layout/station-label-layout.test.js`

Expected: PASS; only approximate routes preserve the badge through roadbook and export models.

- [x] **Step 5: Commit approximation-state rendering**

```bash
git add index.html share-export.js styles.css tests/share-export/share-export.test.js tests/share-export/share-export.integration.test.js
git commit -m "feat: mark unfinished route results"
```

### Task 4: End-to-end verification

**Files:**
- Modify: `docs/superpowers/plans/2026-08-04-current-best-route.md`

- [x] **Step 1: Run the full static and solver suite**

Run: `node tests/solver-progress/solver-progress.test.js && node tests/solver-progress/index-integration.test.js && node tests/solver-worker/corridor-reduction.test.js && node tests/solver-worker/exact-optimization.test.js && node tests/solver-worker/exact-fixed-endpoint.test.js && node tests/solver-worker/fixed-endpoint-anytime.test.js && node tests/solver-worker/through-service.test.js && node tests/share-export/share-export.test.js && node tests/share-export/share-export.integration.test.js && node tests/mobile-map-interaction/mobile-map-interaction.test.js && node run_regression_tests.js`

Expected: all contracts pass; timed regression cases may report `timeout_reached: true` but must return only valid route structures.

- [x] **Step 2: Manually verify both responsive layouts**

Run the local site, temporarily lower the prompt threshold in a non-committed browser console only, and verify on desktop and 390px mobile widths that all dialog buttons are visible, usable, and do not overlap browser controls.

- [x] **Step 3: Update verification checkboxes and inspect release diff**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only files named in this plan are changed.

- [x] **Step 4: Commit verification record**

```bash
git add docs/superpowers/plans/2026-08-04-current-best-route.md
git commit -m "test: verify current best route flow"
```
