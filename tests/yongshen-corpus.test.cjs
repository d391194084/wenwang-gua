// 執行：node tests/yongshen-corpus.test.cjs [--update]
// 自動選用神語料：明確題計正確率；有分歧的題目只記錄，不計分。
// 明確題的失敗若已列在 known-failures.json 視為已知；清單外的新失敗回傳非零結束碼。
// --update：把目前的明確題失敗寫回 known-failures.json（保留原有的 status、note）。
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..'),DIR=path.join(__dirname,'yongshen-corpus');
const raw=fs.readFileSync(path.join(ROOT,'3-2.html'),'utf8');
const hash=crypto.createHash('sha256').update(Buffer.from(raw)).digest('hex');
const read=f=>JSON.parse(fs.readFileSync(path.join(DIR,f),'utf8'));
function load(){
 const code=raw.match(/<script>\s*([\s\S]*?)<\/script>/)[1].split('/* ---------- 初始化 ---------- */')[0];
 const els=new Map();
 function el(id){if(!els.has(id))els.set(id,{value:'',classList:{contains:()=>false},getContext:()=>({}),addEventListener:()=>{}});return els.get(id);}
 const {Solar}=require(path.join(ROOT,'lib/lunar.js'));
 const env={Solar,Date,console,document:{getElementById:el,querySelectorAll:()=>[],querySelector:()=>({value:''}),documentElement:{style:{}}},window:{matchMedia:()=>({matches:false}),addEventListener:()=>{}},setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{}};
 vm.createContext(env);vm.runInContext(code,env);return env;
}
const env=load();
// 與畫面相同：問句去頭尾空白，性別預設「不指定」
const pick=r=>(env.inferYong(r.q.trim(),r.gender||'')||{}).value||'-';

const clear=read('clear.json'),amb=read('ambiguous.json');
const knownList=fs.existsSync(path.join(DIR,'known-failures.json'))?read('known-failures.json'):[];
const known=new Map(knownList.map(k=>[k.q,k]));

const fails=[];let ok=0;
const bySrc={};
for(const r of clear){
 const got=pick(r),s=bySrc[r.src]||(bySrc[r.src]={tested:0,correct:0});s.tested++;
 if(got===r.yong){ok++;s.correct++;}else fails.push({q:r.q,expected:r.yong,got,why:r.why,src:r.src});
}
const pct=(a,b)=>Math.round(a*1000/b)/10;
const newFails=fails.filter(f=>!known.has(f.q));
const fixed=knownList.filter(k=>!fails.some(f=>f.q===k.q));

const ambOut={inCandidates:0,blank:0,outside:[],noCandidates:0};
for(const r of amb){
 const got=pick(r);
 if(!r.candidates.length){ambOut.noCandidates++;continue;}
 if(got==='-')ambOut.blank++;
 else if(r.candidates.includes(got))ambOut.inCandidates++;
 else ambOut.outside.push({q:r.q,got,candidates:r.candidates,why:r.why});
}

if(process.argv.includes('--update')){
 const out=fails.map(f=>{const k=known.get(f.q)||{};return {q:f.q,expected:f.expected,got:f.got,why:f.why,status:k.status||'待確認',note:k.note||''};});
 fs.writeFileSync(path.join(DIR,'known-failures.json'),'['+out.map(x=>'\n  '+JSON.stringify(x)).join(',')+'\n]\n');
}

console.log(JSON.stringify({
 sourceHash:hash,
 clear:{tested:clear.length,correct:ok,percent:pct(ok,clear.length),bySource:Object.fromEntries(Object.entries(bySrc).map(([k,v])=>[k,Object.assign(v,{percent:pct(v.correct,v.tested)})]))},
 failures:fails.length,newFailures:newFails,knownFixed:fixed.map(k=>k.q),
 ambiguous:{tested:amb.length,inCandidates:ambOut.inCandidates,blank:ambOut.blank,outside:ambOut.outside.length,noCandidates:ambOut.noCandidates,outsideList:ambOut.outside}
},null,2));
process.exitCode=newFails.length?1:0;
