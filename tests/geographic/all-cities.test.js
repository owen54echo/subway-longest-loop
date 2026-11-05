const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Geo = require('../../geographic-view.js');
const context = {window:{}};
vm.runInNewContext(fs.readFileSync('subway_data.js','utf8'), context);
for (const [cityKey, city] of Object.entries(context.window.subwayDataMap)) {
    test(`${cityKey}: complete geography view has connected, classified segments`, () => {
        const filename = cityKey === 'guangzhou' ? 'guangfo' : cityKey;
        const geometry = JSON.parse(fs.readFileSync(`data/geometry/${filename}.json`, 'utf8'));
        assert.equal(geometry.meta.city, cityKey);
        assert.ok(geometry.meta.matchedSegments > 0, 'requires at least one supported OSM segment');
        const view = Geo.create(city, geometry);
        assert.equal(view.data.nodes.length, city.nodes.length);
        let matched = 0;
        for (const edge of city.edges) {
            const shape = view.points(edge);
            assert.ok(shape && shape.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
            const u = view.data.nodes.find(n => n.name === edge.u);
            const v = view.data.nodes.find(n => n.name === edge.v);
            assert.equal(shape.points[0].x, u.x);
            assert.equal(shape.points.at(-1).y, v.y);
            if (shape.estimated) assert.equal(shape.points.length, 2);
            else { assert.ok(geometry.meta.sources[shape.source]); matched++; }
        }
        assert.ok(matched > 0);
    });
}
