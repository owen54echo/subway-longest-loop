#!/usr/bin/env python3
"""Add straight-line estimates for the Xiamen trial sections without altering reviewed OSM paths."""
import json
from pathlib import Path
from build_city_geometry import gcj_to_wgs

root = Path(__file__).resolve().parent.parent
source = (root / 'subway_data.js').read_text(encoding='utf-8')
city = json.loads(source[source.index('{'):source.rindex('}') + 1])['xiamen']
path = root / 'data/geometry/xiamen.json'
geometry = json.loads(path.read_text(encoding='utf-8'))
for node in city['nodes']:
    if node['name'] not in geometry['positions']:
        geometry['positions'][node['name']] = [round(v, 6) for v in gcj_to_wgs(node['lng'], node['lat'])]
keys = {f"{edge['line']}\t{edge['u']}\t{edge['v']}" for edge in city['edges']}
if not set(geometry['segments']).issubset(keys):
    raise ValueError('Existing Xiamen geometry no longer matches the topology')
geometry['missing'] = sorted(keys - set(geometry['segments']))
geometry['meta']['totalSegments'] = len(keys)
geometry['meta']['matchedSegments'] = len(geometry['segments'])
geometry['meta']['totalStations'] = len(city['nodes'])
path.write_text(json.dumps(geometry, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
