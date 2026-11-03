// Build each hypothetical network using the same raw-edge topology rules as an individual simulation.
self.window = self;
importScripts('topology-rules.js', 'calculation-topology.js', 'network-research-core.js');
const core = self.NetworkResearchCore;
self.onmessage = async ({data}) => {
    try {
        const {city, nodes, edges} = data;
        const topology = self.CalculationTopology.create(city, nodes, edges);
        const base = core.graph(topology.nodes, topology.edges, nodes);
        const baseDistances = base.nodes.map((_, i) => core.shortest(base, i, false).dist);
        const scenarios = [
            ...base.nodes.map(node => ({kind:'station', name:node.name})),
            ...[...new Set(edges.map(edge => edge.line))].map(name => ({kind:'line', name}))
        ];
        const rankings = {station:[], line:[]};
        for (let k=0; k<scenarios.length; k++) {
            const scenario = scenarios[k];
            let remainingNodes = nodes, remainingEdges;
            if (scenario.kind === 'station') {
                const removed = new Set(topology.getMapStationNames(scenario.name));
                remainingNodes = nodes.filter(node => !removed.has(node.name));
                remainingEdges = edges.filter(edge => !removed.has(edge.u) && !removed.has(edge.v));
            } else remainingEdges = edges.filter(edge => edge.line !== scenario.name);
            const changedTopology = self.CalculationTopology.create(city, remainingNodes, remainingEdges);
            const changed = core.graph(changedTopology.nodes, changedTopology.edges, nodes);
            const names = changed.nodes.map(node => node.name).filter(name => base.names.has(name));
            let disconnected = 0, longer = 0, endpointPairs = 0;
            if (scenario.kind === 'station') {
                const original = baseDistances[base.names.get(scenario.name)];
                endpointPairs = names.filter(name => Number.isFinite(original[base.names.get(name)])).length;
            }
            const originalIndices = names.map(name => base.names.get(name));
            const changedIndices = names.map(name => changed.names.get(name));
            for (let i=0; i<names.length; i++) {
                const old = baseDistances[originalIndices[i]], now = core.shortest(changed, changedIndices[i], false).dist;
                for (let j=i+1; j<names.length; j++) {
                    if (!Number.isFinite(old[originalIndices[j]])) continue;
                    const distance = now[changedIndices[j]];
                    if (!Number.isFinite(distance)) disconnected++;
                    else if (distance > old[originalIndices[j]]) longer++;
                }
            }
            rankings[scenario.kind].push({...scenario, disconnected, longer, endpointPairs});
            if (k % 2 === 0 || k === scenarios.length-1) {
                postMessage({type:'progress',current:k+1,total:scenarios.length});
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        const rank = list => list.sort((a,b) => b.disconnected-a.disconnected || b.longer-a.longer || a.name.localeCompare(b.name,'zh')).slice(0,10);
        postMessage({type:'done',station:rank(rankings.station),line:rank(rankings.line), stationTotal:rankings.station.length,lineTotal:rankings.line.length});
    } catch (error) { postMessage({type:'error',message:error.message || String(error)}); }
};
