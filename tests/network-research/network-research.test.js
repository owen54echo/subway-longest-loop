const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const core = require('../../network-research-core.js');
const nodes = [
    {name:'A',lat:0,lng:0}, {name:'B',lat:0,lng:0.01},
    {name:'C',lat:0.01,lng:0.01}, {name:'D',lat:0.01,lng:0},
    {name:'E',lat:0.02,lng:0}
];
const edges = [
    {u:'A',v:'B',line:'L1'}, {u:'A',v:'B',line:'L2'},
    {u:'B',v:'C',line:'L1'}, {u:'A',v:'D',line:'L3'},
    {u:'D',v:'C',line:'L3'}, {u:'C',v:'E',line:'L1'}
];
const g = core.graph(nodes,edges,nodes);
assert.equal(g.missingWeights,0);
assert.deepStrictEqual(core.path(g,'A','B',false).path_edges,[0]);
assert.deepStrictEqual(core.path(core.graph(nodes,edges.slice(1),nodes),'A','B',false).path_edges,[0]);
assert.equal(core.shortest(g,0,false).dist[2],2);
assert.equal(core.path(g,'A','E',false).path_edges.length,3);
assert.deepStrictEqual(core.components(g,nodes.map(n => n.name)),[5]);
const isolated = core.graph(nodes,edges.filter(e => e.v !== 'E'),nodes);
assert.deepStrictEqual(core.components(isolated,nodes.map(n => n.name)),[4,1]);
assert.equal(core.path(isolated,'A','E',false),null);
assert(Number.isNaN(core.distance(nodes[0],{lat:null,lng:0})));
assert.equal(core.graph(nodes,[{u:'A',v:'B',mapSegments:[{u:'A',v:'missing'}]}],nodes).missingWeights,1);

const windowLike = {};
for (const file of ['topology-rules.js','calculation-topology.js']) new Function('window',fs.readFileSync(file,'utf8'))(windowLike);
const closed = {name:'X',wiki:{operationalStatus:{state:'temporarily_closed',calculation:{mode:'pass_through',from:'A',to:'B',line:'L'}}}};
const rawNodes = [nodes[0],nodes[1],closed], rawEdges = [{u:'A',v:'X',line:'L'}, {u:'X',v:'B',line:'L'}];
assert.equal(windowLike.CalculationTopology.create('beijing',rawNodes,rawEdges).edges.length,1);
assert.equal(windowLike.CalculationTopology.create('beijing',rawNodes,rawEdges.slice(1)).edges.length,0);

async function runWorker(payload) {
    let final;
    const context = {self:{NetworkResearchCore:core}, importScripts:()=>{}, postMessage:x=>{if(x.type==='done'||x.type==='error') final=x;}, setTimeout};
    vm.runInNewContext(fs.readFileSync('network-research-worker.js','utf8'),context);
    await context.self.onmessage({data:payload});
    return final;
}
(async () => {
    const detour = await runWorker({type:'detour',nodes,edges,mapNodes:nodes,minimum:0.1,start:'A'});
    assert.equal(detour.type,'done'); assert.equal(detour.pairs.length,4);
    assert(detour.pairs.every(p=>p.a==='A'));
    const lines = await runWorker({type:'detour',nodes,edges:[
        {u:'A',v:'B',line:'L1'}, {u:'B',v:'C',line:'L2'}, {u:'C',v:'E',line:'L2'}
    ],mapNodes:nodes,maximum:100,start:'A'});
    assert.equal(lines.pairs.find(p=>p.b==='B').lineCount,1);
    assert.equal(lines.pairs.find(p=>p.b==='C').lineCount,2);
    assert.equal(lines.pairs.find(p=>p.b==='E').lineCount,2, 'repeated use of one line counts once');
    const boundary = core.distance(nodes[0], nodes[1]);
    const limited = await runWorker({type:'detour',nodes,edges,mapNodes:nodes,maximum:boundary,start:'A'});
    assert(limited.pairs.some(p => p.b === 'B'), 'exact upper boundary must be included');
    assert(limited.pairs.every(p => p.direct <= boundary), 'outside upper boundary must be excluded');
    assert(limited.stats.tooFar > 0);
    const changedEdges = edges.filter(e => e.v !== 'E');
    const failure = await runWorker({type:'failure',nodes,edges,mapNodes:nodes,changedNodes:nodes,changedEdges});
    assert.equal(failure.stats.baselinePairs,10); assert.equal(failure.stats.disconnected,4);
    assert.equal(failure.stats.longer,0); assert.equal(failure.stats.unchanged,6);
    assert.equal(failure.stats.beforeComponents.length,1); assert.equal(failure.stats.afterComponents.length,2);
    const missing = await runWorker({type:'detour',nodes,edges:[{u:'A',v:'B',mapSegments:[{u:'A',v:'missing'}]}],mapNodes:nodes,minimum:0.1});
    assert.equal(missing.type,'error');
    console.log('network research tests passed');
})().catch(error=>{console.error(error); process.exitCode=1;});

// Multi-edge closures preserve the chosen line, path direction and parallel edge IDs.
const lineEdges = [
    {edge:{u:'A',v:'B'},index:0}, {edge:{u:'B',v:'C'},index:1},
    {edge:{u:'C',v:'D'},index:2}, {edge:{u:'D',v:'A'},index:3}
];
const ring = core.linePaths(lineEdges,'A','C');
assert.equal(ring.paths.length,2);
assert.deepStrictEqual(ring.paths.map(p => p.stations),[['A','B','C'],['A','D','C']]);
assert.deepStrictEqual(core.linePaths(lineEdges,'B','B').paths,[]);
assert.deepStrictEqual(core.linePaths(lineEdges,'A','Z').paths,[]);
assert.equal(core.linePaths(lineEdges,'A','C',1).truncated,true);
const duplicate = core.linePaths([{edge:{u:'A',v:'B',line:'L'},index:3},{edge:{u:'B',v:'A',line:'L'},index:8}],'A','B');
assert.deepStrictEqual(duplicate.paths.map(p => p.edges),[[3,8]]);
assert.equal(duplicate.paths[0].segmentCount,1);
const distinct = core.linePaths([{edge:{u:'A',v:'B',line:'L',color:'red'},index:3},{edge:{u:'A',v:'B',line:'L',color:'blue'},index:8}],'A','B');
assert.deepStrictEqual(distinct.paths.map(p => p.edges),[[3],[8]]);
