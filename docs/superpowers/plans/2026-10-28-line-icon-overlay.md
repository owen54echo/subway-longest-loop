# Zoomed Line Badge Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在地图放大到 `2.0×` 及以上时，为当前视口内能够安全放置的线路显示彩色胶囊线路牌，并保持线路、车站和站名不被遮挡。

**Architecture:** 新增纯布局模块 `line-badge-layout.js`，负责按线路分组、生成线段候选位置和执行矩形碰撞检测；`index.html` 只负责从当前 SVG/城市数据生成候选、测量文字和渲染独立的 `line-badges-group`。复用现有站名布局结果作为阻塞矩形，线路牌不进入路线计算或站点数据。

**Tech Stack:** 原生 JavaScript、SVG、现有 `station-label-layout.js`、现有 Node 合约测试、现有 `styles.css`。

## Global Constraints

- 地图缩放比例小于 `2.0` 时线路牌全部隐藏。
- 默认灰色线网和官方线路颜色模式都显示彩色线路牌；线路牌始终使用线路官方颜色。
- 同一视口同一线路最多显示一个线路牌。
- 线路、站点、站名和路线高亮优先于线路牌；找不到安全位置时隐藏线路牌。
- 线路牌随缩放结束、拖动结束、城市切换、路线高亮和官方颜色开关变化重新布局。
- 拖动或缩放进行中只更新已有 SVG transform，不在每个指针事件中重新布局。
- 不新增数据字段，不改变路线求解、站点选择、站名内容和现有颜色开关的业务行为。

---

### Task 1: Build the pure line badge layout module

**Files:**
- Create: `line-badge-layout.js`
- Create: `tests/station-label-layout/line-badge-layout.test.js`

**Interfaces:**
- Consumes: candidates shaped as `{ id, line, x, y, width, height, priority, slots }`; blocked rectangles shaped as `{ left, top, right, bottom }`.
- Produces: `window.LineBadgeLayout.place(candidates, blockedRects, options)` returning `{ placed, deferred }`; every placed item contains `{ id, line, rect, x, y, slot }`.

- [ ] **Step 1: Write the failing layout contract test**

```js
const assert = require("assert");
const fs = require("fs");

const windowLike = {};
new Function("window", fs.readFileSync("line-badge-layout.js", "utf8"))(windowLike);
const { place, intersects } = windowLike.LineBadgeLayout;

const candidates = [
    { id: "red-a", line: "1号线", x: 100, y: 100, width: 42, height: 18, priority: 80, slots: [[0, -22], [0, 22]] },
    { id: "red-b", line: "1号线", x: 130, y: 100, width: 42, height: 18, priority: 70, slots: [[0, -22], [0, 22]] },
    { id: "blue-a", line: "2号线", x: 190, y: 100, width: 42, height: 18, priority: 60, slots: [[0, -22], [0, 22]] }
];

const result = place(candidates, [{ left: 70, top: 70, right: 120, bottom: 120 }], { maxPerLine: 1 });
assert.strictEqual(result.placed.filter(item => item.line === "1号线").length, 1);
assert.strictEqual(result.placed.filter(item => item.line === "2号线").length, 1);
for (let index = 0; index < result.placed.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < result.placed.length; nextIndex += 1) {
        assert.ok(!intersects(result.placed[index].rect, result.placed[nextIndex].rect));
    }
}
assert.ok(result.deferred.includes("red-b"));
console.log("line badge layout contract ok");
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node tests/station-label-layout/line-badge-layout.test.js`

Expected: FAIL because `line-badge-layout.js` does not exist.

- [ ] **Step 3: Implement collision-aware placement**

Implement these exact behaviors in `line-badge-layout.js`:

```js
(function () {
    function intersects(a, b) {
        return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }

    function makeRect(candidate, offsetX, offsetY) {
        return {
            left: candidate.x + offsetX - candidate.width / 2,
            top: candidate.y + offsetY - candidate.height / 2,
            right: candidate.x + offsetX + candidate.width / 2,
            bottom: candidate.y + offsetY + candidate.height / 2
        };
    }

    function place(candidates, blockedRects = [], options = {}) {
        const maxPerLine = options.maxPerLine || 1;
        const occupied = [...blockedRects];
        const placed = [];
        const deferred = [];
        const lineCounts = new Map();
        const sorted = [...candidates].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

        for (const candidate of sorted) {
            if ((lineCounts.get(candidate.line) || 0) >= maxPerLine) {
                deferred.push(candidate.id);
                continue;
            }
            for (const [offsetX, offsetY, slot] of candidate.slots) {
                const rect = makeRect(candidate, offsetX, offsetY);
                if (occupied.some(other => intersects(rect, other))) continue;
                const item = { id: candidate.id, line: candidate.line, rect, x: rect.left, y: rect.top, slot };
                occupied.push(rect);
                placed.push(item);
                lineCounts.set(candidate.line, (lineCounts.get(candidate.line) || 0) + 1);
                break;
            }
            if (!placed.some(item => item.id === candidate.id)) deferred.push(candidate.id);
        }
        return { placed, deferred };
    }

    window.LineBadgeLayout = { place, intersects };
})();
```

- [ ] **Step 4: Run the focused test**

Run: `node tests/station-label-layout/line-badge-layout.test.js`

Expected: PASS with `line badge layout contract ok`.

- [ ] **Step 5: Commit the isolated module**

```bash
git add line-badge-layout.js tests/station-label-layout/line-badge-layout.test.js
git commit -m "feat: add collision-aware line badge layout"
```

### Task 2: Integrate dynamic badges into the SVG map

**Files:**
- Modify: `index.html:641` for the script load
- Modify: `index.html:737-1050` for the SVG layer, candidate generation, and label refresh integration
- Modify: `index.html:1080-1205` for post-gesture refresh behavior
- Modify: `index.html:1205-1420` and route-rendering refresh call sites so city/route changes recalculate badges
- Modify: `tests/map-style/classic-map.test.js`

**Interfaces:**
- Consumes: `window.LineBadgeLayout.place`, `data.nodes`, `data.edges`, `getLineColor`, `isNodeInCurrentViewport`, and the existing station label layout result.
- Produces: an SVG group with id `line-badges-group`; each rendered badge has class `line-badge-map`, `data-line`, and an accessible `aria-label`.

- [ ] **Step 1: Add failing integration assertions**

Append assertions to `tests/map-style/classic-map.test.js`:

```js
assert.ok(html.includes('src="line-badge-layout.js"'), "Line badge layout module is not loaded");
assert.ok(html.includes('id="line-badges-group"'), "Line badge SVG layer is missing");
assert.ok(html.includes("function refreshLineBadges"), "Line badge refresh hook is missing");
assert.ok(html.includes("LINE_BADGE_MIN_SCALE = 2.0"), "Line badge zoom threshold is missing");
assert.ok(html.includes("window.LineBadgeLayout.place"), "Line badges do not use collision-aware placement");
```

- [ ] **Step 2: Run the map contract and verify it fails**

Run: `node tests/map-style/classic-map.test.js`

Expected: FAIL because the new script, SVG group, refresh hook, and threshold do not exist.

- [ ] **Step 3: Add the independent badge layer and refresh function**

Load `line-badge-layout.js` after `station-label-layout.js`. Add `line-badges-group` to the SVG after `stations-group` and before `labels-group`, plus:

```js
const LINE_BADGE_MIN_SCALE = 2.0;
let lastStationLabelRects = [];

function refreshLineBadges(stationLabelRects = lastStationLabelRects) {
    const badgesGroup = document.getElementById("line-badges-group");
    if (!badgesGroup) return;
    badgesGroup.replaceChildren();
    if (scale < LINE_BADGE_MIN_SCALE) return;

    // Build at most one candidate per visible edge, then let the layout module
    // select one safe position per line.
    const candidates = buildLineBadgeCandidates();
    const blockedRects = [
        ...stationLabelRects,
        ...buildPriorityMarkerRects(data.nodes)
    ];
    const layout = window.LineBadgeLayout.place(candidates, blockedRects, {
        maxPerLine: 1
    });
    layout.placed.forEach(item => renderLineBadge(badgesGroup, item));
}
```

`buildLineBadgeCandidates()` must group visible edges by `edge.line`, calculate each edge midpoint and perpendicular offsets, use `getLineColor(edge.line)` for color lookup, and create slots in this order: `perpendicular - 18`, `perpendicular + 18`, then the same two offsets with a small along-line shift. Candidate priority must prefer longer edges, edges farther from both endpoints, and candidates inside the viewport. It must skip unavailable station endpoints and edges outside the current viewport.

`renderLineBadge()` must create a rounded SVG `rect` and a centered SVG `text`, use the full line name, set `data-line`, set `aria-label="线路 ${line}"`, and use `pointer-events="none"`. The badge must be placed from the layout rectangle, not from a fixed station coordinate.

- [ ] **Step 4: Return placed station label rectangles and trigger badge refresh**

Update `refreshStationLabels()` to assign the final `layout.placed.map(item => item.rect)` to `lastStationLabelRects`, call `refreshLineBadges(lastStationLabelRects)` after station labels are placed, and preserve the existing return behavior for callers. Do not run badge layout in `updateMapDuringGesture({ refreshLabels: false })`; the existing deferred flush remains the only refresh at gesture end.

Call `refreshLineBadges()` through the existing `refreshStationLabels()` path after route highlight changes, city switches, reset, and official-color toggles. Do not add a per-pointermove layout call.

- [ ] **Step 5: Run focused map tests**

Run:

```bash
node tests/station-label-layout/line-badge-layout.test.js
node tests/map-style/classic-map.test.js
```

Expected: both PASS.

- [ ] **Step 6: Commit the map integration**

```bash
git add index.html tests/map-style/classic-map.test.js
git commit -m "feat: show collision-free line badges when zoomed"
```

### Task 3: Add responsive badge styling and visual safeguards

**Files:**
- Modify: `styles.css` near the existing station/map styles
- Modify: `tests/map-style/classic-map.test.js` if a CSS contract is needed

**Interfaces:**
- Consumes: SVG classes `.line-badge-map`, `.line-badge-map-bg`, and `.line-badge-map-text` emitted by Task 2.
- Produces: stable desktop/mobile sizes and unavailable/route-overlay-safe visual treatment.

- [ ] **Step 1: Add the CSS contract assertions**

Add these checks:

```js
assert.ok(css.includes(".line-badge-map"), "Line badge style is missing");
assert.ok(css.includes("pointer-events: none"), "Map badges must not intercept station gestures");
```

- [ ] **Step 2: Add the minimal styles**

Add `.line-badge-map` styles with `pointer-events: none`, `vector-effect: non-scaling-stroke`, a dark outline/high-contrast text treatment, and a mobile media query that reduces font size and padding. Do not use a gradient or animation. Keep the SVG geometry responsible for the actual collision rectangle.

- [ ] **Step 3: Run the map style test**

Run: `node tests/map-style/classic-map.test.js`

Expected: PASS.

- [ ] **Step 4: Commit the visual safeguards**

```bash
git add styles.css tests/map-style/classic-map.test.js
git commit -m "style: make zoomed line badges responsive"
```

### Task 4: Full regression and release check

**Files:**
- Modify: none unless a focused test exposes an integration regression
- Test: all existing JavaScript and Python tests

- [ ] **Step 1: Run all JavaScript contract tests**

Run: `find tests -type f -name '*.test.js' -print0 | xargs -0 -n1 node`

Expected: every test exits 0, including route, mobile map, station label, share export, and solver contracts.

- [ ] **Step 2: Run the data-pipeline syntax check**

Run: `python3 -m py_compile compile_subways.py`

Expected: exit 0.

- [ ] **Step 3: Check the complete diff**

Run: `git diff --check && git status --short --branch`

Expected: no whitespace errors; only the intended commits are present and the working tree is clean.

- [ ] **Step 4: Commit any test-only adjustment**

```bash
git add tests
git commit -m "test: cover zoomed line badge behavior"
```

Run the full test command again after this commit.

