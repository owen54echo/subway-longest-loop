const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Rose=require('../../orientation-rose.js');
const sum=a=>a.reduce((x,y)=>x+y,0);
const edge={line:'1号线',u:'A',v:'B',color:'#ff0000'};
const city={edges:[edge,{...edge,u:'B',v:'A'},{line:'2号线',u:'B',v:'C',color:'#0000ff'}]};
const geometry={positions:{A:[113,23],B:[113,23.01],C:[113.01,23.01]},segments:{'1号线\tA\tB':{points:[[113,23],[113,23.01]],source:'1'}}};
test('undirected track is symmetric, length-weighted and deduplicated',()=>{
 const result=Rose.analyze(city,geometry);
 assert.equal(result.totalSegments,2); assert.equal(result.sourcedSegments,1); assert.equal(result.estimatedSegments,1);
 assert.equal(result.lines.length,1); assert.equal(result.lines[0].color,'#ff0000');
 assert.ok(result.lines[0].km>1 && result.lines[0].km<1.2);
 assert.ok(Math.abs(sum(result.lines[0].bins)-result.lines[0].km)<1e-9);
 assert.ok(Math.abs(result.lines[0].bins[0]-result.lines[0].bins[8])<1e-9);
 assert.ok(result.lines[0].bins[0]>0);
});
test('estimated sections remain excluded unless explicitly requested',()=>{
 const result=Rose.analyze(city,geometry,{includeEstimated:true});
 assert.equal(result.lines.length,2); const blue=result.lines.find(x=>x.name==='2号线');
 assert.equal(blue.color,'#0000ff'); assert.ok(blue.bins[4]>0); assert.equal(blue.bins[4],blue.bins[12]);
});
test('each bend contributes in its own direction',()=>{
 const curved={positions:{A:[113,23],B:[113.01,23.01]},segments:{'1号线\tA\tB':{points:[[113,23],[113,23.01],[113.01,23.01]]}}};
 const line=Rose.analyze({edges:[edge]},curved).lines[0];
 assert.ok(line.bins[0]>0 && line.bins[4]>0);
});
test('all city geometry datasets yield finite symmetric colored results',()=>{
 const context={window:{}};vm.runInNewContext(fs.readFileSync('subway_data.js','utf8'),context);
 for(const [key,city] of Object.entries(context.window.subwayDataMap)) {
  const geo=JSON.parse(fs.readFileSync(`data/geometry/${key==='guangzhou'?'guangfo':key}.json`,'utf8'));
  const result=Rose.analyze(city,geo); assert.ok(result.lines.length,key); assert.ok(result.sourcedSegments>0,key);
  for(const line of result.lines) { assert.ok(/^#[a-f\d]{6}$/i.test(line.color),`${key}/${line.name}`); assert.ok(Number.isFinite(line.km));
   for(let i=0;i<8;i++)assert.ok(Math.abs(line.bins[i]-line.bins[i+8])<1e-8);
  }
 }
});
