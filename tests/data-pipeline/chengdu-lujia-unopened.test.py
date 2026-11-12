# -*- coding: utf-8 -*-
import copy
import pathlib
import sys
root = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root))
from compile_subways import exclude_chengdu_lujia_unopened
nodes = {
    '福田': {'name': '福田', 'lng': 104.387506, 'lat': 30.27816},
    '芦葭': {'name': '芦葭', 'lng': 104.441771, 'lat': 30.25548},
    '资阳临空': {'name': '资阳临空', 'lng': 104.584953, 'lat': 30.172822},
}
edges = [
    {'u': '福田', 'v': '芦葭', 'line': 'S3(资阳)线', 'color': '#B5B5B6'},
    {'u': '芦葭', 'v': '资阳临空', 'line': 'S3(资阳)线', 'color': '#B5B5B6'},
]
exclude_chengdu_lujia_unopened(nodes, edges)
assert '芦葭' not in nodes
assert len(edges) == 1 and (edges[0]['u'], edges[0]['v']) == ('福田', '资阳临空')
before = copy.deepcopy((nodes, edges))
exclude_chengdu_lujia_unopened(nodes, edges)
assert (nodes, edges) == before
print('Unopened Lujia preprocessing is idempotent')
