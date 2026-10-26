// 執行：node tests/fortune-exhaustive.test.cjs
// 使用真實 HTML 邏輯及本地曆法；固定日期與六爻狀態核對吉凶優先級及例外。
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..'),raw=fs.readFileSync(path.join(ROOT,'3-2.html'),'utf8');
const hash=crypto.createHash('sha256').update(Buffer.from(raw)).digest('hex');
function load(){
 let code=raw.match(/<script>\s*([\s\S]*?)<\/script>/)[1].split('/* ---------- 初始化 ---------- */')[0];
 const target='return { verdict: verdict, tone: vTone, sections: sections };';assert(code.includes(target));
 code=code.replace(target,'globalThis.__debug={vScore,cat,focus,A,cr,active:A.lines.map(a=>!!active(a))}; '+target);
 const els=new Map();function el(id){if(!els.has(id))els.set(id,{value:'',classList:{contains:()=>false},getContext:()=>({}),addEventListener:()=>{}});return els.get(id);}
 const {Solar}=require(path.join(ROOT,'lib/lunar.js'));
 const env={Solar,Date,console,document:{getElementById:el,querySelectorAll:()=>[],querySelector:s=>({value:s.includes('ziMode')?'0':s.includes('gender')?'男':'auto'}),documentElement:{style:{}}},window:{matchMedia:()=>({matches:false}),addEventListener:()=>{}},setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{}};
 vm.createContext(env);vm.runInContext(code,env);return {env,el};
}

const dates=['2026-01-15T12:00:00+08:00','2026-04-15T12:00:00+08:00','2026-07-15T12:00:00+08:00','2026-10-26T12:00:00+08:00'];
const queries=[['求財','妻財'],['我的工作能升職嗎','官鬼'],['我考試能及格嗎','父母'],['我出國能成行嗎','世'],['我的手機能找回嗎','妻財'],['官司能勝訴嗎','世'],['她愛我嗎','妻財'],['我身體的病何時好','世']];
const rt=load(),coins=[[0,0,0],[1,0,0],[1,1,0],[1,1,1]],examples={};
const counts={analyses:0,secondLayerEligible:0,secondLayerRescued:0,effortOverrule:0,firstLayerEligible:0,firstLayerLost:0,inactiveActor:0,actorsMismatch:0,nonfinite:0};
function record(key,state,date,q,sel,result,d){if(!examples[key])examples[key]={state,date,q,sel,score:d.vScore,verdict:result.verdict};}
for(const date of dates){
 rt.env.castTime=new Date(date);rt.env.timeInfo=rt.env.computeTimeInfo(rt.env.castTime);
 for(let state=0;state<4096;state++)for(const [q,sel] of queries){
  rt.el('question').value=q;rt.el('yongShen').value=sel;
  rt.env.yaos=Array.from({length:6},(_,i)=>rt.env.makeYao(coins[(state>>>(2*i))&3]));
  const gua=rt.env.analyzeGua(),result=rt.env.buildDetailedAnalysis(gua),d=rt.env.__debug,f=d.focus;
  counts.analyses++;
  function fail(key){counts[key]++;record(key,state,date,q,sel,result,d);}
  if(!Number.isFinite(d.vScore)||d.A.lines.some(a=>!Number.isFinite(a.score)))fail('nonfinite');
  const ordinary=f&&!f.useless&&!f.fei?.length&&d.cat!=='病'&&d.cr.replace===null&&!d.cr.keepUseless;
  if(ordinary&&!['回頭生','回頭剋','化進神'].some(t=>f.chgTags.includes(t))&&f.mdScore>=1&&f.actKe.length>f.actSheng.length){
   counts.secondLayerEligible++;
   if(d.vScore>-1.5)fail('secondLayerRescued');
   if(result.verdict==='平（需努力，有機會）')fail('effortOverrule');
  }
  const firstLayerGood=f&&(f.chgTags.includes('回頭生')||(d.cat!=='尋'&&f.chgTags.includes('化進神')));
  if(ordinary&&d.cat!=='胎'&&firstLayerGood&&(d.cr.cap===null||d.cr.cap>=1)&&(d.cr.staticCap===null||d.cr.staticCap>=1)){
   counts.firstLayerEligible++;
   if(d.vScore<1)fail('firstLayerLost');
  }
  for(const actor of d.A.actors){
   const a=d.A.lines[actor.idx];
   if(!d.active[actor.idx])fail('inactiveActor');
   if(!a.moving&&!a.anDong)fail('actorsMismatch');
  }
 }
 console.error(JSON.stringify({completedDate:date,analyses:counts.analyses}));
}
// 一個卦例可能觸發多個檢查，failures 是違規次數，不是獨立卦例數。
const failures=['secondLayerRescued','effortOverrule','firstLayerLost','inactiveActor','actorsMismatch','nonfinite'].reduce((n,k)=>n+counts[k],0);
console.log(JSON.stringify({sourceHash:hash,dates,queries,counts,failures,examples},null,2));
process.exitCode=failures?1:0;
