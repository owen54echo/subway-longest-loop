import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import compile_subways


assert len(compile_subways.CITIES) == 17
assert compile_subways.CITIES[0]["key"] == "beijing"
assert compile_subways.CITIES[-1]["key"] == "changsha"
assert compile_subways.CITY_CATALOG_PATH.endswith("data/cities.json")
print("compile pipeline contract ok")
