import json
import math
import sys
import time
import argparse
import os

def load_graph(json_path):
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data

class OptimizedLongestPathSolver:
    def __init__(self, data, config):
        self.nodes_data = data["nodes"]
        self.edges_data = data["edges"]
        self.config = config
        
        self.V = len(self.nodes_data)
        self.E = len(self.edges_data)
        
        # 1. Map station names to integer IDs
        self.station_name_to_id = {node["name"]: idx for idx, node in enumerate(self.nodes_data)}
        self.station_id_to_name = [node["name"] for node in self.nodes_data]
        
        self.start_id = self.station_name_to_id.get(config["start_station"])
        self.waypoint_ids = [self.station_name_to_id[wp] for wp in config["waypoints"] if wp in self.station_name_to_id]
        
        # Map line names to integer IDs
        self.line_name_to_id = {}
        line_counter = 0
        for edge in self.edges_data:
            if edge["line"] not in self.line_name_to_id:
                self.line_name_to_id[edge["line"]] = line_counter
                line_counter += 1
        self.line_count = line_counter
        
        # 2. Build flat graph representation and track degrees
        self.edge_u = [0] * self.E
        self.edge_v = [0] * self.E
        self.edge_line = [0] * self.E
        self.edge_weight = [1.0] * self.E
        self.total_network_weight = 0.0
        
        self.remaining_degree = [0] * self.V
        
        for idx, edge in enumerate(self.edges_data):
            u_id = self.station_name_to_id[edge["u"]]
            v_id = self.station_name_to_id[edge["v"]]
            self.edge_u[idx] = u_id
            self.edge_v[idx] = v_id
            self.edge_line[idx] = self.line_name_to_id[edge["line"]]
            
            self.remaining_degree[u_id] += 1
            self.remaining_degree[v_id] += 1
            
            weight = 1.0
            if config["optimize_metric"] == "distance":
                u_node = self.nodes_data[u_id]
                v_node = self.nodes_data[v_id]
                dx = u_node["x"] - v_node["x"]
                dy = u_node["y"] - v_node["y"]
                weight = math.sqrt(dx * dx + dy * dy)
                
            self.edge_weight[idx] = weight
            self.total_network_weight += weight
            
        # Adjacency list using integer tuples: (v, edge_id, line_id, weight)
        self.adj = [[] for _ in range(self.V)]
        for i in range(self.E):
            u = self.edge_u[i]
            v = self.edge_v[i]
            w = self.edge_weight[i]
            l = self.edge_line[i]
            self.adj[u].append((v, i, l, w))
            self.adj[v].append((u, i, l, w))
            
        # Greedy Sorting: Sort neighbors descending (waypoints first, then heaviest weight)
        for u in range(self.V):
            self.adj[u].sort(
                key=lambda x: (x[0] in self.waypoint_ids, x[3]),
                reverse=True
            )
            
        # Solver tracking states
        self.visited_edges = [0] * self.E
        self.visited_stations_count = [0] * self.V
        if self.start_id is not None:
            self.visited_stations_count[self.start_id] = 1
            
        self.line_usage_count = [0] * self.line_count
        self.unique_lines_count = 0
        
        # BFS pre-allocated arrays
        self.bfs_queue = [0] * self.V
        self.node_visited_token = [0] * self.V
        self.current_bfs_token = 0
        self.counted_edges_token = [0] * self.E
        self.current_edge_bfs_token = 0
        
        # Paths
        self.current_path = [0] * self.E
        self.current_stations_path = [0] * (self.E + 1)
        if self.start_id is not None:
            self.current_stations_path[0] = self.start_id
            
        self.best_path = []
        self.best_weight = -1.0
        self.best_stations = []
        
        self.start_time = 0.0
        self.timeout_reached = False
        self.step_count = 0
        
    def add_line_usage(self, line_id):
        if self.line_usage_count[line_id] == 0:
            self.unique_lines_count += 1
        self.line_usage_count[line_id] += 1
        
    def remove_line_usage(self, line_id):
        self.line_usage_count[line_id] -= 1
        if self.line_usage_count[line_id] == 0:
            self.unique_lines_count -= 1
            
    def get_reachable_remaining_weight(self, start_node):
        self.current_bfs_token += 1
        self.current_edge_bfs_token += 1
        
        head_ptr = 0
        tail_ptr = 0
        
        self.bfs_queue[tail_ptr] = start_node
        tail_ptr += 1
        self.node_visited_token[start_node] = self.current_bfs_token
        
        reachable_weight = 0.0
        
        while head_ptr < tail_ptr:
            u = self.bfs_queue[head_ptr]
            head_ptr += 1
            
            for v, edge_id, _, weight in self.adj[u]:
                if self.visited_edges[edge_id] == 1 or self.counted_edges_token[edge_id] == self.current_edge_bfs_token:
                    continue
                    
                if not self.config["allow_station_reuse"] and self.visited_stations_count[v] > 0 and v != self.start_id:
                    continue
                    
                self.counted_edges_token[edge_id] = self.current_edge_bfs_token
                reachable_weight += weight
                
                if self.node_visited_token[v] != self.current_bfs_token:
                    self.node_visited_token[v] = self.current_bfs_token
                    self.bfs_queue[tail_ptr] = v
                    tail_ptr += 1
                    
        return reachable_weight
        
    def solve(self):
        if self.start_id is None:
            print(f"Error: Start station '{self.config['start_station']}' not found.")
            return None
            
        self.start_time = time.time()
        self.dfs(self.start_id, 0, 0.0, -1, 0, self.total_network_weight)
        
        return {
            "path_edges": self.best_path,
            "path_stations": self.best_stations,
            "weight": self.best_weight,
            "timeout_reached": self.timeout_reached
        }
        
    def dfs(self, u, path_len, current_weight, last_line_id, transfer_count, remaining_weight):
        self.step_count += 1
        if self.step_count % 10000 == 0:
            if time.time() - self.start_time > self.config["timeout"]:
                self.timeout_reached = True
                return
                
        # Candidate check
        is_candidate = True
        for wp_id in self.waypoint_ids:
            if self.visited_stations_count[wp_id] == 0:
                is_candidate = False
                break
                
        if self.config["mode"] == "loop":
            if u == self.start_id and path_len > 0:
                if is_candidate and current_weight > self.best_weight:
                    self.best_weight = current_weight
                    self.best_path = self.current_path[:path_len]
                    self.best_stations = [self.station_id_to_name[sid] for sid in self.current_stations_path[:path_len+1]]
                return
        else:
            if is_candidate and current_weight > self.best_weight:
                self.best_weight = current_weight
                self.best_path = self.current_path[:path_len]
                self.best_stations = [self.station_id_to_name[sid] for sid in self.current_stations_path[:path_len+1]]
                
        # O(1) Upper Bound check
        if current_weight + remaining_weight <= self.best_weight:
            return
            
        # O(1) Waypoint degree dead-end pruning
        for wp_id in self.waypoint_ids:
            if self.visited_stations_count[wp_id] == 0 and self.remaining_degree[wp_id] == 0:
                return
            
        # O(V + E) Reachability check
        if path_len % 3 == 0:
            reachable_weight = self.get_reachable_remaining_weight(u)
            if current_weight + reachable_weight <= self.best_weight:
                return
                
            # Waypoint reachability check
            for wp_id in self.waypoint_ids:
                if self.visited_stations_count[wp_id] == 0 and self.node_visited_token[wp_id] != self.current_bfs_token:
                    return
                    
        # Explore neighbors
        for v, edge_id, line_id, weight in self.adj[u]:
            if self.visited_edges[edge_id] == 1:
                continue
                
            if not self.config["allow_station_reuse"]:
                if v == self.start_id and self.config["mode"] == "loop":
                    pass
                elif self.visited_stations_count[v] > 0:
                    continue
                    
            new_transfer_count = transfer_count
            if last_line_id != -1 and last_line_id != line_id:
                new_transfer_count += 1
            if self.config["max_transfers"] is not None and new_transfer_count > self.config["max_transfers"]:
                continue
                
            if self.config["max_lines"] is not None:
                self.add_line_usage(line_id)
                if self.unique_lines_count > self.config["max_lines"]:
                    self.remove_line_usage(line_id)
                    continue
                    
            # Recurse
            self.visited_edges[edge_id] = 1
            self.visited_stations_count[v] += 1
            self.remaining_degree[u] -= 1
            self.remaining_degree[v] -= 1
            self.current_path[path_len] = edge_id
            self.current_stations_path[path_len + 1] = v
            
            self.dfs(v, path_len + 1, current_weight + weight, line_id, new_transfer_count, remaining_weight - weight)
            
            # Backtrack
            self.remaining_degree[u] += 1
            self.remaining_degree[v] += 1
            self.visited_stations_count[v] -= 1
            self.visited_edges[edge_id] = 0
            if self.config["max_lines"] is not None:
                self.remove_line_usage(line_id)
                
            if self.timeout_reached:
                return

def print_result(result, edges_data, optimize_metric):
    if not result or result["weight"] == -1:
        print("\nNo valid path found matching the constraints.")
        return
        
    print("\n" + "="*50)
    print("广州地铁大环线设计结果")
    print("="*50)
    print(f"运行状态: {'时间超时限制 (已返回当前最长路)' if result['timeout_reached'] else '搜索完成'}")
    
    if optimize_metric == "distance":
        print(f"总计算距离: {result['weight']:.2f} 单位")
        print(f"经过区间数: {len(result['path_edges'])} 个")
    else:
        print(f"经过区间数: {result['weight']:.0f} 个")
        
    print(f"经过车站数: {len(result['path_stations'])} 个")
    
    print("\n详细路线步骤:")
    stations = result["path_stations"]
    path_edges = result["path_edges"]
    
    print(f"起点: {stations[0]}")
    for i in range(len(path_edges)):
        edge_id = path_edges[i]
        edge = edges_data[edge_id]
        next_station = stations[i+1]
        print(f"  → 乘坐 [{edge['line']}] 抵达 -> {next_station}")
        
    print("="*50)

def main():
    parser = argparse.ArgumentParser(description="广州地铁最长路径规划求解器")
    parser.add_argument("--start", type=str, required=True, help="起点车站名称")
    parser.add_argument("--mode", type=str, choices=["path", "loop"], default="path", help="规划模式: path(单向路径) 或 loop(闭环回路)")
    parser.add_argument("--no-reuse", action="store_true", help="启用此项则同一车站无论如何不能重复经过")
    parser.add_argument("--max-transfers", type=int, default=None, help="最大允许换乘次数")
    parser.add_argument("--max-lines", type=int, default=None, help="最大使用线路数")
    parser.add_argument("--waypoints", type=str, default="", help="必经打卡车站列表，逗号分隔")
    parser.add_argument("--metric", type=str, choices=["edges", "distance"], default="edges", help="最优化度量: edges(区间数) 或 distance(物理距离)")
    parser.add_argument("--timeout", type=float, default=10.0, help="搜索超时时间(秒)")
    parser.add_argument("--output-svg", action="store_true", help="是否同时输出高亮路径的 SVG 地图")
    
    args = parser.parse_args()
    
    project_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(project_dir, "guangzhou_subway_network.json")
    if not os.path.exists(json_path):
        print(f"Error: Network JSON file not found at {json_path}. Please run generate_subway_graph.py first.")
        sys.exit(1)
        
    data = load_graph(json_path)
    
    waypoints_list = []
    if args.waypoints:
        waypoints_list = [w.strip() for w in args.waypoints.split(",") if w.strip()]
        
    config = {
        "start_station": args.start,
        "mode": args.mode,
        "allow_station_reuse": not args.no_reuse,
        "max_transfers": args.max_transfers,
        "max_lines": args.max_lines,
        "waypoints": waypoints_list,
        "optimize_metric": args.metric,
        "timeout": args.timeout
    }
    
    print(f"正在进行最长路径规划，起点: {args.start} | 模式: {args.mode} | 度量: {args.metric}...")
    solver = OptimizedLongestPathSolver(data, config)
    result = solver.solve()
    
    print_result(result, data["edges"], args.metric)
    
    if result and result["weight"] > -1:
        result_json_path = os.path.join(project_dir, "longest_path_result.json")
        with open(result_json_path, "w", encoding="utf-8") as f:
            json.dump({
                "path_edges": result["path_edges"],
                "path_stations": result["path_stations"]
            }, f, ensure_ascii=False, indent=2)
            
        if args.output_svg:
            print("\n正在生成高亮路径的 SVG 向量图...")
            import subprocess
            subprocess.run([
                "python3", 
                os.path.join(project_dir, "generate_subway_graph.py"),
                "--highlight",
                result_json_path
            ])

if __name__ == "__main__":
    main()
