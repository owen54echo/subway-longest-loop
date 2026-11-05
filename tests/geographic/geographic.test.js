const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Geo = require('../../geographic-view.js');
const geometry = require('../../data/geometry/guangfo.json');
const window = {};
vm.runInNewContext(fs.readFileSync(require.resolve('../../subway_data.js'), 'utf8'), {window});
const city = window.subwayDataMap.guangzhou;

test('whole network is represented and every sourced segment is connected to known stations', () => {
    const data = Geo.create(city, geometry);
    assert.equal(data.data.nodes.length, city.nodes.length);
    assert.equal(data.data.edges.length, city.edges.length);
    let matches = 0, fallback = 0;
    for (const edge of city.edges) {
        const shape = data.points(edge);
        assert.ok(shape, `${edge.line} ${edge.u} ${edge.v}`);
        const start = data.data.nodes.find(n => n.name === edge.u);
        const end = data.data.nodes.find(n => n.name === edge.v);
        assert.equal(shape.points[0].x, start.x);
        assert.equal(shape.points.at(-1).y, end.y);
        assert.ok(shape.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
        if (shape.estimated) fallback++; else { matches++; assert.ok(geometry.meta.sources[shape.source]); }
    }
    assert.equal(matches, geometry.meta.matchedSegments);
    assert.equal(fallback, geometry.meta.totalSegments - matches);
    assert.ok(matches > 0 && fallback > 0);
});

test('display projection leaves original topology and station data untouched', () => {
    const original = JSON.stringify(city);
    const view = Geo.create(city, geometry);
    const edge = city.edges.find(e => e.line === '佛山3号线' && e.u === '北滘公园');
    assert.ok(edge);
    const route = view.points(edge);
    assert.equal(route.estimated, false);
    assert.ok(route.points.length > 2, 'known curved segment retains intermediate points');
    const reversed = view.points({...edge, u:edge.v, v:edge.u});
    assert.equal(reversed.estimated, false);
    assert.deepEqual(reversed.points[0], route.points.at(-1));
    assert.equal(JSON.stringify(city), original);
});

test('missing geometry is clearly marked and drawn as a straight station connection', () => {
    const view = Geo.create(city, geometry);
    const edge = city.edges.find(e => !geometry.segments[Geo.key(e.line,e.u,e.v)]);
    const shape = view.points(edge);
    assert.equal(shape.estimated, true);
    assert.equal(shape.points.length, 2);
});
