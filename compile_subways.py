# compile_subways.py
import urllib.request
import json
import time
import math
import os
import sys

from sync_station_surroundings import merge_station_status, merge_surroundings

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
CITY_CATALOG_PATH = os.path.join(PROJECT_DIR, "data", "cities.json")


def load_city_catalog(path=CITY_CATALOG_PATH):
    with open(path, encoding="utf-8") as file:
        catalog = json.load(file)
    keys = [city.get("key") for city in catalog]
    if not catalog or any(not city.get("key") for city in catalog) or len(keys) != len(set(keys)):
        raise ValueError("City catalog must contain unique non-empty keys")
    return catalog


CITIES = load_city_catalog()

NANJING_LINE_6_COLOR = "#00AD8E"
NANJING_LINE_6_STATIONS = [
    {"name": "南京南站", "lng": 118.791602, "lat": 31.973016, "x": 681, "y": 1051},
    {"name": "夹岗", "lng": 118.810434, "lat": 31.988275, "x": 730, "y": 1012},
    {"name": "机场跑道旧址", "lng": 118.808500, "lat": 31.994246, "x": 762, "y": 967},
    {"name": "市中医院", "lng": 118.803522, "lat": 32.000308, "x": 748, "y": 928},
    {"name": "应天东街", "lng": 118.806444, "lat": 32.009694, "x": 754, "y": 885},
    {"name": "中和桥", "lng": 118.810278, "lat": 32.020394, "x": 768, "y": 842},
    {"name": "光华门", "lng": 118.809580, "lat": 32.025579, "x": 778, "y": 809},
    {"name": "明故宫", "lng": 118.813465, "lat": 32.040460, "x": 786, "y": 631},
    {"name": "富贵山", "lng": 118.813787, "lat": 32.050257, "x": 782, "y": 585},
    {"name": "岗子村", "lng": 118.811020, "lat": 32.067011, "x": 776, "y": 544},
    {"name": "花园路", "lng": 118.816775, "lat": 32.085081, "x": 782, "y": 487},
    {"name": "红山新城", "lng": 118.812448, "lat": 32.094517, "x": 792, "y": 430},
    {"name": "营苑南路", "lng": 118.822632, "lat": 32.103713, "x": 823, "y": 362},
    {"name": "万寿", "lng": 118.828693, "lat": 32.121579, "x": 875, "y": 280},
    {"name": "燕江新城", "lng": 118.841506, "lat": 32.135805, "x": 920, "y": 238},
    {"name": "兴学路", "lng": 118.856629, "lat": 32.139663, "x": 1000, "y": 218},
    {"name": "兴智街", "lng": 118.871992, "lat": 32.140651, "x": 1080, "y": 212},
    {"name": "十月广场", "lng": 118.887029, "lat": 32.140845, "x": 1160, "y": 210},
    {"name": "金陵石化", "lng": 118.923308, "lat": 32.151805, "x": 1350, "y": 173},
    {"name": "栖霞山", "lng": 118.945230, "lat": 32.148904, "x": 1470, "y": 182},
]

def normalize_nanjing_station_name(name, _line_name=None):
    if name == "红山新城·玄武花园城":
        return "红山新城"
    return name

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

def is_finite_number(value):
    return isinstance(value, (int, float)) and math.isfinite(value)


def build_station_id(city_key, node):
    """Prefer coordinate identity so a source-name correction does not orphan metadata."""
    if is_finite_number(node.get("lng")) and is_finite_number(node.get("lat")):
        return f"{city_key}:geo:{node['lng']:.6f}:{node['lat']:.6f}"
    return f"{city_key}:name:{node.get('name', '')}"


def attach_station_ids(city_key, nodes):
    station_ids = set()
    for node in nodes.values():
        station_id = build_station_id(city_key, node)
        if station_id in station_ids:
            raise ValueError(f"Duplicate station identity in {city_key}: {station_id}")
        station_ids.add(station_id)
        node["stationId"] = station_id


def apply_nanjing_line6(nodes, edges):
    """Add the verified Line 6 contract without rebuilding unrelated cities."""
    for station in NANJING_LINE_6_STATIONS:
        name = station["name"]
        node = nodes.get(name)
        if node is None:
            node = {
                "name": name,
                "x": station["x"],
                "y": station["y"],
                "lng": station["lng"],
                "lat": station["lat"],
                "lines": ["6号线"],
            }
            nodes[name] = node
        else:
            if "6号线" not in node["lines"]:
                node["lines"].append("6号线")
            node["lng"] = station["lng"]
            node["lat"] = station["lat"]
            if not is_finite_number(node.get("x")) or not is_finite_number(node.get("y")):
                node["x"] = station["x"]
                node["y"] = station["y"]

    edges[:] = [edge for edge in edges if edge.get("line") != "6号线"]
    for left, right in zip(NANJING_LINE_6_STATIONS, NANJING_LINE_6_STATIONS[1:]):
        edges.append(add_edge_distance({
            "u": left["name"],
            "v": right["name"],
            "line": "6号线",
            "color": NANJING_LINE_6_COLOR,
        }, nodes))

    # Shared-station coordinates are refreshed above, so keep adjacent legacy
    # line distances consistent with the same node coordinates.
    for edge in edges:
        add_edge_distance(edge, nodes)

def load_existing_compiled_data(output_js):
    if not os.path.exists(output_js):
        return None
    try:
        with open(output_js, "r", encoding="utf-8") as file:
            content = file.read()
        start_marker = "window.subwayDataMap = "
        end_marker = ";\n\n// Keep window.subwayData"
        start = content.index(start_marker) + len(start_marker)
        end = content.index(end_marker, start)
        return json.loads(content[start:end])
    except (OSError, ValueError, json.JSONDecodeError):
        return None

def normalize_integral_numbers(value):
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, list):
        return [normalize_integral_numbers(item) for item in value]
    if isinstance(value, dict):
        return {key: normalize_integral_numbers(item) for key, item in value.items()}
    return value

def write_compiled_data(compiled_data, output_js):
    serialized_data = normalize_integral_numbers(compiled_data)
    js_content = [
        "// Consolidated subway data for multiple cities.",
        "// Generated automatically by compile_subways.py.",
        "",
        "window.subwayDataMap = " + json.dumps(serialized_data, ensure_ascii=False, indent=2) + ";",
        "",
        "// Keep window.subwayData for backward compatibility (Guangzhou)",
        "window.subwayData = window.subwayDataMap[\"guangzhou\"];"
    ]
    temporary_path = output_js + ".tmp"
    with open(temporary_path, "w", encoding="utf-8") as file:
        file.write("\n".join(js_content))
    os.replace(temporary_path, output_js)


def validate_compiled_data(compiled_data, expected_city_keys):
    """Reject incomplete or dangling output before replacing the public data file."""
    if set(compiled_data) != set(expected_city_keys):
        missing = sorted(set(expected_city_keys) - set(compiled_data))
        extra = sorted(set(compiled_data) - set(expected_city_keys))
        raise ValueError(f"Compiled city set mismatch; missing={missing}, extra={extra}")

    for city_key, city_data in compiled_data.items():
        nodes = city_data.get("nodes", [])
        edges = city_data.get("edges", [])
        node_names = {node.get("name") for node in nodes}
        station_ids = [node.get("stationId") for node in nodes]
        if not nodes or not edges:
            raise ValueError(f"Compiled city {city_key} is empty")
        if any(not station_id for station_id in station_ids) or len(set(station_ids)) != len(station_ids):
            raise ValueError(f"Compiled city {city_key} contains invalid station identities")
        dangling = [edge for edge in edges if edge.get("u") not in node_names or edge.get("v") not in node_names]
        if dangling:
            raise ValueError(f"Compiled city {city_key} contains {len(dangling)} dangling edges")

def patch_existing_nanjing_line6(output_js):
    compiled_data = load_existing_compiled_data(output_js)
    if not compiled_data or "nanjing" not in compiled_data:
        raise RuntimeError("Existing subway_data.js does not contain Nanjing data")

    nanjing = compiled_data["nanjing"]
    nodes = {node["name"]: node for node in nanjing["nodes"]}
    apply_nanjing_line6(nodes, nanjing["edges"])
    nanjing["nodes"] = list(nodes.values())
    write_compiled_data(compiled_data, output_js)

def load_existing_wiki_by_city(output_js):
    existing_data = load_existing_compiled_data(output_js)
    if not existing_data:
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

def parse_city_raw(raw_data, line_rename_fn=None, station_rename_fn=None, allowed_lines=None):
    nodes = {}
    edges = []
    
    for line in raw_data.get("l", []):
        ln = line.get("ln")
        if line_rename_fn:
            ln = line_rename_fn(ln)
        if allowed_lines is not None and ln not in allowed_lines:
            continue
            
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
            if x.is_integer():
                x = int(x)
            if y.is_integer():
                y = int(y)

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
    output_js = os.path.join(os.path.dirname(os.path.abspath(__file__)), "subway_data.js")
    existing_wiki_by_city = load_existing_wiki_by_city(output_js)
    
    # Fetch all cities raw data
    raw_subways = {}
    for c in CITIES:
        print(f"Fetching raw data for {c['name']} ({c['key']})...")
        raw = fetch_subway_raw(c["adcode"], c["pinyin"])
        if raw:
            raw_subways[c["key"]] = raw
        time.sleep(0.2)

    missing_city_data = [city["key"] for city in CITIES if city["key"] not in raw_subways]
    if missing_city_data:
        raise RuntimeError(f"Aborting compile; raw data missing for cities: {missing_city_data}")
        
    # Fetch secondary cities raw data for merging
    print("Fetching raw data for Foshan...")
    foshan_raw = fetch_subway_raw("4406", "foshan")
    if not foshan_raw:
        raise RuntimeError("Aborting compile; Foshan data is required for the Guangzhou network")
    print("Fetching raw data for Shaoxing...")
    shaoxing_raw = fetch_subway_raw("3306", "shaoxing")
    if not shaoxing_raw:
        raise RuntimeError("Aborting compile; Shaoxing data is required for the Hangzhou network")
    
    # Process each city
    for c in CITIES:
        key = c["key"]
        # Rename function for Hangzhou station collisions
        if key == "hangzhou":
            def station_rename_hangzhou(name, line_name):
                if name == "奥体中心" and ("绍兴" in line_name or line_name in ["1号线", "1号线支线", "2号线", "绍兴1号线", "绍兴1号线支线", "绍兴2号线"]):
                    return "绍兴奥体中心"
                return name
            nodes, edges = parse_city_raw(
                raw_subways[key],
                station_rename_fn=station_rename_hangzhou,
                allowed_lines=c.get("operational_lines"),
            )
        elif key == "nanjing":
            nodes, edges = parse_city_raw(
                raw_subways[key],
                station_rename_fn=normalize_nanjing_station_name,
                allowed_lines=c.get("operational_lines"),
            )
        else:
            nodes, edges = parse_city_raw(raw_subways[key], allowed_lines=c.get("operational_lines"))
        
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
            
        if key == "nanjing":
            apply_nanjing_line6(nodes, edges)

        attach_station_ids(key, nodes)
        compiled_data[key] = {
            "city": c["name"],
            "nodes": list(nodes.values()),
            "edges": edges
        }
        print(f"[{c['name']}] Compiled: {len(nodes)} stations, {len(edges)} sections.")

    restored_wiki_count = restore_existing_wiki(compiled_data, existing_wiki_by_city)
    print(f"Restored wiki metadata for {restored_wiki_count} stations.")

    surroundings_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "station_surroundings.json")
    if os.path.exists(surroundings_path):
        with open(surroundings_path, encoding="utf-8") as surroundings_file:
            surroundings_data = json.load(surroundings_file)
        surroundings_count = merge_surroundings(compiled_data, surroundings_data)
        print(f"Merged surroundings metadata for {surroundings_count} stations.")

    status_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "station_status.json")
    if os.path.exists(status_path):
        with open(status_path, encoding="utf-8") as status_file:
            status_data = json.load(status_file)
        status_count = merge_station_status(compiled_data, status_data)
        print(f"Merged operational status for {status_count} stations.")

    validate_compiled_data(compiled_data, [city["key"] for city in CITIES])
    write_compiled_data(compiled_data, output_js)
    print(f"Successfully compiled all cities and saved to {output_js}!")

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == "--patch-nanjing-line6":
        target = os.path.join(os.path.dirname(os.path.abspath(__file__)), "subway_data.js")
        patch_existing_nanjing_line6(target)
        print(f"Patched Nanjing Line 6 data in {target}")
    else:
        main()
