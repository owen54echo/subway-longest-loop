# 代码审计整改与扩展性提升实施规划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变现有产品功能和计算规则的前提下，消除数据更新与预计算失效风险，建立可配置的城市、线路和车站扩展流程，并清理确认失效的历史代码。

**Architecture:** 以 `data/cities.json` 作为城市配置的唯一来源，编译器负责生成经过校验、带稳定标识和拓扑指纹的城市数据；前端按城市加载数据，预计算结果必须与当前拓扑指纹匹配。路线统计和贯通规则收敛到共享纯函数，最后再拆分页面控制器和删除历史实现。

**Tech Stack:** Python 3、原生 JavaScript、Web Worker、HTML/CSS、Node.js 测试脚本、Playwright 浏览器测试（最后阶段引入）。

## Global Constraints

- 基线分支为 `codex/mainland-cities`，规划编写时基线提交为 `ceb8412`。
- 每个任务必须先增加失败测试，再写最小实现；不得用一次性大重构替代分步迁移。
- 保持现有 HTML 结构、业务规则、城市数据、分享、路书和移动端交互不变，除非任务明确要求修复已确认错误。
- 编译失败时不得覆盖上一份可用的 `subway_data.js` 或任何正式生成物。
- 所有公开仓库内容不得包含密码、Token、Cookie、私有链接或个人敏感信息。
- 生成文件必须可重复构建；输入没有变化时，不应产生仅由当前时间导致的差异。
- 每个阶段完成后都必须经过人工浏览器验收，阶段之间禁止混合提交。
- 新增手写 JavaScript 模块原则上不超过500行，单个函数原则上不超过80行、嵌套不超过4层；确需突破时必须在代码审查中解释原因，而不是用无意义拆函数满足数字。
- 新增 Python 公共函数必须有类型标注；JavaScript 公共接口必须有 JSDoc，名称必须使用项目领域词汇，不使用 `data1`、`temp2`、`handleThing` 等含义不明的名称。
- 注释只用于解释业务规则、数据来源、算法不变量、兼容原因和非直观取舍；禁止把代码逐句翻译成注释，也禁止保留已经失效的过程性注释。
- 业务规则只能存在于领域模块中，页面控制器不得复制线路合并、贯通、换乘、距离或车站身份规则。
- 新模块不得直接增加 `window` 全局状态；兼容当前非打包架构时，只允许暴露一个命名空间入口，并在后续任务中由依赖注入替换。
- 求解器的正确性高于性能；任何新剪枝都必须写明为什么不会排除最优解，并通过独立穷举差分测试后才能合并。
- “精确结果”和“当前最佳结果”必须使用结构化状态区分；超时、主动提前结束或预计算时间预算不足时不得标记为全局最优。
- Worker 输入和输出都必须经过独立契约校验；未知起终点、未知必经站、悬空边和冲突约束不得静默降级。

---

## 一、实施边界和发布顺序

### 阶段 A：数据安全与唯一配置源

包含任务 1-6。解决部分抓取覆盖、城市配置重复、运营线路失控、稳定车站标识、一次性补丁和预计算过期问题。完成后即可独立发布。

### 阶段 B：规则统一与按城市加载

包含任务 7-12。先明确算法契约、修复已确认的精确性问题并建立独立差分验证，再统一贯通和路线统计规则，最后按城市拆分加载并拆分页面控制器。

### 阶段 C：历史清理与测试体系

包含任务 13-17。先解决外部数据进入 HTML 的安全渲染和生产调试残留，再建立架构与代码质量守护及浏览器回归保护，最后删除失效代码并完善更新文档。历史代码清理必须放在最后执行。

## 二、目标文件结构

```text
data/
  cities.json                       # 城市注册表唯一来源
  topology-rules.json               # 逻辑线路、支线和贯通配置
  overrides/
    nanjing.json                    # 南京6号线等有来源和有效期的覆盖数据
    station-aliases.json            # 车站改名与兼容名称
  generated/
    city-manifest.js                # 浏览器城市目录，自动生成
    cities/<city-key>.js            # 单城市线网数据，自动生成
    extremes/<city-key>.js          # 单城市预计算结果，自动生成
scripts/
  verify_project.sh                 # 本地与发布前统一验证入口
city-data-loader.js                 # 浏览器按城市加载并缓存
route-rules.js                      # 线路、贯通与换乘共享规则
solver-contract.js                  # 求解输入、结果与最优性状态契约
city-controller.js                  # 城市切换和城市选择器
safe-dom.js                         # 外部数据的安全 DOM 渲染
docs/architecture.md               # 模块职责、依赖方向和扩展接口
docs/algorithm-contract.md          # 精确搜索语义、剪枝证明和近似结果定义
architecture.config.json           # 可自动检查的模块边界
tests/
  data-pipeline/
  city-loader/
  route-rules/
  solver-contract/
  solver-differential/
  security/
  architecture/
  e2e/
```

原有 `subway_data.js` 和 `city_extremes_results.js` 在阶段 B 完成前保留；阶段 B 验收后才删除。

## 三、代码质量和架构原则

### 1. 分层和依赖方向

依赖只允许沿以下方向流动，不允许反向引用或循环依赖：

```text
原始数据/人工覆盖
        ↓
编译与校验工具
        ↓
生成数据/城市清单
        ↓
纯领域规则（route-rules、拓扑、路线指标）
        ↓
加载器与应用服务
        ↓
页面控制器
        ↓
index.html 启动编排
```

- 纯领域规则不得读取 DOM、`localStorage` 或网络。
- 页面控制器不得直接解析生成文件，也不得自行实现图论或换乘规则。
- Worker 和主线程必须依赖相同领域规则，不得各自维护近似实现。
- 生成文件不能被人工编辑；人工修正只能进入 `data/overrides/`。
- 每条剪枝规则必须在 `docs/algorithm-contract.md` 中记录适用前提、上界含义和正确性理由。

### 2. 可读性标准

- 一个文件只承担一个可描述的职责；文件名应能回答“它管理什么”。
- 函数名使用动词和领域对象，例如 `loadCityData`、`countTransfers`、`validateCompiledCity`。
- 复杂条件先命名再组合，避免在 `if` 中堆叠多层布尔表达式。
- 使用提前返回减少嵌套；异常路径必须给出城市、线路或车站上下文。
- 不以缩短行数为目的压缩代码；生成文件除外。
- 每次提取模块后立即删除原实现，禁止长期保留两套“新旧兼容”业务逻辑。

### 3. 注释标准

应保留或新增的注释：

```js
// 2号线和8号线贯通运营，换乘统计按同一 logicalLine 处理。
```

不应出现的注释：

```js
// 把 count 加 1
count += 1;
```

人工线路覆盖必须记录权威来源类型、复核日期、适用范围和退出条件。临时兼容注释必须说明删除条件，不能只写“临时修复”。

### 4. 架构扩展标准

- 新增城市不修改 `index.html`、路线规则或现有城市代码。
- 新增正式线路只更新城市配置、来源数据或覆盖数据，并只重算受影响城市。
- 车站改名通过稳定 ID 和 alias 完成，不批量搜索替换业务代码。
- 新增一种路线指标时，在共享领域模块增加一次实现，路书、自定义路线、Worker 和分享模块通过接口复用。
- 外部服务端点、城市名称、线路运营状态和算法版本不得散落在多个文件中。
- 新增剪枝或启发式排序时，必须先加入独立小图穷举对照；启发式只能改变搜索顺序，不能改变可行解集合。
- 车站名、线路名、介绍和来源数据均视为不可信字符串，进入页面时使用 `textContent` 或统一转义函数。

### 5. 每个任务的代码审查门槛

每个任务提交前都必须回答并通过：

```text
[ ] 文件和函数职责能否用一句话准确描述
[ ] 是否新增了重复规则、重复常量或隐式全局状态
[ ] 名称是否表达业务含义，而不是实现细节
[ ] 注释是否解释原因、约束或来源，而不是复述代码
[ ] 错误信息是否包含可定位的城市/线路/车站上下文
[ ] 新接口是否有类型说明、输入输出和失败行为
[ ] 是否存在可删除的迁移兼容代码，并写明删除时点
[ ] 单元测试是否验证行为，而不是只匹配源码字符串
[ ] 模块依赖是否符合既定方向且没有循环依赖
[ ] 算法改动是否有独立穷举对照、剪枝证明和确定性结果规则
[ ] 外部数据是否未经转义进入 innerHTML、属性或选择器
```

---

### Task 1: 建立统一验证入口和基线报告

**Files:**
- Create: `scripts/verify_project.sh`
- Create: `tests/data-pipeline/repository-baseline.test.js`
- Modify: `工作迁移.md`

**Interfaces:**
- Produces: `bash scripts/verify_project.sh`，作为后续所有任务和发布前的唯一完整验证入口。

- [ ] **Step 1: 写入基线测试，检查17个城市、关键生成文件和禁止提交文件**

```js
const assert = require('assert');
const fs = require('fs');

const data = fs.readFileSync('subway_data.js', 'utf8');
const cityKeys = [...data.matchAll(/^\s{2}"([a-z]+)": \{/gm)].map(match => match[1]);
assert.strictEqual(new Set(cityKeys).size, 17);
assert.ok(!fs.existsSync('.env'));
assert.ok(fs.existsSync('city_extremes_results.js'));
console.log('repository baseline passed');
```

- [ ] **Step 2: 运行测试并记录当前失败点**

Run: `node tests/data-pipeline/repository-baseline.test.js`

Expected: 当前结构解析若不能稳定识别17个城市则 FAIL；不得通过放宽数量断言规避失败。

- [ ] **Step 3: 创建统一验证脚本**

```bash
#!/usr/bin/env bash
set -euo pipefail
find tests -type f \( -name '*.test.js' -o -name '*.test.mjs' \) -print0 | sort -z | xargs -0 -n1 node
node run_regression_tests.js
python3 -m py_compile compile_subways.py precompute_station_surroundings.py sync_station_surroundings.py validate_station_surroundings.py
python3 validate_station_surroundings.py station_surroundings.json subway_data.js
git diff --check
```

- [ ] **Step 4: 在 `工作迁移.md` 记录统一验证命令**

只增加当前命令和预期结果，不写入本机密码、Token 或环境变量值。

- [ ] **Step 5: 运行完整验证并提交**

Run: `bash scripts/verify_project.sh`

Expected: 所有现有测试、8项旧回归测试、Python语法、周边数据和 Git 差异检查全部通过。

Commit: `test: add unified project verification`

---

### Task 2: 建立城市注册表唯一来源

**Files:**
- Create: `data/cities.json`
- Create: `tests/data-pipeline/city-catalog.test.js`
- Modify: `compile_subways.py`
- Modify: `index.html`
- Modify: `tests/data-updates/mainland-cities.test.js`

**Interfaces:**
- Produces: `load_city_catalog(path) -> list[dict]`
- Each city entry: `{key, displayName, tabName, adcode, pinyin, operationalLines, minimumNodes, minimumEdges, enabled}`

- [ ] **Step 1: 增加城市注册表契约测试**

```js
const assert = require('assert');
const cities = require('../../data/cities.json');
assert.strictEqual(cities.length, 17);
assert.strictEqual(new Set(cities.map(city => city.key)).size, cities.length);
for (const city of cities) {
  assert.ok(city.key && city.displayName && city.tabName);
  assert.ok(Array.isArray(city.operationalLines));
  assert.ok(city.operationalLines.length > 0);
  assert.ok(city.minimumNodes > 0 && city.minimumEdges > 0);
}
console.log('city catalog passed');
```

- [ ] **Step 2: 创建 `data/cities.json`**

17个现有城市全部迁入；所有城市都必须明确填写已正式运营线路，不允许省略后默认接受上游全部线路。

```json
[
  {
    "key": "guangzhou",
    "displayName": "广佛（广州+佛山）",
    "tabName": "广佛",
    "adcode": "4401",
    "pinyin": "guangzhou",
    "operationalLines": ["1号线"],
    "minimumNodes": 1,
    "minimumEdges": 1,
    "enabled": true
  }
]
```

实施时必须把广州及其余城市的完整正式运营线路补齐，示例中的最小数量不能直接用于正式值；正式值取当前生成数据数量的安全下限，并由测试锁定。

- [ ] **Step 3: 修改编译器从 JSON 读取城市**

```python
def load_city_catalog(path):
    with open(path, "r", encoding="utf-8") as file:
        cities = json.load(file)
    keys = [city["key"] for city in cities if city.get("enabled", True)]
    if len(keys) != len(set(keys)):
        raise ValueError("Duplicate city key in data/cities.json")
    return [city for city in cities if city.get("enabled", True)]
```

删除 Python 中的 `CITIES` 常量，并将 `operationalLines` 映射给现有 `allowed_lines` 参数。

- [ ] **Step 4: 首页城市按钮改为由注册表生成**

暂时由编译器把城市元数据写入唯一命名空间 `window.SubwayApp.catalog`，`index.html` 只保留空容器：

```html
<div class="city-tab-container" id="city-tab-container" role="tablist" aria-label="选择城市地铁网络"></div>
```

渲染函数必须按 `data/cities.json` 顺序生成按钮，并保持广州默认选中。

- [ ] **Step 5: 运行目录、首页和完整验证**

Run: `node tests/data-pipeline/city-catalog.test.js && node tests/data-updates/mainland-cities.test.js && bash scripts/verify_project.sh`

Expected: 17个城市均由注册表生成；HTML 中不再硬编码17个按钮。

Commit: `refactor: centralize city catalog`

---

### Task 3: 编译器改为全量校验和原子写入

**Files:**
- Create: `tests/data-pipeline/atomic-compile.test.py`
- Modify: `compile_subways.py`

**Interfaces:**
- Produces: `validate_compiled_data(compiled_data, catalog) -> None`
- Produces: `atomic_write_compiled_data(compiled_data, output_js) -> None`
- Produces: CLI flag `--allow-partial`，仅用于本地诊断，默认关闭。

- [ ] **Step 1: 写失败测试，模拟一个城市抓取失败**

测试必须断言：默认模式抛出异常、正式输出文件内容保持不变、临时文件被清理；`--allow-partial` 只能写到显式指定的诊断路径。

- [ ] **Step 2: 实现全量数据校验**

```python
def validate_compiled_data(compiled_data, catalog):
    expected = {city["key"] for city in catalog}
    actual = set(compiled_data)
    if actual != expected:
        raise ValueError(f"City mismatch: missing={expected-actual}, extra={actual-expected}")
    for city in catalog:
        payload = compiled_data[city["key"]]
        if len(payload["nodes"]) < city["minimumNodes"]:
            raise ValueError(f'{city["key"]}: node count below baseline')
        if len(payload["edges"]) < city["minimumEdges"]:
            raise ValueError(f'{city["key"]}: edge count below baseline')
```

在数量校验之外必须逐城检查：节点 ID 和名称唯一性、边端点存在、无非预期自环、无重复区间、坐标为有限值、区间距离为正数、节点线路与边线路一致、逻辑线路配置能够匹配实际线路、主连通分量变化未超过城市基线。任何距离缺失都必须阻止正式构建，禁止在距离优化时静默回退为 `1 km`。

- [ ] **Step 3: 使用同目录临时文件和 `os.replace` 原子替换**

```python
def atomic_write_compiled_data(compiled_data, output_js):
    temporary = output_js + ".tmp"
    try:
        write_compiled_data(compiled_data, temporary)
        os.replace(temporary, output_js)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
```

- [ ] **Step 4: 恢复 HTTPS 默认验证并补充来源错误信息**

删除 `ssl._create_default_https_context = ssl._create_unverified_context`。错误信息必须包含城市 key、来源地址和失败阶段，但不得包含 Cookie 或请求凭据。

- [ ] **Step 5: 验证成功构建与失败保护**

Run: `python3 -m unittest tests/data-pipeline/atomic-compile.test.py && bash scripts/verify_project.sh`

Expected: 模拟失败不会改变正式生成文件；正常编译可通过全部校验。

Commit: `fix: make subway compilation atomic`

---

### Task 4: 引入稳定车站 ID 和改名别名

**Files:**
- Create: `data/overrides/station-aliases.json`
- Create: `tests/data-pipeline/station-identity.test.py`
- Modify: `compile_subways.py`
- Modify: `sync_station_surroundings.py`
- Modify: `validate_station_surroundings.py`
- Modify: `station_surroundings.json`

**Interfaces:**
- Produces: `build_station_id(city_key, station) -> str`
- Node fields: `{id, name, aliases, x, y, lng, lat, lines}`
- Metadata lookup order: `stationId` first，旧名称仅作为一次迁移兼容。

- [ ] **Step 1: 增加稳定性、重名和改名测试**

覆盖三类输入：同一来源站改名后 ID 不变；同城同名不同坐标产生不同 ID；旧周边信息通过 alias 迁移到新 ID。

- [ ] **Step 2: 实现稳定 ID**

```python
import hashlib

def build_station_id(city_key, station):
    source_id = station.get("sid") or station.get("id")
    if source_id:
        return f"{city_key}:{source_id}"
    lng, lat = parse_station_lng_lat(station)
    identity = f"{city_key}|{lng:.6f}|{lat:.6f}"
    digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:16]
    return f"{city_key}:{digest}"
```

坐标缺失时编译必须失败，不允许退回名称生成 ID。

- [ ] **Step 3: 第一阶段保持现有名称键不变，同时给每个节点增加 `id`**

这样不立即破坏前端。编译器必须验证同城 ID 唯一、同名站是否需要明确合并；未经配置的同名冲突直接失败。

- [ ] **Step 4: 周边信息改为优先使用 `stationId`**

为现有记录一次性补齐 `stationId`。同步脚本先按 ID，找不到时才读取 `station-aliases.json`，不得继续默认按名称静默合并。

- [ ] **Step 5: 验证全部城市无重复 ID 和无孤立元数据**

Run: `python3 -m unittest tests/data-pipeline/station-identity.test.py && python3 validate_station_surroundings.py station_surroundings.json subway_data.js && bash scripts/verify_project.sh`

Commit: `refactor: add stable station identities`

---

### Task 5: 把临时线路补丁迁移为可审计覆盖数据

**Files:**
- Create: `data/overrides/nanjing.json`
- Create: `tests/data-pipeline/city-overrides.test.py`
- Modify: `compile_subways.py`
- Delete after verification: hardcoded `NANJING_LINE_6_STATIONS` and `NANJING_LINE_6_COLOR`

**Interfaces:**
- Produces: `apply_city_overrides(city_key, nodes, edges, override) -> tuple[nodes, edges]`
- Override fields: `{source, reviewedAt, expiresWhenSourceContains, stationAliases, replaceLines}`

- [ ] **Step 1: 使用当前南京6号线数据创建等价 fixture 测试**

测试必须比较覆盖前后站序、颜色、坐标和区间距离，不只比较站点数量。

- [ ] **Step 2: 将南京6号线迁移到 JSON**

```json
{
  "source": "verified operational source",
  "reviewedAt": "2026-10-22",
  "expiresWhenSourceContains": {"line": "6号线", "minimumStations": 20},
  "stationAliases": {"红山新城·玄武花园城": "红山新城"},
  "replaceLines": [{"name": "6号线", "color": "#00AD8E", "stations": []}]
}
```

正式文件中的 `stations` 必须完整迁移现有20站数据。

- [ ] **Step 3: 实现通用覆盖加载器和到期提示**

当上游已满足 `expiresWhenSourceContains` 时，编译应失败并提示人工比较，而不是继续静默覆盖或自动删除覆盖。

- [ ] **Step 4: 删除 Python 中南京专用常量和专用分支**

只有等价测试通过后才能删除；不得同时改动南京以外城市数据。

- [ ] **Step 5: 验证南京数据前后等价**

Run: `python3 -m unittest tests/data-pipeline/city-overrides.test.py && bash scripts/verify_project.sh`

Commit: `refactor: move city patches to audited overrides`

---

### Task 6: 为城市数据和预计算结果增加拓扑指纹

**Files:**
- Create: `tests/data-pipeline/topology-fingerprint.test.js`
- Modify: `compile_subways.py`
- Modify: `precompute_city_extremes.js`
- Modify: `merge_city_extremes_results.js`
- Modify: `index.html`
- Regenerate: `subway_data.js`
- Regenerate: `city_extremes_results.js`

**Interfaces:**
- City metadata: `meta.topologyHash`
- Precompute metadata: `{topologyHash, solverVersion, rulesVersion, optimality, timeBudgetMs, timedOutStarts}`
- Runtime: `isPrecomputedResultCompatible(city, result) -> boolean`

- [ ] **Step 1: 写测试证明“增加一条边后旧缓存必须失效”**

测试包含两个场景：路径仍连通但哈希不同必须拒绝；数据和三个版本字段完全一致才能接受。

- [ ] **Step 2: 编译器生成稳定拓扑哈希**

```python
def topology_hash(nodes, edges):
    canonical = {
        "nodes": sorted((node["id"], node["name"]) for node in nodes.values()),
        "edges": sorted((edge["u"], edge["v"], edge["line"], edge.get("logicalLine", "")) for edge in edges),
    }
    payload = json.dumps(canonical, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
```

- [ ] **Step 3: 预计算脚本复制拓扑哈希和版本信息**

版本使用显式常量，例如 `SOLVER_VERSION = 2`、`RULES_VERSION = 1`，算法或规则改变时必须主动递增。

每个预计算结果必须明确写入 `optimality: "exact" | "current_best"`。只要任一起点超时，城市汇总不得标记为 `exact`；页面继续沿用当前最佳标识，不得用“已完成扫描”暗示全局最优。

- [ ] **Step 4: 前端删除“只要旧路径仍连通就兼容”的判断**

```js
function isPrecomputedResultCompatible(city, result) {
  return Boolean(result
    && result.topologyHash === city.meta.topologyHash
    && result.solverVersion === SOLVER_VERSION
    && result.rulesVersion === RULES_VERSION);
}
```

- [ ] **Step 5: 重新生成所有城市结果并验证**

Run: `node tests/data-pipeline/topology-fingerprint.test.js && node precompute_city_extremes.js && bash scripts/verify_project.sh`

Expected: 17个城市全部有匹配的拓扑哈希；手动修改一个哈希后页面拒绝该城市预计算结果。

Commit: `fix: invalidate stale route precomputations`

---

### Task 7: 明确求解器契约并拒绝非法请求

**Files:**
- Create: `docs/algorithm-contract.md`
- Create: `solver-contract.js`
- Create: `tests/solver-contract/solver-contract.test.js`
- Modify: `solver-worker.js`
- Modify: `index.html`
- Modify: `precompute_city_extremes.js`

**Interfaces:**
- Produces: `SolverContract.validateRequest(config) -> {ok, errors}`
- Produces: `SolverContract.verifyResult(config, result) -> {ok, errors, metrics}`
- Produces: `SolverContract.compareResults(left, right, metric) -> number`
- Result field: `optimality: "exact" | "current_best"`

- [ ] **Step 1: 固化算法语义**

`docs/algorithm-contract.md` 必须明确：图为无向图；区间边始终不可重复；`allow_station_reuse` 只控制车站是否可重复；闭环可在允许重复车站时多次经过起点；逻辑线路用于换乘和线路复用约束；距离优化使用正数区间距离；精确与当前最佳结果的判定条件。

- [ ] **Step 2: 写非法输入失败测试**

覆盖未知起点、未知终点、未知必经站、重复节点 ID、边端点不存在、非正距离、起终点被避让、必经站被避让以及 `mode`/`metric` 非法值。特别锁定当前错误行为：不存在的终点不得被当成“未指定终点”。

```js
const validation = SolverContract.validateRequest({
  start_station: 'A',
  end_station: '不存在',
  nodes: [{name: 'A'}],
  edges: [],
  mode: 'path',
  optimize_metric: 'edges'
});
assert.strictEqual(validation.ok, false);
assert(validation.errors.some(error => error.code === 'UNKNOWN_END_STATION'));
```

- [ ] **Step 3: 实现纯函数请求校验**

错误对象统一为 `{code, message, context}`；`context` 只包含城市、线路、车站等公开定位信息。Worker 接到非法请求时返回 `type: "error"`，不得启动搜索或静默过滤必经站。

- [ ] **Step 4: 实现独立结果校验器**

结果校验必须重新检查：边编号有效、路径连续、起终点正确、闭环闭合、边不重复、车站复用规则、线路复用规则、最大线路数、最大换乘数、必经站、距离和权重。校验器不能调用求解器 DFS，也不能信任 Worker 返回的统计值。

- [ ] **Step 5: 主线程在启动前和展示前执行契约校验**

非法设置在页面上给出明确原因；任一 Worker 返回非法结果时终止本次会话并记录错误，不得把结果交给路书、分享或巡航模式。

- [ ] **Step 6: 完整验证**

Run: `node tests/solver-contract/solver-contract.test.js && bash scripts/verify_project.sh`

Commit: `fix: validate solver requests and results`

---

### Task 8: 修复闭环精确性、数值稳定性和确定性

**Files:**
- Create: `tests/solver-worker/repeated-station-loop.test.js`
- Create: `tests/solver-worker/deterministic-result.test.js`
- Create: `tests/solver-worker/distance-precision.test.js`
- Modify: `solver-worker.js`
- Modify: `index.html`
- Modify: `docs/algorithm-contract.md`

**Interfaces:**
- Uses: `SolverContract.compareResults(left, right, metric)`
- Result ordering: 优化指标优先，完全相同时按稳定路线签名排序。

- [ ] **Step 1: 为已确认的闭环错误增加回归测试**

使用两个三角形共享起点 A 的“8字图”。允许重复车站时精确答案必须使用6条边；禁止重复车站时答案为3条边。

```text
A-B-C-A-D-E-A
```

当前实现会在第一次回到 A 时停止并错误返回3条边，因此测试在修复前必须失败。

- [ ] **Step 2: 修复允许重复车站时的闭环终止条件**

回到起点时先把当前闭合路线作为候选；只有 `allow_station_reuse === false` 时立即回溯。允许重复车站时继续探索未使用边，直到没有合法扩展，再由回溯结束。

- [ ] **Step 3: 消除距离权重的 Float32 上界误差**

距离模式改用 `Float64Array`，`totalNetworkWeight` 必须累加写入数组后的同一个值。边数模式保持整数。上界比较使用统一 `WEIGHT_EPSILON`，并在算法契约中解释其用途。

- [ ] **Step 4: 统一并列结果排序**

Worker 内候选、并行 Worker 汇总、当前最佳候选和预计算合并全部调用同一比较函数。不得依赖邻接边输入顺序或 Worker 完成先后决定并列路线。

- [ ] **Step 5: 修复并行进度语义**

每个 Worker 的一级分支总数只统计自己的 `root_edge_ids`。若无法给出严格的全状态百分比，界面文案改为“根分支完成度”，不能把启发式进度显示为完整搜索百分比。

- [ ] **Step 6: 校准求解器注释**

删除或修正“全程零内存分配”“桥树严格未来权重上界”等与当前实现不一致的注释；每个剪枝注释必须说明安全前提，启发式排序注释必须明确其不影响正确性。

- [ ] **Step 7: 完整验证**

Run: `node tests/solver-worker/repeated-station-loop.test.js && node tests/solver-worker/deterministic-result.test.js && node tests/solver-worker/distance-precision.test.js && bash scripts/verify_project.sh`

Commit: `fix: preserve exact repeated-station loops`

---

### Task 9: 建立独立穷举差分与算法性能基线

**Files:**
- Create: `tests/solver-differential/reference-solver.js`
- Create: `tests/solver-differential/random-graphs.test.js`
- Create: `tests/solver-differential/metamorphic.test.js`
- Create: `scripts/benchmark_solver.js`
- Create: `tests/fixtures/solver-benchmarks.json`
- Modify: `scripts/verify_project.sh`
- Modify: `docs/algorithm-contract.md`

**Interfaces:**
- Produces: `referenceSolve(config) -> Result`，仅用于小图测试，不复用正式求解器的剪枝代码。
- Produces: `node scripts/benchmark_solver.js --verify-states`

- [ ] **Step 1: 编写独立小图穷举器**

参考求解器使用直接回溯，不使用桥、双连通、走廊推进、可达权重或正式求解器的任何剪枝，只复用已经独立定义的请求和结果契约。

- [ ] **Step 2: 使用固定随机种子生成小图**

每轮生成4至8个节点、3至12条边，覆盖 path/loop、指定和不指定终点、允许和禁止重复车站、允许和禁止重复线路、换乘限制、线路数限制、必经站、边数和距离指标。至少执行200个可复现案例。

- [ ] **Step 3: 增加变形测试**

验证以下不变量：节点重命名不改变最优权重；边输入顺序不改变最终路线签名规则；增加不可达分量不改变答案；全部距离按正数比例缩放时路线不变且权重同比缩放。

- [ ] **Step 4: 为每种剪枝建立反例 fixture**

桥过滤、起点双连通分量、走廊推进、可达性上界和必经站死胡同各自至少有一个“应剪”和一个“不得剪”的图。以后修改剪枝时先扩充 fixture。

- [ ] **Step 5: 建立与机器速度无关的性能基线**

基线记录 `explored_states`、候选更新次数和各剪枝命中数，不用绝对毫秒作为 CI 失败条件。状态数增加超过基线25%时报告回归并要求解释；真实运行时长只作为观察指标。

- [ ] **Step 6: 加入统一验证**

Run: `node tests/solver-differential/random-graphs.test.js && node tests/solver-differential/metamorphic.test.js && node scripts/benchmark_solver.js --verify-states && bash scripts/verify_project.sh`

Expected: 正式求解器在所有未超时小图中与独立穷举器权重、可行性和最优性一致。

Commit: `test: prove solver against independent exhaustive search`

---

### Task 10: 统一线路、贯通和路线统计规则

**Files:**
- Create: `route-rules.js`
- Create: `data/topology-rules.json`
- Create: `tests/route-rules/route-rules.test.js`
- Create: `tests/route-rules/topology-rules-data.test.js`
- Modify: `calculation-topology.js`
- Modify: `custom-route.js`
- Modify: `solver-worker.js`
- Modify: `index.html`
- Modify: `tests/custom-route/custom-route.test.js`

**Interfaces:**
- Produces: `RouteRules.logicalLine(edge) -> string`
- Produces: `RouteRules.isThroughServiceTransition(previousEdge, nextEdge) -> boolean`
- Produces: `RouteRules.countTransfers(edges) -> number`
- Produces: `RouteRules.sumDistance(edges) -> number`
- Produces: `CalculationTopology.create(cityKey, nodes, edges, topologyRules)`，线路分组数据不再硬编码在 JavaScript 中。

- [ ] **Step 1: 写统一规则测试**

至少覆盖深圳2/8号线、北京1号线/八通线、广州3号线及支线、郑州南四环贯通、普通换乘和空路线。

```js
assert.strictEqual(RouteRules.countTransfers([
  {line: '2号线', logicalLine: '2号线/8号线'},
  {line: '8号线', logicalLine: '2号线/8号线'}
]), 0);
```

- [ ] **Step 2: 把城市线路分组迁移为声明式数据**

将 `LOGICAL_LINE_GROUPS` 和 `THROUGH_SERVICE_GROUPS` 迁入 `data/topology-rules.json`。校验器必须保证同一原始线路不会属于两个逻辑线路组、配置中的线路真实存在、贯通站点真实存在且每组至少包含两个站点。

- [ ] **Step 3: 创建兼容浏览器、Worker 和 Node 的共享模块**

使用 UMD 导出；页面通过 `<script>` 加载，Worker 使用 `importScripts('route-rules.js')`，Node 使用 `require`。不得复制第四份实现。

- [ ] **Step 4: 自定义路线改用共享统计函数**

删除 `custom-route.js` 内重复贯通和换乘判断，保留现有返回结构。

- [ ] **Step 5: 路书、预计算兼容检查和求解器改用同一规则**

每迁移一个调用点就运行对应测试；旧函数仅在调用全部清零后删除。

- [ ] **Step 6: 运行完整回归并人工对比两个已知案例**

Run: `node tests/route-rules/topology-rules-data.test.js && node tests/route-rules/route-rules.test.js && node tests/custom-route/custom-route.test.js && bash scripts/verify_project.sh`

Manual: 深圳2号线转8号线显示0次换乘；郑州贯通服务保持原行为。

Commit: `fix: centralize route and transfer rules`

---

### Task 11: 按城市拆分和懒加载线网数据

**Files:**
- Create: `city-data-loader.js`
- Create: `tests/city-loader/city-data-loader.test.js`
- Create generated: `data/generated/city-manifest.js`
- Create generated: `data/generated/cities/*.js`
- Create generated: `data/generated/extremes/*.js`
- Modify: `compile_subways.py`
- Modify: `precompute_city_extremes.js`
- Modify: `index.html`
- Delete after acceptance: `subway_data.js`
- Delete after acceptance: `city_extremes_results.js`

**Interfaces:**
- Produces: `CityDataLoader.load(cityKey) -> Promise<CityData>`
- Produces: `CityDataLoader.loadExtremes(cityKey) -> Promise<CityExtremes | null>`
- Produces: `CityDataLoader.clearCache() -> void`

- [ ] **Step 1: 写加载、缓存、失败重试和并发去重测试**

同一城市并发请求只能插入一个 `<script>`；加载失败必须移除失败 Promise，下一次可以重试；未知城市返回明确错误。

- [ ] **Step 2: 编译器每个城市写一个生成文件和清单**

清单包含 `{key, displayName, dataUrl, extremesUrl, topologyHash}`。写入方式继续使用临时文件和原子替换。

- [ ] **Step 3: 实现城市加载器**

```js
const pending = new Map();
async function load(cityKey) {
  if (window.SubwayApp.cityData?.[cityKey]) return window.SubwayApp.cityData[cityKey];
  if (pending.has(cityKey)) return pending.get(cityKey);
  const promise = loadScript(manifest[cityKey].dataUrl)
    .then(() => window.SubwayApp.cityData[cityKey])
    .finally(() => pending.delete(cityKey));
  pending.set(cityKey, promise);
  return promise;
}
```

- [ ] **Step 4: 首页启动过程改为先加载默认广州，再初始化地图**

城市切换过程中显示现有加载状态；失败时保留旧城市地图并显示可重试错误，不得出现空白地图。

- [ ] **Step 5: 验证加载体积和双端城市切换**

Run: `node tests/city-loader/city-data-loader.test.js && bash scripts/verify_project.sh`

Manual: 桌面和390px移动端依次切换广州、北京、厦门、长沙；浏览器 Network 中未选择城市的数据不得提前下载。

- [ ] **Step 6: 删除旧聚合文件引用**

仅当17个城市、探索页和分享流程都通过后删除两个旧聚合生成物。

Commit: `perf: load subway data by city`

---

### Task 12: 分步拆分首页控制器

**Files:**
- Create: `city-controller.js`
- Create: `roadbook-controller.js`
- Create: `explore-controller.js`
- Create: `tests/controllers/city-controller.test.js`
- Modify: `index.html`

**Interfaces:**
- `CityController.init({catalog, loader, onCityChanged})`
- `RoadbookController.open(route, cityData)`
- `ExploreController.init({catalog, loader})`

- [ ] **Step 1: 先测试并提取城市选择器逻辑**

保证键盘选择、ARIA状态、默认城市、加载失败恢复和切换后地图回调行为不变。

- [ ] **Step 2: 迁移路书渲染和移动端浮层控制**

只移动函数，不同时改 DOM 和样式；模块通过参数接收元素和数据，不得重新全局查找所有 DOM。

- [ ] **Step 3: 迁移探索页城市选择、直达矩阵和中心性入口**

共享城市目录和加载器，不允许模块重新维护城市名称映射。

- [ ] **Step 4: 删除 `index.html` 中已迁移函数**

每次删除前用 `rg` 确认只剩模块实现和测试引用。

- [ ] **Step 5: 运行完整验证和页面烟雾测试**

Run: `node tests/controllers/city-controller.test.js && bash scripts/verify_project.sh`

Expected: `index.html` 只保留页面结构和应用启动编排，业务模块通过明确接口协作。

Commit: `refactor: split page controllers by responsibility`

---

### Task 13: 安全渲染外部数据并清理生产调试残留

**Files:**
- Create: `safe-dom.js`
- Create: `tests/security/dynamic-content.test.js`
- Create: `tests/security/production-logging.test.js`
- Modify: `index.html`
- Modify: `share-export.js`
- Modify: `analytics-dashboard.js`

**Interfaces:**
- Produces: `SafeDom.setText(element, value) -> void`
- Produces: `SafeDom.createTextElement(tagName, className, value) -> HTMLElement`
- Produces: `SafeDom.escapeAttribute(value) -> string`，只用于确实需要模板属性的场景。

- [ ] **Step 1: 写恶意站名和线路名测试**

fixture 使用 `<img src=x onerror=alert(1)>`、引号、反引号、`&` 和超长文本，验证路书、筛选 chip、直达矩阵、探索结果和分享预览均只显示文字，不创建可执行节点或破坏属性。

- [ ] **Step 2: 优先把动态内容改为 DOM API**

车站名、线路名、介绍、城市名和来源文字使用 `textContent`。只有完全静态模板可以继续使用 `innerHTML`；动态表格应使用 `DocumentFragment`，避免拼接来自数据源的字符串。

- [ ] **Step 3: 统一 SVG、属性和选择器编码**

站点 DOM ID 使用稳定 `stationId`，不再把站名直接拼进 ID。需要构造 CSS 选择器时使用 `CSS.escape`；SVG 文本节点使用 `textContent`，属性值经过明确校验。

- [ ] **Step 4: 移除或门控生产调试日志**

删除每次计算输出完整 `solverConfig`、全路径和大对象的日志。保留的诊断日志只能在显式 `debug` 模式启用，默认生产环境不得产生大量控制台输出。

- [ ] **Step 5: 完整验证**

Run: `node tests/security/dynamic-content.test.js && node tests/security/production-logging.test.js && bash scripts/verify_project.sh`

Expected: 所有外部字符串只作为文字显示；正式页面默认不输出完整线网、规则配置或求解路径对象。

Commit: `fix: render network data safely`

---

### Task 14: 建立架构说明和自动化边界守护

**Files:**
- Create: `docs/architecture.md`
- Create: `architecture.config.json`
- Create: `scripts/check_architecture.js`
- Create: `tests/architecture/module-boundaries.test.js`
- Modify: `scripts/verify_project.sh`

**Interfaces:**
- Produces: `node scripts/check_architecture.js`
- Produces: 架构决策记录 ADR-001 至 ADR-006，后续架构改变必须新增 ADR，不覆盖历史原因。

- [ ] **Step 1: 编写架构文档，明确模块职责和公开接口**

`docs/architecture.md` 至少包含：系统上下文、数据构建流程、运行时模块图、Worker 边界、生成文件规则、错误处理、扩展城市流程和部署边界。

必须记录以下决策：

```text
ADR-001: data/cities.json 是城市配置唯一来源
ADR-002: stationId 是车站身份，名称和 alias 只用于展示及迁移
ADR-003: route-rules.js 是逻辑线路、贯通、换乘和距离规则唯一实现
ADR-004: 城市数据按需加载，index.html 只负责应用启动编排
ADR-005: solver-contract.js 独立校验求解输入和输出，正式求解器不能自证正确
ADR-006: 站名、线路名和介绍均按外部不可信数据安全渲染
```

- [ ] **Step 2: 创建可机器读取的模块边界配置**

```json
{
  "generated": ["data/generated/"],
  "domainModules": ["route-rules.js", "calculation-topology.js"],
  "controllers": ["city-controller.js", "roadbook-controller.js", "explore-controller.js"],
  "forbiddenDomainTokens": ["document.", "localStorage", "innerHTML", "fetch("],
  "singleOwnerSymbols": ["isThroughServiceTransition", "countTransfers", "sumDistance"],
  "maximumHandwrittenModuleLines": 500
}
```

- [ ] **Step 3: 实现轻量架构检查脚本**

```js
function assertDomainPurity(file, source, forbiddenTokens) {
  for (const token of forbiddenTokens) {
    if (source.includes(token)) {
      throw new Error(`${file}: domain module must not depend on ${token}`);
    }
  }
}

function assertSingleOwner(symbol, sources, expectedOwner) {
  const owners = [...sources.entries()]
    .filter(([, source]) => source.includes(`function ${symbol}`) || source.includes(`${symbol}:`))
    .map(([file]) => file);
  if (owners.length !== 1 || owners[0] !== expectedOwner) {
    throw new Error(`${symbol}: expected owner ${expectedOwner}, actual ${owners.join(', ')}`);
  }
}
```

脚本只检查可客观判断的边界，不用行数或字符串检查替代人工代码审查。生成文件、测试 fixture 和第三方文件不受手写模块行数限制。

- [ ] **Step 4: 为边界检查增加正反 fixture**

测试必须证明领域模块引用 DOM 时失败、相同规则有两个 owner 时失败、生成文件不会被误判、合法依赖能够通过。

- [ ] **Step 5: 把架构检查加入统一验证**

Run: `node tests/architecture/module-boundaries.test.js && node scripts/check_architecture.js && bash scripts/verify_project.sh`

Expected: 架构边界、现有行为和数据校验全部通过；失败信息可以定位到文件和规则名称。

Commit: `docs: define and enforce architecture boundaries`

---

### Task 15: 建立真实浏览器回归测试

**Files:**
- Create: `package.json`
- Create: `playwright.config.js`
- Create: `tests/e2e/core-flows.spec.js`
- Create: `tests/e2e/mobile-flows.spec.js`
- Modify: `scripts/verify_project.sh`

**Interfaces:**
- Produces: `npm run test:e2e`
- Produces: `npm run verify`

- [ ] **Step 1: 添加最小 Playwright 开发依赖和命令**

```json
{
  "private": true,
  "scripts": {
    "test:e2e": "playwright test",
    "verify": "bash scripts/verify_project.sh && playwright test"
  },
  "devDependencies": {"@playwright/test": "1.55.0"}
}
```

实际实施时先确认 Node 版本支持该固定版本；不允许使用不锁版本的 `latest`。

- [ ] **Step 2: 覆盖桌面核心流程**

测试城市切换、起终点输入选中、实时计算取消、当前最佳路线、路书、分享三个档位和探索页。

- [ ] **Step 3: 覆盖390x844移动端流程**

测试底部工具栏不被遮挡、自定义选站、地图拖动、三分钟提示按钮、路书浮层拖动和最底部操作按钮可点击。

- [ ] **Step 4: 保留现有源码契约测试，但标注用途**

现有字符串测试仍作为结构保护；浏览器测试才是交互验收依据，二者不得互相替代。

- [ ] **Step 5: 执行全量验证**

Run: `npm install && npx playwright install chromium && npm run verify`

Expected: Node/Python/数据校验和桌面、移动端浏览器测试全部通过。

Commit: `test: add browser coverage for core flows`

---

### Task 16: 清理确认失效和重复的历史代码

**Files:**
- Delete: `analytics-config.js`
- Delete: `functions/analytics-api/[[path]].js`
- Delete or move to `archive/legacy-solver/`: `longest_path_solver.py`
- Delete or replace: `run_regression_tests.py`
- Modify: `tests/analytics/pages-function.test.js`
- Modify: `tests/analytics/release-safety.test.js`
- Modify: `README.md`
- Modify: `工作迁移.md`

**Interfaces:**
- Current production analytics remains GitHub Pages frontend plus Cloudflare Worker endpoint.
- Current production solver remains `solver-worker.js`.

- [ ] **Step 1: 用 `rg` 生成删除候选引用清单**

Run: `rg -n "analytics-config|functions/analytics-api|longest_path_solver|run_regression_tests" . --glob '!docs/**' --glob '!.git/**'`

Expected: 每个引用都有保留、迁移或删除决定；不能因为文件名称像历史代码就直接删除。

- [ ] **Step 2: 删除与 `site-runtime.js` 完全重复且运行时未加载的配置**

更新测试，让它验证正式入口只读取 `site-runtime.js`。

- [ ] **Step 3: 删除当前部署架构无法执行的 Pages Function**

README 明确统计架构为 GitHub Pages + Cloudflare Worker，避免未来继续配置错误入口。

- [ ] **Step 4: 处理旧 Python 求解器**

若历史对比仍有价值，移动到 `archive/legacy-solver/` 并写明“非正式运行时、依赖已缺失”；否则删除，并把仍有效的图论回归案例迁入 `tests/solver-worker/`。

- [ ] **Step 5: 删除兼容别名和时间戳噪声**

确认浏览器和测试不再使用后，删除 `window.subwayData` 广州别名。生成文件元数据使用输入版本或来源复核日期，不使用每次构建的当前时间。

- [ ] **Step 6: 运行完整验证**

Run: `npm run verify && rg -n "window\.subwayData(?!Map)" . --glob '*.js' --glob '*.html'`

Expected: 完整验证通过；兼容别名无运行时引用。

Commit: `chore: remove obsolete runtime paths`

---

### Task 17: 最终扩展流程、数据差异报告和发布验收

**Files:**
- Create: `scripts/report_data_changes.py`
- Create: `docs/城市与线路更新指南.md`
- Modify: `README.md`
- Modify: `工作迁移.md`

**Interfaces:**
- Produces: `python3 scripts/report_data_changes.py before.js after.js`
- Report fields per city: added/removed/renamed stations, added/removed lines, added/removed edges, coordinate changes, topology hash changes.

- [ ] **Step 1: 为差异报告写 fixture 测试**

输入包含新增站、改名站、删线和坐标变化；输出必须区分“改名”与“删除后新增”。

- [ ] **Step 2: 实现结构化差异报告**

使用稳定 `stationId` 判断改名，不能用名称猜测；输出 Markdown 和 JSON 两种格式供人工审核和自动检查。

- [ ] **Step 3: 编写新增城市流程**

固定流程为：更新 `data/cities.json` → 添加必要 override → 编译单城市 → 审查差异 → 生成该城市预计算 → 运行完整验证 → 双端人工验收。

- [ ] **Step 4: 编写线路和车站更新流程**

说明正式运营状态确认、stationId/alias、暂停站通过服务、线路合并、拓扑哈希、预计算失效和周边信息同步检查。

- [ ] **Step 5: 最终发布验收**

Run: `npm run verify && git diff --check && git status --short`

Manual checklist:

```text
[ ] 17个现有城市均可打开
[ ] 新旧城市切换后地图和探索数据一致
[ ] 自定义路线、实时计算、路书、分享均可使用
[ ] 移动端底部操作区无遮挡
[ ] 预计算哈希与当前城市数据一致
[ ] 仓库及 Git 差异中无密钥和个人敏感信息
```

Commit: `docs: document repeatable network updates`

---

## 四、阶段验收和回滚策略

### 阶段 A 验收

- 17个城市必须与整改前节点、边和线路数量逐城对比。
- 任一城市抓取失败，正式生成文件的 SHA-256 不得变化。
- 手动增加一条测试边后，旧预计算必须被拒绝。
- 南京6号线迁移前后数据完全等价。

回滚单位：任务 1-6 每项独立提交；禁止 squash 后首次上线，以便精确回退。

### 阶段 B 验收

- “8字图”允许重复车站闭环返回6条边，禁止重复车站返回3条边。
- 非法终点、必经站或悬空边被明确拒绝，不会退化成另一种搜索。
- 固定种子随机小图的正式求解结果与独立穷举结果一致。
- 相同输入重复运行及不同 Worker 完成顺序得到相同的并列结果。
- 深圳2/8号线等逻辑合并线路不产生错误换乘。
- 选择一个城市时，不下载其他16个城市的数据。
- 城市加载失败时保留旧地图并可重试。
- 桌面端和移动端核心功能无行为变化。

回滚单位：先恢复旧聚合数据 script，再回滚懒加载提交；共享路线规则提交可独立保留。

### 阶段 C 验收

- 恶意或异常站名、线路名只能显示为文本，不能生成可执行 HTML。
- 生产环境不输出完整线网、求解配置或路径大对象。
- 架构检查能够阻止领域模块读取 DOM 和同一业务规则出现多个 owner。
- 删除候选文件前后完整测试结果一致。
- README、工作迁移和实际部署架构一致。
- 浏览器测试覆盖此前出现过的终点无法选中、移动端按钮失效和底部遮挡问题。

回滚单位：历史清理、页面拆分和测试工具分别提交。

## 五、明确不在本轮整改范围内的事项

- 不改变最长路径的数学定义和精确性要求。
- 不重新设计地图、路书、分享卡或按钮视觉。
- 不新增城市和新业务模块。
- 不把项目迁移到 React、Vue 或其他框架。
- 不更换当前 GitHub Pages + Cloudflare Worker 的部署组合。

## 六、完成标准

整改完成后，应达到以下目标：

1. 新增城市只需增加一份城市配置和必要覆盖数据，无需手工编辑首页按钮。
2. 新增或删除线路、车站后，编译器自动生成差异报告，并使旧预计算失效。
3. 同名站、车站改名和周边信息通过稳定 ID 管理，不再依赖名称碰巧一致。
4. 路书、自定义路线和求解器使用同一套逻辑线路、贯通和换乘规则。
5. 用户只下载当前选择城市的数据。
6. 旧 Python 求解器、重复统计配置和无效部署适配器不再混淆正式架构。
7. 一条统一命令可以完成单元、数据、语法和浏览器端核心流程验证。
8. 领域规则、加载器、控制器和页面编排之间具有单向依赖，不再依赖开发者记忆维持边界。
9. 公共接口有类型和失败行为说明，复杂业务规则的注释能够追溯原因、来源和退出条件。
10. 新增代码通过命名、函数规模、嵌套深度、重复逻辑和模块职责审查后才能合并。
11. 所有精确搜索优化均有独立穷举差分测试；剪枝失败时不能发布。
12. 非法求解条件被明确拒绝，Worker 输出在进入路书前经过独立可行性校验。
13. 相同数据和规则产生确定性结果，距离权重不存在 Float32 上界误剪风险。
14. 站名、线路名和外部介绍不通过未转义的 `innerHTML` 进入页面。
