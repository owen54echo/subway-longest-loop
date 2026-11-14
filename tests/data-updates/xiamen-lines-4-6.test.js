const assert = require('node:assert/strict'), fs = require('node:fs'), S = require('../../solver-contract.js');
const w = {}; for (const f of ['topology-rules.js','route-rules.js','calculation-topology.js','subway_data.js','city_extremes_results.js']) new Function('window', fs.readFileSync(f,'utf8'))(w);
const city = w.subwayDataMap.xiamen, spec = JSON.parse(fs.readFileSync('data/xiamen-lines-4-6.json','utf8'));
const expected = {'4号线':['集美软件园北','后溪','厦门北站','官浔','丙洲','城场','洪坑','前浯'],'6号线':['角江路','角美中心','文圃路','角海路','角美东','一农','林埭','鼎美','马銮中心','西滨','碑头','杏滨','内茂','董任','官任','杏林湾','华侨大学']};
const geo = JSON.parse(fs.readFileSync('data/geometry/xiamen.json','utf8'));
for (const [line, names] of Object.entries(expected)) {
 assert.deepEqual(spec[line].stations.map(s=>s.name), names);
 const edges=city.edges.filter(e=>e.line===line); assert.equal(edges.length,names.length-1);
 edges.forEach((e,i)=>{assert.equal(e.u,names[i]);assert.equal(e.v,names[i+1]);assert(e.straightLengthKm>0);assert(geo.missing.includes(`${line}\t${e.u}\t${e.v}`));});
 for(const name of names) {const n=city.nodes.find(n=>n.name===name);assert(n && n.lines.includes(line) && geo.positions[name],`${line}/${name}`);}
}
for (const name of ['西岩','陈井','翔安机场','洞庭','龙江明珠','石美']) assert(!city.nodes.some(n=>n.name===name), name);
for (const [name,lines] of Object.entries({'厦门北站':['1号线','4号线'],'洪坑':['3号线','4号线'],'官任':['1号线','6号线'],'鼎美':['2号线','6号线'],'马銮中心':['2号线','6号线']})) assert(lines.every(line=>city.nodes.find(n=>n.name===name).lines.includes(line)),name);
const t=w.CalculationTopology.create('xiamen',city.nodes,city.edges), results=w.cityExtremeResults.xiamen;assert.equal(Object.keys(results).length,8);
for(const [key,entry] of Object.entries(results)) {assert.equal(entry.total,t.nodes.length);assert.equal(entry.topologyFingerprint,S.topologyFingerprint(t.nodes,t.edges));const r=entry.result;assert(r,key);const check=S.verifyResult({nodes:t.nodes,edges:t.edges,start_station:r.path_stations[0],end_station:null,mode:key.startsWith('loop')?'loop':'path',allow_station_reuse:key.includes('reuse'),allow_line_reuse:true,max_transfers:null,max_lines:null,waypoints:[],optimize_metric:key.includes('distance')?'distance':'edges'},r);assert.ok(check.ok,`${key}: ${JSON.stringify(check.errors)}`);}
console.log('Xiamen trial sections, transfers, fallback geometry and precomputed routes verified');
