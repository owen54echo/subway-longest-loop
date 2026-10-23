const assert = require("assert");
const fs = require("fs");

const catalog = JSON.parse(fs.readFileSync("data/cities.json", "utf8"));
const source = fs.readFileSync("compile_subways.py", "utf8");
for (const value of ["3502", "3702", "3302", "4301", "xiamen", "qingdao", "ningbo", "changsha"]) {
    assert(catalog.some(city => city.adcode === value || city.key === value), `编译配置应包含 ${value}`);
}
assert(source.includes("load_city_catalog"), "编译器应从城市目录读取配置");
assert(source.includes("operational_lines"), "编译器应提供正式运营线路白名单");
assert(source.includes("allowed_lines"), "解析器应按正式运营线路过滤原始数据");

console.log("Mainland cities compile configuration contract ok");
