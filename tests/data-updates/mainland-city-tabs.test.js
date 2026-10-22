const assert = require("assert");
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");
for (const [key, label] of [["xiamen", "厦门"], ["qingdao", "青岛"], ["ningbo", "宁波"], ["changsha", "长沙"]]) {
    assert(html.includes(`data-value="${key}"`), `页面应提供 ${label} 城市入口`);
}

console.log("Mainland cities tab contract ok");
