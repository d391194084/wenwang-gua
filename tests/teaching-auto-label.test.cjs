// A teaching origin label must not add unrelated background to the current question.
const assert=require('assert');
const {load,cast,text}=require('./teaching-guide.test.cjs');
const records=[];try{const rt=load();rt.el('yongShen').classList.contains=c=>c==='auto-picked';const q='我的工作能升職嗎',x=cast(rt,{q,sel:'官鬼',manual:false}),top=text(x.html.slice(0,x.html.indexOf('<section')));assert(top.includes(q));assert(top.includes('官鬼'));assert(/由系統依所問自動判斷/.test(top));assert(!/育嬰假|回原單位|任用/.test(top),'Auto label added background absent from the question: '+top);records.push({id:'automatic origin label preserves actual focus without importing unrelated policy examples',pass:true})}catch(e){records.push({id:'automatic origin label preserves actual focus without importing unrelated policy examples',pass:false,error:e.message})}
const failures=records.filter(x=>!x.pass).length;console.log(JSON.stringify({tested:records.length,failures,records},null,2));process.exitCode=failures?1:0;
