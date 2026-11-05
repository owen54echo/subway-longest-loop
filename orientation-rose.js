/* Directions describe undirected track axes, weighted by geographic line length. */
(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.OrientationRose = api;
})(typeof window === 'undefined' ? globalThis : window, function() {
    'use strict';
    const BINS = 16, R = 6371.0088, radians = degrees => degrees * Math.PI / 180;
    function lengthBearing(a, b) {
        const lat1 = radians(a[1]), lat2 = radians(b[1]), deltaLat = lat2 - lat1, deltaLon = radians(b[0] - a[0]);
        const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
        const km = 2 * R * Math.asin(Math.sqrt(Math.min(1, h)));
        const bearing = (Math.atan2(Math.sin(deltaLon) * Math.cos(lat2), Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon)) * 180 / Math.PI + 360) % 360;
        return {km, bearing};
    }
    const key = (line,u,v) => `${line}\t${u}\t${v}`;
    function analyze(city, geometry, options = {}) {
        if (!city?.edges || !geometry?.positions || !geometry?.segments) throw new Error('方向数据不完整');
        const lines = new Map(), seen = new Set();
        let totalSegments = 0, sourcedSegments = 0, estimatedSegments = 0, missingPositions = 0;
        for (const e of city.edges) {
            const id = key(e.line, ...[e.u,e.v].sort());
            if (seen.has(id)) continue;
            seen.add(id); totalSegments++;
            const a=geometry.positions[e.u], b=geometry.positions[e.v];
            if (!a?.every(Number.isFinite) || !b?.every(Number.isFinite)) { missingPositions++; continue; }
            const f=geometry.segments[key(e.line,e.u,e.v)], reverse=geometry.segments[key(e.line,e.v,e.u)];
            const shape=f || reverse;
            const sourced=Array.isArray(shape?.points) && shape.points.length >= 2;
            if (sourced) sourcedSegments++; else estimatedSegments++;
            if (!sourced && !options.includeEstimated) continue;
            const coords=sourced ? (f ? shape.points.slice() : shape.points.slice().reverse()) : [a,b];
            // Match the line endpoints used by the geographic view.
            coords[0]=a; coords[coords.length-1]=b;
            if (!lines.has(e.line)) lines.set(e.line, {name:e.line,color:e.color,bins:Array(BINS).fill(0),km:0,segments:0});
            const line=lines.get(e.line); line.segments++;
            for (let i=1;i<coords.length;i++) {
                const {km,bearing}=lengthBearing(coords[i-1],coords[i]);
                if (!Number.isFinite(km) || km<=0) continue;
                // A track has two equivalent travel directions: split each length equally
                // across opposite sectors so the chart's sum remains the actual length.
                const axis=Math.round((bearing % 180) / (360 / BINS)) % (BINS / 2);
                line.bins[axis]+=km/2; line.bins[axis+BINS/2]+=km/2; line.km+=km;
            }
        }
        return {lines:[...lines.values()], totalSegments,sourcedSegments,estimatedSegments,missingPositions};
    }
    return {analyze,lengthBearing,BINS};
});
