// 离线预计算“城市线网之最”：复用浏览器 Worker 中的同一求解器，产出可直接加载的静态结果。
const fs = require('fs');
const path = require('path');

const projectDir = __dirname;
const dataCode = fs.readFileSync(path.join(projectDir, 'subway_data.js'), 'utf8');
const topologyCode = fs.readFileSync(path.join(projectDir, 'calculation-topology.js'), 'utf8');
const workerCode = fs.readFileSync(path.join(projectDir, 'solver-worker.js'), 'utf8');
const dataWindow = new Function('window', `${dataCode}\nreturn window;`)({});
const cities = dataWindow.subwayDataMap;
const topologyWindow = {};
new Function('window', topologyCode)(topologyWindow);

function runSolver(config) {
    let result = null;
    const context = { postMessage: message => { if (message.type === 'result') result = message; }, onmessage: null };
    new Function(`(function(self) { const postMessage = self.postMessage; let onmessage = null; ${workerCode} self.onmessage = onmessage; })(this);`).call(context);
    context.onmessage({ data: config });
    return result;
}

const baseRules = {
    'path-reuse': { mode: 'path', allowStationReuse: true },
    'loop-reuse': { mode: 'loop', allowStationReuse: true },
    'path-simple': { mode: 'path', allowStationReuse: false },
    'loop-simple': { mode: 'loop', allowStationReuse: false }
};
const metrics = {
    edges: { suffix: '', optimizeMetric: 'edges' },
    distance: { suffix: '-distance', optimizeMetric: 'distance' }
};
const rules = Object.fromEntries(Object.entries(baseRules).flatMap(([ruleKey, rule]) =>
    Object.entries(metrics).map(([, metric]) => [
        `${ruleKey}${metric.suffix}`,
        { ...rule, optimizeMetric: metric.optimizeMetric }
    ])
));
const timeout = 0.25;
const output = {};
const shard = Number(process.argv[2] || 0);
const shardCount = Number(process.argv[3] || 1);
const metricFilter = process.argv[4] || "all";
const cityFilter = process.argv[5] || "";
const nodeShard = Number(process.argv[6] || 0);
const nodeShardCount = Number(process.argv[7] || 1);
const outputShard = Number(process.argv[8] || shard);
const allCityEntries = Object.entries(cities);
const cityEntries = allCityEntries
    .filter(([cityKey]) => !cityFilter || cityKey === cityFilter)
    .filter((_, index) => index % shardCount === shard);
const selectedRules = Object.fromEntries(Object.entries(rules).filter(([, rule]) =>
    metricFilter === "all" || rule.optimizeMetric === metricFilter
));
const totalRuns = cityEntries.reduce((sum, [cityKey, city]) => {
    const topology = topologyWindow.CalculationTopology.create(cityKey, city.nodes, city.edges);
    const scopedCount = topology.nodes.filter((_, index) => index % nodeShardCount === nodeShard).length;
    return sum + scopedCount * Object.keys(selectedRules).length;
}, 0);
let completedRuns = 0;

for (const [cityKey, city] of cityEntries) {
    const topology = topologyWindow.CalculationTopology.create(cityKey, city.nodes, city.edges);
    const scopedNodes = topology.nodes.filter((_, index) => index % nodeShardCount === nodeShard);
    output[cityKey] = {};
    for (const [ruleKey, rule] of Object.entries(selectedRules)) {
        let best = null;
        let timedOutStarts = 0;
        for (const node of scopedNodes) {
            const result = runSolver({
                start_station: node.name,
                end_station: null,
                mode: rule.mode,
                allow_station_reuse: rule.allowStationReuse,
                max_transfers: null,
                max_lines: null,
                waypoints: [],
                optimize_metric: rule.optimizeMetric,
                nodes: topology.nodes,
                edges: topology.edges,
                timeout
            });
            completedRuns++;
            if (result.timeout_reached) timedOutStarts++;
            if (result.weight > -1 && (!best || result.weight > best.weight)) best = result;
            if (completedRuns % 50 === 0) console.log(`Shard ${shard}: ${completedRuns}/${totalRuns}`);
        }
        output[cityKey][ruleKey] = {
            result: best,
            total: topology.nodes.length,
            timedOutStarts,
            searchTimeoutSeconds: timeout
        };
        console.log(`Completed ${city.city} / ${ruleKey}`);
    }
}

fs.writeFileSync(path.join(projectDir, `city_extremes_results_${outputShard}.json`), JSON.stringify(output));
console.log(`Wrote shard ${outputShard}`);
