# Exact Solver Reduction Design

## Goal

Reduce browser-side exact route-search time without changing the set of valid routes or returning an approximate answer.

## Scope

This phase keeps the existing static GitHub Pages architecture and all current route rules. It does not add a WASM or server-side integer-programming runtime.

## Design

### Forced same-line corridors

For each request, classify a station as a pass-through corridor station only when it is not the start, end, or waypoint; it has exactly two available incident edges; and those edges use the same logical line. After entering such a station, the next edge is forced because edges cannot repeat. The worker advances through the full forced corridor in one DFS transition while retaining every original edge and station in the result path.

All rule checks remain valid during the forced advance: the logical line remains unchanged, no extra transfer is created, and all traversed stations and edges are marked individually. A route can still end at a corridor station only when it is an explicit endpoint or waypoint, which are protected from contraction.

### Simple-loop biconnected filter

When the user requests a loop with station reuse disabled, every valid result is a simple cycle. A simple cycle containing the start station is wholly contained in a vertex-biconnected block that contains that start station. Tarjan block decomposition marks all other edges as ineligible before DFS. Bridge edges remain excluded by the existing exact loop rule.

### Result and progress

The worker continues returning original edge IDs and station names. Search-state progress counts decision transitions rather than forced corridor stations, so the count is no longer compared directly with pre-reduction releases. Completion remains the only condition for displaying a final route.

## Correctness Constraints

- Every original edge traversed by a forced corridor is marked and restored independently.
- Start, endpoint, and waypoint stations are never pass-through stations.
- The biconnected filter is applied only to `mode === "loop" && allow_station_reuse === false`.
- Tests compare reduced-worker answers with independent exhaustive enumeration on small graphs.

## Deferred Work

For low-constraint cases that still exceed practical browser time after reduction, add a separate exact edge-subset solver. That model must be designed independently because transfer caps and no-line-reentry constraints depend on traversal order.
