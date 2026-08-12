(function(global) {
    const THROUGH_SERVICE_GROUPS = {
        zhengzhou: [{
            name: "南四环",
            stations: ["南四环(郑州航空港站)", "南四环(贾河)"]
        }]
    };

    // Keep route presentation on the source line name, but use these logical line names
    // for transfer and line-reuse rules. Only officially named branches or merged services
    // are grouped here; ordinary cross-line operations remain separate lines.
    const LOGICAL_LINE_GROUPS = {
        beijing: [
            { name: "1号线/八通线", lines: ["1号线", "八通线", "1号线八通线", "1号线/八通线"] },
            { name: "4号线/大兴线", lines: ["4号线", "大兴线", "4号线大兴线", "4号线/大兴线"] }
        ],
        guangzhou: [
            { name: "3号线", lines: ["3号线", "3号线支线", "3号线北延段", "3号线东延段"] },
            { name: "14号线", lines: ["14号线", "14号线支线(知识城线)", "14号线支线", "知识城线"] }
        ],
        shenzhen: [
            { name: "2号线/8号线", lines: ["2号线", "8号线", "2号线/8号线", "2号线&8号线"] },
            { name: "6号线", lines: ["6号线", "6号线/光明线", "6号线支线"] }
        ],
        chongqing: [
            { name: "3号线", lines: ["3号线", "轨道交通3号线(空港线)", "3号线(空港线)"] },
            { name: "6号线", lines: ["6号线", "6号线东站段", "轨道交通国博线", "国博线"] }
        ],
        hangzhou: [
            { name: "绍兴1号线", lines: ["绍兴1号线", "绍兴1号线支线"] }
        ]
    };

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
            normalizeLine,
            getMapStationNames,
            getMapSegments,
            isStationUnavailable: station => unavailableStations.has(station),
            isThroughServiceTransition
        };
    }

    global.CalculationTopology = { create };
})(window);
