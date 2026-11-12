const assert=require('node:assert/strict'),fs=require('node:fs'),S=require('../../solver-contract.js');
const w={};for(const f of ['topology-rules.js','route-rules.js','calculation-topology.js','subway_data.js','city_extremes_results.js']) new Function('window',fs.readFileSync(f,'utf8'))(w);
const city=w.subwayDataMap.chongqing,t=w.CalculationTopology.create('chongqing',city.nodes,city.edges);
const rows=w.cityExtremeResults.chongqing;
assert.equal(Object.keys(rows).length,8);
for(const [key,entry] of Object.entries(rows)){
 assert.equal(entry.total,t.nodes.length,key);assert.equal(entry.topologyFingerprint,S.topologyFingerprint(t.nodes,t.edges),key);
 assert.ok(entry.result,key);const r=entry.result;
 const check=S.verifyResult({nodes:t.nodes,edges:t.edges,start_station:r.path_stations[0],end_station:null,mode:key.startsWith('loop')?'loop':'path',allow_station_reuse:key.includes('reuse'),allow_line_reuse:true,max_transfers:null,max_lines:null,waypoints:[],optimize_metric:key.includes('distance')?'distance':'edges'},r);
 assert.ok(check.ok,`${key}: ${JSON.stringify(check.errors)}`);
}
console.log('Chongqing 15 line city-wide precomputations verified');
