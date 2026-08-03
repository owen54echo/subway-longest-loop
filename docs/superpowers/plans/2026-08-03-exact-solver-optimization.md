# Exact Solver Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce wall-clock time for exact longest-route searches without changing any valid optimum.

**Architecture:** The worker derives the static bridge forest once per city graph, then applies constant-time admissibility rules: a loop excludes every bridge; a fixed-endpoint path excludes bridges outside its unique bridge-tree route. The UI splits independent first edges across a capped number of workers and selects the best completed exact result.

**Tech Stack:** Static HTML, browser Web Workers, vanilla JavaScript, Node assert tests.

## Global Constraints

- Final routes must remain exact; no timeout candidate can be displayed as final.
- Do not introduce dependencies or server-side computation.
- Mobile concurrency is capped at two workers; desktop is capped at four.
- Every pruning rule must have a brute-force small-graph equivalence test.

---

### Task 1: Exactness fixtures

**Files:**
- Create: `tests/solver-worker/exact-optimization.test.js`
- Modify: `solver-worker.js`

- [x] Write a small bridge-tree fixture and a dense-cycle fixture.
- [x] Run each fixture with exhaustive worker search and assert its exact edge count and endpoint constraints.
- [x] Add assertions that bridge metadata is exposed in the worker result only for test diagnostics.

### Task 2: Constant-time bridge filtering

**Files:**
- Modify: `solver-worker.js`
- Test: `tests/solver-worker/exact-optimization.test.js`

- [x] Compute original-graph bridges with edge IDs, then build bridge-connected components and a bridge forest.
- [x] Mark the unique bridge-tree route between fixed endpoints once before DFS.
- [x] Reject all bridge edges in loop mode and off-route bridge edges in fixed-endpoint mode.
- [x] Keep generic paths free of per-state bridge-tree traversal and assert fixture optima are unchanged.

### Task 3: Parallel root search

**Files:**
- Modify: `solver-worker.js`
- Modify: `index.html`
- Test: `tests/solver-worker/exact-optimization.test.js`

- [x] Accept `root_edge_ids` in the worker and search only those independent first edges.
- [x] Dispatch at most two mobile or four desktop workers when more than one root edge exists.
- [x] Aggregate progress and return only after every worker completes; select the highest exact result.
- [x] Cancel and error paths terminate every active worker.

### Task 4: Verification

**Files:**
- Test: `tests/solver-worker/exact-optimization.test.js`
- Test: `tests/solver-worker/*.test.js`

- [x] Run all solver-worker contracts, full regression, syntax checks, and whitespace checks.
- [x] Compare serial and split-root fixture results for identical optimum weights and valid paths.
- [x] Record the benchmark state counts supplied by worker progress without claiming universal timing improvements.
