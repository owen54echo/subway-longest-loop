const assert = require("assert");
const fs = require("fs");

const topologyWindow = {};
new Function("window", fs.readFileSync("calculation-topology.js", "utf8"))(topologyWindow);
const dataWindow = {};
new Function("window", fs.readFileSync("subway_data.js", "utf8"))(dataWindow);

const { create } = topologyWindow.CalculationTopology;

function expectLogicalLine(cityKey, rawLine, logicalLine) {
    const city = dataWindow.subwayDataMap[cityKey];
    const topology = create(cityKey, city.nodes, city.edges);
    const matchingEdges = topology.edges.filter(edge => edge.line === rawLine);
    assert(matchingEdges.length, `${cityKey} should include ${rawLine}`);
    assert(matchingEdges.every(edge => edge.logicalLine === logicalLine),
        `${cityKey} ${rawLine} should be counted as ${logicalLine}`);
}

expectLogicalLine("beijing", "1号线八通线", "1号线/八通线");
expectLogicalLine("beijing", "4号线大兴线", "4号线/大兴线");
expectLogicalLine("guangzhou", "14号线", "14号线");
expectLogicalLine("guangzhou", "14号线支线(知识城线)", "14号线");
expectLogicalLine("shenzhen", "2号线/8号线", "2号线/8号线");
expectLogicalLine("shenzhen", "6号线/光明线", "6号线");
expectLogicalLine("shenzhen", "6号线支线", "6号线");
expectLogicalLine("chongqing", "3号线", "3号线");
expectLogicalLine("chongqing", "轨道交通3号线(空港线)", "3号线");
expectLogicalLine("chongqing", "6号线", "6号线");
expectLogicalLine("chongqing", "轨道交通国博线", "6号线");
expectLogicalLine("chongqing", "6号线东站段", "6号线");
expectLogicalLine("hangzhou", "绍兴1号线", "绍兴1号线");
expectLogicalLine("hangzhou", "绍兴1号线支线", "绍兴1号线");

function runWorker(allowLineReuse) {
    const workerCode = fs.readFileSync("solver-worker.js", "utf8");
    let result = null;
    const context = {
        postMessage(message) {
            if (message.type === "result") result = message;
        },
        onmessage: null
    };
    new Function(`
        const postMessage = this.postMessage;
        let onmessage = null;
        ${workerCode}
        this.onmessage = onmessage;
    `).call(context);

    context.onmessage({
        data: {
            start_station: "甲",
            end_station: null,
            mode: "path",
            allow_station_reuse: false,
            allow_line_reuse: allowLineReuse,
            max_transfers: null,
            max_lines: null,
            waypoints: [],
            optimize_metric: "edges",
            nodes: ["甲", "乙", "丙", "丁", "戊"].map(name => ({ name })),
            edges: [
                { u: "甲", v: "乙", line: "3号线", logicalLine: "3号线" },
                { u: "乙", v: "丙", line: "3号线支线", logicalLine: "3号线" },
                { u: "丙", v: "丁", line: "2号线", logicalLine: "2号线" },
                { u: "丁", v: "戊", line: "3号线", logicalLine: "3号线" }
            ],
            timeout: 1
        }
    });
    return result;
}

const reusableLines = runWorker(true);
assert.strictEqual(reusableLines.weight, 4, "A line may be re-entered when the rule allows it");

const onePassPerLine = runWorker(false);
assert.strictEqual(onePassPerLine.weight, 3,
    "A logical line may continue across branch edges but cannot be re-entered after leaving it");

const html = fs.readFileSync("index.html", "utf8");
assert(html.includes('id="allow-line-reuse"'));
assert(html.includes("allow_line_reuse: document.getElementById(\"allow-line-reuse\").checked"));

console.log("line reuse contract ok");
