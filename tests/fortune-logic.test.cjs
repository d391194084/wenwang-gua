// 執行：node tests/fortune-logic.test.cjs
// 使用真實 HTML 邏輯及本地曆法；固定日期與六爻狀態核對吉凶優先級及例外。
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..'),raw=fs.readFileSync(path.join(ROOT,'3-2.html'),'utf8');
const hash=crypto.createHash('sha256').update(Buffer.from(raw)).digest('hex');
function load(){
 let code=raw.match(/<script>\s*([\s\S]*?)<\/script>/)[1].split('/* ---------- 初始化 ---------- */')[0];
 const target='return { verdict: verdict, tone: vTone, sections: sections };';assert(code.includes(target));
 code=code.replace(target,'globalThis.__debug={vScore,cat,focus,A,cr}; '+target);
 const els=new Map();function el(id){if(!els.has(id))els.set(id,{value:'',classList:{contains:()=>false},getContext:()=>({}),addEventListener:()=>{}});return els.get(id);}
 const {Solar}=require(path.join(ROOT,'lib/lunar.js'));
 const env={Solar,Date,console,document:{getElementById:el,querySelectorAll:()=>[],querySelector:s=>({value:s.includes('ziMode')?'0':s.includes('gender')?'男':'auto'}),documentElement:{style:{}}},window:{matchMedia:()=>({matches:false}),addEventListener:()=>{}},setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{}};
 vm.createContext(env);vm.runInContext(code,env);return {env,el};
}
const fixtures=[
 {id:'L2-JOB',state:147,q:'我的工作能升職嗎',sel:'官鬼',score:-1.6,verdict:'偏凶（阻礙較多）',tone:'bad'},
 {id:'L2-MONEY',state:1185,q:'求財',sel:'妻財',score:-1.6,verdict:'偏凶（阻礙較多）',tone:'bad'},
 {id:'L2-EXAM-A',state:132,q:'我考試能及格嗎',sel:'父母',score:-2.1,verdict:'偏凶（阻礙較多）',tone:'bad'},
 {id:'L2-EXAM-B',state:260,q:'我考試能及格嗎',sel:'父母',score:-1.6,verdict:'偏凶（阻礙較多）',tone:'bad'},
 {id:'L1-ADVANCE',state:161,q:'我的工作能升職嗎',sel:'官鬼',score:1,verdict:'偏吉',tone:'good'},
 {id:'L1-GEN-MONEY',state:840,q:'求財',sel:'妻財',score:1,verdict:'偏吉',tone:'good'},
 {id:'L1-GEN-JOB',state:131,q:'我的工作能升職嗎',sel:'官鬼',score:1,verdict:'偏吉',tone:'good'},
 {id:'L1-GEN-LOST',state:9,q:'尋找遺失的東西',sel:'妻財',score:1,verdict:'偏吉',tone:'good'},
 {id:'L1-ILLNESS-DIRECTION',state:264,q:'我身體的病何時好',sel:'世',score:-1,verdict:'平（成敗參半，看後續變化）',tone:''},
 {id:'L1-QUIT-DIRECTION',state:48,q:'我想離職',sel:'官鬼',score:0,verdict:'平（成敗參半，看後續變化）',tone:''},
 {id:'KEEP-EFFORT',state:3,q:'我考試能及格嗎',sel:'父母',score:-1.5,verdict:'平（需努力，有機會）',tone:''},
 {id:'KEEP-INNER-GEN',state:2265,q:'我考試能及格嗎',sel:'父母',score:4.5,verdict:'吉',tone:'good'},
 {id:'KEEP-EXAM-GATE',state:4,q:'我考試能及格嗎',sel:'父母',score:-1.6,verdict:'偏凶（阻礙較多）',tone:'bad'},
 {id:'KEEP-QUIT',state:147,q:'我想離職',sel:'官鬼',score:2.1,verdict:'偏吉',tone:'good'},
 {id:'KEEP-ILLNESS',state:296,q:'我身體的病何時好',sel:'世',score:4.5,verdict:'吉',tone:'good'},
 {id:'KEEP-L2-ILLNESS',state:147,q:'我身體的病何時好',sel:'世',score:1.6,verdict:'偏吉',tone:'good'},
 {id:'KEEP-L2-REPLACE',state:1187,q:'他喜歡我嗎',sel:'妻財',score:0,verdict:'平（成敗參半，看後續變化）',tone:''},
 {id:'KEEP-L2-BIRTH',state:1188,q:'我何時生產',sel:'子孫',score:-1.1,verdict:'應期卦（只看產期，不論吉凶）',tone:''},
 {id:'KEEP-PREG-ADVANCE',state:12,q:'老婆生產順利嗎',sel:'子孫',score:0.5,verdict:'平（成敗參半，看後續變化）',tone:''},
 {id:'KEEP-PREG-GEN',state:16,q:'老婆生產順利嗎',sel:'子孫',score:0.5,verdict:'平（成敗參半，看後續變化）',tone:''},
 {id:'KEEP-LOST-ADVANCE-A',state:329,q:'尋找遺失的東西',sel:'妻財',score:-2.5,verdict:'偏凶（阻礙較多）',tone:'bad'},
 {id:'KEEP-LOST-ADVANCE-B',state:323,q:'尋找遺失的東西',sel:'妻財',score:-4,verdict:'凶',tone:'bad'},
 {id:'KEEP-BIRTH-TIMING',state:132,q:'我何時生產',sel:'子孫',score:1,verdict:'應期卦（只看產期，不論吉凶）',tone:''},
 {id:'KEEP-INNER-CAP',state:495,date:'2026-07-15T12:00:00+08:00',q:'我考試能及格嗎',sel:'父母',score:-1.6,verdict:'偏凶（阻礙較多）',tone:'bad'}
];
const rt=load(),coins=[[0,0,0],[1,0,0],[1,1,0],[1,1,1]],records=[];let failures=0;
for(const f of fixtures){
 const date=f.date||'2026-01-15T12:00:00+08:00';rt.el('question').value=f.q;rt.el('yongShen').value=f.sel;
 rt.env.castTime=new Date(date);rt.env.timeInfo=rt.env.computeTimeInfo(rt.env.castTime);
 rt.env.yaos=Array.from({length:6},(_,i)=>rt.env.makeYao(coins[(f.state>>>(2*i))&3]));
 const gua=rt.env.analyzeGua(),result=rt.env.buildDetailedAnalysis(gua),d=rt.env.__debug;
 const actual={score:d.vScore,verdict:result.verdict,tone:result.tone},expected={score:f.score,verdict:f.verdict,tone:f.tone};
 const pass=actual.score===expected.score&&actual.verdict===expected.verdict&&actual.tone===expected.tone;
 if(!pass)failures++;
 records.push({id:f.id,q:f.q,sel:f.sel,state:f.state,date,gua:gua.mainName,changed:gua.chgName,actual,expected,pass});
}
console.log(JSON.stringify({sourceHash:hash,tested:records.length,failures,records},null,2));process.exitCode=failures?1:0;
