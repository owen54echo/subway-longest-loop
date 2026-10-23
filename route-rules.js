(function(global, factory) {
    const api = factory();
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    global.SubwayRouteRules = api;
})(typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : globalThis), function() {
    /**
     * Keep route metrics in one module so the custom planner, roadbook and
     * solver use the same distance and transfer definitions.
     */
    function edgeDistance(edge) {
        return Number(edge?.actualLengthKm ?? edge?.straightLengthKm ?? 0);
    }

    function logicalLine(edge) {
        return edge?.logicalLine || edge?.line || "";
    }

    function isThroughServiceTransition(previousEdge, nextEdge) {
        const previousGroups = previousEdge?.throughServiceGroups || [];
        const nextGroups = nextEdge?.throughServiceGroups || [];
        const sharedGroup = previousGroups.find(group => nextGroups.includes(group));
        if (!sharedGroup) return false;

        const previousStations = [previousEdge.mapU || previousEdge.u, previousEdge.mapV || previousEdge.v]
            .filter(station => previousEdge.throughServiceEndpointGroups?.[station] === sharedGroup);
        const nextStations = [nextEdge.mapU || nextEdge.u, nextEdge.mapV || nextEdge.v]
            .filter(station => nextEdge.throughServiceEndpointGroups?.[station] === sharedGroup);

        return previousStations.length > 0 && nextStations.length > 0 &&
            !previousStations.some(station => nextStations.includes(station));
    }

    function countTransfers(edges) {
        return edges.reduce((count, edge, index) => {
            if (!index) return count;
            const previous = edges[index - 1];
            return logicalLine(edge) !== logicalLine(previous) &&
                !isThroughServiceTransition(previous, edge) ? count + 1 : count;
        }, 0);
    }

    function totalDistance(edges) {
        return edges.reduce((sum, edge) => sum + edgeDistance(edge), 0);
    }

    return {
        edgeDistance,
        logicalLine,
        isThroughServiceTransition,
        countTransfers,
        totalDistance
    };
});
