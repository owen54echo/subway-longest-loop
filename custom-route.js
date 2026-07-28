(function() {
    function edgeDistance(edge) {
        return Number(edge.actualLengthKm ?? edge.straightLengthKm ?? 0);
    }

    function comparePathCost(a, b) {
        return a.hops - b.hops || a.distance - b.distance || a.signature.localeCompare(b.signature);
    }

    function createGraph(nodes, edges) {
        const byStation = new Map(nodes.map(node => [node.name, []]));

        edges.forEach((edge, edgeIndex) => {
            const common = {
                edgeIndex,
                line: edge.line || "",
                distance: edgeDistance(edge)
            };

            byStation.get(edge.u)?.push({ ...common, to: edge.v });
            byStation.get(edge.v)?.push({ ...common, to: edge.u });
        });

        for (const neighbors of byStation.values()) {
            neighbors.sort((a, b) =>
                a.to.localeCompare(b.to) ||
                a.line.localeCompare(b.line) ||
                a.edgeIndex - b.edgeIndex
            );
        }

        return { edges, byStation };
    }

    function findMinimumStopPath(graph, start, target) {
        if (!graph.byStation.has(start) || !graph.byStation.has(target) || start === target) {
            return null;
        }

        const startState = {
            station: start,
            hops: 0,
            distance: 0,
            signature: start,
            stations: [start],
            edgeIndices: []
        };
        const queue = [startState];
        const bestByStation = new Map([[start, startState]]);

        while (queue.length) {
            queue.sort(comparePathCost);
            const current = queue.shift();
            if (bestByStation.get(current.station) !== current) {
                continue;
            }
            if (current.station === target) {
                return current;
            }

            for (const next of graph.byStation.get(current.station) || []) {
                const candidate = {
                    station: next.to,
                    hops: current.hops + 1,
                    distance: current.distance + next.distance,
                    signature: `${current.signature}>${next.line}>${next.to}`,
                    stations: [...current.stations, next.to],
                    edgeIndices: [...current.edgeIndices, next.edgeIndex]
                };
                const previous = bestByStation.get(next.to);
                if (!previous || comparePathCost(candidate, previous) < 0) {
                    bestByStation.set(next.to, candidate);
                    queue.push(candidate);
                }
            }
        }

        return null;
    }

    function createDraft(start = "") {
        return { start, current: start, segments: [] };
    }

    function appendSelection(draft, target, graph) {
        if (!draft.current) {
            return { ok: true, draft: createDraft(target), addedSegment: null };
        }

        const path = findMinimumStopPath(graph, draft.current, target);
        if (!path || path.edgeIndices.length === 0) {
            return { ok: false, error: "无法连接到该车站" };
        }

        const isAdjacent = (graph.byStation.get(draft.current) || []).some(item => item.to === target);
        const addedSegment = {
            kind: isAdjacent ? "manual" : "jump",
            target,
            stations: path.stations,
            edgeIndices: path.edgeIndices
        };

        return {
            ok: true,
            draft: {
                ...draft,
                current: target,
                segments: [...draft.segments, addedSegment]
            },
            addedSegment
        };
    }

    function undoDraft(draft) {
        const segments = draft.segments.slice(0, -1);
        return {
            ...draft,
            current: segments.length ? segments[segments.length - 1].target : draft.start,
            segments
        };
    }

    function clearDraft() {
        return createDraft();
    }

    function confirmDraft(draft, graph) {
        if (!draft.start || !draft.segments.length) {
            return { ok: false, error: "至少选择一个区间" };
        }

        const path_stations = [draft.start];
        const path_edges = [];
        for (const segment of draft.segments) {
            path_stations.push(...segment.stations.slice(1));
            path_edges.push(...segment.edgeIndices);
        }

        const distanceKm = path_edges.reduce((sum, edgeIndex) => sum + edgeDistance(graph.edges[edgeIndex]), 0);
        const transfers = path_edges.reduce((count, edgeIndex, offset) => {
            if (!offset) return count;
            return graph.edges[edgeIndex].line !== graph.edges[path_edges[offset - 1]].line ? count + 1 : count;
        }, 0);

        return { path_stations, path_edges, distanceKm, transfers, source: "custom" };
    }

    window.CustomRoute = {
        createGraph,
        createDraft,
        appendSelection,
        undoDraft,
        clearDraft,
        confirmDraft,
        findMinimumStopPath
    };
})();
