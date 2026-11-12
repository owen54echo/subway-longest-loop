const assert = require('node:assert/strict');
const fs = require('node:fs');
const w = {};
new Function('window',fs.readFileSync('subway_data.js','utf8'))(w);
const city=w.subwayDataMap.chongqing;
const names=['井口','礼学路','金山寺','欢乐谷','重光立交','重光','金福路','金童路','果塘路','西南政法大学','宝圣湖','双龙湖','江北机场T3航站楼','天堡','龙港大道','复盛','福惠大道','两江影视城'];
const transfers={'金山寺':'6号线','欢乐谷':'轨道交通国博线','重光':'5号线','金童路':'3号线','宝圣湖':'9号线','江北机场T3航站楼':'10号线','复盛':'4号线'};
assert.equal(city.nodes.length,282); assert.equal(city.edges.length,329);
const edges=city.edges.filter(e=>e.line==='15号线');
assert.equal(edges.length,17);assert.deepEqual([edges[0].u,...edges.map(e=>e.v)],names);
for(const name of names){ const nodes=city.nodes.filter(n=>n.name===name);assert.equal(nodes.length,1,name);assert.ok(nodes[0].lines.includes('15号线'),name);assert.ok(Number.isFinite(nodes[0].lng)&&Number.isFinite(nodes[0].lat),name); }
for(const [name,line] of Object.entries(transfers))assert.ok(city.nodes.find(n=>n.name===name).lines.includes(line),name);
assert.ok(!city.nodes.some(n=>n.name==='曾家'&&n.lines.includes('15号线')));
for(const edge of edges){assert.equal(edge.color,'#2249A3');assert.ok(edge.straightLengthKm>0);}
const geometry=JSON.parse(fs.readFileSync('data/geometry/chongqing.json','utf8'));
for(const name of names)assert.ok(geometry.positions[name]?.every(Number.isFinite),name);
for(const e of edges)assert.ok(geometry.missing.includes([e.line,e.u,e.v].join('\t')),'unverified line shape must remain marked estimated');
console.log('Chongqing 15 Line stations, transfers and fallback geometry passed');
