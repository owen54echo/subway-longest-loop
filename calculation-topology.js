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
                logicalLine: normalizeLine(edge.line),
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
            normalizeLine,
            getMapStationNames,
            isThroughServiceTransition
        };
    }

    global.CalculationTopology = { create };
})(window);
