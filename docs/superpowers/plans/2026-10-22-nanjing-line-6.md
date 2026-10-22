# 南京地铁 6 号线 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将南京地铁 6 号线完整接入地图、计算拓扑和南京预计算结果，并发布到 GitHub main。

**Architecture:** 在现有高德数据编译流程中加入南京 6 号线的可重复兜底补丁；地图保留原始线路名称，计算拓扑通过逻辑线路分组表达 6/S1 贯通运营。预计算沿用浏览器 Worker 的同一求解器，仅替换南京结果。

**Tech Stack:** Python 3 数据编译、原生 JavaScript、Web Worker、Node.js 回归测试、GitHub Pages。

## Global Constraints

- 不修改其他城市线网数据和预计算结果。
- 不增加第三方运行时依赖。
- 不提交密码、Token、环境变量值、个人信息或临时分片。
- 地图仍分别显示 6 号线与 S1 号线，计算时视为一条贯通线路。

---

### Task 1: 锁定南京 6 号线数据契约

**Files:**
- Create: `tests/data-updates/nanjing-line6.test.js`
- Modify: `run_regression_tests.py`

**Interfaces:**
- Consumes: `window.subwayDataMap.nanjing`
- Produces: 263 站、288 区间、20 站有序线路和八组预计算结果的回归契约

- [ ] 写入会因当前缺少 6 号线而失败的数据测试。
- [ ] 运行 `node tests/data-updates/nanjing-line6.test.js`，确认失败原因是缺少线路。
- [ ] 将测试登记到 Python 回归入口。

### Task 2: 增加可重复的数据更新逻辑

**Files:**
- Modify: `compile_subways.py`
- Modify: `subway_data.js`

**Interfaces:**
- Produces: `apply_nanjing_line6(nodes, edges)`，补齐节点、线路归属、相邻区间和估算距离

- [ ] 在 `compile_subways.py` 定义 20 站权威数据、线路色和示意坐标。
- [ ] 实现幂等补齐函数，删除旧 6 号线区间后按顺序重建。
- [ ] 在南京编译完成后调用补齐函数。
- [ ] 对现有 `subway_data.js` 执行同一补齐逻辑，保留百科、周边和运营状态元数据。
- [ ] 运行数据测试，确认通过。

### Task 3: 表达 6/S1 贯通运营

**Files:**
- Modify: `calculation-topology.js`
- Modify: `tests/line-reuse/line-reuse.test.js`

**Interfaces:**
- Produces: 南京逻辑线路 `6号线/S1号线`

- [ ] 先增加 6 号线和 S1 号线应归入同一逻辑线路的失败测试。
- [ ] 在 `LOGICAL_LINE_GROUPS.nanjing` 增加线路别名。
- [ ] 运行线路复用测试，确认通过。

### Task 4: 重算南京城市线网之最

**Files:**
- Modify: `city_extremes_results.js`

**Interfaces:**
- Consumes: 南京最新计算拓扑和 Worker 求解器
- Produces: 南京八组可直接加载的预计算结果

- [ ] 并行运行南京节点分片预计算。
- [ ] 使用 `node merge_city_extremes_results.js <分片数> nanjing` 只替换南京。
- [ ] 运行南京数据测试，确认每条预计算路径的边索引有效。

### Task 5: 验证与发布

**Files:**
- Verify: all changed files

- [ ] 运行完整自动化测试与 Python 语法检查。
- [ ] 启动本地页面，检查南京地图桌面和移动视口。
- [ ] 检查变更范围、空白错误和敏感信息。
- [ ] 对照 GitHub 最新 main 头提交，创建单一发布提交并更新 main。
- [ ] 再次读取 GitHub main，确认新提交已经生效。

