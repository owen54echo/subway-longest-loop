#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

find tests -type f \( -name '*.test.js' -o -name '*.test.mjs' \) -print0 \
  | sort -z \
  | xargs -0 -n1 node

node run_regression_tests.js

python3 -m py_compile \
  compile_subways.py \
  sync_station_surroundings.py \
  validate_station_surroundings.py

python3 tests/data-pipeline/compile-pipeline.test.py
python3 validate_station_surroundings.py station_surroundings.json subway_data.js

git diff --check

echo "Project verification passed."
