// 直接執行語料測試入口，僅替換輸入資料位置；捕捉「已知」掩蓋新錯誤與性別遺失。
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const ROOT=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(__dirname,'yongshen-corpus.test.cjs'),'utf8');
const folder=path.join(ROOT,'tmp/corpus_runner_fixtures');fs.mkdirSync(folder,{recursive:true});
function run(name,clear,known=[],ambiguous=[]){
 const dir=path.join(folder,name);fs.mkdirSync(dir,{recursive:true});
 for(const [f,d]of [['clear.json',clear],['known-failures.json',known],['ambiguous.json',ambiguous]])fs.writeFileSync(path.join(dir,f),JSON.stringify(d));
 const needle="DIR=path.join(__dirname,'yongshen-corpus')";assert(source.includes(needle));
 const script=source.replace(needle,'DIR='+JSON.stringify(dir)),output=[];
 const proc={argv:['node','test'],exitCode:0};
 vm.runInNewContext(script,{require,__dirname,Buffer,process:proc,console:{log:s=>output.push(s)}},{filename:path.join(__dirname,'yongshen-corpus.test.cjs')});
 return {data:JSON.parse(output.join('\n')),exit:proc.exitCode};
}
const records=[];function test(id,fn){try{fn();records.push({id,pass:true});}catch(e){records.push({id,pass:false,error:e.message});}}
test('同一句已知失敗改成另一錯法仍須擋下',()=>{const r=run('changed',[{q:'求財',yong:'父母',src:'test'}],[{q:'求財',expected:'父母',got:'-'}]);assert.equal(r.data.failures,1);assert.equal(r.data.newFailures.length,1);assert.equal(r.exit,1);});
test('同問句不同性別不可共用已知錯誤豁免',()=>{const r=run('gender',[{q:'我跟他會有結果嗎',gender:'女',yong:'父母',src:'test'}],[{q:'我跟他會有結果嗎',gender:'男',expected:'父母',got:'妻財'}]);assert.equal(r.data.newFailures.length,1);assert.equal(r.data.newFailures[0].gender,'女');assert.equal(r.exit,1);});
test('已知錯誤的原始錯法仍記失敗但不算新回歸',()=>{const r=run('known',[{q:'求財',yong:'父母',src:'test'}],[{q:'求財',expected:'父母',got:'妻財'}]);assert.equal(r.data.failures,1);assert.equal(r.data.newFailures.length,0);assert.equal(r.exit,0);});
test('真正修好時列出已知修復',()=>{const r=run('fixed',[{q:'求財',yong:'妻財',src:'test'}],[{q:'求財',expected:'妻財',got:'-'}]);assert(r.data.knownFixed.includes('求財'));assert.equal(r.data.failures,0);});

test('修復細項可區分同問句的男女案例',()=>{const q='我跟他會有結果嗎',r=run('fixed-gender',[{q,gender:'女',yong:'官鬼',src:'test'},{q,gender:'男',yong:'父母',src:'test'}],[{q,gender:'女',expected:'官鬼',got:'-'},{q,gender:'男',expected:'父母',got:'妻財'}]);assert.deepEqual(r.data.knownFixedDetails,[{q,gender:'女',expected:'官鬼'}]);assert.equal(r.data.failures,1);});
test('空候選也須列出自動強選或未選的結果',()=>{const r=run('unscored',[],[],[{q:'我今年運勢',candidates:[],why:'待確認'},{q:'天鵝絨',candidates:[],why:'待確認'}]);assert.equal(r.data.ambiguous.noCandidates,2);assert.equal(r.data.ambiguous.noCandidatesWithSelection,1);assert.equal(r.data.ambiguous.noCandidatesBlank,1);assert.equal(r.data.ambiguous.noCandidatesList.length,2);});
test('頭尾空白不應造成假的新回歸',()=>{const r=run('trim',[{q:' 求財 ',yong:'父母',src:'test'}],[{q:'求財',expected:'父母',got:'妻財'}]);assert.equal(r.data.newFailures.length,0);});
const failures=records.filter(r=>!r.pass).length;console.log(JSON.stringify({tested:records.length,failures,records},null,2));process.exitCode=failures?1:0;
