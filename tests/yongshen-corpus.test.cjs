// 執行：node tests/yongshen-corpus.test.cjs [--update]
// 自動選用神語料：明確題計標註符合率；有分歧的題目只記錄，不計分。
// 問句、性別、預期與實際錯誤結果皆相同才視為已知；新失敗回傳非零結束碼。
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
// 同一句可有不同性別；已知錯誤也只接受原本的錯法，不能放過新的錯誤結果。
const caseKey=r=>JSON.stringify([r.q.trim(),r.gender||'']);
const failureKey=r=>JSON.stringify([caseKey(r),r.expected,r.got]);
const known=new Map(knownList.map(k=>[caseKey(k),k]));
const knownSignatures=new Set(knownList.map(failureKey));

const fails=[];let ok=0;
const bySrc={};
for(const r of clear){
 const got=pick(r),s=bySrc[r.src]||(bySrc[r.src]={tested:0,correct:0});s.tested++;
 if(got===r.yong){ok++;s.correct++;}else fails.push({q:r.q,gender:r.gender||'',expected:r.yong,got,why:r.why,src:r.src});
}
const pct=(a,b)=>Math.round(a*1000/b)/10;
const newFails=fails.filter(f=>!knownSignatures.has(failureKey(f)));
const fixed=knownList.filter(k=>clear.some(r=>caseKey(r)===caseKey(k)&&r.yong===k.expected&&pick(r)===k.expected));

const ambOut={inCandidates:0,blank:0,outside:[],noCandidates:0,noCandidatesWithSelection:0,noCandidatesBlank:0,noCandidatesList:[]};
for(const r of amb){
 const got=pick(r);
 if(!r.candidates.length){
  ambOut.noCandidates++;
  if(got==='-')ambOut.noCandidatesBlank++;else ambOut.noCandidatesWithSelection++;
  ambOut.noCandidatesList.push({q:r.q,gender:r.gender||'',got,why:r.why});continue;
 }
 if(got==='-')ambOut.blank++;
 else if(r.candidates.includes(got))ambOut.inCandidates++;
 else ambOut.outside.push({q:r.q,got,candidates:r.candidates,why:r.why});
}

if(process.argv.includes('--update')){
 const out=fails.map(f=>{const k=known.get(caseKey(f))||{};return {q:f.q,gender:f.gender,expected:f.expected,got:f.got,why:f.why,status:k.status||'待確認',note:k.note||''};});
 fs.writeFileSync(path.join(DIR,'known-failures.json'),'['+out.map(x=>'\n  '+JSON.stringify(x)).join(',')+'\n]\n');
}

console.log(JSON.stringify({
 sourceHash:hash,
 clear:{tested:clear.length,correct:ok,percent:pct(ok,clear.length),bySource:Object.fromEntries(Object.entries(bySrc).map(([k,v])=>[k,Object.assign(v,{percent:pct(v.correct,v.tested)})]))},
 failures:fails.length,newFailures:newFails,knownFixed:fixed.map(k=>k.q),knownFixedDetails:fixed.map(k=>({q:k.q,gender:k.gender||'',expected:k.expected})),
 ambiguous:{tested:amb.length,inCandidates:ambOut.inCandidates,blank:ambOut.blank,outside:ambOut.outside.length,noCandidates:ambOut.noCandidates,noCandidatesWithSelection:ambOut.noCandidatesWithSelection,noCandidatesBlank:ambOut.noCandidatesBlank,noCandidatesList:ambOut.noCandidatesList,outsideList:ambOut.outside}
},null,2));
process.exitCode=newFails.length?1:0;
