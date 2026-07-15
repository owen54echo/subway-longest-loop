# compile_subways.py
import urllib.request
import json
import ssl
import time
import math
import os

ssl._create_default_https_context = ssl._create_unverified_context

CITIES = [
    {"key": "beijing", "name": "北京市", "adcode": "1100", "pinyin": "beijing"},
    {"key": "shanghai", "name": "上海市", "adcode": "3100", "pinyin": "shanghai"},
    {"key": "guangzhou", "name": "广佛（广州+佛山）", "adcode": "4401", "pinyin": "guangzhou"},
    {"key": "shenzhen", "name": "深圳市", "adcode": "4403", "pinyin": "shenzhen"},
    {"key": "wuhan", "name": "武汉市", "adcode": "4201", "pinyin": "wuhan"},
    {"key": "chengdu", "name": "成都市", "adcode": "5101", "pinyin": "chengdu"},
    {"key": "chongqing", "name": "重庆市", "adcode": "5000", "pinyin": "chongqing"},
    {"key": "hangzhou", "name": "杭州市（含绍兴、海宁）", "adcode": "3301", "pinyin": "hangzhou"},
    {"key": "nanjing", "name": "南京市", "adcode": "3201", "pinyin": "nanjing"},
    {"key": "xian", "name": "西安市", "adcode": "6101", "pinyin": "xian"},
    {"key": "zhengzhou", "name": "郑州市", "adcode": "4101", "pinyin": "zhengzhou"},
    {"key": "tianjin", "name": "天津市", "adcode": "1200", "pinyin": "tianjin"},
    {"key": "suzhou", "name": "苏州市", "adcode": "3205", "pinyin": "suzhou"}
]

def parse_station_lng_lat(station):
    sl = station.get("sl")
    if not sl:
        return None, None

    try:
        lng_str, lat_str = sl.split(",", 1)
        lng = float(lng_str)
        lat = float(lat_str)
    except (TypeError, ValueError):
        return None, None

    if not (-180 <= lng <= 180 and -90 <= lat <= 90):
        return None, None
    return lng, lat

def haversine_km(lng1, lat1, lng2, lat2):
    radius_km = 6371.0088
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    return 2 * radius_km * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def add_edge_distance(edge, nodes):
    u_node = nodes.get(edge["u"])
    v_node = nodes.get(edge["v"])
    if not u_node or not v_node:
        return edge

    required = (u_node.get("lng"), u_node.get("lat"), v_node.get("lng"), v_node.get("lat"))
    if any(value is None for value in required):
        return edge

    distance = haversine_km(u_node["lng"], u_node["lat"], v_node["lng"], v_node["lat"])
    if distance > 0:
        edge["straightLengthKm"] = round(distance, 3)
    return edge

def load_existing_wiki_by_city(output_js):
    if not os.path.exists(output_js):
        return {}

    try:
        with open(output_js, "r", encoding="utf-8") as f:
            content = f.read()
        start_marker = "window.subwayDataMap = "
        end_marker = ";\n\n// Keep window.subwayData"
        start = content.index(start_marker) + len(start_marker)
        end = content.index(end_marker, start)
        existing_data = json.loads(content[start:end])
    except (OSError, ValueError, json.JSONDecodeError):
        return {}

    wiki_by_city = {}
    for city_key, city_data in existing_data.items():
        wiki_by_city[city_key] = {
            node["name"]: node["wiki"]
            for node in city_data.get("nodes", [])
            if node.get("wiki")
        }
    return wiki_by_city

def restore_existing_wiki(compiled_data, wiki_by_city):
    restored_count = 0
    for city_key, city_data in compiled_data.items():
        city_wiki = wiki_by_city.get(city_key, {})
        for node in city_data.get("nodes", []):
            wiki = city_wiki.get(node["name"])
            if wiki:
                node["wiki"] = wiki
                restored_count += 1
    return restored_count

def fetch_subway_raw(adcode, pinyin):
    url = f"http://map.amap.com/service/subway?srhdata={adcode}_drw_{pinyin}.json"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    req = urllib.request.Request(url, headers=headers)
    for attempt in range(1, 4):
        try:
            with urllib.request.urlopen(req, timeout=20) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as e:
            print(f"Error fetching {pinyin} ({adcode}), attempt {attempt}/3: {e}")
            if attempt < 3:
                time.sleep(1.0)
    return None

def parse_city_raw(raw_data, line_rename_fn=None, station_rename_fn=None):
    nodes = {}
    edges = []
    
    for line in raw_data.get("l", []):
        ln = line.get("ln")
        if line_rename_fn:
            ln = line_rename_fn(ln)
            
        color = line.get("cl")
        if not color.startswith("#"):
            color = "#" + color
            
        st_list = line.get("st", [])
        
        # Add nodes
        for st in st_list:
            name = st.get("n")
            if station_rename_fn:
                name = station_rename_fn(name, ln)
                
            p_str = st.get("p", "0 0")
            try:
                x, y = map(float, p_str.split())
            except ValueError:
                x, y = 0.0, 0.0

            lng, lat = parse_station_lng_lat(st)
                
            if name not in nodes:
                nodes[name] = {
                    "name": name,
                    "x": x,
                    "y": y,
                    "lng": lng,
                    "lat": lat,
                    "lines": [ln]
                }
            else:
                if ln not in nodes[name]["lines"]:
                    nodes[name]["lines"].append(ln)
                if nodes[name].get("lng") is None and lng is not None:
                    nodes[name]["lng"] = lng
                if nodes[name].get("lat") is None and lat is not None:
                    nodes[name]["lat"] = lat
                    
        # Add edges
        for i in range(len(st_list) - 1):
            u = st_list[i].get("n")
            v = st_list[i+1].get("n")
            if station_rename_fn:
                u = station_rename_fn(u, ln)
                v = station_rename_fn(v, ln)
            if u == v:
                continue
            edge = {
                "u": u,
                "v": v,
                "line": ln,
                "color": color
            }
            edges.append(add_edge_distance(edge, nodes))
            
    return nodes, edges

def merge_cities(primary_nodes, primary_edges, secondary_raw, affine_params, line_rename_fn=None, station_rename_fn=None):
    a, b, c, d = affine_params
    sec_nodes, sec_edges = parse_city_raw(secondary_raw, line_rename_fn, station_rename_fn)
    
    # Merge nodes
    for name, node in sec_nodes.items():
        if name in primary_nodes:
            for ln in node["lines"]:
                if ln not in primary_nodes[name]["lines"]:
                    primary_nodes[name]["lines"].append(ln)
        else:
            x_new = a * node["x"] + b
            y_new = c * node["y"] + d
            primary_nodes[name] = {
                "name": name,
                "x": round(x_new, 1),
                "y": round(y_new, 1),
                "lng": node.get("lng"),
                "lat": node.get("lat"),
                "lines": node["lines"]
            }
            
    # Merge edges
    for edge in sec_edges:
        u, v, line = edge["u"], edge["v"], edge["line"]
        exists = any((e["u"] == u and e["v"] == v and e["line"] == line) or 
                     (e["u"] == v and e["v"] == u and e["line"] == line) 
                     for e in primary_edges)
        if not exists:
            primary_edges.append(edge)

def main():
    compiled_data = {}
    output_js = "./subway_data.js"
    existing_wiki_by_city = load_existing_wiki_by_city(output_js)
    
    # Fetch all cities raw data
    raw_subways = {}
    for c in CITIES:
        print(f"Fetching raw data for {c['name']} ({c['key']})...")
        raw = fetch_subway_raw(c["adcode"], c["pinyin"])
        if raw:
            raw_subways[c["key"]] = raw
        time.sleep(0.2)
        
    # Fetch secondary cities raw data for merging
    print("Fetching raw data for Foshan...")
    foshan_raw = fetch_subway_raw("4406", "foshan")
    print("Fetching raw data for Shaoxing...")
    shaoxing_raw = fetch_subway_raw("3306", "shaoxing")
    
    # Process each city
    for c in CITIES:
        key = c["key"]
        if key not in raw_subways:
            print(f"Skipping {key} due to fetch failure.")
            continue
            
        # Rename function for Hangzhou station collisions
        if key == "hangzhou":
            def station_rename_hangzhou(name, line_name):
                if name == "奥体中心" and ("绍兴" in line_name or line_name in ["1号线", "1号线支线", "2号线", "绍兴1号线", "绍兴1号线支线", "绍兴2号线"]):
                    return "绍兴奥体中心"
                return name
            nodes, edges = parse_city_raw(raw_subways[key], station_rename_fn=station_rename_hangzhou)
        else:
            nodes, edges = parse_city_raw(raw_subways[key])
        
        # Merge if necessary
        if key == "guangzhou" and foshan_raw:
            print("Merging Foshan into Guangzhou network...")
            # Affine parameters Guangzhou-Foshan
            affine_gz_fs = (0.964680, 170.26, 1.290174, 590.10)
            
            def line_rename_foshan(name):
                if name == "3号线":
                    return "佛山3号线"
                return name
                
            merge_cities(nodes, edges, foshan_raw, affine_gz_fs, line_rename_foshan)
            
        elif key == "hangzhou" and shaoxing_raw:
            print("Merging Shaoxing into Hangzhou network...")
            # Affine parameters Hangzhou-Shaoxing
            affine_hz_sx = (0.571376, 2081.34, 0.881112, 1146.63)
            
            def line_rename_shaoxing(name):
                if name == "1号线":
                    return "绍兴1号线"
                if name == "1号线支线":
                    return "绍兴1号线支线"
                if name == "2号线":
                    return "绍兴2号线"
                return name
                
            def station_rename_hangzhou(name, line_name):
                if name == "奥体中心" and ("绍兴" in line_name or line_name in ["1号线", "1号线支线", "2号线", "绍兴1号线", "绍兴1号线支线", "绍兴2号线"]):
                    return "绍兴奥体中心"
                return name

            merge_cities(nodes, edges, shaoxing_raw, affine_hz_sx, line_rename_shaoxing, station_rename_hangzhou)
            
        compiled_data[key] = {
            "city": c["name"],
            "nodes": list(nodes.values()),
            "edges": edges
        }
        print(f"[{c['name']}] Compiled: {len(nodes)} stations, {len(edges)} sections.")

    restored_wiki_count = restore_existing_wiki(compiled_data, existing_wiki_by_city)
    print(f"Restored wiki metadata for {restored_wiki_count} stations.")
    
    js_content = [
        "// Consolidated subway data for multiple cities.",
        f"// Generated automatically by compile_subways.py on {time.strftime('%Y-%m-%d %H:%M:%S')}.",
        "",
        "window.subwayDataMap = " + json.dumps(compiled_data, ensure_ascii=False, indent=2) + ";",
        "",
        "// Keep window.subwayData for backward compatibility (Guangzhou)",
        "window.subwayData = window.subwayDataMap[\"guangzhou\"];"
    ]
    
    with open(output_js, "w", encoding="utf-8") as f:
        f.write("\n".join(js_content))
    print(f"Successfully compiled all cities and saved to {output_js}!")

if __name__ == '__main__':
    main()
