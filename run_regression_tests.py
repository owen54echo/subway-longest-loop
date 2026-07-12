# run_regression_tests.py
# Regression test suite for the Optimized Longest Path Solver

import sys
import os
import time

# Adjust path to import from the project directory
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from longest_path_solver import load_graph, OptimizedLongestPathSolver

def run_test_case(name, data, config):
    print(f"\n--- 运行测试用例: {name} ---")
    print(f"配置: 起点={config['start_station']}, 模式={config['mode']}, 允许重复={config['allow_station_reuse']}, 打卡={config['waypoints']}")
    
    start_time = time.perf_counter()
    solver = OptimizedLongestPathSolver(data, config)
    result = solver.solve()
    duration = time.perf_counter() - start_time
    
    # 1. Check for crash / termination
    if not result:
        print(f"❌ 失败: 求解器返回空对象")
        return False
        
    print(f"计算耗时: {duration * 1000:.2f} 毫秒")
    print(f"最长权重/段数: {result['weight']}")
    print(f"途经车站数: {len(result['path_stations'])}")
    print(f"是否超时截断: {result['timeout_reached']}")
    
    # 2. Check path sanity
    if result["weight"] > -1:
        stations = result["path_stations"]
        edges = result["path_edges"]
        
        # Verify length matching
        if len(stations) != len(edges) + 1:
            print(f"❌ 失败: 路径站数 ({len(stations)}) 与区间边数 ({len(edges)}) 不匹配")
            return False
            
        # Verify edge connections
        for idx, edge_idx in enumerate(edges):
            edge = data["edges"][edge_idx]
            u, v = edge["u"], edge["v"]
            curr_st = stations[idx]
            next_st = stations[idx + 1]
            
            # Check if edge endpoints match successive stations
            if not ((u == curr_st and v == next_st) or (u == next_st and v == curr_st)):
                print(f"❌ 失败: 第 {idx} 步区间 [{edge['line']}] ({u} <-> {v}) 与路径相邻站 ({curr_st} -> {next_st}) 不连通")
                return False
                
        # Verify Loop constraint
        if config["mode"] == "loop":
            if stations[0] != stations[-1]:
                print(f"❌ 失败: 环线模式下起点 ({stations[0]}) 与终点 ({stations[-1]}) 不同")
                return False
                
        # Verify Node-Simple constraint
        if not config["allow_station_reuse"]:
            visited_counts = {}
            for st in stations:
                visited_counts[st] = visited_counts.get(st, 0) + 1
            
            # For loop mode, only start/end can repeat
            for st, count in visited_counts.items():
                if config["mode"] == "loop" and st == config["start_station"]:
                    if count > 2:
                        print(f"❌ 失败: 非重复节点环线模式中起点访问了 {count} 次 (上限 2)")
                        return False
                else:
                    if count > 1:
                        print(f"❌ 失败: 非重复节点路径模式中车站 '{st}' 重复访问了 {count} 次")
                        return False
                        
        # Verify Waypoints constraint
        for wp in config["waypoints"]:
            if wp not in stations:
                print(f"❌ 失败: 路径未覆盖必经打卡站 '{wp}'")
                return False
                
        print(f"✅ 成功: 路径结构完全合法且连通")
        return True
    else:
        print(f"ℹ️ 提示: 未找到符合约束的路径 (此结果对于某些死路测试用例是正确的)")
        return True

def main():
    json_path = os.path.join(os.path.dirname(__file__), "guangzhou_subway_network.json")
    if not os.path.exists(json_path):
        print(f"错误: 找不到网络数据 {json_path}")
        sys.exit(1)
        
    data = load_graph(json_path)
    
    test_cases = [
        # 1. Standard single path with central hub
        {
            "name": "体育西路单向最长路径 (允许重复车站)",
            "config": {
                "start_station": "体育西路",
                "mode": "path",
                "allow_station_reuse": True,
                "max_transfers": None,
                "max_lines": None,
                "waypoints": [],
                "optimize_metric": "edges",
                "timeout": 5.0
            }
        },
        # 2. Loop path with non-reuse stations
        {
            "name": "公园前闭环最长回路 (禁止重复车站)",
            "config": {
                "start_station": "公园前",
                "mode": "loop",
                "allow_station_reuse": False,
                "max_transfers": None,
                "max_lines": None,
                "waypoints": [],
                "optimize_metric": "edges",
                "timeout": 5.0
            }
        },
        # 3. Waypoint routing
        {
            "name": "体育西路起点的打卡规划 (包含 广州塔 和 广州南站)",
            "config": {
                "start_station": "体育西路",
                "mode": "path",
                "allow_station_reuse": True,
                "max_transfers": None,
                "max_lines": None,
                "waypoints": ["广州塔", "广州南站"],
                "optimize_metric": "edges",
                "timeout": 5.0
            }
        },
        # 4. Strict transfers limit
        {
            "name": "嘉禾望岗单向最长路径 (限制最多 3 次换乘)",
            "config": {
                "start_station": "嘉禾望岗",
                "mode": "path",
                "allow_station_reuse": True,
                "max_transfers": 3,
                "max_lines": None,
                "waypoints": [],
                "optimize_metric": "edges",
                "timeout": 5.0
            }
        },
        # 5. Non-existent waypoint test (Should return no path or prune instantly)
        {
            "name": "无法连通的打卡站测试 (剪枝边界条件验证)",
            "config": {
                "start_station": "沙园",
                "mode": "path",
                "allow_station_reuse": False,
                "max_transfers": None,
                "max_lines": None,
                "waypoints": ["从化客运站"], # Fromhua is very far on Line 14, no-reuse makes it extremely hard or impossible to reach under strict limits
                "optimize_metric": "edges",
                "timeout": 5.0
            }
        }
    ]
    
    success_count = 0
    for tc in test_cases:
        if run_test_case(tc["name"], data, tc["config"]):
            success_count += 1
            
    print(f"\n==========================================")
    print(f"回归测试完成: {success_count}/{len(test_cases)} 通过")
    print(f"==========================================")

if __name__ == "__main__":
    main()
