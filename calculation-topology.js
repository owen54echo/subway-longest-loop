(function(global) {
    const THROUGH_SERVICE_GROUPS = {
        zhengzhou: [{
            name: "南四环",
            stations: ["南四环(郑州航空港站)", "南四环(贾河)"]
        }]
    };

    function create(cityKey, nodes, edges) {
        const aliasToLogical = new Map();
        const logicalToMapStations = new Map();

        for (const group of THROUGH_SERVICE_GROUPS[cityKey] || []) {
            logicalToMapStations.set(group.name, [...group.stations]);
            group.stations.forEach(station => aliasToLogical.set(station, group.name));
        }

        const normalizeStation = station => aliasToLogical.get(station) || station;
        const logicalNodesByName = new Map();

        nodes.forEach(node => {
            const logicalName = normalizeStation(node.name);
            const existing = logicalNodesByName.get(logicalName);
            if (!existing) {
                logicalNodesByName.set(logicalName, {
                    ...node,
                    name: logicalName,
                    lines: [...(node.lines || [])]
                });
                return;
            }
            existing.lines = [...new Set([...existing.lines, ...(node.lines || [])])];
        });

        const calculationEdges = edges.map(edge => {
            const u = normalizeStation(edge.u);
            const v = normalizeStation(edge.v);
            const throughServiceGroups = [...new Set([u, v].filter(name => logicalToMapStations.has(name)))];
            const throughServiceEndpointGroups = Object.fromEntries(
                [edge.u, edge.v]
                    .filter(station => logicalToMapStations.has(normalizeStation(station)))
                    .map(station => [station, normalizeStation(station)])
            );
            return {
                ...edge,
                u,
                v,
                mapU: edge.u,
                mapV: edge.v,
                throughServiceGroups,
                throughServiceEndpointGroups
            };
        });

        function getMapStationNames(station) {
            return logicalToMapStations.get(station) || [station];
        }

        function isThroughServiceTransition(previousEdge, nextEdge) {
            if (!previousEdge || !nextEdge) return false;
            const previousGroups = previousEdge.throughServiceGroups || [];
            const nextGroups = nextEdge.throughServiceGroups || [];
            const sharedGroup = previousGroups.find(group => nextGroups.includes(group));
            if (!sharedGroup) return false;

            const previousStations = [previousEdge.mapU || previousEdge.u, previousEdge.mapV || previousEdge.v]
                .filter(station => previousEdge.throughServiceEndpointGroups?.[station] === sharedGroup);
            const nextStations = [nextEdge.mapU || nextEdge.u, nextEdge.mapV || nextEdge.v]
                .filter(station => nextEdge.throughServiceEndpointGroups?.[station] === sharedGroup);

            return previousStations.length > 0 && nextStations.length > 0 &&
                !previousStations.some(station => nextStations.includes(station));
        }

        return {
            nodes: [...logicalNodesByName.values()],
            edges: calculationEdges,
            normalizeStation,
            getMapStationNames,
            isThroughServiceTransition
        };
    }

    global.CalculationTopology = { create };
})(window);
