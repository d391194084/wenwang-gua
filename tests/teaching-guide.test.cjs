// Output-level checks for the approved one-page teaching guide. Original labels and engine tests remain unchanged.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..'),raw=fs.readFileSync(path.join(ROOT,'3-2.html'),'utf8');
function load(){
 const fields=new Map();const el=id=>{if(!fields.has(id))fields.set(id,{value:'',classList:{contains:()=>false},getContext:()=>({}),addEventListener(){}});return fields.get(id)};
 const env={Solar:require(path.join(ROOT,'lib/lunar.js')).Solar,Date,console,document:{getElementById:el,querySelectorAll:()=>[],querySelector:s=>({value:s.includes('ziMode')?'00':s.includes('gender')?'男':'auto'}),documentElement:{style:{}}},window:{matchMedia:()=>({matches:false}),addEventListener(){}},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){}};
 vm.createContext(env);for(const name of ['zhouyi','jiegua'])vm.runInContext(fs.readFileSync(path.join(ROOT,'lib',name+'.js'),'utf8'),env);
 vm.runInContext(raw.match(/<script>\s*([\s\S]*?)<\/script>/)[1].split('/* ---------- 初始化 ---------- */')[0],env);
 return {env,el};
}
function cast(rt,{state=1365,q='我的工作能升職嗎',sel='官鬼',date='2026-01-15T12:00:00+08:00',book=false,manual=true}={}){
 const e=rt.env;rt.el('question').value=q;rt.el('yongShen').value=sel;e.yongManual=manual;
 e.castTime=book?null:new Date(date);e.timeInfo=book?e.makeBookTimeInfo('巳','甲子'):e.computeTimeInfo(e.castTime);
 e.bookCase=book?{monthZhi:'巳',dayGZ:'甲子'}:null;
 const coins=[[0,0,0],[1,0,0],[1,1,0],[1,1,1]];e.yaos=Array.from({length:6},(_,i)=>e.makeYao(coins[(state>>>(2*i))&3]));
 const g=e.analyzeGua(),A=e.assessGua(g),r=e.buildDetailedAnalysis(g);return {g,A,r,html:e.teachingHtml(g),analysis:e.analysisHtml(g),jie:e.jieguaHtml(g)};
}
const text=s=>s.replace(/<[^>]*>/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
function visible(html){let depth=0,out='';for(const token of html.match(/<[^>]*>|[^<]+/g)||[]){if(/^<details\b/i.test(token)){depth++;continue}if(/^<\/details/i.test(token)){depth--;continue}if(!depth)out+=token;}return text(out);}
const sourceRE=/六爻(?:中級課程|神卦整理)|安易芳|依課程|課程講者|第\s*[0-9０-９]+(?:[、,\s–—-]+[0-9０-９]+)*\s*集|《(?:卜筮正宗|三命通會)》|老師自己驗證/;
function run(){const records=[];const test=(id,fn)=>{try{fn();records.push({id,pass:true})}catch(e){records.push({id,pass:false,error:e.message})}};
 test('one page has five clear sections with the question and existing verdict before them',()=>{const x=cast(load()),h=x.html;const titles=['看哪一爻','看力量','看幫助與阻礙','對照整體判斷','看時間'];let last=-1;for(const t of titles){const at=h.indexOf(t);assert(at>last,'missing or out of order: '+t);last=at;}const first=h.indexOf(titles[0]);assert(h.slice(0,first).includes('我的工作能升職嗎'));assert(h.slice(0,first).includes(x.r.verdict));assert(/<details\b/.test(h),'supplementary learning should be optional');assert(!/父親的病何時好|女生問「和男友/.test(text(h)),'unrelated stock quizzes');});
 test('book example preserves manual focus, both candidates, entered month/day and strength versus verdict',()=>{const rt=load(),e=rt.env;const p=e.prepareBookLines({lines:[7,8,8,8,7,8],monthZhi:'巳',dayGZ:'甲子'});rt.el('question').value='官司會順利解決嗎';rt.el('yongShen').value='官鬼';e.yongManual=true;e.yaos=p.yaos;e.timeInfo=p.timeInfo;e.castTime=null;e.bookCase={monthZhi:'巳',dayGZ:'甲子'};const g=e.analyzeGua(),r=e.buildDetailedAnalysis(g),h=e.teachingHtml(g),t=visible(h);assert.equal(r.verdict,'偏凶（阻礙較多）');for(const s of ['五爻','三爻','官鬼','偏旺','偏凶','甲子','巳'])assert(t.includes(s),s);assert(/手選|手動/.test(t));assert(/力量.{0,40}不.{0,30}(?:成敗|順利|有利|吉凶)|旺.{0,40}不.{0,30}(?:成敗|順利|有利|吉凶)/.test(t),'explain strength versus outcome');assert(!/\d{1,2}月\d{1,2}日|\d{4}-\d{2}-\d{2}/.test(t),'no invented Gregorian date');assert(/未提供國曆|沒有國曆|無國曆/.test(t));});
 test('generated source labels disappear in teaching and detailed analysis including expanded rules',()=>{for(const state of [0,3,80,132,341,849,1365,1430,4095])for(const [q,sel]of [['我的工作能升職嗎','官鬼'],['我何時生產','子孫'],['官司會順利解決嗎','官鬼']]){const x=cast(load(),{state,q,sel});for(const h of [x.html,x.analysis])assert(!sourceRE.test(text(h)),state+'/'+q+': '+text(h).match(sourceRE));}});
 test('source removal preserves the original user question including book titles and HTML-sensitive input',()=>{const q='依課程第23集《卜筮正宗》，老師說工作如何？<script>測試</script>',x=cast(load(),{q});for(const h of [x.html,x.analysis]){assert(text(h).includes(q));assert(!h.includes('<script>測試</script>'));}});
 test('dark movement and actual effect evidence is kept visible even without explicit moving lines',()=>{const x=cast(load(),{state:1430}),t=visible(x.html);assert(!x.g.hasMoving);assert(x.A.lines.some(a=>a.anDong));assert(/暗動/.test(t));assert(!/六爻安靜[^。]*沒有影響|完全沒有爻在作用/.test(t));});
 test('childbirth timing-only exception is directly visible',()=>{const x=cast(load(),{state:80,q:'我何時生產',sel:'子孫'}),t=visible(x.html);assert(t.includes(x.r.verdict));assert(/不論吉凶|只看產期/.test(t));assert(/醫院/.test(t));assert(!/事終不成|看不到明確的好轉時機/.test(t));});
 test('resignation reversal is visible alongside the existing verdict',()=>{const x=cast(load(),{state:160,q:'我想離職'}),t=visible(x.html);assert.equal(x.r.verdict,'吉');assert(t.includes('離職'));assert(/反.{0,10}看|較容易離開|容易離職/.test(t));assert(t.includes(x.r.verdict));});
 test('pending identity does not emit a completed guide or timing',()=>{const x=cast(load(),{q:'他生病會好嗎',sel:'',manual:false}),t=text(x.html);assert(t.includes('待確認')||t.includes('先確認'));assert(!t.includes('看時間'));assert(!/整體傾向：(?:吉|凶)/.test(t));});
 test('weather and medicine context keep current question limits visible',()=>{for(const [q,sel,need]of [['明天會下雨嗎','父母',/氣象預報/],['我吃完藥可以開車嗎','世',/藥品說明/]]){const x=cast(load(),{q,sel}),t=visible(x.html);assert(need.test(t),q);assert(!/病情加重|病勢嚴重/.test(t));}});
 test('visible body does not list every unrelated meaning of the chosen relative',()=>{const x=cast(load(),{q:'官司會順利解決嗎'}),t=visible(x.html);assert(!/丈夫.*男友.*疾病|鬼神.*上司/.test(t));});
 const failures=records.filter(r=>!r.pass).length;console.log(JSON.stringify({sourceHash:crypto.createHash('sha256').update(raw).digest('hex'),tested:records.length,failures,records},null,2));process.exitCode=failures?1:0;}
module.exports={load,cast,text,visible};if(require.main===module)run();
