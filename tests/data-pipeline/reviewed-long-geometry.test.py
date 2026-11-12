# -*- coding: utf-8 -*-
import copy
import json
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / 'scripts'))
from long_geometry_overrides import apply_reviewed_long_segments

overlays = json.loads((root / 'data/geometry/reviewed-long-segments.json').read_text())
for city, overlay in overlays.items():
    geometry = json.loads((root / 'data/geometry' / (city + '.json')).read_text())
    base = copy.deepcopy(geometry)
    base['meta']['approach'] = base['meta']['approach'].replace(' Reviewed long sections use OSM route stop-to-stop tracks matched to existing station positions.', '')
    for key in overlay['segments']:
        del base['segments'][key]
        base['missing'].append(key)
    base['meta']['matchedSegments'] = len(base['segments'])
    changed = copy.deepcopy(base)
    station = next(iter(overlay['stationPositions']))
    changed['positions'][station][0] += 0.001
    try:
        apply_reviewed_long_segments(changed, city)
        raise AssertionError('changed station must require review')
    except ValueError:
        pass
    updated = apply_reviewed_long_segments(base, city)
    assert updated['segments'] == geometry['segments']
    assert set(updated['missing']) == set(geometry['missing'])
print('Reviewed long segments reject changed station anchors')
