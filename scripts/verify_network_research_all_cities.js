// Local integration audit: actual city data, both workers, and their shared topology rules.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const core = require('../network-research-core.js');
const browser = {};
const page = vm.createContext({window:browser});
for (const file of ['subway_data.js','topology-rules.js','calculation-topology.js']) vm.runInContext(fs.readFileSync(file,'utf8'),page);
async function runWorker(file, payload) {
    const sandbox = {setTimeout, console}; sandbox.self = sandbox;
    const context = vm.createContext(sandbox);
    let answer;
    sandbox.postMessage = message => {if (message.type === 'done' || message.type === 'error') answer = message;};
    sandbox.importScripts = (...scripts) => scripts.forEach(script => vm.runInContext(fs.readFileSync(script,'utf8'),context));
    vm.runInContext(fs.readFileSync(file,'utf8'),context);
    await sandbox.onmessage({data:payload});
    if (!answer || answer.type === 'error') throw new Error(answer?.message || `No result: ${file}`);
    return answer;
}
async function audit(key, raw) {
    const topology = browser.CalculationTopology.create(key,raw.nodes,raw.edges);
    const nodeMap = new Map(raw.nodes.map(n => [n.name,n]));
    const inconsistent = raw.edges.filter(e => {
        const d = core.distance(nodeMap.get(e.u),nodeMap.get(e.v));
        return !Number.isFinite(e.straightLengthKm) || e.straightLengthKm <= 0 || !Number.isFinite(d) || Math.abs(e.straightLengthKm-d)>0.005;
    });
    assert.equal(inconsistent.length,0,`${key} inconsistent map-edge distances`);
    const common = {nodes:topology.nodes, edges:topology.edges, mapNodes:raw.nodes};
    const detour = await runWorker('network-research-worker.js',{...common,type:'detour',maximum:2});
    assert(detour.pairs.length > 0,`${key} no nearby reachable pairs`);
    assert(detour.pairs.every(p => p.direct <= 2 && p.lineCount > 0),`${key} invalid detour result`);
    const graph = core.graph(topology.nodes,topology.edges,raw.nodes);
    for (const p of detour.pairs.slice(0,10)) {
        const path = core.path(graph,p.a,p.b,true);
        assert(path,`${key} missing weighted route`);
        assert.equal(new Set(path.path_edges.map(i => topology.edges[i].line)).size,p.lineCount,`${key} incorrect line count`);
    }
    const rankings = await runWorker('network-failure-ranking-worker.js',{city:key,nodes:raw.nodes,edges:raw.edges});
    assert.equal(rankings.stationTotal,topology.nodes.length);
    assert(rankings.station.length > 0 && rankings.line.length > 0,`${key} missing rankings`);
    for (const rank of [rankings.station[0],rankings.line[0]]) {
        let nodes = raw.nodes, edges;
        if (rank.kind === 'station') {
            const removed = new Set(topology.getMapStationNames(rank.name));
            nodes = nodes.filter(n=>!removed.has(n.name));
            edges = raw.edges.filter(e=>!removed.has(e.u)&&!removed.has(e.v));
        } else edges = raw.edges.filter(e=>e.line!==rank.name);
        const modified = browser.CalculationTopology.create(key,nodes,edges);
        const individual = await runWorker('network-research-worker.js',{...common,type:'failure',closedStation:rank.kind === 'station' ? rank.name : undefined, changedNodes:modified.nodes,changedEdges:modified.edges});
        assert.equal(rank.disconnected,individual.stats.disconnected,`${key} ${rank.name} disconnected`);
        assert.equal(rank.longer,individual.stats.longer,`${key} ${rank.name} longer`);
        if (rank.kind === 'station') assert.equal(rank.endpointPairs,individual.stats.endpointPairs,`${key} endpoint pairs`);
        assert.equal(individual.stats.baselinePairs,individual.stats.disconnected+individual.stats.longer+individual.stats.unchanged);
    }
    console.log(`${key}: ${detour.pairs.length} nearby pairs, ${rankings.stationTotal} stations, ${rankings.lineTotal} lines — OK`);
}
(async () => {
    for (const [key,city] of Object.entries(browser.subwayDataMap)) await audit(key,city);
    console.log('All 17 city research audits passed.');
})().catch(error => {console.error(error);process.exitCode=1;});
