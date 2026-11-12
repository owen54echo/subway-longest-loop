#!/usr/bin/env python3
"""Build a conservative, inspectable Guangzhou/Foshan geography overlay from OSM snapshots.

Usage: python3 scripts/build_guangfo_geometry.py /path/to/route-*.xml directory
Snapshots are standard OpenStreetMap API relation/<id>/full XML; provenance is recorded.
This does not modify subway_data.js. OSM data is ODbL, see output metadata.
"""
import collections, datetime, heapq, json, math, pathlib, statistics, sys, xml.etree.ElementTree as ET
try:
    from long_geometry_overrides import apply_reviewed_long_segments
except ModuleNotFoundError:
    from scripts.long_geometry_overrides import apply_reviewed_long_segments
ROOT=pathlib.Path(__file__).resolve().parent.parent
IDS={'13103097':'南海有轨电车1号线','13239401':'18号线','13604443':'佛山2号线','13987999':'22号线','15054264':'佛山3号线','19283541':'10号线','19283544':'12号线','7390450':'2号线','7480669':'1号线','7483883':'5号线','7422204':'8号线','7520751':'7号线','8338723':'14号线','8378350':'14号线支线(知识城线)','7285816':'6号线','6728313':'13号线','18132492':'11号线','9607953':'4号线','9611404':'APM线','9171918':'21号线','2646091':'广佛线','9841061':'3号线','444000':'3号线','7935591':'9号线'}
ALIASES={'礌岗':'𧒽岗','机场南(1号航站楼)':'机场南','机场北(T2)':'机场北','林岳东(2号线)':'林岳东'}
def gcj_to_wgs(lon,lat):
    # Approximate inverse GCJ-02; used only for unconfirmed fallback station positions.
    a=6378245.0; ee=0.00669342162296594323
    if not (72.004 <= lon <= 137.8347 and .8293 <= lat <= 55.8271): return lon,lat
    x=lon-105.; y=lat-35.
    dlat=-100+2*x+3*y+.2*y*y+.1*x*y+.2*math.sqrt(abs(x))+(20*math.sin(6*x*math.pi)+20*math.sin(2*x*math.pi))*2/3+(20*math.sin(y*math.pi)+40*math.sin(y/3*math.pi))*2/3+(160*math.sin(y/12*math.pi)+320*math.sin(y*math.pi/30))*2/3
    dlon=300+x+2*y+.1*x*x+.1*x*y+.1*math.sqrt(abs(x))+(20*math.sin(6*x*math.pi)+20*math.sin(2*x*math.pi))*2/3+(20*math.sin(x*math.pi)+40*math.sin(x/3*math.pi))*2/3+(150*math.sin(x/12*math.pi)+300*math.sin(x/30*math.pi))*2/3
    rad=lat/180*math.pi; magic=1-ee*math.sin(rad)**2; sm=math.sqrt(magic)
    return lon-dlon*180/(a/sm*math.cos(rad)*math.pi),lat-dlat*180/((a*(1-ee))/(magic*sm)*math.pi)
def dist(a,b):
    x=(a[0]-b[0])*math.cos(math.radians((a[1]+b[1])/2));y=a[1]-b[1];return math.hypot(x,y)*111200

def path(graph,start,end):
    q=[(0,start)]; best={start:0}; prev={}
    while q:
        d,u=heapq.heappop(q)
        if d!=best[u]:continue
        if u==end:break
        for v,w in graph[u]:
            t=d+w
            if t<best.get(v,float('inf')):best[v]=t;prev[v]=u;heapq.heappush(q,(t,v))
    if end not in best:return None
    p=[end]
    while p[-1]!=start:p.append(prev[p[-1]])
    return list(reversed(p))
def simplify(points,tolerance=20):
    # Distance to the line segment in metres (Douglas–Peucker), keeping endpoints.
    if len(points)<3:return points
    a,b=points[0],points[-1];k=math.cos(math.radians((a[1]+b[1])/2)); bx=(b[0]-a[0])*k*111200;by=(b[1]-a[1])*111200;den=bx*bx+by*by
    def dev(p):
        px=(p[0]-a[0])*k*111200;py=(p[1]-a[1])*111200;t=max(0,min(1,(px*bx+py*by)/den)) if den else 0
        return math.hypot(px-t*bx,py-t*by)
    v=[dev(p) for p in points[1:-1]]; i=max(range(len(v)),key=v.__getitem__)
    if v[i]<=tolerance:return [a,b]
    return simplify(points[:i+2],tolerance)[:-1]+simplify(points[i+1:],tolerance)
def main():
    source=pathlib.Path(sys.argv[1]);text=(ROOT/'subway_data.js').read_text();city=json.loads(text[text.index('{'):text.rindex('}')+1])['guangzhou'];project={n['name']:n for n in city['nodes']};edges=city['edges']; byline=collections.defaultdict(list)
    for e in edges:byline[e['line']].append(e)
    routes=[]; obs=collections.defaultdict(list)
    for rid,line in IDS.items():
        f=source/f'route-{rid}.xml'
        if not f.exists():print('missing',rid,file=sys.stderr);continue
        root=ET.parse(f).getroot(); rel=next(x for x in root.findall('relation') if x.get('id')==rid);nodes={n.get('id'):n for n in root.findall('node')};ways={w.get('id'):w for w in root.findall('way')};coords={k:(float(n.get('lon')),float(n.get('lat'))) for k,n in nodes.items()};graph=collections.defaultdict(list);stops={}
        for m in rel.findall('member'):
            if m.get('type')=='way' and not m.get('role') and m.get('ref') in ways:
                ids=[n.get('ref') for n in ways[m.get('ref')].findall('nd') if n.get('ref') in coords]
                for u,v in zip(ids,ids[1:]):w=dist(coords[u],coords[v]);graph[u].append((v,w));graph[v].append((u,w))
            if m.get('type')=='node' and m.get('role')=='stop' and m.get('ref') in nodes:
                node=nodes[m.get('ref')];tags={t.get('k'):t.get('v') for t in node.findall('tag')};name=tags.get('name')
                if name:stops[name]=m.get('ref')
        for name in {e['u'] for e in byline[line]}|{e['v'] for e in byline[line]}:
            osmname=ALIASES.get(name,name)
            if osmname in stops:obs[name].append(coords[stops[osmname]])
        routes.append((rid,line,rel,coords,graph,stops))
    # Adopt an OSM stop only if it agrees with the approximate inverse-transformed
    # existing station within 200 m and different sources agree within 100 m.
    chosen={}; fallback={}; unresolved=[]
    for name,n in project.items():
        estimate=gcj_to_wgs(n['lng'],n['lat']); pts=obs[name]
        if pts:
            center=(statistics.median(p[0] for p in pts),statistics.median(p[1] for p in pts));offset=dist(center,estimate);spread=max(dist(p,center) for p in pts)
            if offset<=200 and spread<=100:chosen[name]=center;continue
            unresolved.append({'station':name,'offset_m':round(offset),'spread_m':round(spread),'reason':'station_coordinate_conflict'})
        fallback[name]=estimate
    positions={**fallback,**chosen}; geometry={};reject=collections.Counter();sources={}
    for rid,line,rel,coords,graph,stops in routes:
        sources[rid]={'relation':rid,'line':line,'version':rel.get('version'),'timestamp':rel.get('timestamp'),'url':f'https://www.openstreetmap.org/relation/{rid}'}
        for e in byline[line]:
            u,v=e['u'],e['v'];key=f"{line}\t{u}\t{v}"
            if key in geometry:continue
            nu,nv=ALIASES.get(u,u),ALIASES.get(v,v)
            if nu not in stops or nv not in stops:reject['missing_station']+=1;continue
            if u not in chosen or v not in chosen:reject['unresolved_station']+=1;continue
            su,sv=stops[nu],stops[nv]
            if su not in graph or sv not in graph:reject['stop_not_on_track']+=1;continue
            if dist(coords[su],positions[u])>100 or dist(coords[sv],positions[v])>100:reject['route_endpoint_conflict']+=1;continue
            ids=path(graph,su,sv)
            if not ids:reject['disconnected_track']+=1;continue
            if any(i in set(stops.values()) for i in ids[1:-1]):reject['intermediate_stop']+=1;continue
            pts=[coords[i] for i in ids];length=sum(dist(a,b) for a,b in zip(pts,pts[1:]));direct=dist(positions[u],positions[v])
            if direct<1 or length>direct*3+300 or length>20000:reject['implausible_path']+=1;continue
            simplified=simplify(pts,20);geometry[key]={'line':line,'u':u,'v':v,'points':[[round(p[0],6),round(p[1],6)] for p in simplified],'source':rid,'osmLengthM':round(length)}
    allkeys={f"{e['line']}\t{e['u']}\t{e['v']}" for e in edges}; missing=sorted(allkeys-set(geometry));
    out={'meta':{'city':'guangzhou','generated':'2026-11-05','source':'© OpenStreetMap contributors','license':'ODbL','licenseUrl':'https://www.openstreetmap.org/copyright','approach':'Project station coordinates are treated as approximately GCJ-02, inverse-transformed to WGS84 only for display; OSM stop positions adopted only after proximity checks. This is an unverified coordinate assumption, not a survey.','matchedSegments':len(geometry),'totalSegments':len(allkeys),'matchedStations':len(chosen),'totalStations':len(project),'sources':sources},'positions':{k:[round(v[0],6),round(v[1],6)] for k,v in positions.items()},'osmStations':sorted(chosen),'segments':geometry,'unresolved':unresolved,'missing':missing}
    out=apply_reviewed_long_segments(out,'guangfo')
    target=ROOT/'data/geometry/guangfo.json';target.write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'))+'\n');print('edges',len(allkeys),'matched',len(geometry),'fallback',len(missing),'stations',len(chosen),'/',len(project),'conflicts',len(unresolved),'rejections',dict(reject));print('conflict sample',unresolved[:12]);print('by line');
    for line,es in byline.items():
        keys={f"{line}\t{e['u']}\t{e['v']}" for e in es};print(line,len(keys & set(geometry)),'/',len(keys))
if __name__=='__main__':main()
