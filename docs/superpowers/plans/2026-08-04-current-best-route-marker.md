# Current Best Route Marker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unattractive “近似” badge with a compact dashed-ring current-best-route state marker across the route book and all share outputs.

**Architecture:** The existing `isApproximate` field remains the only state source. `index.html` emits a reusable SVG marker string for export cards, while `styles.css` renders the animated in-page marker and reduced-motion fallback; `share-export.js` supplies the static print equivalent. Tests assert the new marker and the absence of the retired text label.

**Tech Stack:** Static HTML, vanilla JavaScript, CSS, Node.js assertion tests.

## Global Constraints

- Do not change solver, cancellation, route confirmation, or sharing business logic.
- Render a marker only when `isApproximate` is true.
- Use “当前最佳路线，计算未完成” for accessible/status explanations.
- In-page marker can animate; SVG and print markers must be static.
- Respect `prefers-reduced-motion`.

---

### Task 1: Replace the route-book and SVG marker

**Files:**
- Modify: `index.html:321,2433-2445,2494-2506`
- Modify: `styles.css:850-870`
- Test: `tests/share-export/share-export.integration.test.js`

**Interfaces:**
- Consumes: `result.isApproximate` from `displayResults(result, filteredEdges)`.
- Produces: `#route-approximation-badge` with an accessible dashed ring in the route book; static `approximationBadge` SVG fragments in compact, detailed, and complete card exports.

- [x] **Step 1: Write the failing static contract test**

```js
assert.ok(html.includes('class="route-approximation-ring"'), "The route book must use the dashed-ring current-best marker");
assert.ok(html.includes('stroke-dasharray="5 4"'), "Shared SVG cards must use the static dashed-ring marker");
assert.ok(!html.includes('font-family="STKaiti, KaiTi, cursive"'), "Shared SVG cards must not render the retired handwriting marker");
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node tests/share-export/share-export.integration.test.js`

Expected: FAIL because the current source still contains the handwriting-style “近似” badge.

- [x] **Step 3: Implement the route-book and SVG marker**

```html
<span id="route-approximation-badge" class="route-approximation-badge" hidden title="当前最佳路线，计算未完成" aria-label="当前最佳路线，计算未完成">
  <span class="route-approximation-ring" aria-hidden="true"></span>
</span>
```

```css
.route-approximation-ring {
    width: 17px;
    height: 17px;
    border: 2px dashed var(--text-muted);
    border-radius: 50%;
    position: relative;
    animation: route-approximation-spin 4s linear infinite;
}
.route-approximation-ring::after { content: ""; position: absolute; inset: 4px; border-radius: 50%; background: var(--state-success); }
@media (prefers-reduced-motion: reduce) { .route-approximation-ring { animation: none; } }
```

Replace each SVG text-and-rectangle marker with a static group containing a dashed circle and small green center dot, with `aria-label="当前最佳路线，计算未完成"`.

- [x] **Step 4: Run the focused test to verify it passes**

Run: `node tests/share-export/share-export.integration.test.js`

Expected: `share export integration contract ok`.

- [x] **Step 5: Commit**

```bash
git add index.html styles.css tests/share-export/share-export.integration.test.js
git commit -m "feat: refine current best route marker"
```

### Task 2: Replace the print marker and protect state propagation

**Files:**
- Modify: `share-export.js:71-92`
- Modify: `tests/share-export/share-export.test.js:44-47`

**Interfaces:**
- Consumes: `model.isApproximate` from `createCardModel(snapshot, mode)`.
- Produces: static dashed ring in `createPrintHtml(model)` only for unfinished results.

- [x] **Step 1: Write the failing print-output assertions**

```js
const approximatePrintHtml = createPrintHtml(createCardModel(approximateSnapshot, "complete"));
assert.ok(approximatePrintHtml.includes('class="current-best-ring"'), "Approximate print output must carry the current-best ring");
assert.ok(!approximatePrintHtml.includes(">近似<"), "Approximate print output must not expose the retired label");
assert.ok(!createPrintHtml(createCardModel(snapshot, "complete")).includes('current-best-ring'), "Exact print output must not render a current-best marker");
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node tests/share-export/share-export.test.js`

Expected: FAIL because print output still creates `.approx-label` with “近似”.

- [x] **Step 3: Implement the static print marker**

```css
.current-best-ring { display: inline-block; width: 13px; height: 13px; margin-left: 6px; border: 1.5px dashed #687068; border-radius: 50%; position: relative; vertical-align: -1px; }
.current-best-ring::after { content: ""; position: absolute; inset: 3px; border-radius: 50%; background: #1d8b68; }
```

```js
${model.isApproximate ? ' <span class="current-best-ring" title="当前最佳路线，计算未完成" aria-label="当前最佳路线，计算未完成"></span>' : ""}
```

- [x] **Step 4: Run the focused test to verify it passes**

Run: `node tests/share-export/share-export.test.js`

Expected: `share export contract ok`.

- [x] **Step 5: Commit**

```bash
git add share-export.js tests/share-export/share-export.test.js
git commit -m "feat: use current best marker in print export"
```

### Task 3: Verify cross-output rendering and publish

**Files:**
- Modify: `docs/superpowers/plans/2026-08-04-current-best-route-marker.md`
- Test: `tests/share-export/share-export.test.js`
- Test: `tests/share-export/share-export.integration.test.js`
- Test: `tests/solver-progress/index-integration.test.js`

**Interfaces:**
- Consumes: the unchanged `isApproximate` field from worker candidates and confirmed routes.
- Produces: verified route-book, print, SVG-share behavior and a public `main` release.

- [x] **Step 1: Run all targeted regression tests**

Run:

```bash
node tests/share-export/share-export.test.js
node tests/share-export/share-export.integration.test.js
node tests/solver-progress/index-integration.test.js
```

Expected: every command reports its contract as `ok`.

- [x] **Step 2: Parse the inline controller**

Run:

```bash
node -e 'const fs=require("fs"); const html=fs.readFileSync("index.html","utf8"); const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match=>match[1]); new Function(scripts.at(-1)); console.log("inline controller parses")'
```

Expected: `inline controller parses`.

- [x] **Step 3: Verify desktop and mobile visual behavior**

Open the local page, inject an unfinished route result, and check that the route-book ring has no text, the ring fits beside the title at desktop and 390px mobile widths, and an exact result hides it.

- [x] **Step 4: Mark the completed plan and commit**

Mark every completed checkbox as `[x]`, then run:

```bash
git add docs/superpowers/plans/2026-08-04-current-best-route-marker.md
git commit -m "test: verify current best route marker"
```

- [ ] **Step 5: Audit and push the verified commits**

Run:

```bash
git diff --check origin/main..HEAD
git grep -n -I -E '(sk-[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|BEGIN .*PRIVATE KEY|PRIVATE_USERNAME)' HEAD -- .
git fetch origin main
git rev-list --left-right --count HEAD...origin/main
git push origin HEAD:main
```

Expected: no whitespace or sensitive-information findings, remote has no divergent commits, and push succeeds.
