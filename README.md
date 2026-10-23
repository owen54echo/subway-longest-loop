# 地铁路网线路研究

一个基于图论探索城市地铁路网最长路线、最长闭环和路线结构的静态网页工具。

## 功能

- 多城市地铁路网地图与线路颜色切换
- 单向路线、闭环路线和自定义路线规划
- 允许/禁止重复车站、允许/禁止重复逻辑线路、换乘次数和线路数约束
- 按区间数或经纬度直线距离优化
- 路书、路线播放、分享卡和 PDF 打印
- 直达矩阵、中心性排行和城市线网之最
- 车站运营状态、周边资料和来源核对信息

## 本地运行

```bash
python3 -m http.server 8000
```

然后打开 `http://localhost:8000/index.html`。由于求解器使用 Web Worker，不能直接双击 HTML 文件运行。

## 验证

```bash
bash scripts/verify_project.sh
```

验证脚本覆盖数据目录、拓扑归并、路线规则、求解器契约、预计算结果、分享卡和现有回归测试。

## 数据更新

- 城市目录和正式运营线路：`data/cities.json`
- 合并线路与直通规则：`data/topology-rules.json`
- 编译脚本：`compile_subways.py`
- 预计算脚本：`precompute_city_extremes.js`

新增城市或调整线路后，应重新编译、预计算并运行完整验证。详细边界和算法不变量见 [`docs/architecture.md`](docs/architecture.md)。

## 隐私与安全

公开仓库不包含环境变量、密码、访问令牌、数据库密钥或个人隐私信息。分析服务的密钥只应配置在部署平台的 Secret/Environment Variables 中。
