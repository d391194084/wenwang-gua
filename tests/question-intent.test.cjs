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
 const code=raw.match(/<script>\s*([\s\S]*?)<\/script>/)[1].split('/* ---------- 初始化 ---------- */')[0];
 const resultReturn='return { verdict: verdict, tone: vTone, sections: sections };';assert(code.includes(resultReturn));
 vm.runInContext(code.replace(resultReturn,'globalThis.__qualityScore=vScore; '+resultReturn),env);
 return {env,el,selected};
}
const runtimes=new Map();function runtime(g){if(!runtimes.has(g))runtimes.set(g,load(g));return runtimes.get(g);}
const fixtures=['round2-observed','shared-intent-controls','question-quality'].flatMap(n=>JSON.parse(fs.readFileSync(path.join(__dirname,n+'.cases.json'),'utf8')));
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
test('多問及多人物代詞歧義：三分頁與純文字先澄清，手動確認後恢復',()=>{
 for(const q of ['我能升職嗎？也想問我和她會不會復合？','媽媽和朋友都會去，她能否平安？','我只問她的工作能不能升職？']){
  const rt=load('男'),g=cast(rt,q,''),e=rt.env,r=e.buildDetailedAnalysis(g);
  assert.equal(r.requiresConfirmation,true,q);assert.equal(r.verdict,'待確認用神');assert(!r.sections.some(s=>s.title==='應期參考'));
  for(const out of [e.analysisHtml(g),e.teachingHtml(g),e.jieguaHtml(g),e.buildAnalysisLines(g).join('\n')])assert(out.includes('待確認用神'),q);
  rt.el('yongShen').value='官鬼';assert(!e.buildDetailedAnalysis(g).requiresConfirmation,q);
 }
});
test('明確只問的本人工作：與無背景同卦的三頁判詞與分數一致',()=>{
 const states=[0,132,147,1185,4095];
 for(const state of states){
  function view(q){const rt=load('男'),e=rt.env;rt.el('question').value=q;e.autoPickYong();assert.equal(rt.el('yongShen').value,'官鬼');e.castTime=new Date('2026-01-15T12:00:00+08:00');e.timeInfo=e.computeTimeInfo(e.castTime);const opts=[[0,0,0],[1,0,0],[1,1,0],[1,1,1]];e.yaos=Array.from({length:6},(_,i)=>e.makeYao(opts[(state>>>(2*i))&3]));const g=e.analyzeGua(),r=e.buildDetailedAnalysis(g);return {r,score:e.__qualityScore,htmls:[e.analysisHtml(g),e.teachingHtml(g),e.jieguaHtml(g)],lines:e.buildAnalysisLines(g).join('\n')};}
  const a=view('我的工作能不能升職？');
  for(const q of ['媽媽住院了，我只問我的工作能不能升職？','媽媽住院了，我的工作能不能升職？謝謝～','我只問我的工作能不能升職，媽媽還在住院。','媽媽住院了我只問我的工作能不能升職']){
   const b=view(q);
   assert.equal(b.r.verdict,a.r.verdict,q+' state '+state);assert.equal(b.r.tone,a.r.tone,q);assert.equal(b.score,a.score,q+' score state '+state);
   for(const out of b.htmls){assert(out.includes(a.r.verdict),q+' state '+state);assert(!out.includes('代表病的官鬼'),'背景不得變病況');}
   assert(b.lines.includes(a.r.verdict),q);
  }
 }
});
test('多問手選仍保留，但不將工作與感情混成感情專斷且三頁提醒先選主問',()=>{
 const q='我能升職嗎？也想問我和她會不會復合？',rt=load('男'),e=rt.env;
 e.yongManual=true;rt.el('question').value=q;rt.el('yongShen').value='官鬼';e.autoPickYong();assert.equal(rt.el('yongShen').value,'官鬼');
 const g=cast(rt,q,'官鬼'),r=e.buildDetailedAnalysis(g);assert(!r.requiresConfirmation);assert.equal(e.questionCategory('官鬼'),'');
 assert(!r.sections.some(s=>/感情專門/.test(s.title)));
 for(const out of [e.analysisHtml(g),e.teachingHtml(g),e.jieguaHtml(g),e.buildAnalysisLines(g).join('\n')])assert(/多件|多問|一件最想問/.test(out));
});
test('自動用神改成多問時清空舊值，明確主問後恢復；手選不被覆寫',()=>{
 const rt=load('男'),e=rt.env;rt.el('question').value='我的工作能升職嗎';e.autoPickYong();assert.equal(rt.el('yongShen').value,'官鬼');
 rt.el('question').value='我想問工作、感情';e.autoPickYong();assert.equal(rt.el('yongShen').value,'');assert(/先|確認|一件/.test(e.yongAutoNote));
 rt.el('question').value='我只問我的工作能升職嗎';e.autoPickYong();assert.equal(rt.el('yongShen').value,'官鬼');
 e.yongManual=true;rt.el('yongShen').value='父母';rt.el('question').value='我想問工作、感情';e.autoPickYong();assert.equal(rt.el('yongShen').value,'父母');
});
test('新增多問與代詞歧義反例：三分頁與純文字先澄清',()=>{
 for(const q of ['我想問工作、感情','我想問寶寶健康和我的工作','媽媽和朋友都會去，請問她能否平安？','我想知道她能否平安，媽媽和朋友都會去','老公和兒子都生病了，他會好嗎？','我先問工作，再問感情']){
  const rt=load('男'),g=cast(rt,q,''),e=rt.env,r=e.buildDetailedAnalysis(g);
  assert.equal(r.requiresConfirmation,true,q);assert.equal(r.verdict,'待確認用神',q);assert(!r.sections.some(s=>s.title==='應期參考'),q);
  for(const out of [e.analysisHtml(g),e.teachingHtml(g),e.jieguaHtml(g),e.buildAnalysisLines(g).join('\n')])assert(out.includes('待確認用神'),q);
 }
});
test('單一問事、同事件背景或前提不誤判多問；手選用神時不出現多問提醒且事類照主問',()=>{
 for(const q of ['我想問考上之後，工作會不會順利？','我想問懷孕的事，寶寶健康嗎？','我想問升職加薪','寶寶健康和懷孕順利嗎','我想問考上研究所之後工作順利嗎？','工作和事業順利嗎']){
  const rt=load('男'),e=rt.env;rt.el('question').value=q;e.autoPickYong();const sel=rt.el('yongShen').value;
  assert(sel,q);assert.notEqual(e.questionCategory(sel),'',q);
  const g=cast(rt,q,sel),r=e.buildDetailedAnalysis(g);assert(!r.requiresConfirmation,q);assert(!r.sections.some(s=>s.title==='一次問多件事'),q);
  for(const out of [e.analysisHtml(g),e.teachingHtml(g),e.jieguaHtml(g),e.buildAnalysisLines(g).join('\n')])assert(!/一次問了多件事/.test(out),q);
 }
});
test('明寫用神與多問：以X為用優先，事類留白，三頁與純文字都提醒先選主問',()=>{
 const q='以父母為用，我想問工作和感情',rt=load('男'),e=rt.env;rt.el('question').value=q;e.autoPickYong();assert.equal(rt.el('yongShen').value,'父母');
 assert.equal(e.questionCategory('父母'),'');
 const g=cast(rt,q,'父母'),r=e.buildDetailedAnalysis(g);assert(!r.requiresConfirmation);assert.equal(r.sections[0].title,'一次問多件事');
 for(const out of [e.analysisHtml(g),e.teachingHtml(g),e.jieguaHtml(g),e.buildAnalysisLines(g).join('\n')])assert(/一次問了多件事/.test(out)&&/不代表每一件事都有結論/.test(out));
});
test('畫面保留原問句：範圍判斷不改輸入框，解卦仍顯示原問',()=>{
 const q='媽媽住院了，我只問我的工作能不能升職？謝謝',rt=load('男'),e=rt.env;rt.el('question').value=q;e.autoPickYong();
 assert.equal(rt.el('yongShen').value,'官鬼');assert.equal(rt.el('question').value,q);
 const g=cast(rt,q,'官鬼');assert(e.jieguaHtml(g).includes(q));assert.equal(rt.el('question').value,q);
});
test('手動用神優先：多人物代詞與多問都不被自動判斷覆寫',()=>{
 for(const q of ['媽媽和朋友都會去，她能否平安？','我想問工作、感情']){
  const rt=load('男'),e=rt.env;e.yongManual=true;rt.el('yongShen').value='兄弟';rt.el('question').value=q;e.autoPickYong();assert.equal(rt.el('yongShen').value,'兄弟',q);
  const r=e.buildDetailedAnalysis(cast(rt,q,'兄弟'));assert(!r.requiresConfirmation,q);
 }
});
test('並列不同六親的所問對象：三分頁與純文字先確認；單一連屬稱謂、同六親、明確主詞不誤擋',()=>{
 for(const q of ['媽媽和朋友誰會康復？','媽媽和朋友都會康復嗎？','媽媽的姐姐和朋友誰會康復？','老公和兒子誰會康復？','我只問媽媽和朋友，誰會康復？']){
  const rt=load(''),g=cast(rt,q,''),e=rt.env,r=e.buildDetailedAnalysis(g);
  assert.equal(r.requiresConfirmation,true,q);assert.equal(r.verdict,'待確認用神',q);assert(!r.sections.some(s=>s.title==='應期參考'),q);
  for(const out of [e.analysisHtml(g),e.teachingHtml(g),e.jieguaHtml(g),e.buildAnalysisLines(g).join('\n')])assert(out.includes('待確認用神'),q);
  rt.el('yongShen').value='兄弟';assert(!e.buildDetailedAnalysis(g).requiresConfirmation,q+' 手選後恢復');
 }
 for(const q of ['媽媽的朋友會康復嗎？','爸爸和媽媽都會康復嗎？','媽媽和朋友都會去，媽媽能否平安？','媽媽和朋友都會去，我能否平安？']){
  const rt=load(''),e=rt.env;rt.el('question').value=q;e.autoPickYong();assert(rt.el('yongShen').value,q);
  const g=cast(rt,q,rt.el('yongShen').value);assert(!e.buildDetailedAnalysis(g).requiresConfirmation,q);
 }
 const rt=load(''),e=rt.env;e.yongManual=true;rt.el('yongShen').value='兄弟';rt.el('question').value='媽媽和朋友誰會康復？';e.autoPickYong();assert.equal(rt.el('yongShen').value,'兄弟');
});
test('請假與面試官背景：用神依請假的人與面試結果，三分頁不把家人病況當主問，畫面保留原問句',()=>{
 const expect=[['媽媽住院，我能不能請假？','官鬼'],['媽媽住院，我能不能請假照顧她？','官鬼'],['我的朋友能不能請假？','兄弟'],['面試官是我朋友，面試能成功嗎？','官鬼'],['媽媽考上之後，工作順利嗎？','父母']];
 for(const [q,sel] of expect){
  const rt=load('男'),e=rt.env;rt.el('question').value=q;e.autoPickYong();assert.equal(rt.el('yongShen').value,sel,q);
  const g=cast(rt,q,sel),r=e.buildDetailedAnalysis(g);assert(!r.requiresConfirmation,q);assert.equal(e.questionCategory(sel),'名',q);
  for(const out of [e.analysisHtml(g),e.teachingHtml(g),e.jieguaHtml(g),e.buildAnalysisLines(g).join('\n')]){assert(!/代表病|病勢|病況|病情/.test(out.replace(/<[^>]+>/g,'')),q+' 不得以家人病況當主問');}
  assert.equal(rt.el('question').value,q);assert(e.jieguaHtml(g).includes(q.replace(/[？]$/,'')),q);
 }
});
test('本人與親友明確並列問誰／都：三分頁與純文字先確認；單一感情關係與其他我句不誤擋',()=>{
 for(const q of ['媽媽住院，朋友和我誰會先好？','我和朋友誰會先康復？','朋友和我都會康復嗎？']){
  const rt=load('男'),g=cast(rt,q,''),e=rt.env,r=e.buildDetailedAnalysis(g);
  assert.equal(r.requiresConfirmation,true,q);assert.equal(r.verdict,'待確認用神',q);assert(!r.sections.some(s=>s.title==='應期參考'),q);
  for(const out of [e.analysisHtml(g),e.teachingHtml(g),e.jieguaHtml(g),e.buildAnalysisLines(g).join('\n')])assert(out.includes('待確認用神'),q);
  rt.el('yongShen').value='兄弟';assert(!e.buildDetailedAnalysis(g).requiresConfirmation,q+' 手選後恢復');
 }
 for(const [q,sel] of [['我和朋友會在一起嗎？','妻財'],['我和她會復合嗎？','妻財'],['我和朋友都會去，我能否平安？','世'],['我的朋友能不能請假？','兄弟']]){
  const rt=load('男'),e=rt.env;rt.el('question').value=q;e.autoPickYong();assert.equal(rt.el('yongShen').value,sel,q);
  assert(!e.buildDetailedAnalysis(cast(rt,q,sel)).requiresConfirmation,q);
 }
});
const failures=records.filter(r=>!r.pass).length;
console.log(JSON.stringify({sourceHash,tested:records.length,failures,observedCases:239,policyOverrides:2,records},null,2));process.exitCode=failures?1:0;
