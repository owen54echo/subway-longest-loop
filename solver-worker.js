// solver-worker.js
// 高度优化的地铁 network 最长路径/环线求解器 (Web Worker 独立线程运行)
// 核心优化技术：
// 1. 扁平化 TypedArray (一维类型化数组) 与 前向星 (Forward Star) 图表示法，避免 JS 对象与内存碎片的开销
// 2. 邻接边贪心排序启发式算法：优先探索连接必经站 (Waypoint) 的边与权重较大的边
// 3. 动态节点度数 (Degree) 跟踪：用于 O(1) 必经站死胡同剪枝 (Waypoint Dead-end Pruning)
// 4. O(1) 绝对最大权重上限剪枝
// 5. 零内存分配 (Zero-allocation) 的 BFS 连通性与必经站可达性剪枝

onmessage = function(e) {
    // 接收主线程传递的配置参数
    const config = e.data;
    const { 
        start_station,          // 起始车站名称
        mode,                   // 模式："loop" (闭环回路) 或 "path" (单向最长路径)
        allow_station_reuse,    // 是否允许车站重复经过
        max_transfers,          // 最大换乘次数限制 (null 表示不限制)
        max_lines,              // 最大经过线路数限制 (null 表示不限制)
        waypoints,              // 必经车站名称列表
        optimize_metric,        // 优化度量维度："distance" (估算距离) 或 "edges"/"stations" (区间数/站数)
        nodes,                  // 地铁车站节点数据数组
        edges,                  // 地铁区间边数据数组
        end_station             // 终点车站名称
    } = config;

    const V = nodes.length;     // 车站总数
    const E = edges.length;     // 区间边总数

    // 1. 建立车站名称与整数 ID 的双向映射，后续算法全部使用整数 ID 以极大地提升性能
    const stationNameToId = {};
    const stationIdToName = new Array(V);
    nodes.forEach((node, idx) => {
        stationNameToId[node.name] = idx;
        stationIdToName[idx] = node.name;
    });

    const startId = stationNameToId[start_station]; // 起始车站的 ID
    const endId = end_station ? stationNameToId[end_station] : undefined; // 终点车站的 ID
    // 过滤并映射必经车站的名称为 ID 列表
    const waypointIds = (waypoints || []).map(name => stationNameToId[name]).filter(id => id !== undefined);
    
    // 2. 建立线路名称到整数 ID 的映射，方便在搜索时快速比对线路是否切换
    const lineNameToId = {};
    let lineCounter = 0;
    edges.forEach(edge => {
        if (lineNameToId[edge.line] === undefined) {
            lineNameToId[edge.line] = lineCounter++;
        }
    });
    const lineCount = lineCounter; // 不同的地铁线路总数

    // 3. 解析边数据并使用一维类型化数组 (TypedArray) 存储，相比普通 JS 对象可成倍降低内存占用与 GC 耗时
    const edgeU = new Int32Array(E);      // 每条边的一端车站 ID
    const edgeV = new Int32Array(E);      // 每条边的另一端车站 ID
    const edgeLine = new Int32Array(E);   // 每条边所属的地铁线路 ID
    const edgeWeight = new Float32Array(E); // 每条边的权重 (距离或站数)
    let totalNetworkWeight = 0.0;         // 全网边权重总和，用于计算路径的上界限制

    // 记录每个车站的可用度数（当前状态下连接的未访问边的数量），用于 O(1) 死胡同剪枝
    const remainingDegree = new Int32Array(V);

    edges.forEach((edge, idx) => {
        edgeU[idx] = stationNameToId[edge.u];
        edgeV[idx] = stationNameToId[edge.v];
        edgeLine[idx] = lineNameToId[edge.line];
        
        // 累加车站的初始度数
        remainingDegree[edgeU[idx]]++;
        remainingDegree[edgeV[idx]]++;
        
        // 默认每条区间（边）的权重为 1.0；距离模式优先使用真实区间长度，缺失时回退到经纬度直线距离。
        const distanceWeight = edge.actualLengthKm ?? edge.straightLengthKm;
        const weight = optimize_metric === "distance" && Number.isFinite(distanceWeight) && distanceWeight > 0
            ? distanceWeight
            : 1.0;
        edgeWeight[idx] = weight;
        totalNetworkWeight += weight;
    });

    // 4. 邻接边贪心排序启发式算法
    // 收集每个节点 u 的所有出边，排序后准备构建前向星
    const nodeEdges = Array.from({ length: V }, () => []);
    for (let i = 0; i < E; i++) {
        const u = edgeU[i];
        const v = edgeV[i];
        const w = edgeWeight[i];
        const lineId = edgeLine[i];
        nodeEdges[u].push({ to: v, id: i, lineId: lineId, weight: w });
        nodeEdges[v].push({ to: u, id: i, lineId: lineId, weight: w });
    }

    // 对每个车站的邻接边排序：
    // 注意：前向星在遍历时，较晚插入链表的边会最先被取出遍历。
    // 因此，为了优先遍历“必经站”和“大权重边”，我们需要按升序排序，使优先级高（必经站/大权重）的边处于尾部，后插入链表，从而被最先遍历。
    for (let u = 0; u < V; u++) {
        nodeEdges[u].sort((a, b) => {
            // 规则一：连接必经车站的边优先
            const aIsWp = waypointIds.includes(a.to) ? 1 : 0;
            const bIsWp = waypointIds.includes(b.to) ? 1 : 0;
            if (aIsWp !== bIsWp) {
                return aIsWp - bIsWp; 
            }
            // 规则二：权重较大的边优先
            return a.weight - b.weight;
        });
    }

    // 5. 构建前向星 (Forward Star) 图数据结构
    // head[u] 存储节点 u 的第一条出边在 to/edgeId/next 数组中的索引偏移量
    const head = new Int32Array(V).fill(-1);
    const to = new Int32Array(2 * E);      // 存储目标节点的 ID
    const edgeId = new Int32Array(2 * E);  // 存储对应的原始边 ID
    const next = new Int32Array(2 * E);    // 链表的下一指针
    let edgeCounter = 0;

    // 向前向星中添加单向边信息
    function addHalfEdge(u, v, id) {
        to[edgeCounter] = v;
        edgeId[edgeCounter] = id;
        next[edgeCounter] = head[u];
        head[u] = edgeCounter++;
    }

    // 按已排序的顺序将所有边插入前向星中
    for (let u = 0; u < V; u++) {
        nodeEdges[u].forEach(e => {
            addHalfEdge(u, e.to, e.id);
        });
    }

    // 6. 预先分配搜索所需的全部状态数组，实现零动态内存分配 (Zero-Allocation)，避免垃圾回收引发的卡顿
    const visitedEdges = new Uint8Array(E); // 标记边是否已访问
    const visitedStationsCount = new Int32Array(V); // 记录每个车站的访问次数
    visitedStationsCount[startId] = 1; // 标记起点已访问一次

    // 预分配用于 BFS 连通性校验的队列与标记数组，杜绝 BFS 时动态 new Array() 或 new Set()
    const bfsQueue = new Int32Array(V);
    const nodeVisitedToken = new Int32Array(V); // 车站的 BFS 访问标记（通过每次自增 token 避免循环重置数组）
    let currentBfsToken = 1;
    const countedEdgesToken = new Int32Array(E); // 边的 BFS 计数标记
    let currentEdgeBfsToken = 1;

    // 记录当前的搜索路径
    const currentPath = new Int32Array(E); // 当前经过的边 ID 数组
    const currentStationsPath = new Int32Array(E + 1); // 当前经过的车站 ID 数组
    currentStationsPath[0] = startId;

    // 保存全局搜索出的最佳路径结果
    let bestPath = [];
    let bestWeight = -1.0;
    let bestStations = [];

    const startTime = Date.now();
    const timeoutDuration = (config.timeout || 10) * 1000; // 超时限制 (默认为 10 秒)
    let timeoutReached = false;

    // 7. 使用预分配容器进行快速 BFS，计算当前节点在剩余子图中的“最大连通分量权重之和”与“必经站连通性”
    function getReachableRemainingWeight(startNode) {
        currentBfsToken++;     // 递增 Token，用于无清空数组开销的 O(1) 访问状态标记
        currentEdgeBfsToken++;

        let headPtr = 0;
        let tailPtr = 0;

        bfsQueue[tailPtr++] = startNode;
        nodeVisitedToken[startNode] = currentBfsToken;

        let reachableWeight = 0.0;

        while (headPtr < tailPtr) {
            const u = bfsQueue[headPtr++];
            
            let e = head[u];
            while (e !== -1) {
                const v = to[e];
                const id = edgeId[e];
                
                // 剪枝条件：边已被使用，或在此轮 BFS 中已被统计过
                if (visitedEdges[id] === 1 || countedEdgesToken[id] === currentEdgeBfsToken) {
                    e = next[e];
                    continue;
                }

                // 剪枝条件：如果不允许车站复用，且目标车站已被访问过（且不是起点车站，如果是闭环允许回起点）
                if (!allow_station_reuse && visitedStationsCount[v] > 0 && v !== startId) {
                    e = next[e];
                    continue;
                }

                // 标记此边已被统计过，并累加它的可达权重
                countedEdgesToken[id] = currentEdgeBfsToken;
                reachableWeight += edgeWeight[id];

                // 如果目标节点在此轮 BFS 中尚未访问，将其加入队列
                if (nodeVisitedToken[v] !== currentBfsToken) {
                    nodeVisitedToken[v] = currentBfsToken;
                    bfsQueue[tailPtr++] = v;
                }
                e = next[e];
            }
        }
        return reachableWeight;
    }

    // 线路使用计数器与不重复线路统计器，用于控制 max_lines (最大线路数) 限制
    const lineUsageCount = new Int32Array(lineCount);
    let uniqueLinesCount = 0;

    function addLineUsage(lineId) {
        if (lineUsageCount[lineId] === 0) {
            uniqueLinesCount++;
        }
        lineUsageCount[lineId]++;
    }

    function removeLineUsage(lineId) {
        lineUsageCount[lineId]--;
        if (lineUsageCount[lineId] === 0) {
            uniqueLinesCount--;
        }
    }

    // 获取起点的一级分支总数，用于计算求解进度百分比
    let totalFirstLevel = 0;
    let tempE = head[startId];
    while (tempE !== -1) {
        totalFirstLevel++;
        tempE = next[tempE];
    }
    if (totalFirstLevel === 0) totalFirstLevel = 1;
    let currentFirstLevelIndex = 0;

    // 8. 核心 DFS 回溯搜索算法
    let remainingTotalWeight = totalNetworkWeight; // 全网尚未使用的边总权重上限，用于全局上界剪枝
    let stepCount = 0;

    function isThroughServiceTransition(previousEdgeId, nextEdgeId) {
        if (previousEdgeId === -1 || nextEdgeId === -1) return false;
        const previousEdge = edges[previousEdgeId];
        const nextEdge = edges[nextEdgeId];
        const previousGroups = previousEdge?.throughServiceGroups || [];
        const nextGroups = nextEdge?.throughServiceGroups || [];
        const sharedGroup = previousGroups.find(group => nextGroups.includes(group));
        if (!sharedGroup) return false;

        const previousStations = [previousEdge.mapU || previousEdge.u, previousEdge.mapV || previousEdge.v]
            .filter(station => previousEdge.throughServiceEndpointGroups?.[station] === sharedGroup);
        const nextStations = [nextEdge.mapU || nextEdge.u, nextEdge.mapV || nextEdge.v]
            .filter(station => nextEdge.throughServiceEndpointGroups?.[station] === sharedGroup);

        return previousStations.length > 0 && nextStations.length > 0 &&
            !previousStations.some(station => nextStations.includes(station));
    }

    function dfs(u, pathLen, currentWeight, lastLineId, lastEdgeId, transferCount) {
        stepCount++;
        
        // 每 5000 步进行一次超时判定与进度反馈，防止阻塞并提供 UI 交互体验
        if (stepCount % 5000 === 0) {
            if (Date.now() - startTime > timeoutDuration) {
                timeoutReached = true;
                return;
            }
            postMessage({
                type: "progress",
                step_count: stepCount,
                percent: Math.min(99, Math.round((currentFirstLevelIndex / totalFirstLevel) * 100))
            });
        }

        // 检查必经车站 (Waypoints) 是否都已访问
        let isValidCandidate = true;
        for (let i = 0; i < waypointIds.length; i++) {
            if (visitedStationsCount[waypointIds[i]] === 0) {
                isValidCandidate = false;
                break;
            }
        }

        // 回路模式 (loop)：只有当前回到起点并且路径长度大于零，才算是一个合法的“环路候选解”
        if (mode === "loop") {
            if (u === startId && pathLen > 0) {
                if (isValidCandidate && currentWeight > bestWeight) {
                    bestWeight = currentWeight;
                    bestPath = Array.from(currentPath.subarray(0, pathLen));
                    bestStations = Array.from(currentStationsPath.subarray(0, pathLen + 1)).map(id => stationIdToName[id]);
                }
                return;
            }
        } else {
            // 普通路径模式 (path)
            if (endId !== undefined) {
                // 如果指定了终点，必须到达终点且路径长度大于零才算作有效候选解
                if (u === endId && pathLen > 0) {
                    if (isValidCandidate && currentWeight > bestWeight) {
                        bestWeight = currentWeight;
                        bestPath = Array.from(currentPath.subarray(0, pathLen));
                        bestStations = Array.from(currentStationsPath.subarray(0, pathLen + 1)).map(id => stationIdToName[id]);
                    }
                    // 如果不允许重复访问车站，到达终点后不可能再延伸出以该终点结尾的简单路径，可直接回溯
                    if (!allow_station_reuse) {
                        return;
                    }
                }
            } else {
                // 未指定终点：只要路线有效，随时更新当前遍历中权重最大的全局解
                if (isValidCandidate && currentWeight > bestWeight) {
                    bestWeight = currentWeight;
                    bestPath = Array.from(currentPath.subarray(0, pathLen));
                    bestStations = Array.from(currentStationsPath.subarray(0, pathLen + 1)).map(id => stationIdToName[id]);
                }
            }
        }

        // [剪枝 1] O(1) 绝对最大权重上限剪枝
        // 如果“当前路径累积权重” +“全图未使用的剩余边权重总和”都无法超越已知的最佳收益，果断回溯
        if (currentWeight + remainingTotalWeight <= bestWeight) {
            return;
        }

        // [剪枝 2] O(1) 必经站死胡同剪枝
        // 如果某个必经站尚未被访问，但是在当前的子图中其“剩余可用度数 (Degree)”已经归零 (意味着没有任何可用边可以连通它)
        // 那么未来绝对不可能再连通该站，这条分支必定无解，果断回溯
        for (let i = 0; i < waypointIds.length; i++) {
            const wpId = waypointIds[i];
            if (visitedStationsCount[wpId] === 0 && remainingDegree[wpId] === 0) {
                return;
            }
        }

        // [剪枝 3] O(V + E) BFS 连通性剪枝 (每 3 步执行一次，平摊时间复杂度)
        if (pathLen % 3 === 0) {
            const reachableWeight = getReachableRemainingWeight(u);
            // 3a. 可达边权重上限剪枝：如果当前节点能连通的所有剩余边总权重加上当前权重仍小于当前最好权重，则剪枝
            if (currentWeight + reachableWeight <= bestWeight) {
                return;
            }
            
            // 3b. 必经站可达性剪枝：如果存在尚未访问的必经站，且通过 BFS 发现当前节点与该必经站已经不再连通，则剪枝
            for (let i = 0; i < waypointIds.length; i++) {
                const wpId = waypointIds[i];
                if (visitedStationsCount[wpId] === 0 && nodeVisitedToken[wpId] !== currentBfsToken) {
                    return;
                }
            }

            // 3c. 终点可达性剪枝：若设置了终点且当前尚未到达终点，如果终点已无法连通，则剪枝
            if (endId !== undefined && u !== endId && nodeVisitedToken[endId] !== currentBfsToken) {
                return;
            }
        }

        // 9. 使用前向星结构迭代遍历邻居节点
        let e = head[u];
        while (e !== -1) {
            const v = to[e];
            const id = edgeId[e];

            // 过滤已被占用的边
            if (visitedEdges[id] === 1) {
                e = next[e];
                continue;
            }

            // 节点访问限制过滤
            if (!allow_station_reuse) {
                if (v === startId && mode === "loop") {
                    // 如果是环路模式，允许最后回到起点终结路径
                } else if (visitedStationsCount[v] > 0) {
                    // 否则不许重复访问已有车站
                    e = next[e];
                    continue;
                }
            }

            // 计算换乘次数限制
            const lineId = edgeLine[id];
            let newTransferCount = transferCount;
            if (lastLineId !== -1 && lastLineId !== lineId && !isThroughServiceTransition(lastEdgeId, id)) {
                newTransferCount += 1;
            }
            if (max_transfers !== null && newTransferCount > max_transfers) {
                e = next[e];
                continue;
            }

            // 计算并校验最大线路数限制
            if (max_lines !== null) {
                addLineUsage(lineId);
                if (uniqueLinesCount > max_lines) {
                    removeLineUsage(lineId);
                    e = next[e];
                    continue;
                }
            }

            // 10. 前进：记录并修改搜索状态，开始深度递归
            visitedEdges[id] = 1;
            visitedStationsCount[v]++;
            remainingDegree[u]--;
            remainingDegree[v]--;
            remainingTotalWeight -= edgeWeight[id];
            currentPath[pathLen] = id;
            currentStationsPath[pathLen + 1] = v;

            // 特殊逻辑：如果是起点发出的第一级搜索分支，累加进度索引并通知主线程
            if (pathLen === 0) {
                currentFirstLevelIndex++;
                postMessage({
                    type: "progress",
                    step_count: stepCount,
                    percent: Math.min(99, Math.round((currentFirstLevelIndex / totalFirstLevel) * 100))
                });
            }

            dfs(v, pathLen + 1, currentWeight + edgeWeight[id], lineId, id, newTransferCount);

            // 11. 回溯：完全还原现场状态
            remainingTotalWeight += edgeWeight[id];
            remainingDegree[u]++;
            remainingDegree[v]++;
            visitedStationsCount[v]--;
            visitedEdges[id] = 0;
            if (max_lines !== null) {
                removeLineUsage(lineId);
            }

            // 如果超时标记已被点亮，立刻向上层返回，终止所有深层计算
            if (timeoutReached) return;

            e = next[e]; // 走向下一个前向星邻居
        }
    }

    // 启动求解器搜索
    dfs(startId, 0, 0.0, -1, -1, 0);

    // 将最终计算出的最优解传回主线程
    postMessage({
        type: "result",
        path_edges: bestPath,
        path_stations: bestStations,
        weight: bestWeight,
        timeout_reached: timeoutReached
    });
};
