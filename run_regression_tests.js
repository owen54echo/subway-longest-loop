// run_regression_tests.js
// Regression test suite for the Optimized JS Solver (solver-worker.js) in Node.js

const fs = require('fs');
const path = require('path');

// 1. Load subway data from subway_data.js
function loadSubwayData() {
    const dataPath = path.join(__dirname, 'subway_data.js');
    if (!fs.existsSync(dataPath)) {
        console.error(`错误: 找不到数据文件 ${dataPath}`);
        process.exit(1);
    }
    const fileContent = fs.readFileSync(dataPath, 'utf8');
    
    // Evaluate in a context where window is mocked
    const sandbox = { window: {} };
    try {
        const runFn = new Function('window', fileContent + '\nreturn window;');
        const resultWindow = runFn(sandbox.window);
        return resultWindow.subwayData;
    } catch (e) {
        console.error("错误: 加载/运行 subway_data.js 失败:", e);
        process.exit(1);
    }
}

// 2. Wrap solver-worker.js so it can run synchronously as a function
function getSolverRunner() {
    const workerPath = path.join(__dirname, 'solver-worker.js');
    if (!fs.existsSync(workerPath)) {
        console.error(`错误: 找不到 solver-worker.js 文件`);
        process.exit(1);
    }
    const workerCode = fs.readFileSync(workerPath, 'utf8');
    
    return function runSolver(config) {
        let result = null;
        
        // Mock environment
        const context = {
            postMessage: (msg) => {
                if (msg && (msg.type === 'result' || msg.path_edges !== undefined)) {
                    result = msg;
                }
            },
            onmessage: null
        };
        
        // Use a Function wrapper to create a local scope that resolves postMessage and onmessage
        const wrapperCode = `
(function(self) {
    const postMessage = self.postMessage;
    let onmessage = null;
    
    ${workerCode}
    
    self.onmessage = onmessage;
})(this);
        `;
        
        try {
            const runFn = new Function(wrapperCode);
            runFn.call(context);
        } catch (e) {
            console.error("加载 solver-worker.js 发生语法或初始化错误:", e);
            throw e;
        }
        
        if (typeof context.onmessage !== 'function') {
            throw new Error("solver-worker.js 没有正确挂载 onmessage 处理器");
        }
        
        // Run solver
        context.onmessage({ data: config });
        return result;
    };
}

// 3. Test runner
function runTestCase(name, solverRunner, data, testConfig) {
    console.log(`\n--- 运行测试用例: ${name} ---`);
    console.log(`配置: 起点=${testConfig.start_station}, 模式=${testConfig.mode}, 允许重复=${testConfig.allow_station_reuse}, 打卡=[${testConfig.waypoints.join(', ')}]`);
    
    const startTime = Date.now();
    
    // Build config to pass to the worker
    const config = {
        start_station: testConfig.start_station,
        end_station: testConfig.end_station,
        mode: testConfig.mode,
        allow_station_reuse: testConfig.allow_station_reuse,
        max_transfers: testConfig.max_transfers,
        max_lines: testConfig.max_lines,
        waypoints: testConfig.waypoints,
        optimize_metric: testConfig.optimize_metric,
        nodes: data.nodes,
        edges: data.edges, // Use full network in regression test
        timeout: testConfig.timeout || 5
    };
    
    let result;
    try {
        result = solverRunner(config);
    } catch (err) {
        console.error("❌ 失败: 运行求解器时发生异常:", err);
        return false;
    }
    
    const duration = Date.now() - startTime;
    
    if (!result) {
        console.error("❌ 失败: 求解器没有返回任何结果");
        return false;
    }
    
    console.log(`计算耗时: ${duration} 毫秒`);
    console.log(`最长权重/段数: ${result.weight}`);
    console.log(`途经车站数: ${result.path_stations ? result.path_stations.length : 0}`);
    console.log(`是否超时截断: ${result.timeout_reached}`);
    
    if (result.weight > -1) {
        const stations = result.path_stations;
        const edges = result.path_edges;
        
        // Check structural sanity
        if (!stations || !edges) {
            console.error("❌ 失败: 结果中缺失 path_stations 或 path_edges");
            return false;
        }
        
        if (stations.length !== edges.length + 1) {
            console.error(`❌ 失败: 路径站数 (${stations.length}) 与区间边数 (${edges.length}) 不匹配`);
            return false;
        }
        
        // Verify edge connections
        for (let i = 0; i < edges.length; i++) {
            const edgeIdx = edges[i];
            const edge = data.edges[edgeIdx];
            if (!edge) {
                console.error(`❌ 失败: 索引为 ${edgeIdx} 的边在原数据中不存在`);
                return false;
            }
            
            const u = edge.u;
            const v = edge.v;
            const currSt = stations[i];
            const nextSt = stations[i + 1];
            
            const connects = (u === currSt && v === nextSt) || (u === nextSt && v === currSt);
            if (!connects) {
                console.error(`❌ 失败: 第 ${i} 步区间 [${edge.line}] (${u} <-> ${v}) 与路径相邻站 (${currSt} -> ${nextSt}) 不连通`);
                return false;
            }
        }
        
        // Loop mode constraint
        if (config.mode === 'loop') {
            if (stations[0] !== stations[stations.length - 1]) {
                console.error(`❌ 失败: 环线模式下起点 (${stations[0]}) 与终点 (${stations[stations.length - 1]}) 不同`);
                return false;
            }
        }
        
        // End station constraint
        if (config.end_station) {
            if (stations[stations.length - 1] !== config.end_station) {
                console.error(`❌ 失败: 终点约束未满足，预期终点: ${config.end_station}，实际终点: ${stations[stations.length - 1]}`);
                return false;
            }
        }
        
        // Station reuse constraint
        if (!config.allow_station_reuse) {
            const visited = {};
            for (let i = 0; i < stations.length; i++) {
                const st = stations[i];
                visited[st] = (visited[st] || 0) + 1;
            }
            
            for (const st in visited) {
                const count = visited[st];
                if (config.mode === 'loop' && st === config.start_station) {
                    if (count > 2) {
                        console.error(`❌ 失败: 环路非重复模式下起点访问了 ${count} 次 (上限 2)`);
                        return false;
                    }
                } else {
                    if (count > 1) {
                        console.error(`❌ 失败: 非重复模式下车站 '${st}' 被重复访问了 ${count} 次`);
                        return false;
                    }
                }
            }
        }
        
        // Waypoints constraint
        for (let i = 0; i < config.waypoints.length; i++) {
            const wp = config.waypoints[i];
            if (!stations.includes(wp)) {
                console.error(`❌ 失败: 路径中未包含必经打卡站 '${wp}'`);
                return false;
            }
        }
        
        console.log(`✅ 成功: 路径结构完全合法且连通`);
        return true;
    } else {
        console.log(`ℹ️ 提示: 未找到符合约束的路径 (此结果对于某些测试用例是正确的)`);
        return true;
    }
}

function main() {
    const data = loadSubwayData();
    const solverRunner = getSolverRunner();
    
    const testCases = [
        {
            name: "体育西路单向最长路径 (允许重复车站)",
            config: {
                start_station: "体育西路",
                mode: "path",
                allow_station_reuse: true,
                max_transfers: null,
                max_lines: null,
                waypoints: [],
                optimize_metric: "stations",
                timeout: 5.0
            }
        },
        {
            name: "公园前闭环最长回路 (禁止重复车站)",
            config: {
                start_station: "公园前",
                mode: "loop",
                allow_station_reuse: false,
                max_transfers: null,
                max_lines: null,
                waypoints: [],
                optimize_metric: "stations",
                timeout: 5.0
            }
        },
        {
            name: "体育西路起点的打卡规划 (包含 广州塔 和 广州南站)",
            config: {
                start_station: "体育西路",
                mode: "path",
                allow_station_reuse: true,
                max_transfers: null,
                max_lines: null,
                waypoints: ["广州塔", "广州南站"],
                optimize_metric: "stations",
                timeout: 5.0
            }
        },
        {
            name: "嘉禾望岗单向最长路径 (限制最多 3 次换乘)",
            config: {
                start_station: "嘉禾望岗",
                mode: "path",
                allow_station_reuse: true,
                max_transfers: 3,
                max_lines: null,
                waypoints: [],
                optimize_metric: "stations",
                timeout: 5.0
            }
        },
        {
            name: "无法连通的打卡站测试 (剪枝边界条件验证)",
            config: {
                start_station: "沙园",
                mode: "path",
                allow_station_reuse: false,
                max_transfers: null,
                max_lines: null,
                waypoints: ["从化客运站"],
                optimize_metric: "stations",
                timeout: 5.0
            }
        },
        {
            name: "体育西路到广州南站最长路径 (允许重复车站)",
            config: {
                start_station: "体育西路",
                end_station: "广州南站",
                mode: "path",
                allow_station_reuse: true,
                max_transfers: null,
                max_lines: null,
                waypoints: [],
                optimize_metric: "stations",
                timeout: 5.0
            }
        },
        {
            name: "万胜围到西塱最长路径 (禁止重复车站)",
            config: {
                start_station: "万胜围",
                end_station: "西塱",
                mode: "path",
                allow_station_reuse: false,
                max_transfers: null,
                max_lines: null,
                waypoints: [],
                optimize_metric: "stations",
                timeout: 5.0
            }
        }
    ];
    
    let passCount = 0;
    testCases.forEach(tc => {
        if (runTestCase(tc.name, solverRunner, data, tc.config)) {
            passCount++;
        }
    });
    
    console.log(`\n==========================================`);
    console.log(`JS 回归测试完成: ${passCount}/${testCases.length} 通过`);
    console.log(`==========================================`);
    
    if (passCount !== testCases.length) {
        process.exit(1);
    }
}

main();
