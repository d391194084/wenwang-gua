// 解卦、分析、教學的語境回歸：接種安排與副作用不推定患病、非人事題不編造對方的心理與相處、天氣主問不套做事結論。
// 案例在 tests/narrative-context.cases.json；一律讀取目前 3-2.html 實際執行，不依賴 tmp/。
// 這是有限的固定語境與卦象抽樣，不代表所有問法都正確；各分頁判詞與計分由其他測試負責。
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..'),raw=fs.readFileSync(path.join(ROOT,'3-2.html'),'utf8');
const sourceHash=crypto.createHash('sha256').update(raw).digest('hex');
const cases=JSON.parse(fs.readFileSync(path.join(__dirname,'narrative-context.cases.json'),'utf8'));

function load(gender){
 const fields=new Map(),choices=['','世','應','父母','兄弟','子孫','妻財','官鬼'];
 function el(id){if(!fields.has(id))fields.set(id,{value:'',options:choices.map(text=>({text})),get selectedIndex(){return choices.indexOf(this.value);},classList:{contains:()=>false,toggle:()=>{}},getContext:()=>({}),addEventListener:()=>{}});return fields.get(id);}
 const env={Solar:require(path.join(ROOT,'lib/lunar.js')).Solar,Date,console,document:{getElementById:el,querySelectorAll:()=>[],querySelector:s=>({value:s.includes('gender')?gender:s.includes('ziMode')?'0':'auto'}),documentElement:{style:{}}},window:{matchMedia:()=>({matches:false}),addEventListener:()=>{}},setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{}};
 vm.createContext(env);for(const name of ['zhouyi','jiegua'])vm.runInContext(fs.readFileSync(path.join(ROOT,'lib',name+'.js'),'utf8'),env);
 vm.runInContext(raw.match(/<script>\s*([\s\S]*?)<\/script>/)[1].split('/* ---------- 初始化 ---------- */')[0],env);
 return {env,el};
}
const rt=load('男'),opts=[[0,0,0],[1,0,0],[1,1,0],[1,1,1]];
function cast(q,sel,state){
 const e=rt.env;rt.el('question').value=q;rt.el('yongShen').value=sel;
 e.castTime=new Date('2026-01-15T12:00:00+08:00');e.timeInfo=e.computeTimeInfo(e.castTime);
 e.yaos=Array.from({length:6},(_,i)=>e.makeYao(opts[(state>>>(2*i))&3]));
 const gua=e.analyzeGua(),r=e.buildDetailedAnalysis(gua),plain=r.sections.find(s=>s.title==='白話解讀');
 return {e,gua,r,plain,jie:e.jieguaHtml(gua)};
}
const strip=html=>html.replace(/<[^>]+>/g,'');
const conclusion=x=>(((x.plain?.items||[]).find(i=>/^結論：/.test(i.text))||{}).text||'').replace(/^結論：/,'');
const sayText=jie=>strip((jie.split('class="teach-step jie-say"')[1]||'').split('<details')[0]);
const firstParagraph=jie=>{const sec=jie.split('class="teach-step jie-say"')[1]||'';const m=/<p>([\s\S]*?)<\/p>/.exec(sec);return m?strip(m[1]):'';};
// 分析頁（白話解讀＋各專門斷法）與教學頁「本卦怎麼看」的動態文字；教學頁的通用規則、練習題不在此列
// 解卦中依這一題推出的敘述；排除只引用卦名象義、爻辭原意、宜忌與比喻的段落（它們已明說只是提醒）
const sayNarrative=jie=>((jie.split('class="teach-step jie-say"')[1]||'').split('<details')[0].match(/<p>[\s\S]*?<\/p>/g)||[]).map(strip).filter(p=>!/^(?:至於卦名|如果要我多提醒一句|用生活的畫面)|爻辭說/.test(p)).join('\n');
const analysisText=x=>x.r.sections.map(s=>(s.items||[]).map(i=>i.text).join('\n')).join('\n');
const teachingLook=x=>x.e.teachingSteps(x.gua).map(s=>[].concat(s.apply||[]).join('\n')).join('\n');
const states=[];for(let s=0;s<4096;s+=31)states.push(s);states.push(0,4095);

function fail(msg){throw new Error(msg);}
const PATIENT_RE=/病情|病重|病況|病勢|病位|剛生的病|久病|近病|拖很久的病|病纏|積極就醫|務必就醫|持續治療|好好休養|病何時好|病好|病痛/;
const DIRECTIVE_RE=/繼續進行|繼續治療|繼續服用|繼續使用|停藥|停用|停止|換藥|改用|換成|換療法|尋求其他方式|延後再做|可以積極去做|建議暫緩|另作打算|趕快去打|不要去打|不用打|一定要打/;
const INVENTED_RE=/你和對方|對方願意|對你有好感|遷就對方|談得來|關係融洽|意見不合/;
const INVENTED_ANALYSIS_RE=/你和對方|對方願意|對你有好感|遷就對方|談得來|關係融洽|對方有意助我|雙方有意|彼此不合、意見相左|壓力來自對方(?!或)|我能制住對方/;
const SOCIAL_RE=/你和對方關係融洽|你和對方容易意見不合|對方願意幫你|你付出比較多，要遷就對方|壓力主要來自對方或外在環境|你比較能掌握對方或局面/;
const NEUTRAL_RE=/外在條件|外在環境|局面/;
const WEATHER_BAD_RE=/可以積極去做|建議暫緩|延後再做|錢財方面|款項|另作打算|最壞的打算|大致順利|整體順利/;
// 就醫與否的說明（care）專用字詞：CARE_MARK_RE 是該說明的標記，其他題型的結論不能出現；
// CARE_BAD_RE 是就醫題的結論不能出現的內容（接種安排、療效、病情，或憑卦象叫人去、不去、觀察）
const CARE_MARK_RE=/不是卦象能替你決定|這一題問的是要不要看醫生/;
const CARE_BAD_RE=/是否接種|接種或用藥|副作用|實際療效|效果傾向|病情|病重|持續治療|好好休養|積極就醫|務必就醫|建議(?:你)?(?:去|先|盡快|立刻|暫緩|不要)|不用(?:看|去)|不需要(?:看|去|就醫)|不必(?:看|去)|應該去|最好(?:去|先)|趕快去|先觀察|再觀察|先不用/;
// 尋物結論的說法：對方肯不肯幫忙的題目不能套用
const LOST_ANSWER_RE=/找回來|找不回|找得回|比較難找回|很難找回|多找幾個地方|最壞的打算|找不找得回/;
const WEATHER_CLAIM_RE=/一定會(?:下雨|放晴|下雪)|必定(?:下雨|放晴|下雪)|肯定(?:下雨|放晴|下雪)|降雨機率|機率|[0-9]+\s*%/;

const records=[];
// 案例可選填 expectedAuto：自動判斷用神必須是這個值（只填沒有歧義的案例）
function record(f,fn){try{
 let auto;
 if(f.expectedAuto!==undefined){
  auto=(rt.env.inferYong(f.q,'男')||{}).value||'';
  if(auto!==f.expectedAuto)fail('自動用神應為 '+f.expectedAuto+'，實際為 '+(auto||'（未選）'));
 }
 records.push({id:f.id,kind:f.kind,q:f.q,pass:true,...(auto!==undefined?{auto}:{}),...(fn()||{})});
}catch(err){records.push({id:f.id,kind:f.kind,q:f.q,pass:false,error:String(err&&err.message||err)});}}

for(const f of cases){
 if(f.kind==='medical-matter')record(f,()=>{
  const verdicts=new Set();
  for(const state of states){
   const x=cast(f.q,f.sel,state),line=conclusion(x),at=' state='+state+' '+x.r.verdict+'：';
   verdicts.add(x.r.verdict);
   if(!line)fail('沒有結論'+at);
   if(PATIENT_RE.test(analysisText(x)))fail('分析推定患病'+at+analysisText(x).match(PATIENT_RE)[0]);
   if(PATIENT_RE.test(teachingLook(x)))fail('教學推定患病'+at+teachingLook(x).match(PATIENT_RE)[0]);
   if(PATIENT_RE.test(sayText(x.jie)))fail('解卦推定患病'+at+sayText(x.jie).match(PATIENT_RE)[0]);
   if(!/醫師|藥師|醫療專業|專業/.test(line))fail('結論沒有交代由專業評估'+at+line);
   if(DIRECTIVE_RE.test(line))fail('憑卦象指示去打、停用或繼續治療'+at+line);
   if(CARE_MARK_RE.test(line))fail('問接種或醫藥卻套用「要不要就醫」的說明'+at+line);
   const first=firstParagraph(x.jie);
   if(!first.includes('你問的是「'+f.q+'」'))fail('解卦第一段沒有先說明所問'+at);
   if(!first.includes(x.r.verdict)||!first.includes(line))fail('解卦第一段沒有先答判詞與結論'+at);
   if(!/專業意見/.test(sayText(x.jie)))fail('解卦缺少專業意見提醒'+at);
   if(/undefined|NaN/.test(x.jie+analysisText(x)))fail('出現 undefined 或 NaN'+at);
  }
  for(const need of ['吉','偏吉','偏凶（阻礙較多）','凶'])if(!verdicts.has(need))fail('掃描沒有涵蓋判詞 '+need);
  return {states:states.length};
 });
 // 問「要不要看醫生、需不需要去醫院」：主問是就醫與否，不是接種、療效或病情；
 // 卦象不能決定去不去，所以每個判詞下的結論相同，只交給實際症狀與專業評估，也不憑卦象指示去或不去、用藥。
 else if(f.kind==='care')record(f,()=>{
  const lines=new Set(),verdicts=new Set();
  for(const state of states){
   const x=cast(f.q,f.sel,state),line=conclusion(x),at=' state='+state+' '+x.r.verdict+'：';
   verdicts.add(x.r.verdict);lines.add(line);
   if(!line)fail('沒有結論'+at);
   if(!/看醫生|就醫/.test(line))fail('結論沒有對題（要不要就醫）'+at+line);
   if(!/實際症狀|實際的症狀/.test(line)||!/專業/.test(line))fail('結論沒有交代由實際症狀與專業評估'+at+line);
   if(!/不是卦象能替你決定|不能用來決定/.test(line))fail('結論沒有說明卦象不能決定要不要就醫'+at+line);
   if(CARE_BAD_RE.test(line))fail('問就醫卻回答接種、療效或病情，或憑卦象指示去與不去'+at+line);
   if(DIRECTIVE_RE.test(line))fail('憑卦象指示去打、停用或繼續治療'+at+line);
   const first=firstParagraph(x.jie);
   if(!first.includes('你問的是「'+f.q+'」'))fail('解卦第一段沒有先說明所問'+at);
   if(!first.includes(x.r.verdict)||!first.includes(line))fail('解卦第一段沒有先答判詞與結論'+at);
   if(!/專業意見/.test(sayText(x.jie)))fail('解卦缺少專業意見提醒'+at);
   const all=analysisText(x)+'\n'+teachingLook(x)+'\n'+sayText(x.jie);
   if(/是否接種或用藥|疫苗接種或用藥的事|疫苗、用藥或治療這件事本身/.test(all))fail('三分頁仍把就醫與否說成接種安排或醫藥本身'+at+all.match(/是否接種或用藥|疫苗接種或用藥的事|疫苗、用藥或治療這件事本身/)[0]);
   if(/undefined|NaN/.test(x.jie+analysisText(x)))fail('出現 undefined 或 NaN'+at);
  }
  if(lines.size!==1)fail('就醫與否的結論隨判詞變動，變成憑卦象決定：'+[...lines].join(' / '));
  for(const need of ['吉','偏吉','偏凶（阻礙較多）','凶'])if(!verdicts.has(need))fail('掃描沒有涵蓋判詞 '+need);
  return {states:states.length};
 });
 // 明說對方「願意、答應、肯不肯」幫忙：主問是對方肯不肯，失物只是請對方幫的事，不是物品找不找得回。
 else if(f.kind==='help-consent')record(f,()=>{
  let seen=0;
  for(const state of states){
   const x=cast(f.q,f.sel,state),line=conclusion(x),at=' state='+state+'：';
   if(x.e.questionCategory(f.sel)!=='')fail('主問是對方肯不肯幫忙，卻被當成「'+x.e.questionCategory(f.sel)+'」類事'+at);
   if(LOST_ANSWER_RE.test(line)||/物品|失物/.test(line))fail('結論回答的是物品找不找得回，不是對方肯不肯幫'+at+line);
   if(!/幫忙|答應|願意|協助/.test(line))fail('結論沒有回答對方肯不肯幫忙'+at+line);
   if(!firstParagraph(x.jie).includes(line))fail('解卦第一段沒有先答同一句結論'+at);
   if(x.plain.items.some(i=>SOCIAL_RE.test(i.text)))seen++;
  }
  if(!seen)fail('對方肯不肯幫忙的世應相處說明全數消失');
  return {states:states.length,seen};
 });
 else if(f.kind==='patient')record(f,()=>{
  for(const state of states){
   const x=cast(f.q,f.sel,state),line=conclusion(x),at=' state='+state+'：';
   if(CARE_MARK_RE.test(line))fail('問病況會不會好卻套用「要不要就醫」的說明'+at+line);
   if(!/病|好轉/.test(line))fail('問患者病況卻沒有病況結論'+at+line);
   if(/實際療效|疫苗|是否接種|接種或用藥|副作用的實際情況|這項醫藥|效果傾向|效果大致|效果好壞/.test(line))fail('問患者病況卻套用接種安排或醫藥效用敘述'+at+line);
   if(!firstParagraph(x.jie).includes(line))fail('解卦第一段沒有先答同一句病況結論'+at);
  }
  return {states:states.length};
 });
 else if(f.kind==='nonsocial')record(f,()=>{
  let neutral=0;
  for(const state of states){
   const x=cast(f.q,f.sel,state),all=analysisText(x),say=sayNarrative(x.jie),at=' state='+state+'：';
   const plainAll=x.plain.items.map(i=>i.text).join('\n');
   if(INVENTED_RE.test(plainAll))fail('白話解讀出現未指明對方的心理／相處敘述'+at+plainAll.match(INVENTED_RE)[0]);
   if(SOCIAL_RE.test(plainAll))fail('白話解讀把外在條件寫成對方：'+at+plainAll.match(SOCIAL_RE)[0]);
   if(SOCIAL_RE.test(say))fail('解卦把外在條件寫成對方：'+at+say.match(SOCIAL_RE)[0]);
   // 各專門斷法中的類別象義（如求財六沖的「合作易意見不合」）是事類的通用說法，只檢查會被當成對某個人心理的敘述
   if(INVENTED_ANALYSIS_RE.test(all))fail('分析出現未指明對方的心理／相處敘述'+at+all.match(INVENTED_ANALYSIS_RE)[0]);
   if(INVENTED_RE.test(say))fail('解卦出現未指明對方的心理／相處敘述'+at+say.match(INVENTED_RE)[0]);
   if(INVENTED_ANALYSIS_RE.test(teachingLook(x)))fail('教學出現未指明對方的心理／相處敘述'+at+teachingLook(x).match(INVENTED_ANALYSIS_RE)[0]);
   if(NEUTRAL_RE.test((x.plain.items.find(i=>/外在條件|外在環境|局面/.test(i.text))||{}).text||''))neutral++;
  }
  if(!/下雨|放晴|下雪/.test(f.q)&&neutral===0)fail('世應關係被整段刪除，沒有保留外在條件的中性說明');
  return {states:states.length,neutral};
 });
 else if(f.kind==='social')record(f,()=>{
  let seen=0;
  for(const state of states){
   const x=cast(f.q,f.sel,state);
   if(x.plain.items.some(i=>SOCIAL_RE.test(i.text)))seen++;
  }
  if(!seen)fail('人事題的世應相處說明全數消失');
  return {states:states.length,seen};
 });
 else if(f.kind==='weather')record(f,()=>{
  for(const state of states){
   const x=cast(f.q,f.sel,state),line=conclusion(x),say=sayText(x.jie),first=firstParagraph(x.jie),at=' state='+state+' '+x.r.verdict+'：';
   if(!/天氣|下雨|放晴|下雪|降雨|氣象/.test(line))fail('結論沒有對題'+at+line);
   if(!/氣象預報/.test(line))fail('結論沒有建議參考氣象預報'+at+line);
   if(!/通用|沒有專門|不是專門/.test(line))fail('結論沒有坦白說明通用吉凶不是晴雨判斷'+at+line);
   if(WEATHER_BAD_RE.test(line))fail('天氣主問套用做事或金流結論'+at+line);
   if(WEATHER_CLAIM_RE.test(say+analysisText(x)))fail('把通用吉凶說成一定下雨或放晴，或臆造機率'+at+(say+analysisText(x)).match(WEATHER_CLAIM_RE)[0]);
   if(!first.includes('你問的是「'+f.q+'」')||!first.includes(x.r.verdict)||!first.includes(line))fail('解卦第一段沒有先答'+at);
   if(WEATHER_BAD_RE.test(first))fail('解卦第一段套用做事結論'+at);
   if(/病情|病重|病勢/.test(say))fail('解卦出現病情敘述'+at);
   if(/undefined|NaN/.test(x.jie))fail('出現 undefined 或 NaN'+at);
  }
  return {states:states.length};
 });
 else if(f.kind==='weather-background')record(f,()=>{
  for(const state of states){
   const x=cast(f.q,f.sel,state),line=conclusion(x),at=' state='+state+'：';
   if(!/出行|行程|安全|旅遊|平安/.test(line))fail('天氣只是背景卻蓋過出行主問'+at+line);
   if(/氣象預報/.test(line))fail('出行主問被當成天氣題'+at+line);
  }
  return {states:states.length};
 });
 else records.push({id:f.id,kind:f.kind,q:f.q,pass:false,error:'未知案例類型 '+f.kind});
}
const failures=records.filter(r=>!r.pass).length;
console.log(JSON.stringify({sourceHash,tested:records.length,failures,records},null,2));
process.exitCode=failures?1:0;
