import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import compile_subways as compiler

# A shared transfer uses the primary city's coordinates; both adjacent
# secondary-city edges must be measured against that final coordinate.
primary = {"B": {"name": "B", "x": 0, "y": 0, "lng": 113.0, "lat": 23.0, "lines": ["P"]}}
secondary = {"l": [{"ln": "S", "cl": "000000", "st": [
    {"n": "A", "p": "0 0", "sl": "112.99,23.0"},
    {"n": "B", "p": "1 1", "sl": "113.001,23.0"},
    {"n": "C", "p": "2 2", "sl": "113.01,23.0"},
]}]}
edges = []
compiler.merge_cities(primary, edges, secondary, (1, 0, 1, 0))
assert len(edges) == 2
for edge in edges:
    a, b = primary[edge['u']], primary[edge['v']]
    assert edge['straightLengthKm'] == round(compiler.haversine_km(a['lng'], a['lat'], b['lng'], b['lat']), 3)
assert primary['B']['lng'] == 113.0
print('merged distance regression passed')
