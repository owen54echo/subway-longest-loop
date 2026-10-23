const assert = require("assert");
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");
const catalog = JSON.parse(fs.readFileSync("data/cities.json", "utf8"));
assert(html.includes("Object.entries(window.subwayDataMap || {})"), "页面应从已编译城市数据生成入口");
for (const [key, label] of [["xiamen", "厦门"], ["qingdao", "青岛"], ["ningbo", "宁波"], ["changsha", "长沙"]]) {
    assert(catalog.some(city => city.key === key), `页面数据应支持 ${label} 城市入口`);
}

console.log("Mainland cities tab contract ok");
