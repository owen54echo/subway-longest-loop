# Current Best Route During Exact Search Design

## Goal

Make a long-running browser calculation understandable and interruptible without presenting an unfinished search as an exact result.

## User Flow

1. When a route calculation starts, the loading overlay displays elapsed time in `mm:ss` alongside the existing explored-state progress.
2. At 3 minutes, if one or more valid candidate routes have been found, show an in-page decision dialog with `使用当前最佳路线` and `继续计算`.
3. Choosing `继续计算` closes the dialog and schedules the same decision again 1 minute later. Only one decision dialog can be open at a time.
4. Choosing `使用当前最佳路线` terminates every active Worker and opens the current global best candidate in the normal route book, map, cruise, and share flows.
5. If no valid candidate exists when a decision is due, show only `继续计算` and `取消计算`.
6. When every Worker completes normally, the existing exact-result flow remains unchanged and no approximation indicator is shown.

## Candidate Collection

Each Worker retains its local incumbent as it does today. When that incumbent improves, it emits an `incumbent` message containing the raw edge IDs, station names, weight, and search statistics. It does not send full paths for ordinary progress heartbeats.

The page aggregates every Worker's incumbent and retains the highest-weight valid route as `bestCandidateResult`. Candidates use the same raw result format as exact Worker results, so `displayResults`, route highlighting, cruise playback, and sharing need no second rendering pipeline.

## Approximation State

Selecting an unfinished candidate adds an explicit `isApproximate: true` result field. The route book and any exported share artifact display a compact framed `近似` label beside the route title. The label uses a locally available Chinese handwriting-style font fallback (`STKaiti`, `KaiTi`, `cursive`) and has an accessible text description explaining that calculation was stopped before an optimality proof.

The visible interface does not show the longer sentence. Exact completed results omit the label entirely.

## Timing and Lifecycle

- The elapsed-time counter uses the calculation start timestamp and updates once per second with a single interval.
- The first decision is scheduled at 180 seconds; subsequent prompts are scheduled 60 seconds after the user chooses to continue.
- Starting a new calculation, cancelling, accepting a candidate, completing all Workers, or a Worker error clears the interval and all prompt timers.
- Dialog actions are idempotent: once a terminal action begins, late Worker messages are ignored.

## Failure and Edge Cases

- The current candidate must satisfy all selected route constraints because it is emitted only after the Worker validates a candidate under its normal rules.
- A candidate can be worse than the unknown final optimum. The `近似` indicator remains present in the route book and share output for that reason.
- If a Worker has not yet produced a candidate, it contributes nothing to the global best candidate.
- If the user cancels, no candidate is opened automatically.
- The existing exact completion path continues to select the best result across all root Worker groups.

## Verification

1. Unit-test that Workers emit only strictly improved valid incumbents.
2. Test aggregation across multiple Worker messages and verify the highest candidate is selected.
3. Test the 3-minute prompt, the 1-minute repeat after continuing, and timer cleanup for cancel, acceptance, error, and completion.
4. Test candidate acceptance terminates active Workers and opens a route book with the `近似` marker.
5. Test exact completion opens the same route book without the marker.
6. Test mobile and desktop dialogs for reachable actions and no overlapping overlay controls.
