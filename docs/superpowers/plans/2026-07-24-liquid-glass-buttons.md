# Liquid Glass Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved restrained Liquid Glass treatment to every existing button without changing HTML or behavior.

**Architecture:** Add theme-aware material tokens and one late CSS override layer in `styles.css`. Existing semantic classes retain their current meaning, while shared rules supply glass, motion, accessibility, and state behavior.

**Tech Stack:** Static HTML, CSS, Node.js contract tests.

## Global Constraints

- Do not change `index.html` button markup, labels, listeners, or state logic.
- Do not add dependencies, JavaScript, a UI framework, gradients, or a theme switcher.
- Retain all existing button sizes, disabled states, keyboard focus, and mobile touch targets.
- Use hover scale `1.02`, active scale `0.96`, and remove transform motion for reduced-motion users.
- Keep changes local; do not push GitHub.

---

### Task 1: Contract and centralized material layer

**Files:**
- Create: `tests/button-style/liquid-glass.test.js`
- Modify: `styles.css`

**Interfaces:**
- Consumes: existing classes `.btn-float`, `.nav-item`, `.city-tab`, `.tab-btn`, `.btn-primary`, `.btn-cancel-solver`, `.map-popup-btn`, `.analysis-action`, `.cruise-btn`, `.speed-btn`.
- Produces: theme tokens and a shared CSS button material layer.

- [x] **Step 1: Write the failing contract**

Assert that `styles.css` contains `--button-glass-surface`, `--button-glass-edge`, `.button-glass-surface`, `backdrop-filter: blur(18px)`, `scale(1.02)`, `scale(0.96)`, and a reduced-motion override.

- [x] **Step 2: Verify the contract fails**

Run: `node tests/button-style/liquid-glass.test.js`

Expected: fails because the centralized Liquid Glass layer does not exist.

- [x] **Step 3: Add the shared material layer**

Add light and dark tokens plus a grouped selector for native button families. Use rgba surfaces, inner highlight, soft shadow, 12px rounded corners, 18px blur/saturation, hover reflection, active compression, and disabled protection.

- [x] **Step 4: Verify the contract passes**

Run: `node tests/button-style/liquid-glass.test.js`

Expected: `liquid glass button contract ok`.

### Task 2: Semantic states and verification

**Files:**
- Modify: `styles.css`
- Modify: `tests/button-style/liquid-glass.test.js`

**Interfaces:**
- Consumes: existing active, disabled, danger, and primary button classes.
- Produces: readable translucent semantic tints that preserve current button state meaning.

- [x] **Step 1: Extend the failing contract**

Assert that selected/primary controls retain `--button-glass-primary`, disabled controls disable transforms, and city tabs keep `touch-action: pan-x`.

- [x] **Step 2: Verify it fails before implementation**

Run: `node tests/button-style/liquid-glass.test.js`

Expected: fails on the new semantic-state assertion.

- [x] **Step 3: Add semantic overrides**

Tint existing primary, active, and danger classes using their semantic colors. Keep icon controls circular only for `.btn-float`; keep city tabs stable in their scrolling strip.

- [x] **Step 4: Run full verification**

Run:

```bash
node tests/button-style/liquid-glass.test.js
node tests/map-style/classic-map.test.js
node tests/map-style/cruise-mode.test.js
node run_regression_tests.js
git diff --check
```

Expected: all contracts pass and the route suite reports `9/9`.

- [x] **Step 5: Inspect desktop and mobile**

In the browser, verify light/dark themes and a `390 x 844` viewport for normal, primary, active, disabled, popup, and cruise buttons.

- [x] **Step 6: Commit the implementation**

Stage only `styles.css`, `tests/button-style/liquid-glass.test.js`, and this plan; create a local commit without pushing.
