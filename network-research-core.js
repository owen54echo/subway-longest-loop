(function (root) {
    'use strict';
    const INF = Infinity;
    function distance(a, b) {
        if (![a?.lat, a?.lng, b?.lat, b?.lng].every(Number.isFinite)) return NaN;
        const rad = Math.PI / 180, dlat = (b.lat - a.lat) * rad, dlng = (b.lng - a.lng) * rad;
        const h = Math.sin(dlat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dlng / 2) ** 2;
        return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
    }
    function graph(nodes, edges, mapNodes) {
        const names = new Map(nodes.map((n, i) => [n.name, i]));
        const raw = new Map((mapNodes || nodes).map(n => [n.name, n]));
        const adj = nodes.map(() => []);
        let missingWeights = 0;
        edges.forEach((e, index) => {
            const a = names.get(e.u), b = names.get(e.v);
            if (a === undefined || b === undefined || a === b) return;
            const pieces = e.mapSegments?.length ? e.mapSegments : [{u:e.mapU || e.u, v:e.mapV || e.v}];
            const weights = pieces.map(p => distance(raw.get(p.u), raw.get(p.v)));
            const weight = weights.every(w => Number.isFinite(w) && w > 0) ? weights.reduce((x,y) => x+y, 0) : NaN;
            if (!Number.isFinite(weight)) missingWeights++;
            adj[a].push({to:b, index, weight}); adj[b].push({to:a, index, weight});
        });
        return { nodes, edges, names, adj, missingWeights };
    }
    function shortest(g, start, weighted) {
        const n = g.nodes.length, dist = Array(n).fill(INF), prev = Array(n).fill(-1), prevEdge = Array(n).fill(-1);
        dist[start] = 0;
        if (!weighted) {
            const q = [start];
            for (let head = 0; head < q.length; head++) {
                const u = q[head];
                for (const edge of g.adj[u]) if (dist[edge.to] === INF) {
                    dist[edge.to] = dist[u] + 1; prev[edge.to] = u; prevEdge[edge.to] = edge.index; q.push(edge.to);
                }
            }
        } else {
            const used = Array(n).fill(false);
            for (let i = 0; i < n; i++) {
                let u = -1;
                for (let j = 0; j < n; j++) if (!used[j] && (u < 0 || dist[j] < dist[u])) u = j;
                if (u < 0 || dist[u] === INF) break;
                used[u] = true;
                for (const edge of g.adj[u]) if (Number.isFinite(edge.weight) && dist[u] + edge.weight < dist[edge.to]) {
                    dist[edge.to] = dist[u] + edge.weight; prev[edge.to] = u; prevEdge[edge.to] = edge.index;
                }
            }
        }
        return {dist, prev, prevEdge};
    }
    function path(g, from, to, weighted) {
        const a = g.names.get(from), b = g.names.get(to);
        if (a === undefined || b === undefined) return null;
        const s = shortest(g, a, weighted);
        if (!Number.isFinite(s.dist[b])) return null;
        const stations = [], edges = [];
        for (let u = b; u !== a; u = s.prev[u]) { stations.push(g.nodes[u].name); edges.push(s.prevEdge[u]); }
        stations.push(from); stations.reverse(); edges.reverse();
        return {path_stations:stations, path_edges:edges};
    }
    function components(g, survivingNames) {
        const remaining = new Set(survivingNames), groups = [];
        while (remaining.size) {
            const name = remaining.values().next().value, distances = shortest(g, g.names.get(name), false).dist;
            const group = [...remaining].filter(n => Number.isFinite(distances[g.names.get(n)]));
            group.forEach(n => remaining.delete(n)); groups.push(group.length);
        }
        return groups.sort((a,b) => b-a);
    }
    // A line's branches may repeat the exact same undirected map edge. The
    // calculation graph is undirected, so remove all identical copies together.
    function groupLineEdges(lineEdges) {
        const groups = new Map();
        for (const {edge, index} of lineEdges) {
            const attributes = Object.keys(edge).filter(key => key !== 'u' && key !== 'v').sort().map(key => [key, edge[key]]);
            const key = JSON.stringify([[edge.u, edge.v].sort(), attributes]);
            if (!groups.has(key)) groups.set(key, {edge, indices:[]});
            groups.get(key).indices.push(index);
        }
        return [...groups.values()];
    }
    function linePaths(lineEdges, start, end, limit = 24) {
        if (!start || !end || start === end) return {paths: [], truncated: false};
        const adj = new Map();
        for (const {edge, indices} of groupLineEdges(lineEdges)) {
            if (!adj.has(edge.u)) adj.set(edge.u, []);
            if (!adj.has(edge.v)) adj.set(edge.v, []);
            adj.get(edge.u).push({to:edge.v, indices});
            adj.get(edge.v).push({to:edge.u, indices});
        }
        const paths = [], visited = new Set([start]);
        let explored = 0, truncated = false;
        function visit(node, stations, edges) {
            if (truncated) return;
            if (++explored > 100000) { truncated = true; return; }
            if (node === end) {
                if (paths.length >= limit) { truncated = true; return; }
                paths.push({stations:[...stations], edges:edges.flat(), segmentCount:edges.length});
                return;
            }
            for (const edge of adj.get(node) || []) {
                if (visited.has(edge.to)) continue;
                visited.add(edge.to); stations.push(edge.to); edges.push(edge.indices);
                visit(edge.to, stations, edges);
                edges.pop(); stations.pop(); visited.delete(edge.to);
                if (truncated) break;
            }
        }
        visit(start,[start],[]);
        return {paths, truncated};
    }
    root.NetworkResearchCore = { distance, graph, shortest, path, components, linePaths, groupLineEdges };
    if (typeof module !== 'undefined') module.exports = root.NetworkResearchCore;
})(typeof self !== 'undefined' ? self : globalThis);
