(function(global) {
    const topologyRules = global.SubwayTopologyRules;
    if (!topologyRules) {
        throw new Error("SubwayTopologyRules must be loaded before calculation-topology.js");
    }
    const THROUGH_SERVICE_GROUPS = topologyRules.throughServiceGroups;
    const LOGICAL_LINE_GROUPS = topologyRules.logicalLineGroups;

    function create(cityKey, nodes, edges) {
        const aliasToLogical = new Map();
        const logicalToMapStations = new Map();
        const lineAliasToLogical = new Map();
        const unavailableStations = new Set(
            nodes
                .filter(node => node?.wiki?.operationalStatus?.state === "temporarily_closed")
                .map(node => node.name)
        );

        for (const group of THROUGH_SERVICE_GROUPS[cityKey] || []) {
            logicalToMapStations.set(group.name, [...group.stations]);
            group.stations.forEach(station => aliasToLogical.set(station, group.name));
        }

        for (const group of LOGICAL_LINE_GROUPS[cityKey] || []) {
            group.lines.forEach(line => lineAliasToLogical.set(line, group.name));
        }

        const normalizeStation = station => aliasToLogical.get(station) || station;
        const normalizeLine = line => lineAliasToLogical.get(line) || line;
        const logicalNodesByName = new Map();

        nodes.filter(node => !unavailableStations.has(node.name)).forEach(node => {
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

        function createCalculationEdge(edge) {
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
                logicalLine: normalizeLine(edge.line),
                mapU: edge.u,
                mapV: edge.v,
                throughServiceGroups,
                throughServiceEndpointGroups
            };
        }

        const calculationEdges = edges
            .filter(edge => !unavailableStations.has(edge.u) && !unavailableStations.has(edge.v))
            .map(createCalculationEdge);

        // A temporarily closed station remains on the map, but a declared through-service
        // section becomes one calculation edge so routes can pass it without stopping.
        nodes.filter(node => unavailableStations.has(node.name)).forEach(node => {
            const calculation = node.wiki?.operationalStatus?.calculation;
            if (calculation?.mode !== "pass_through" || !calculation.from || !calculation.to || !calculation.line) return;

            const fromEdge = edges.find(edge =>
                edge.line === calculation.line &&
                ((edge.u === calculation.from && edge.v === node.name) || (edge.v === calculation.from && edge.u === node.name))
            );
            const toEdge = edges.find(edge =>
                edge.line === calculation.line &&
                ((edge.u === calculation.to && edge.v === node.name) || (edge.v === calculation.to && edge.u === node.name))
            );
            if (!fromEdge || !toEdge) return;

            const edgeDistance = edge => Number(edge.actualLengthKm ?? edge.straightLengthKm ?? 0);
            calculationEdges.push({
                u: normalizeStation(calculation.from),
                v: normalizeStation(calculation.to),
                mapU: calculation.from,
                mapV: calculation.to,
                line: calculation.line,
                logicalLine: normalizeLine(calculation.line),
                color: fromEdge.color || toEdge.color,
                straightLengthKm: Number((edgeDistance(fromEdge) + edgeDistance(toEdge)).toFixed(3)),
                throughServiceGroups: [],
                throughServiceEndpointGroups: {},
                throughService: true,
                skippedStations: [node.name],
                mapSegments: [
                    { u: calculation.from, v: node.name, line: fromEdge.line, color: fromEdge.color },
                    { u: node.name, v: calculation.to, line: toEdge.line, color: toEdge.color }
                ]
            });
        });

        function getMapStationNames(station) {
            return logicalToMapStations.get(station) || [station];
        }

        function getMapSegments(edge) {
            if (Array.isArray(edge?.mapSegments) && edge.mapSegments.length) return edge.mapSegments;
            return [{
                u: edge?.mapU || edge?.u,
                v: edge?.mapV || edge?.v,
                line: edge?.line,
                color: edge?.color
            }];
        }

        function isThroughServiceTransition(previousEdge, nextEdge) {
            return global.SubwayRouteRules
                ? global.SubwayRouteRules.isThroughServiceTransition(previousEdge, nextEdge)
                : false;
        }

        return {
            nodes: [...logicalNodesByName.values()],
            edges: calculationEdges,
            normalizeStation,
            normalizeLine,
            getMapStationNames,
            getMapSegments,
            isStationUnavailable: station => unavailableStations.has(station),
            isThroughServiceTransition
        };
    }

    global.CalculationTopology = { create };
})(window);
