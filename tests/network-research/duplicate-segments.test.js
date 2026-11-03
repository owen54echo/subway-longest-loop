const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const core = require('../../network-research-core');
const browser = {};
vm.runInNewContext(fs.readFileSync('subway_data.js','utf8'), {window:browser});
for (const [city,line,a,b] of [
    ['shanghai','5号线','莘庄','春申路'],
    ['chengdu','1号线','四河','华府大道'],
    ['hangzhou','3号线','花坞','西溪湿地南']
]) {
    const raw = browser.subwayDataMap[city];
    const edges = raw.edges.map((edge,index)=>({edge,index})).filter(item=>item.edge.line===line);
    const result = core.linePaths(edges,a,b);
    const direct = result.paths.filter(path=>path.segmentCount===1);
    assert.equal(direct.length,1,`${city}: one modeled section`);
    assert.equal(direct[0].edges.length,2,`${city}: both duplicate copies must be blocked`);
    const removed = new Set(direct[0].edges);
    assert.equal(edges.filter(item=>removed.has(item.index)).length,2);
}
console.log('duplicate branch sections handled together');
