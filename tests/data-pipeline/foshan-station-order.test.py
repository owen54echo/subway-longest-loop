"""Protect the known swapped station coordinates and their derived distances."""
import copy
import json
import sys
from pathlib import Path
root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root))
import compile_subways as compiler

text = (root / 'subway_data.js').read_text(encoding='utf8')
city = json.loads(text[text.index('{'):text.rindex('}') + 1])['guangzhou']
nodes = {node['name']: node for node in city['nodes']}
assert nodes['罗村']['lng'] < nodes['孝德东']['lng'], '罗村应在孝德东以西'
for edge in city['edges']:
    if edge['u'] in ('罗村', '孝德东') or edge['v'] in ('罗村', '孝德东'):
        a, b = nodes[edge['u']], nodes[edge['v']]
        expected = round(compiler.haversine_km(a['lng'], a['lat'], b['lng'], b['lat']), 3)
        assert edge['straightLengthKm'] == expected, (edge, expected)
assert not compiler.correct_foshan_station_coordinates(nodes, city['edges']), 'correct data should be unchanged on repeat'

old = copy.deepcopy(nodes)
for axis in ('lng', 'lat'):
    old['罗村'][axis], old['孝德东'][axis] = old['孝德东'][axis], old['罗村'][axis]
edges = copy.deepcopy(city['edges'])
assert compiler.correct_foshan_station_coordinates(old, edges)
assert old['罗村']['lng'] < old['孝德东']['lng']
assert all(e['straightLengthKm'] == round(compiler.haversine_km(old[e['u']]['lng'], old[e['u']]['lat'], old[e['v']]['lng'], old[e['v']]['lat']), 3)
           for e in edges if e['u'] in ('罗村', '孝德东') or e['v'] in ('罗村', '孝德东'))
unknown = copy.deepcopy(old)
unknown['罗村']['lng'] += .02
assert not compiler.correct_foshan_station_coordinates(unknown, edges), 'changed source coordinates must not be overwritten blindly'
print('Foshan station order and distances passed')
