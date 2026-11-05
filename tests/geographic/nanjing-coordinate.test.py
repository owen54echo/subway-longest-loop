"""The curated Nanjing Line 6 WGS84 anchors must not be converted twice."""
import importlib.util
import json
import pathlib
import sys
root = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root))
from compile_subways import NANJING_LINE_6_STATIONS
spec = importlib.util.spec_from_file_location('geom', root / 'scripts/build_city_geometry.py')
geom = importlib.util.module_from_spec(spec)
spec.loader.exec_module(geom)
geo = json.loads((root / 'data/geometry/nanjing.json').read_text())
for station in NANJING_LINE_6_STATIONS:
    distance = geom.dist(geo['positions'][station['name']], (station['lng'], station['lat']))
    assert distance < 200, (station['name'], distance)
print('Nanjing WGS84 anchors: no double conversion')
