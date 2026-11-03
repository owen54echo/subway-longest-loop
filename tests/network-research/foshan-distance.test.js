const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const core = require('../../network-research-core.js');
const page = {};
vm.runInNewContext(fs.readFileSync('subway_data.js','utf8'), {window:page});
const city = page.subwayDataMap.guangzhou;
const nodes = new Map(city.nodes.map(node => [node.name, node]));
for (const [u,v] of [['广教','北滘公园'], ['北滘公园','高村']]) {
    const edges = city.edges.filter(e => e.line === '佛山3号线' && e.u === u && e.v === v);
    assert.equal(edges.length, 1);
    assert(Math.abs(edges[0].straightLengthKm - core.distance(nodes.get(u), nodes.get(v))) < 0.001);
}
console.log('Foshan station distance consistency passed');
