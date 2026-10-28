const assert = require("assert");
const fs = require("fs");

const review = JSON.parse(fs.readFileSync("data/operational-review.json", "utf8"));
assert.strictEqual(review.reviewedAt, "2026-10-23");
assert.deepStrictEqual(review.findings.xiamen.includedLines, ["1号线", "2号线", "3号线"]);
assert.deepStrictEqual(
    review.findings.xiamen.excludedLines.map(item => item.line),
    ["4号线", "6号线"]
);
assert.strictEqual(review.findings.beijing.excludedStations[0].station, "八角游乐园");
assert(review.confirmedRecentOpenings.some(item => item.city === "nanjing" && item.line === "S2号线(宁马线)"));
assert.deepStrictEqual(review.scheduledOpenings[0], {
    city: "wuhan",
    line: "12号线二期",
    expectedOpeningOn: "2026-10-29",
    source: "https://www.wuhan.gov.cn/sy/whyw/202610/t20261023_2867429.shtml",
    note: "开通前预置；官方公告确认已通过初期运营前安全评估并具备开通条件。",
});

console.log("Operational review contract ok");
