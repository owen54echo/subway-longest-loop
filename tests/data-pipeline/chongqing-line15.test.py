import copy
import json
import pathlib
import sys
root=pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0,str(root))
import compile_subways as c
text=(root/'subway_data.js').read_text()
city=json.loads(text[text.index('{'):text.rindex('}')+1])['chongqing']
nodes={n['name']:copy.deepcopy(n) for n in city['nodes']}
edges=copy.deepcopy(city['edges'])
before=(copy.deepcopy(nodes),copy.deepcopy(edges))
c.apply_chongqing_line15(nodes,edges)
assert nodes==before[0] and edges==before[1], 'Line 15 update must be idempotent'
for name in ('金山寺','欢乐谷','重光','金童路','宝圣湖','江北机场T3航站楼','复盛'):
 assert nodes[name]==before[0][name], f'existing interchange was modified: {name}'
print('Chongqing Line 15 update is idempotent and preserves interchange metadata')
