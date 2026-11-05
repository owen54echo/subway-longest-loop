#!/usr/bin/env python3
"""Audit >3km candidate segments against local AMap station snapshots.

Usage: python3 scripts/audit_long_segments.py <snapshot-dir> <output-json>
Snapshots are only used locally; output contains no copied coordinate data.
"""
import json,math,pathlib,collections,sys,importlib.util,re
root=pathlib.Path(__file__).resolve().parent.parent;source=pathlib.Path(sys.argv[1]);s=(root/'subway_data.js').read_text();cities=json.loads(s[s.index('{'):s.rindex('}')+1]);spec=importlib.util.spec_from_file_location('geom',root/'scripts/build_city_geometry.py');geom=importlib.util.module_from_spec(spec);spec.loader.exec_module(geom)
name={'beijing':'北京','shanghai':'上海','guangzhou':'广佛','shenzhen':'深圳','wuhan':'武汉','chengdu':'成都','chongqing':'重庆','hangzhou':'杭州','nanjing':'南京','xian':'西安','zhengzhou':'郑州','tianjin':'天津','suzhou':'苏州','xiamen':'厦门','qingdao':'青岛','ningbo':'宁波','changsha':'长沙'}
def norm(s):
 s={'刘村·弘阳家居博览中心':'刘村'}.get(s,s)
 s=re.sub(r'[（(].*?[）)]','',s or '').replace('·','').replace('地铁站','').replace('𧒽','礌')
 return s.strip()
def line_id(s):
 s=s.replace('（','(').replace('）',')');m=re.search(r'(S?\d+)号?\s*[（(]?[环)]*线',s,re.I)
 return m.group(1).upper() if m else norm(s).replace('轨道交通','').replace('地铁','')
def lines(k):
 keys=[k]+(['foshan'] if k=='guangzhou' else ['shaoxing'] if k=='hangzhou' else [])
 for ck in keys:
  for l in json.loads((source/(ck+'.json')).read_text()).get('l',[]):yield ck,l
allrows=[]
for k,c in cities.items():
 geo=json.loads((root/'data/geometry'/('guangfo' if k=='guangzhou' else k)).with_suffix('.json').read_text()); ls=list(lines(k)); ns={n['name']:n for n in c['nodes']}
 for e in c['edges']:
  u,v=e['u'],e['v'];key='\t'.join((e['line'],u,v));rev='\t'.join((e['line'],v,u));p=geo['positions'];direct=geom.dist(p[u],p[v]);shape=geo['segments'].get(key) or geo['segments'].get(rev);length=shape.get('osmLengthM',0) if shape else 0
  if max(direct,length)<3000:continue
  occurrences=[]
  for ck,l in ls:
   st=l.get('st',[]); uu=[i for i,x in enumerate(st) if norm(x.get('n'))==norm(u)];vv=[i for i,x in enumerate(st) if norm(x.get('n'))==norm(v)]
   for i in uu:
    for j in vv:
     if i!=j:occurrences.append((abs(i-j),ck,l,i,j))
  same=[o for o in occurrences if line_id(o[2].get('ln',''))==line_id(e['line'])];hits=sorted(same,key=lambda x:x[0]);other=sorted(occurrences,key=lambda x:x[0]); best=(hits or other or [None])[0]
  status=('同线相邻' if hits and hits[0][0]==1 else '同线不相邻' if hits else '其他线路同名' if other else '未找到同线站对')
  offs=[]
  if hits:
   _,_,l,i,j=hits[0]
   for n,idx in ((u,i),(v,j)):
    sl=l['st'][idx].get('sl','').split(',')
    if len(sl)==2:
     try:offs.append(round(geom.dist(p[n],geom.gcj_to_wgs(float(sl[0]),float(sl[1])))))
     except:pass
  interim=[]
  if hits and hits[0][0]>1:
   _,_,l,i,j=hits[0];interim=[x.get('n') for x in l['st'][min(i,j)+1:max(i,j)]]
  allrows.append(dict(city=k,cityName=name[k],line=e['line'],u=u,v=v,direct=round(direct),osmLength=length,kind='OSM' if shape else '估算',status=status,offset=max(offs,default=None),intermediate=interim,amapLine=best[2].get('ln') if best else None))
print('rows',len(allrows),'status',collections.Counter(x['status'] for x in allrows),'est',sum(x['kind']=='估算' for x in allrows))
print('same-line nonadjacent')
for x in allrows:
 if x['status']=='同线不相邻':print(x)
print('large offset >500')
for x in sorted((x for x in allrows if x['offset'] and x['offset']>500),key=lambda x:-x['offset']):print(x)
pathlib.Path(sys.argv[2]).write_text(json.dumps(allrows,ensure_ascii=False,indent=2))
