# Exact Solver Reduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make exact browser search traverse forced same-line corridors once and exclude impossible simple-loop blocks.

**Architecture:** The existing worker keeps original edges as its result format. It adds query-local corridor metadata and biconnected edge eligibility before DFS, then advances forced edges atomically while restoring each raw edge during backtracking.

**Tech Stack:** Vanilla JavaScript, Web Workers, Node `assert` tests.

## Global Constraints

- No approximate result may be displayed as final.
- No dependencies or server-side services are introduced.
- Start, endpoint, and waypoint stations remain explicit search nodes.
- Existing line, transfer, through-service, and distance semantics remain unchanged.

---

### Task 1: Regression fixtures

**Files:**
- Create: `tests/solver-worker/corridor-reduction.test.js`
- Modify: `solver-worker.js`

- [x] Write a forced-corridor fixture and independently enumerate its longest valid route.
- [x] Write a simple-loop articulation fixture whose off-block cycle cannot be selected.
- [x] Run the fixture before implementation and verify the requested worker statistics are absent.

### Task 2: Corridor transition

**Files:**
- Modify: `solver-worker.js`
- Test: `tests/solver-worker/corridor-reduction.test.js`

- [x] Mark eligible pass-through stations after the request graph is built.
- [x] Advance all forced same-line edges in one DFS call while recording each raw edge and station.
- [x] Restore all forced edges, stations, degree counters, and line usage on backtrack.
- [x] Assert result edge and station sequences match exhaustive enumeration.

### Task 3: Biconnected loop filter

**Files:**
- Modify: `solver-worker.js`
- Test: `tests/solver-worker/corridor-reduction.test.js`

- [x] Use Tarjan vertex-biconnected decomposition to mark blocks containing the start station.
- [x] Reject edges outside those blocks only for simple-loop requests.
- [x] Assert a loop cannot use an off-block cycle and the exhaustive optimum is unchanged.

### Task 4: Verification

**Files:**
- Test: `tests/solver-worker/*.test.js`

- [x] Run all solver-worker contracts and existing regression cases.
- [x] Compare representative Guangzhou state counts before and after reduction under the same five-second diagnostic budget.
- [x] Run syntax and whitespace checks.
