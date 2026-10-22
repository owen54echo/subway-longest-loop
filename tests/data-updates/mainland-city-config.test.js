const assert = require("assert");
const fs = require("fs");

const source = fs.readFileSync("compile_subways.py", "utf8");
for (const value of ["3502", "3702", "3302", "4301", "xiamen", "qingdao", "ningbo", "changsha"]) {
    assert(source.includes(value), `编译配置应包含 ${value}`);
}
assert(source.includes("operational_lines"), "编译器应提供正式运营线路白名单");
assert(source.includes("allowed_lines"), "解析器应按正式运营线路过滤原始数据");

console.log("Mainland cities compile configuration contract ok");
