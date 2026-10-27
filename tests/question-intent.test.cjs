// 已曝光的第二批題作開發回歸；原標註保留在originalExpected，不作新盲測。
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..'),raw=fs.readFileSync(path.join(ROOT,'3-2.html'),'utf8');
const sourceHash=crypto.createHash('sha256').update(raw).digest('hex'),records=[];
function load(gender=''){
 const selected={gender};
 const fields=new Map(),choices=['','世','應','父母','兄弟','子孫','妻財','官鬼'];
 function el(id){if(!fields.has(id))fields.set(id,{value:'',options:choices.map(text=>({text})),get selectedIndex(){return choices.indexOf(this.value);},classList:{contains:()=>false,toggle:()=>{}},getContext:()=>({}),addEventListener:()=>{}});return fields.get(id);}
 const env={Solar:require(path.join(ROOT,'lib/lunar.js')).Solar,Date,console,document:{getElementById:el,querySelectorAll:()=>[],querySelector:s=>({value:s.includes('gender')?selected.gender:s.includes('ziMode')?'0':'auto'}),documentElement:{style:{}}},window:{matchMedia:()=>({matches:false}),addEventListener:()=>{}},setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{}};
 vm.createContext(env);for(const name of ['zhouyi','jiegua'])vm.runInContext(fs.readFileSync(path.join(ROOT,'lib',name+'.js'),'utf8'),env);
 vm.runInContext(raw.match(/<script>\s*([\s\S]*?)<\/script>/)[1].split('/* ---------- 初始化 ---------- */')[0],env);
 return {env,el,selected};
}
const runtimes=new Map();function runtime(g){if(!runtimes.has(g))runtimes.set(g,load(g));return runtimes.get(g);}
const fixtures=['round2-observed','shared-intent-controls'].flatMap(n=>JSON.parse(fs.readFileSync(path.join(__dirname,n+'.cases.json'),'utf8')));
for(const f of fixtures){try{
 const {env,el}=runtime(f.gender||'');el('question').value=f.q;el('yongShen').value='';const rule=env.inferYong(f.q,f.gender||''),got=rule?.value||'';
 assert.equal(got,f.sel);if(f.cat!==undefined)assert.equal(env.questionCategory(got),f.cat);if(f.confirm)assert.equal(rule?.requiresConfirmation,true);
 records.push({id:f.id,q:f.q,expected:f.sel,actual:got,pass:true});
}catch(e){records.push({id:f.id,q:f.q,expected:f.sel,pass:false,error:e.message});}}
function test(id,fn){try{fn();records.push({id,pass:true});}catch(e){records.push({id,pass:false,error:e.message});}}
function cast(rt,q,sel){rt.el('question').value=q;rt.el('yongShen').value=sel;const e=rt.env;e.castTime=new Date('2026-01-15T12:00:00+08:00');e.timeInfo=e.computeTimeInfo(e.castTime);e.yaos=Array.from({length:6},()=>e.makeYao([0,0,0]));return e.analyzeGua();}
test('不明他人三分頁及純文字先確認，不產生吉凶與應期',()=>{
 const rt=load(''),g=cast(rt,'她生病了，會好嗎',''),e=rt.env,r=e.buildDetailedAnalysis(g);
 assert.equal(r.requiresConfirmation,true);assert.equal(r.verdict,'待確認用神');assert(!r.sections.some(s=>s.title==='應期參考'));
 for(const html of [e.analysisHtml(g),e.teachingHtml(g),e.jieguaHtml(g)]){assert(html.includes('待確認用神'));assert(!/整體傾向：(?:吉|偏吉|凶|偏凶)/.test(html));}
 assert(e.buildAnalysisLines(g).join('\n').includes('待確認用神'));
});
test('手動確認他人用神後恢復正常三分頁',()=>{
 const rt=load(''),g=cast(rt,'她生病了，會好嗎','應'),e=rt.env,r=e.buildDetailedAnalysis(g);
 assert(!r.requiresConfirmation);assert.notEqual(r.verdict,'待確認用神');assert(r.sections.some(s=>s.title==='應期參考'));assert(e.teachingHtml(g).includes('teach-step'));assert(e.jieguaHtml(g).includes(r.verdict));
});
test('未知主體清除舊自動選擇並說明確認原因',()=>{
 const rt=load('');rt.el('yongShen').value='世';rt.el('question').value='他最近還好嗎';rt.env.autoPickYong();assert.equal(rt.el('yongShen').value,'');assert(/確認|身分|人物/.test(rt.env.yongAutoNote));
});
test('手動選擇仍優先於需確認的問句',()=>{
 const rt=load('');rt.env.yongManual=true;rt.el('yongShen').value='兄弟';rt.el('question').value='他最近還好嗎';rt.env.autoPickYong();assert.equal(rt.el('yongShen').value,'兄弟');
});
test('吃完藥後問開車：自動取世且三分頁不再說車輛父母；手動選父母保持',()=>{
 const q='我吃完藥了，我能開車嗎',rt=load('男');rt.el('question').value=q;rt.env.autoPickYong();
 assert.equal(rt.el('yongShen').value,'世');assert(/吃完藥|出行|開車/.test(rt.env.yongAutoNote));assert(!/房屋|文書|車輛|證件/.test(rt.env.yongAutoNote));
 const g=cast(rt,q,rt.el('yongShen').value),e=rt.env,text=[e.analysisHtml(g),e.teachingHtml(g),e.jieguaHtml(g)].join('\n').replace(/<[^>]+>/g,'');
 assert(/吃完藥後出行/.test(text));assert(!/證件、文書、車輛取父母|房屋、車、文書消息取父母|房車文書/.test(text));
 const manual=load('男');manual.env.yongManual=true;manual.el('yongShen').value='父母';manual.el('question').value=q;manual.env.autoPickYong();
 assert.equal(manual.el('yongShen').value,'父母');
});
test('起卦後補選性別須實際套用用神才恢復分析',()=>{
 const rt=load(''),g=cast(rt,'前任會不會回頭找我',''),e=rt.env;
 assert(e.buildDetailedAnalysis(g).requiresConfirmation);rt.selected.gender='男';e.autoPickYong(true);
 assert.equal(rt.el('yongShen').value,'妻財');assert(e.computeRoles(g));assert(!e.buildDetailedAnalysis(g).requiresConfirmation);
});
test('空白問題保留原概略分析模式',()=>{
 const rt=load(''),g=cast(rt,'','');assert(!rt.env.buildDetailedAnalysis(g).requiresConfirmation);
});
const failures=records.filter(r=>!r.pass).length;
console.log(JSON.stringify({sourceHash,tested:records.length,failures,observedCases:239,policyOverrides:2,records},null,2));process.exitCode=failures?1:0;
