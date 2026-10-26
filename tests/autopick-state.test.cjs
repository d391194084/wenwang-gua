// 自動用神的狀態邊界：手動優先、重新輸入未知主體不得殘留舊選擇。
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..'),raw=fs.readFileSync(path.join(ROOT,'3-2.html'),'utf8');
const sourceHash=crypto.createHash('sha256').update(Buffer.from(raw)).digest('hex'),records=[];
function load(){
 const fields=new Map(),choices=['','世','應','父母','兄弟','子孫','妻財','官鬼'];
 function field(id){if(!fields.has(id))fields.set(id,{value:'',options:choices.map(text=>({text})),get selectedIndex(){return choices.indexOf(this.value);},classList:{contains:()=>false,toggle:()=>{}},getContext:()=>({}),addEventListener:()=>{}});return fields.get(id);}
 const env={Solar:require(path.join(ROOT,'lib/lunar.js')).Solar,Date,console,document:{getElementById:field,querySelectorAll:()=>[],querySelector:s=>({value:s.includes('gender')?'男':'0'}),documentElement:{style:{}}},window:{matchMedia:()=>({matches:false}),addEventListener:()=>{}},setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{}};
 vm.createContext(env);vm.runInContext(raw.match(/<script>\s*([\s\S]*?)<\/script>/)[1].split('/* ---------- 初始化 ---------- */')[0],env);
 return {env,field};
}
function test(id,fn){try{fn();records.push({id,pass:true});}catch(e){records.push({id,pass:false,error:e.message});}}
test('手動選擇不被明確朋友感情覆蓋',()=>{const {env,field}=load();env.yongManual=true;field('yongShen').value='父母';field('question').value='女生朋友要問自己的下一段戀情';env.autoPickYong();assert.equal(field('yongShen').value,'父母');});
test('手動狀態重置後未知朋友性別不殘留舊用神',()=>{const {env,field}=load();field('yongShen').value='父母';env.yongManual=false;field('question').value='朋友要問自己的感情何時開始';env.autoPickYong();assert.equal(field('yongShen').value,'');assert(env.yongAutoNote.includes('朋友'));});
test('清空問句並重置手動狀態後清除舊用神',()=>{const {env,field}=load();field('yongShen').value='父母';env.yongManual=false;field('question').value='';env.autoPickYong();assert.equal(field('yongShen').value,'');});
test('既有自動結果換成未知主體時清除',()=>{const {env,field}=load();field('question').value='女生朋友要問自己的下一段戀情';env.autoPickYong();assert.equal(field('yongShen').value,'官鬼');field('question').value='朋友要問自己的感情何時開始';env.autoPickYong();assert.equal(field('yongShen').value,'');});
test('起卦完成後不再自動改用神',()=>{const {env,field}=load();env.yaos=[0,0,0,0,0,0];field('yongShen').value='父母';field('question').value='女生朋友要問自己的下一段戀情';env.autoPickYong();assert.equal(field('yongShen').value,'父母');});
const failures=records.filter(r=>!r.pass).length;console.log(JSON.stringify({sourceHash,tested:records.length,failures,records},null,2));process.exitCode=failures?1:0;
