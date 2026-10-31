// 監控修正的永久回歸：問句→用神／事類、醫藥效用敘述、需確認三頁、產期與解卦判詞一致性。
// 案例全在 tests/monitor-followup.cases.json（M01～M07、A01～A42 的預期原樣保留，其後為補強案例）；
// 一律讀取目前 3-2.html 實際執行，不寫死函式輸出。
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..'),raw=fs.readFileSync(path.join(ROOT,'3-2.html'),'utf8');
const sourceHash=crypto.createHash('sha256').update(raw).digest('hex');
const cases=JSON.parse(fs.readFileSync(path.join(__dirname,'monitor-followup.cases.json'),'utf8'));

function load(gender=''){
 const selected={gender};
 const fields=new Map(),choices=['','世','應','父母','兄弟','子孫','妻財','官鬼'];
 function el(id){if(!fields.has(id))fields.set(id,{value:'',options:choices.map(text=>({text})),get selectedIndex(){return choices.indexOf(this.value);},classList:{contains:()=>false,toggle:()=>{}},getContext:()=>({}),addEventListener:()=>{}});return fields.get(id);}
 const env={Solar:require(path.join(ROOT,'lib/lunar.js')).Solar,Date,console,document:{getElementById:el,querySelectorAll:()=>[],querySelector:s=>({value:s.includes('gender')?selected.gender:s.includes('ziMode')?'0':'auto'}),documentElement:{style:{}}},window:{matchMedia:()=>({matches:false}),addEventListener:()=>{}},setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{}};
 vm.createContext(env);for(const name of ['zhouyi','jiegua'])vm.runInContext(fs.readFileSync(path.join(ROOT,'lib',name+'.js'),'utf8'),env);
 vm.runInContext(raw.match(/<script>\s*([\s\S]*?)<\/script>/)[1].split('/* ---------- 初始化 ---------- */')[0],env);
 return {env,el,selected};
}
const runtimes=new Map();
function runtime(g){if(!runtimes.has(g))runtimes.set(g,load(g));return runtimes.get(g);}

function fail(msg){throw new Error(msg);}
function cast(rt,q,sel,state){
 const e=rt.env,opts=[[0,0,0],[1,0,0],[1,1,0],[1,1,1]];
 rt.el('question').value=q;rt.el('yongShen').value=sel;
 e.castTime=new Date('2026-01-15T12:00:00+08:00');e.timeInfo=e.computeTimeInfo(e.castTime);
 e.yaos=Array.from({length:6},(_,i)=>e.makeYao(opts[(state>>>(2*i))&3]));
 const gua=e.analyzeGua(),r=e.buildDetailedAnalysis(gua),plain=r.sections.find(s=>s.title==='白話解讀');
 return {e,gua,r,plain,jie:e.jieguaHtml(gua)};
}
const text=html=>html.replace(/<[^>]+>/g,'');
const conclusion=x=>((x.plain?.items||[]).find(i=>/^結論：/.test(i.text))||{}).text||'';
// 解卦第一段（先回答）：取「解卦」區塊的第一個段落
function firstParagraph(jie){const sec=jie.split('class="teach-step jie-say"')[1]||'';const m=/<p>([\s\S]*?)<\/p>/.exec(sec);return m?text(m[1]):'';}
function sayText(jie){return text((jie.split('class="teach-step jie-say"')[1]||'').split('<details')[0]);}
// 結論類敘述：排除只引用卦名象義、宜忌與比喻的段落（它們已明說不是這件事的結果）
function verdictParagraphs(jie){return ((jie.split('class="teach-step jie-say"')[1]||'').split('<details')[0].match(/<p>[\s\S]*?<\/p>/g)||[]).map(text).filter(p=>!/^(?:至於卦名|如果要我多提醒一句|用生活的畫面)/.test(p));}

// 解卦敘述的共同規則：判詞一致、先答再解釋、象義只當提醒、偏凶不說成必然成功、應期卦不另判成敗
function checkJie(x,f){
 const {r,jie}=x,say=sayText(jie),first=firstParagraph(jie),timing=/^應期卦/.test(r.verdict);
 if(!jie.includes('>'+r.verdict+'</div>'))fail('卡片缺少判詞');
 if(!jie.includes('<b>'+r.verdict+'</b>'))fail('解卦文字缺少與詳細分析相同的判詞');
 if(/undefined|NaN/.test(jie))fail('出現 undefined 或 NaN');
 if(/。。|，，|，。|；。|：。|。，/.test(say))fail('標點重複：'+(/。。|，，|，。|；。|：。|。，/.exec(say)||[''])[0]);
 if(f.q&&!first.includes('你問的是「'+f.q+'」'))fail('第一段沒有先說明所問');
 if(!first.includes(r.verdict))fail('第一段沒有先給判詞');
 if(/上面提到|前面提到/.test(first))fail('第一段是開頭，不能說「'+/上面提到|前面提到/.exec(first)[0]+'」');
 const advice=conclusion(x).replace(/^結論：/,'');
 if(advice&&!first.includes(advice))fail('第一段沒有先答白話結論');
 const nameAt=say.indexOf('這一卦起出來是'),answerEnd=say.indexOf(first)+first.length;
 if(nameAt<0||nameAt<answerEnd)fail('卦名象義不能排在回答之前');
 if(!/只能當提醒，不是(?:這件事的結果|運勢的結論)/.test(say))fail('卦名象義沒有說明只是提醒');
 if(r.tone==='bad'){
  if(/以變成的[^。]{0,15}為最後走向/.test(jie))fail('把變卦象義當最後走向');
  if(/必然|一定會成|保證成功|肯定成功|一定成功|必定成功/.test(verdictParagraphs(jie).join('\n')))fail('偏凶被說成必然成功');
 }
 if(timing){
  if(/如果要我多提醒一句|用生活的畫面|事終不成|看不到明確的好轉時機|有利的地方|要留意的是|雖然也有有利/.test(say))fail('應期卦出現成敗或宜忌敘述');
  if(/整體傾向是(?:吉|偏吉|凶|偏凶|平)/.test(say))fail('應期卦另判吉凶');
  const days=((x.plain.items.find(i=>/^可能有變化或結果的日子：/.test(i.text))||{}).text||'').replace(/^可能有變化或結果的日子：/,'').split('。')[0];
  const displayDays=days.replace(/（[^（）]*）/g,'').replace(/(\d{1,2})\/(\d{1,2})/g,'$1月$2日');
  if(displayDays&&!say.includes(displayDays))fail('應期卦解卦缺少與詳細分析相同的日期');
 }else if(!/如果要我多提醒一句/.test(say))fail('缺少提醒段落');
}

const records=[];
function record(f,fn){try{const extra=fn()||{};records.push({id:f.id,kind:f.kind||'intent',q:f.q,pass:true,...extra});}catch(err){records.push({id:f.id,kind:f.kind||'intent',q:f.q,pass:false,error:String(err&&err.message||err)});}}

for(const f of cases){
 const kind=f.kind||'intent';
 if(kind==='intent')record(f,()=>{
  const rt=runtime(f.gender||''),e=rt.env;rt.el('question').value=f.q;rt.el('yongShen').value='';
  const r=e.inferYong(f.q,f.gender||''),sel=r?.value||'',cat=e.questionCategory(sel);
  if(f.sel!==undefined&&sel!==f.sel)fail(JSON.stringify({expected:f.sel,actual:sel,cat}));
  if(f.cat!==undefined&&cat!==f.cat)fail(JSON.stringify({expectedCat:f.cat,actualCat:cat}));
  if(f.forbid&&sel===f.forbid)fail('禁止的用神 '+sel);
  if(f.forbidCat&&cat===f.forbidCat)fail('禁止的事類 '+cat);
  if(f.confirm&&!r?.requiresConfirmation)fail('應要求確認');
  return {sel,cat,requiresConfirmation:r?.requiresConfirmation===true};
 });
 else if(kind==='medical')record(f,()=>{
  // 掃過卦象，確保吉、偏吉、平、偏凶、凶各種判詞的敘述都不推定患病，也不憑卦象叫人繼續、停藥或換療法
  const rt=runtime('男'),verdicts=new Set();
  for(let state=0;state<4096;state+=11){
   const x=cast(rt,f.q,'子孫',state),line=conclusion(x),whole=x.plain.items.map(i=>i.text).join('\n');
   verdicts.add(x.r.verdict);
   if(!line)fail('沒有結論 state='+state);
   if(/病情|病重|病況|病勢|病位|積極就醫|務必就醫/.test(whole))fail('推定患病 state='+state+'：'+whole.match(/病情|病重|病況|病勢|病位|積極就醫|務必就醫/)[0]);
   if(!/效果|效用|治療|防護|醫藥/.test(line))fail('沒有回答醫藥效用 state='+state+'：'+line);
   if(!/專業|醫師|藥師/.test(line))fail('沒有交代實際療效需專業評估 state='+state+'：'+line);
   if(/繼續進行|繼續治療|繼續服用|繼續使用|停藥|停用|停止|換藥|改用|換成|換療法|尋求其他方式|延後再做/.test(line))fail('憑卦象指示繼續、停藥或換療法 state='+state+'：'+line);
   if(/undefined/.test(line))fail('結論為 undefined state='+state);
   const first=firstParagraph(x.jie);
   if(/病情|病重|病況|病勢/.test(first))fail('解卦第一段推定患病 state='+state);
   if(!/專業意見/.test(sayText(x.jie)))fail('解卦缺少專業意見提醒 state='+state);
   checkJie(x,f);
  }
  for(const need of ['吉','偏吉','偏凶（阻礙較多）','凶'])if(!verdicts.has(need))fail('掃描沒有涵蓋判詞 '+need);
  return {verdicts:[...verdicts].sort()};
 });
 else if(kind==='medical-patient')record(f,()=>{
  const rt=runtime('男');let seen=0;
  for(let state=0;state<4096;state+=97){
   const x=cast(rt,f.q,f.sel,state),line=conclusion(x);
   if(!/病|好轉|治療|就醫|醫師/.test(line))fail('問患者病況時應回答病情 state='+state+'：'+line);
   if(/實際療效/.test(line))fail('問患者病況卻套用療效敘述');
   seen++;
  }
  return {states:seen};
 });
 else if(kind==='pending')record(f,()=>{
  const rt=load('男'),e=rt.env;
  const rule=e.inferYong(f.q,'男');
  if(f.id==='P01'&&rule&&rule.value)fail('裸試管不應被硬判成生育：'+rule.value);
  const x=cast(rt,f.q,'',3);
  if(!x.r.requiresConfirmation||x.r.verdict!=='待確認用神')fail('應先待確認：'+x.r.verdict);
  if(x.r.sections.some(s=>s.title==='應期參考'||s.title==='白話解讀'))fail('待確認不應有應期或白話判斷');
  const pages={analysis:e.analysisHtml(x.gua),teaching:e.teachingHtml(x.gua),jie:x.jie,lines:e.buildAnalysisLines(x.gua).join('\n')};
  for(const [name,html] of Object.entries(pages)){
   if(!html.includes('待確認用神'))fail(name+' 沒有待確認');
   if(/整體傾向：(?:吉|偏吉|凶|偏凶|平)|<b>(?:吉|偏吉|凶|偏凶)/.test(html))fail(name+' 產生吉凶');
   if(/可能有變化或結果的日子|應期參考|時間上|如果要我多提醒/.test(html))fail(name+' 產生應期或提醒');
  }
  if(e.teachingSteps(x.gua).length)fail('待確認時教學步驟不應產生');
  rt.el('question').value=f.q;rt.el('yongShen').value='';e.yongManual=false;e.yaos=[];e.autoPickYong();
  if(rt.el('yongShen').value!=='')fail('自動判不出來時不應殘留用神');
  if(!/無法|選擇用神|確認/.test(e.yongAutoNote||''))fail('沒有說明需手動選用神：'+e.yongAutoNote);
  // 手動明選用神後恢復
  const y=cast(rt,f.q,f.manual,3);
  if(y.r.requiresConfirmation||y.r.verdict==='待確認用神')fail('手動選用神後仍待確認');
  if(!y.r.sections.some(s=>s.title==='應期參考'))fail('手動選用神後沒有恢復完整分析');
  if(!y.jie.includes('<b>'+y.r.verdict+'</b>'))fail('手動選用神後解卦判詞不一致');
  return {pendingVerdict:x.r.verdict,restoredVerdict:y.r.verdict};
 });
 else if(kind==='pending-blank')record(f,()=>{
  const rt=load(''),x=cast(rt,'','',3);
  if(x.r.requiresConfirmation||x.r.verdict==='待確認用神')fail('空白問題應保留原概略分析');
  const y=cast(rt,'   ','',3);
  if(y.r.requiresConfirmation)fail('只有空白字元的問題應保留原概略分析');
  return {verdict:x.r.verdict};
 });
 else if(kind==='pending-gender')record(f,()=>{
  const rt=load(''),e=rt.env,x=cast(rt,f.q,'',3);
  if(!x.r.requiresConfirmation)fail('未知性別時應先待確認');
  rt.selected.gender=f.gender;e.autoPickYong(true);
  if(rt.el('yongShen').value!==f.sel)fail('補性別後用神 '+rt.el('yongShen').value);
  const y=e.buildDetailedAnalysis(x.gua);
  if(y.requiresConfirmation||y.verdict==='待確認用神')fail('補性別並套用用神後仍待確認');
  return {restoredVerdict:y.verdict};
 });
 else if(kind==='jie')record(f,()=>{
  const rt=runtime('男'),x=cast(rt,f.q,f.sel,f.state);
  if(f.timing&&!/^應期卦/.test(x.r.verdict))fail('產期題應為應期卦：'+x.r.verdict);
  checkJie(x,f);
  return {verdict:x.r.verdict};
 });
 else if(kind==='jie-sweep')record(f,()=>{
  const rt=runtime('男'),verdicts=new Set();let n=0;
  for(let state=0;state<4096;state+=53){
   const x=cast(rt,f.q,f.sel,state);
   if(f.timing!==undefined&&f.timing!==/^應期卦/.test(x.r.verdict))fail('應期卦判定不一致 state='+state+'：'+x.r.verdict);
   try{checkJie(x,f);}catch(err){fail('state='+state+' '+x.r.verdict+'：'+err.message);}
   verdicts.add(x.r.verdict);n++;
  }
  return {states:n,verdicts:[...verdicts].sort()};
 });
 else if(kind==='intent-parity')record(f,()=>{
  // 介紹人只是背景：與沒有介紹人的同一主問相比，判詞與分析文字（扣除所問原句）必須完全相同
  const rt=runtime('男'),strip=x=>JSON.stringify([x.r.verdict,x.r.sections.map(s=>s.items.map(i=>i.text.split('「'+f.q+'」').join('').split('「'+f.control+'」').join('')))]);
  let n=0;
  for(let state=0;state<4096;state+=7){
   const a=cast(rt,f.q,f.sel,state),b=cast(rt,f.control,f.sel,state);
   if(strip(a)!==strip(b))fail('介紹人影響了分析 state='+state+'：'+a.r.verdict+' ≠ '+b.r.verdict);
   n++;
  }
  return {states:n};
 });
 else records.push({id:f.id,kind,q:f.q,pass:false,error:'未知案例類型 '+kind});
}

// ---- 解卦口吻補強（V01～V04）：假空要有條件、收款題要回答拿到錢的難易；以下為固定樣本與有限掃描，不代表所有問法 ----
const GUARANTEE_RE=/時間到了就會實現|時候到了就(?:會|有)|時候到了就能|到了就會成|一定(?:會)?(?:實現|成功|拿到)/;
const allPlainText=x=>x.r.sections.map(s=>(s.items||[]).map(i=>i.text).join('\n')+'\n'+(s.plain||'')).join('\n');
const KONG_LINE_RE=/^暫時「落空」：/;
const RECEIPT_QUESTIONS=['這筆款項能拿到嗎','這筆貨款什麼時候入帳','我借出去的錢能要回來嗎','年終獎金能領到嗎','這個月的薪水會順利入帳嗎'];
const voiceCases=[
 {id:'V01',kind:'voice',q:'這筆款項能拿到嗎（假空只說有條件的機會，固定 state=12 為凶）',run(){
  const rt=runtime('男'),q='這筆款項能拿到嗎',x=cast(rt,q,'妻財',12);
  if(x.r.tone!=='bad')fail('固定樣本應為凶：'+x.r.verdict);
  const kong=x.plain.items.find(i=>KONG_LINE_RE.test(i.text));
  if(!kong)fail('固定樣本沒有假空白話');
  if(GUARANTEE_RE.test(allPlainText(x)))fail('分析仍保證實現');
  if(GUARANTEE_RE.test(sayText(x.jie)))fail('解卦仍保證實現');
  if(!/其他爻/.test(kong.text)||!/整體/.test(kong.text)||!/前提|只要|要等|才有機會/.test(kong.text))fail('假空白話沒有交代條件：'+kong.text);
  if(!sayText(x.jie).includes(kong.text.replace(/。$/,'')))fail('解卦沒有採用分析同一句假空說法');
  let seen=0;
  for(const [qq,sel] of [[q,'妻財'],['我的疫苗防護效果好嗎','子孫'],['這份工作能成嗎','官鬼']]){
   for(let state=0;state<4096;state+=37){
    const y=cast(rt,qq,sel,state);
    if(GUARANTEE_RE.test(allPlainText(y)))fail('分析保證實現 '+qq+' state='+state);
    if(GUARANTEE_RE.test(sayText(y.jie)))fail('解卦保證實現 '+qq+' state='+state);
    const k=y.plain.items.find(i=>KONG_LINE_RE.test(i.text));
    if(k){seen++;if(!/其他爻/.test(k.text)||!/整體/.test(k.text))fail('假空沒有條件 '+qq+' state='+state);}
   }
  }
  if(seen<3)fail('掃描沒有涵蓋足夠的假空樣本：'+seen);
  return {verdict:x.r.verdict,kong:kong.text,kongSamples:seen};
 }},
 {id:'V02',kind:'voice',q:'收款主問的開頭回答拿到錢的難易，而不是泛用暫緩建議',run(){
  const rt=runtime('男'),verdicts=new Set();let n=0,sample='';
  for(const q of RECEIPT_QUESTIONS){
   for(let state=0;state<4096;state+=97){
    const x=cast(rt,q,'妻財',state),first=firstParagraph(x.jie),answer=first.replace('你問的是「'+q+'」。','');
    const tag=q+' state='+state+' '+x.r.verdict+'：';
    try{checkJie(x,{q});}catch(err){fail(tag+err.message);}
    if(/建議暫緩|另作打算|可以積極去做|^錢財方面/.test(answer.split('。').slice(1).join('。')))fail(tag+'仍是泛用建議 '+answer);
    if(!/款|錢/.test(answer.replace(x.r.verdict,'')))fail(tag+'沒有提到款項或錢 '+answer);
    if(!/拿到|到手|入帳|收回|領到|要回/.test(answer))fail(tag+'沒有回答拿不拿得到 '+answer);
    if(!/我/.test(answer.split('。').slice(1).join('。')))fail(tag+'沒有擬人口吻 '+answer);
    if(/拖欠|催款|賴帳|不肯給|對方會/.test(first))fail(tag+'捏造對方拖款 '+first);
    if(x.r.tone==='bad'){
     if(!/先別當作已經到手|暫時別當作已經到手|別太早當作已經到手/.test(answer))fail(tag+'偏凶沒有提醒別當作已到手 '+answer);
     if(!/把握不高|不太容易|阻礙/.test(answer))fail(tag+'偏凶沒有說明難度 '+answer);
    }
    verdicts.add(x.r.verdict);n++;
    if(!sample&&q===RECEIPT_QUESTIONS[0]&&state===12)sample=first;
   }
  }
  for(const need of ['吉','偏吉','偏凶（阻礙較多）','凶'])if(!verdicts.has(need))fail('掃描沒有涵蓋判詞 '+need);
  return {states:n,verdicts:[...verdicts].sort(),sample};
 }},
 {id:'V03',kind:'voice',q:'換匯、投資、花錢不套用收款說法，也不說成對方拖款',run(){
  const rt=runtime('男');let n=0;
  for(const q of ['要不要把美金換回台幣','這支股票能回本嗎','要不要花錢買這台車','這筆投資值得進場嗎']){
   for(let state=0;state<4096;state+=97){
    const x=cast(rt,q,'妻財',state),first=firstParagraph(x.jie),tag=q+' state='+state+' '+x.r.verdict+'：';
    try{checkJie(x,{q});}catch(err){fail(tag+err.message);}
    if(/拖欠|催款|賴帳|不肯給|收不到|到手|拿到|入帳|款項/.test(first.replace('你問的是「'+q+'」。','')))fail(tag+'非收款題出現收款說法 '+first);
    n++;
   }
  }
  return {states:n};
 }},
 {id:'V04',kind:'voice',q:'專門斷法的結論仍優先：產期題結論不被收款說法取代',run(){
  const rt=runtime('男');let n=0;
  for(const q of ['我何時生產','我懷孕了嗎']){
   for(let state=0;state<4096;state+=211){
    const x=cast(rt,q,'子孫',state),line=conclusion(x);
    if(/到手|款項|拿到/.test(line))fail('專門斷法結論被取代 '+q+' state='+state+'：'+line);
    if(!/醫院|產期|懷孕/.test(line))fail('專門斷法結論消失 '+q+' state='+state+'：'+line);
    n++;
   }
  }
  return {states:n};
 }}
];
for(const f of voiceCases)record({id:f.id,kind:f.kind,q:f.q},()=>f.run());

const failures=records.filter(r=>!r.pass).length;
console.log(JSON.stringify({sourceHash,tested:records.length,failures,records},null,2));
process.exitCode=failures?1:0;
