(function(global, factory) {
    const api = factory();
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    global.SolverContract = api;
})(typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : globalThis), function() {
    const WEIGHT_EPSILON = 1e-9;
    const VALID_MODES = new Set(["path", "loop"]);
    const VALID_METRICS = new Set(["edges", "stations", "distance"]);

    function error(code, message, context = {}) {
        return { code, message, context };
    }

    function edgeLogicalLine(edge) {
        return edge?.logicalLine || edge?.line || "";
    }

    function edgeDistance(edge) {
        const value = edge?.actualLengthKm ?? edge?.straightLengthKm;
        return Number.isFinite(value) && value > 0 ? Number(value) : null;
    }

    function edgeWeight(edge, metric) {
        if (metric === "distance") return edgeDistance(edge);
        return 1;
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

    function validateRequest(config) {
        const errors = [];
        const nodes = Array.isArray(config?.nodes) ? config.nodes : [];
        const edges = Array.isArray(config?.edges) ? config.edges : [];
        const nodeNames = new Set();

        if (!VALID_MODES.has(config?.mode)) {
            errors.push(error("INVALID_MODE", "路线模式无效。", { mode: config?.mode }));
        }
        if (!VALID_METRICS.has(config?.optimize_metric)) {
            errors.push(error("INVALID_METRIC", "优化指标无效。", { metric: config?.optimize_metric }));
        }
        ["allow_station_reuse", "allow_line_reuse"].forEach(field => {
            if (typeof config?.[field] !== "boolean") {
                errors.push(error("INVALID_BOOLEAN", `${field} 必须是布尔值。`, { field, value: config?.[field] }));
            }
        });
        if (!nodes.length) errors.push(error("EMPTY_NODES", "没有可用车站。"));
        if (!edges.length) errors.push(error("EMPTY_EDGES", "没有可用区间。"));

        nodes.forEach((node, index) => {
            if (!node?.name || typeof node.name !== "string") {
                errors.push(error("INVALID_NODE", "车站节点缺少有效名称。", { index }));
            } else if (nodeNames.has(node.name)) {
                errors.push(error("DUPLICATE_NODE", "车站名称重复，无法建立唯一拓扑。", { station: node.name }));
            } else {
                nodeNames.add(node.name);
            }
        });

        edges.forEach((edge, index) => {
            if (!nodeNames.has(edge?.u) || !nodeNames.has(edge?.v)) {
                errors.push(error("DANGLING_EDGE", "区间端点不在车站节点中。", { index, u: edge?.u, v: edge?.v }));
            }
            if (edge?.u === edge?.v) {
                errors.push(error("SELF_LOOP", "不允许存在车站到自身的区间。", { index, station: edge.u }));
            }
            if (!edgeLogicalLine(edge)) {
                errors.push(error("INVALID_LINE", "区间缺少线路名称。", { index }));
            }
            if (config?.optimize_metric === "distance" && edgeDistance(edge) === null) {
                errors.push(error("MISSING_DISTANCE", "距离优化不能使用缺失或非正区间距离。", { index }));
            }
        });

        if (!nodeNames.has(config?.start_station)) {
            errors.push(error("UNKNOWN_START_STATION", "起始车站不存在。", { station: config?.start_station }));
        }
        if (config?.mode === "path" && config?.end_station !== null && config?.end_station !== undefined &&
            !nodeNames.has(config.end_station)) {
            errors.push(error("UNKNOWN_END_STATION", "终点车站不存在。", { station: config.end_station }));
        }
        if (config?.mode === "loop" && config?.end_station) {
            errors.push(error("LOOP_HAS_END_STATION", "闭环模式不能设置终点车站。", { station: config.end_station }));
        }

        const waypoints = Array.isArray(config?.waypoints) ? config.waypoints : [];
        const uniqueWaypoints = new Set();
        waypoints.forEach(station => {
            if (!nodeNames.has(station)) {
                errors.push(error("UNKNOWN_WAYPOINT", "必经车站不存在。", { station }));
            }
            if (uniqueWaypoints.has(station)) {
                errors.push(error("DUPLICATE_WAYPOINT", "必经车站不能重复配置。", { station }));
            }
            uniqueWaypoints.add(station);
        });

        ["max_transfers", "max_lines"].forEach(field => {
            const value = config?.[field];
            if (value !== null && value !== undefined && (!Number.isInteger(value) || value < 0)) {
                errors.push(error("INVALID_LIMIT", `${field} 必须是非负整数或 null。`, { field, value }));
            }
        });

        const avoidedStations = new Set(config?.avoided_stations || []);
        if (avoidedStations.has(config?.start_station)) {
            errors.push(error("START_STATION_AVOIDED", "起始车站不能同时加入避让列表。", { station: config.start_station }));
        }
        if (avoidedStations.has(config?.end_station)) {
            errors.push(error("END_STATION_AVOIDED", "终点车站不能同时加入避让列表。", { station: config.end_station }));
        }
        for (const station of uniqueWaypoints) {
            if (avoidedStations.has(station)) {
                errors.push(error("WAYPOINT_AVOIDED", "必经车站不能同时加入避让列表。", { station }));
            }
        }

        return { ok: errors.length === 0, errors };
    }

    function pathSignature(result) {
        return (result?.path_edges || []).join(",");
    }

    function topologyFingerprint(nodes, edges) {
        const nodePart = (nodes || []).map(node => node?.name || "").sort().join("|");
        const edgePart = (edges || []).map(edge => {
            const endpoints = [edge?.u || "", edge?.v || ""].sort().join("~");
            const distance = edgeDistance(edge);
            return `${endpoints}~${edgeLogicalLine(edge)}~${distance === null ? "" : distance}`;
        }).sort().join("|");
        const source = `${nodePart}::${edgePart}`;
        let hash = 2166136261;
        for (let index = 0; index < source.length; index++) {
            hash ^= source.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return `topology-v1:${(hash >>> 0).toString(16).padStart(8, "0")}:${nodes.length}:${edges.length}`;
    }

    function compareResults(left, right) {
        const leftWeight = Number(left?.weight ?? -1);
        const rightWeight = Number(right?.weight ?? -1);
        if (Math.abs(leftWeight - rightWeight) > WEIGHT_EPSILON) {
            return leftWeight > rightWeight ? 1 : -1;
        }
        const leftSignature = pathSignature(left);
        const rightSignature = pathSignature(right);
        if (leftSignature === rightSignature) return 0;
        return leftSignature < rightSignature ? 1 : -1;
    }

    function verifyResult(config, result) {
        const errors = [];
        const edges = config?.edges || [];
        const stations = Array.isArray(result?.path_stations) ? result.path_stations : [];
        const pathEdges = Array.isArray(result?.path_edges) ? result.path_edges : [];
        const start = config?.start_station;
        const end = config?.end_station;

        if (pathEdges.length === 0 || stations.length !== pathEdges.length + 1) {
            errors.push(error("INVALID_PATH_SHAPE", "路线区间和车站数量不匹配。"));
            return { ok: false, errors };
        }
        if (stations[0] !== start) {
            errors.push(error("INVALID_PATH_START", "路线没有从指定起点开始。", { expected: start, actual: stations[0] }));
        }
        if (config.mode === "loop" && stations.at(-1) !== start) {
            errors.push(error("INVALID_LOOP_END", "闭环路线没有回到起点。", { expected: start, actual: stations.at(-1) }));
        }
        if (config.mode === "path" && end && stations.at(-1) !== end) {
            errors.push(error("INVALID_PATH_END", "路线没有到达指定终点。", { expected: end, actual: stations.at(-1) }));
        }

        const usedEdges = new Set();
        const stationVisits = new Map();
        const lineUsage = new Map();
        let transfers = 0;
        let weight = 0;
        let previousLine = null;

        pathEdges.forEach((edgeId, index) => {
            const edge = Number.isInteger(edgeId) ? edges[edgeId] : null;
            const from = stations[index];
            const to = stations[index + 1];
            if (!edge) {
                errors.push(error("INVALID_EDGE_ID", "路线包含不存在的区间。", { index, edgeId }));
                return;
            }
            if (usedEdges.has(edgeId)) {
                errors.push(error("REPEATED_EDGE", "路线重复经过同一个区间。", { edgeId }));
            }
            usedEdges.add(edgeId);
            if (!((edge.u === from && edge.v === to) || (edge.u === to && edge.v === from))) {
                errors.push(error("DISCONNECTED_PATH", "路线相邻区间无法连接。", { index, from, to, edge }));
            }

            const line = edgeLogicalLine(edge);
            if (previousLine !== null && previousLine !== line && !isThroughServiceTransition(edges[pathEdges[index - 1]], edge)) {
                transfers++;
            }
            previousLine = line;
            lineUsage.set(line, (lineUsage.get(line) || 0) + 1);
            weight += edgeWeight(edge, config.optimize_metric) || 0;
        });

        stations.forEach(station => stationVisits.set(station, (stationVisits.get(station) || 0) + 1));
        if (!config.allow_station_reuse) {
            for (const [station, count] of stationVisits) {
                const allowedLoopReturn = config.mode === "loop" && station === start && count === 2;
                if (count > 1 && !allowedLoopReturn) {
                    errors.push(error("REPEATED_STATION", "路线违反不重复车站限制。", { station, count }));
                }
            }
        }

        if (!config.allow_line_reuse) {
            const seen = new Set();
            let previous = null;
            for (const edgeId of pathEdges) {
                const line = edgeLogicalLine(edges[edgeId]);
                if (line !== previous && seen.has(line)) {
                    errors.push(error("REPEATED_LINE", "路线违反不重复线路限制。", { line }));
                }
                seen.add(line);
                previous = line;
            }
        }
        if (config.max_lines !== null && lineUsage.size > config.max_lines) {
            errors.push(error("TOO_MANY_LINES", "路线超过最大线路数限制。", { actual: lineUsage.size, limit: config.max_lines }));
        }
        if (config.max_transfers !== null && transfers > config.max_transfers) {
            errors.push(error("TOO_MANY_TRANSFERS", "路线超过最大换乘次数限制。", { actual: transfers, limit: config.max_transfers }));
        }
        for (const waypoint of config.waypoints || []) {
            if (!stationVisits.has(waypoint)) {
                errors.push(error("MISSING_WAYPOINT", "路线未经过必经车站。", { station: waypoint }));
            }
        }
        if (Number.isFinite(result?.weight) && Math.abs(result.weight - weight) > WEIGHT_EPSILON) {
            errors.push(error("WEIGHT_MISMATCH", "路线权重与区间权重之和不一致。", { expected: weight, actual: result.weight }));
        }

        return { ok: errors.length === 0, errors, metrics: { transfers, weight, lines: lineUsage.size } };
    }

    return {
        WEIGHT_EPSILON,
        edgeLogicalLine,
        edgeDistance,
        edgeWeight,
        isThroughServiceTransition,
        topologyFingerprint,
        validateRequest,
        verifyResult,
        compareResults
    };
});
