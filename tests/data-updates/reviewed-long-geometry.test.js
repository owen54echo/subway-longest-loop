const assert = require('node:assert/strict');
const fs = require('node:fs');
const geo = require('../../geographic-view.js');
const rose = require('../../orientation-rose.js');
const windowStub = {};
new Function('window', fs.readFileSync('subway_data.js','utf8'))(windowStub);
const overlays = JSON.parse(fs.readFileSync('data/geometry/reviewed-long-segments.json','utf8'));
let count = 0;
for (const [file, overlay] of Object.entries(overlays)) {
  const city = windowStub.subwayDataMap[file === 'guangfo' ? 'guangzhou' : file];
  const geometry = JSON.parse(fs.readFileSync(`data/geometry/${file}.json`,'utf8'));
  const view = geo.create(city, geometry);
  for (const [key, shape] of Object.entries(overlay.segments)) {
    count++;
    assert.deepEqual(geometry.segments[key], shape);
    assert.ok(!geometry.missing.includes(key));
    assert.ok(geometry.meta.sources[shape.source]);
    assert.deepEqual(shape.points[0], geometry.positions[shape.u]);
    assert.deepEqual(shape.points.at(-1), geometry.positions[shape.v]);
    assert.ok(shape.endpointOffsetM.every(v => v <= 75));
    const e = city.edges.find(x => x.line === shape.line && x.u === shape.u && x.v === shape.v);
    assert.ok(e, `${file}: ${key}`);
    assert.equal(view.points(e).estimated, false);
  }
  const stats = rose.analyze(city, geometry, {includeEstimated:true});
  assert.ok(stats.lines.length && stats.lines.every(l => Number.isFinite(l.km)));
  assert.equal(geometry.meta.matchedSegments, Object.keys(geometry.segments).length);
}
assert.equal(count, 52);
const beijing = JSON.parse(fs.readFileSync('data/geometry/beijing.json','utf8'));
const airportOut = beijing.segments['首都机场线\t3号航站楼\t2号航站楼'];
const airportBack = beijing.segments['首都机场线\t2号航站楼\t三元桥'];
// Official distances are 7,243 m and 20,738 m. Distinct directional
// relations avoid sending the return trip back through Terminal 3.
assert.ok(Math.abs(airportOut.osmLengthM - 7243) < 500);
assert.ok(Math.abs(airportBack.osmLengthM - 20738) < 500);
assert.notEqual(airportOut.source, airportBack.source);
const suzhou = JSON.parse(fs.readFileSync('data/geometry/suzhou.json','utf8'));
const throughClosed = suzhou.segments['7号线\t白荡北\t板泾'];
assert.deepEqual(throughClosed.intermediateClosedStations, ['白荡南']);
assert.ok(!windowStub.subwayDataMap.suzhou.nodes.some(n => n.name === '白荡南'));
console.log('Reviewed long sections preserve station anchors and render in all affected cities');
