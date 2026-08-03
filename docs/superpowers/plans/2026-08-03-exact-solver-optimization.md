# Exact Solver Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce wall-clock time for exact longest-route searches without changing any valid optimum.

**Architecture:** The worker will derive the static bridge forest once per city graph. At each DFS state it will use a bridge-tree upper bound in addition to the existing reachable-edge bound; the bound only removes branches that cannot beat the current solution. The UI will split independent first edges across a capped number of workers and select the best completed exact result.

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

### Task 2: Bridge-tree upper bound

**Files:**
- Modify: `solver-worker.js`
- Test: `tests/solver-worker/exact-optimization.test.js`

- [x] Compute original-graph bridges with edge IDs, then build bridge-connected components and a bridge forest.
- [x] Maintain remaining non-bridge component weights during DFS.
- [x] Bound a path by the best unused bridge-tree ray from its current component; bound a loop by its current bridge component only.
- [x] Use the minimum of this bound and the existing reachable-edge bound, and assert fixture optima are unchanged.

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
