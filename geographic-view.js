/* A display-only projection. Source topology, distances and station coordinates are never modified. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.GeographicView = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
    'use strict';
    const project = ([lon, lat]) => ({ x: (lon - 113) * Math.cos(23 * Math.PI / 180) * 3000, y: (24 - lat) * 3000 });
    const key = (line, u, v) => `${line}\t${u}\t${v}`;
    function create(city, geometry) {
        if (!geometry?.positions || !geometry?.segments || !Array.isArray(city?.nodes) || !Array.isArray(city?.edges)) throw new Error('地理走向数据格式不完整');
        const coordinates = city.nodes.map(node => geometry.positions[node.name]).filter(point => point?.every(Number.isFinite));
        const centerLat = coordinates.reduce((sum, point) => sum + point[1], 0) / coordinates.length;
        const centerLon = coordinates.reduce((sum, point) => sum + point[0], 0) / coordinates.length;
        const projectCity = ([lon, lat]) => ({x: (lon - centerLon) * Math.cos(centerLat * Math.PI / 180) * 3000, y: (centerLat - lat) * 3000});
        const nodes = city.nodes.map(node => {
            const point = geometry.positions[node.name];
            if (!point || !point.every(Number.isFinite)) throw new Error(`缺少 ${node.name} 的地理坐标`);
            return { ...node, ...projectCity(point) };
        });
        const byName = new Map(nodes.map(n => [n.name, n]));
        function points(edge) {
            const u = byName.get(edge.u), v = byName.get(edge.v);
            if (!u || !v) return null;
            const forward = geometry.segments[key(edge.line, edge.u, edge.v)];
            const reverse = geometry.segments[key(edge.line, edge.v, edge.u)];
            const segment = forward || reverse;
            if (!segment || !Array.isArray(segment.points) || segment.points.length < 2) return { estimated:true, points:[u,v] };
            const coords = reverse && !forward ? [...segment.points].reverse() : segment.points;
            const projected = coords.map(projectCity);
            projected[0] = { x:u.x, y:u.y }; projected[projected.length - 1] = { x:v.x, y:v.y };
            return { estimated:false, points:projected, source:segment.source };
        }
        return { data:{ ...city, nodes }, points, metadata:geometry.meta };
    }
    return { create, project, key };
});
