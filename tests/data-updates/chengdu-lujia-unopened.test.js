const assert = require('node:assert/strict');
const fs = require('node:fs');
const windowStub = {};
new Function('window', fs.readFileSync('subway_data.js','utf8'))(windowStub);
const city = windowStub.subwayDataMap.chengdu;
assert.ok(!city.nodes.some(n => n.name === '芦葭'));
assert.ok(city.edges.every(e => e.u !== '芦葭' && e.v !== '芦葭'));
const direct = city.edges.filter(e => e.line === 'S3(资阳)线' && e.u === '福田' && e.v === '资阳临空');
assert.equal(direct.length, 1);
assert.ok(direct[0].straightLengthKm > 20 && direct[0].straightLengthKm < 25);
const geometry = JSON.parse(fs.readFileSync('data/geometry/chengdu.json','utf8'));
assert.ok(!Object.hasOwn(geometry.positions, '芦葭'));
assert.ok(geometry.missing.includes('S3(资阳)线\t福田\t资阳临空'));
const resultWindow = {};
new Function('window', fs.readFileSync('city_extremes_results.js','utf8'))(resultWindow);
const contract = require('../../solver-contract.js');
const topologyWindow = {};
for (const f of ['topology-rules.js','route-rules.js','calculation-topology.js']) new Function('window', fs.readFileSync(f,'utf8'))(topologyWindow);
const topology = topologyWindow.CalculationTopology.create('chengdu',city.nodes,city.edges);
for(const entry of Object.values(resultWindow.cityExtremeResults.chengdu)) {
 assert.equal(entry.total, topology.nodes.length);
 assert.equal(entry.topologyFingerprint, contract.topologyFingerprint(topology.nodes,topology.edges));
 assert.ok(!JSON.stringify(entry.result).includes('芦葭'));
}
console.log('Unopened Lujia is excluded and Chengdu route results match the new topology');
