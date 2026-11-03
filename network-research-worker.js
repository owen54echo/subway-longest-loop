importScripts('network-research-core.js');
const core = self.NetworkResearchCore;
self.onmessage = async ({data}) => {
    try {
        const base = core.graph(data.nodes, data.edges, data.mapNodes);
        if (data.type === 'detour' && base.missingWeights) throw new Error(`有 ${base.missingWeights} 个区间缺少有效坐标，无法完整计算距离排行。`);
        const changed = data.type === 'failure' ? core.graph(data.changedNodes, data.changedEdges, data.mapNodes) : null;
        const surviving = changed ? changed.nodes.map(n => n.name).filter(n => base.names.has(n)) : base.nodes.map(n => n.name);
        if (data.type === 'detour' && data.start && surviving.includes(data.start)) {
            surviving.splice(surviving.indexOf(data.start), 1);
            surviving.unshift(data.start);
        }
        const pairs = [], stats = { baselinePairs:0, disconnected:0, longer:0, unchanged:0, excluded:0, tooFar:0, invalid:0, endpointPairs:0 };
        const startCount = data.type === 'detour' && data.start ? 1 : surviving.length;
        for (let i = 0; i < startCount; i++) {
            const a = surviving[i], baseline = core.shortest(base, base.names.get(a), false);
            const weighted = data.type === 'detour' ? core.shortest(base, base.names.get(a), true) : null;
            const altered = changed ? core.shortest(changed, changed.names.get(a), false) : null;
            for (let j = i + 1; j < surviving.length; j++) {
                const b = surviving[j], old = baseline.dist[base.names.get(b)];
                if (data.type === 'detour' && data.start && a !== data.start && b !== data.start) continue;
                if (!Number.isFinite(old)) continue;
                stats.baselinePairs++;
                if (changed) {
                    const now = altered.dist[changed.names.get(b)];
                    const kind = !Number.isFinite(now) ? 'disconnected' : now > old ? 'longer' : 'unchanged';
                    stats[kind]++;
                    if (kind !== 'unchanged') pairs.push({a,b,old,now,kind});
                } else {
                    const direct = core.distance(base.nodes[base.names.get(a)], base.nodes[base.names.get(b)]);
                    const km = weighted.dist[base.names.get(b)];
                    if (!Number.isFinite(direct) || direct < 0.001 || !Number.isFinite(km) || km + 0.001 < direct) { stats.excluded++; stats.invalid++; continue; }
                    if (direct > (data.maximum ?? Infinity)) { stats.excluded++; stats.tooFar++; continue; }
                    const lines = new Set();
                    const startIndex = base.names.get(a);
                    for (let node = base.names.get(b); node !== startIndex; node = weighted.prev[node]) {
                        const edge = base.edges[weighted.prevEdge[node]];
                        if (!edge?.line || weighted.prev[node] < 0) throw new Error('最短路线的线路数据不完整，无法计算线路数。');
                        lines.add(edge.line);
                    }
                    pairs.push({a,b,direct,km,ratio:km/direct,hops:old,lineCount:lines.size});
                }
            }
            if (i % 8 === 0) { postMessage({type:'progress',current:i+1,total:startCount}); await new Promise(resolve => setTimeout(resolve, 0)); }
        }
        if (changed && data.closedStation && base.names.has(data.closedStation)) {
            const ds = core.shortest(base, base.names.get(data.closedStation), false).dist;
            stats.endpointPairs = surviving.filter(n => Number.isFinite(ds[base.names.get(n)])).length;
        }
        if (changed) {
            stats.beforeComponents = core.components(base,surviving);
            stats.afterComponents = core.components(changed,surviving);
            pairs.sort((a,b) => (a.kind === b.kind ? (b.now-b.old)-(a.now-a.old) : a.kind === 'disconnected' ? -1 : 1));
        } else pairs.sort((a,b) => b.ratio-a.ratio);
        postMessage({type:'done',pairs,stats});
    } catch (error) { postMessage({type:'error',message:error.message || String(error)}); }
};
