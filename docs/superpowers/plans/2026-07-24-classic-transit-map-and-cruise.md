# Classic Transit Map and Cruise Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply one classic New York subway-inspired line, station, label, and immersive cruise style to every city while removing the withdrawn Guangzhou geography work.

**Architecture:** Keep the existing shared SVG renderer in `index.html` as the single rendering path for all cities. Add semantic SVG classes and a small set of renderer helpers so CSS controls the common cartographic vocabulary, while inline edge colors continue to support the existing official-color toggle. Cruise mode reuses the solved route and toggles a scoped map state without rerunning the solver.

**Tech Stack:** Static HTML, CSS, SVG, vanilla JavaScript, Node.js contract tests.

## Global Constraints

- Apply the style through the shared renderer so all cities change together.
- Do not add an A/B switch or a new local-storage preference.
- Preserve the existing gray-network / official-line-color toggle.
- Do not change station coordinates, graph topology, route solving, distance, transfers, or exploration data.
- Remove all unpublished land, water, coastline, district, and Guangzhou basemap runtime assets.
- Keep desktop, mobile, keyboard, touch, dark theme, light theme, and reduced-motion behavior.
- Keep all work local; do not push GitHub.

---

### Task 1: Remove the withdrawn geography feature

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Delete: `guangzhou_basemap.js`
- Delete: `data/geography/guangzhou/metadata.json`
- Delete: `data/geography/guangzhou/review-checklist.md`
- Delete: `data/geography/guangzhou/raw/guangzhou-districts.json`
- Delete: `data/geography/guangzhou/raw/pearl-river-waterways.json`
- Delete: `scripts/build_guangzhou_basemap.js`
- Delete: `scripts/fetch_guangzhou_geography.js`
- Delete: `tests/geography/guangzhou_metadata.test.js`
- Delete: `tests/geography/guangzhou_basemap.test.js`
- Delete: `tests/geography/guangzhou_renderer.test.js`
- Delete: `tests/geography/guangzhou_cruise.test.js`
- Delete: `docs/superpowers/specs/2026-07-24-guangzhou-geographic-basemap-design.md`
- Delete: `docs/superpowers/plans/2026-07-24-guangzhou-geographic-basemap.md`

**Interfaces:**
- Consumes: current uncommitted geography implementation.
- Produces: the original geography-free map layer order plus the retained `cruise-map-mode` state helper.

- [x] **Step 1: Write a failing removal contract**

Create `tests/map-style/classic-map.test.js` and assert that `index.html` does not load `guangzhou_basemap.js`, contains no `geography-*` SVG groups, and `styles.css` contains no `--geography-*` tokens.

- [x] **Step 2: Run the test and confirm failure**

Run: `node tests/map-style/classic-map.test.js`

Expected: fail because geography script, groups, and CSS are still present.

- [x] **Step 3: Remove geography runtime code and generated assets**

Delete the exact files above and remove `getCityBasemap`, `createGeographyPath`, `renderCityBasemap`, geography SVG groups, geography CSS variables, district labels, and cruise geography selectors.

- [x] **Step 4: Run the removal contract**

Run: `node tests/map-style/classic-map.test.js`

Expected: geography-removal assertions pass while later style assertions remain pending.

### Task 2: Apply the classic map style to the shared renderer

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `tests/map-style/classic-map.test.js`

**Interfaces:**
- Consumes: `data.nodes`, `data.edges`, `showOfficialLineColors`, and existing station planning state.
- Produces: SVG classes `metro-line`, `station-marker`, `station-marker-transfer`, `station-marker-inner`, and `station-label`.

- [x] **Step 1: Add failing shared-style assertions**

Assert that the renderer emits semantic classes, line width `4.5`, round line caps, ordinary station radius `4.2`, transfer outer radius `6.5`, transfer inner ring, and no city-specific condition controls these values.

- [x] **Step 2: Run the test and confirm failure**

Run: `node tests/map-style/classic-map.test.js`

Expected: fail because the old `2.0` lines and solid ordinary stations remain.

- [x] **Step 3: Implement shared line and station drawing**

Give every base edge class `metro-line`, set `stroke-width="4.5"`, `stroke-linecap="round"`, and `stroke-linejoin="round"`. Draw every ordinary station as a white/theme-background circle with dark outline. Draw transfers with an outer `6.5` circle plus inner ring and keep route-state colors on the outer stroke.

- [x] **Step 4: Update station interaction helpers**

Use `.station-marker-primary` for hover, focus, route dimming, and state restoration so transfer inner rings do not break the existing `querySelector("circle")` behavior.

- [x] **Step 5: Update labels**

Add `station-label` and `station-label-transfer` classes, retain the background halo, and keep transfer labels visible by default while ordinary labels remain interaction/route driven.

- [x] **Step 6: Run style and syntax checks**

Run:

```bash
node tests/map-style/classic-map.test.js
node -e 'const fs=require("fs");const html=fs.readFileSync("index.html","utf8");for(const m of html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g))new Function(m[1]);'
```

Expected: shared map-style contract and inline script parsing pass.

### Task 3: Finish the immersive cruise experience

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Create: `tests/map-style/cruise-mode.test.js`

**Interfaces:**
- Consumes: `lastResultStations`, `cruiseSegments`, `cruiseCurrentSegmentIndex`, and existing cruise controls.
- Produces: `setCruiseMapMode(isActive)`, solid highlighted route styling, current line color on the train marker, and progress text/bar.

- [x] **Step 1: Write failing cruise assertions**

Assert that cruise start/stop toggles `cruise-map-mode`, the panel contains an accessible progress element, the train marker has classic marker classes, and route highlight does not use `animated-flow-line`.

- [x] **Step 2: Run the cruise test and confirm failure**

Run: `node tests/map-style/cruise-mode.test.js`

Expected: fail because progress and classic train marker are missing and the route still animates as dashed flow.

- [x] **Step 3: Implement the cruise HUD and train marker**

Add route progress, replace “模拟地铁” with the current station name, and update marker stroke from the active segment's line color. Keep pause, replay, speed, tracking, loop, and close controls.

- [x] **Step 4: Implement solid route focus**

Render selected route segments with a dark backing and solid official-color stroke. Dim unrelated network only inside the route/cruise state; do not remove map elements.

- [x] **Step 5: Add responsive and reduced-motion rules**

Keep the HUD inside the mobile viewport, use at least `44px` primary touch targets, and disable train halo animation under reduced motion.

- [x] **Step 6: Run cruise contract**

Run: `node tests/map-style/cruise-mode.test.js`

Expected: all cruise assertions pass.

### Task 4: Verify all cities and both viewport classes

**Files:**
- Inspect: `index.html`
- Inspect: `styles.css`
- Inspect: `subway_data.js`

**Interfaces:**
- Consumes: final shared renderer.
- Produces: verified local implementation with no GitHub push.

- [x] **Step 1: Run automated checks**

Run:

```bash
node tests/map-style/classic-map.test.js
node tests/map-style/cruise-mode.test.js
node run_regression_tests.js
git diff --check
```

Expected: style contracts pass, existing regression suite reports `9/9`, and whitespace check is clean.

- [x] **Step 2: Verify representative cities**

In the browser, inspect Guangzhou, Beijing, Shanghai, Shenzhen, and Chongqing in gray and official-color modes. Confirm each uses the same line/station structure and retains city-specific official colors.

- [x] **Step 3: Verify desktop and mobile workflows**

At desktop and `390 × 844`: select a start station, plan a route, open the roadbook, start cruise, pause, change speed, toggle tracking, replay or exit, and confirm controls remain reachable.

- [x] **Step 4: Review scope**

Confirm no geography runtime file remains, no unrelated change is staged, and no push is executed.
