// 离线预计算“城市线网之最”：复用浏览器 Worker 中的同一求解器，产出可直接加载的静态结果。
const fs = require('fs');
const path = require('path');

const projectDir = __dirname;
const dataCode = fs.readFileSync(path.join(projectDir, 'subway_data.js'), 'utf8');
const workerCode = fs.readFileSync(path.join(projectDir, 'solver-worker.js'), 'utf8');
const dataWindow = new Function('window', `${dataCode}\nreturn window;`)({});
const cities = dataWindow.subwayDataMap;

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
const allCityEntries = Object.entries(cities);
const cityEntries = allCityEntries
    .filter(([cityKey]) => !cityFilter || cityKey === cityFilter)
    .filter((_, index) => index % shardCount === shard);
const selectedRules = Object.fromEntries(Object.entries(rules).filter(([, rule]) =>
    metricFilter === "all" || rule.optimizeMetric === metricFilter
));
const totalRuns = cityEntries.reduce((sum, [, city]) => sum + city.nodes.length * Object.keys(selectedRules).length, 0);
let completedRuns = 0;

for (const [cityKey, city] of cityEntries) {
    output[cityKey] = {};
    for (const [ruleKey, rule] of Object.entries(selectedRules)) {
        let best = null;
        let timedOutStarts = 0;
        for (const node of city.nodes) {
            const result = runSolver({
                start_station: node.name,
                end_station: null,
                mode: rule.mode,
                allow_station_reuse: rule.allowStationReuse,
                max_transfers: null,
                max_lines: null,
                waypoints: [],
                optimize_metric: rule.optimizeMetric,
                nodes: city.nodes,
                edges: city.edges,
                timeout
            });
            completedRuns++;
            if (result.timeout_reached) timedOutStarts++;
            if (result.weight > -1 && (!best || result.weight > best.weight)) best = result;
            if (completedRuns % 50 === 0) console.log(`Shard ${shard}: ${completedRuns}/${totalRuns}`);
        }
        output[cityKey][ruleKey] = {
            result: best,
            total: city.nodes.length,
            timedOutStarts,
            searchTimeoutSeconds: timeout
        };
        console.log(`Completed ${city.city} / ${ruleKey}`);
    }
}

fs.writeFileSync(path.join(projectDir, `city_extremes_results_${shard}.json`), JSON.stringify(output));
console.log(`Wrote shard ${shard}`);
