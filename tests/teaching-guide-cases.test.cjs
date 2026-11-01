// Extra positive/negative checks for the one-page teaching guide. tests/teaching-guide.test.cjs stays the acceptance baseline; this file adds case coverage.
const assert=require('assert');
const {load,cast,text,visible}=require('./teaching-guide.test.cjs');
const TITLES=['① 看哪一爻','② 看力量','③ 看幫助與阻礙','④ 對照整體判斷','⑤ 看時間'];
const sourceRE=/六爻(?:中級課程|神卦整理)|安易芳|依課程|課程講者|第\s*[0-9０-９]+(?:[、,\s–—-]+[0-9０-９]+)*\s*集|《[^》]+》|老師自己驗證|八成/;
const dateRE=/\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}|\d{1,2}月\d{1,2}日|國曆\s*\d/;
function focusOf(rt,x){const e=rt.env,roles=e.computeRoles(x.g),pick=e.pickYong(x.g,roles,x.A);
 if(pick)return {line:x.A.lines[pick.idx],fly:null,roles,pick};
 if(roles&&roles.fuYong.length){const fly=x.A.lines[roles.fuYong[0]];return {line:fly.fuA,fly,roles,pick:null};}
 return {line:x.A.lines[x.g.shi],fly:null,roles,pick:null};}
function bookCast(rt,{lines=[7,8,8,8,7,8],month='巳',day='甲子',q='官司會順利解決嗎',sel='官鬼',manual=true}={}){
 const e=rt.env,p=e.prepareBookLines({lines,monthZhi:month,dayGZ:day});rt.el('question').value=q;rt.el('yongShen').value=sel;e.yongManual=manual;
 e.yaos=p.yaos;e.timeInfo=p.timeInfo;e.castTime=null;e.bookCase={monthZhi:month,dayGZ:day};
 const g=e.analyzeGua(),A=e.assessGua(g),r=e.buildDetailedAnalysis(g);return {g,A,r,html:e.teachingHtml(g),analysis:e.analysisHtml(g),jie:e.jieguaHtml(g)};}
function cards(html){return (html.match(/<li class="guide-card">[\s\S]*?<\/li>/g)||[]).map(text);}
function run(){const records=[];const test=(id,fn)=>{try{fn();records.push({id,pass:true})}catch(e){records.push({id,pass:false,error:e.message})}};
 const topics=[['官司會順利解決嗎','官鬼'],['求財','妻財'],['我何時生產','子孫']];

 test('every sampled state renders exactly five ordered sections after the top block, with bounded visible length',()=>{const rt=load();let n=0;
  for(const [q,sel] of topics)for(let s=0;s<4096;s+=3){const x=cast(rt,{state:s,q,sel,book:s%2===0}),h=x.html;n++;
   const heads=(h.match(/<h3>[^<]*<\/h3>/g)||[]).map(t=>t.replace(/<[^>]*>/g,''));assert.deepEqual(heads,TITLES,q+'/'+s);
   const top=h.slice(0,h.indexOf('<section'));assert(top.includes(q),q+'/'+s);assert(top.includes('整體傾向：'+x.r.verdict),q+'/'+s);
   assert(visible(h).length<3600,q+'/'+s+' visible '+visible(h).length);assert(/<details\b/.test(h));}
  assert(n>1000);});

 test('focus line power is shown exactly as assessed: every scoring part, the total, the level and the day twelve-stage',()=>{const rt=load(),e=rt.env;let n=0;
  for(const [q,sel] of topics)for(let s=0;s<4096;s+=7){const x=cast(rt,{state:s,q,sel,book:s%3===0}),f=focusOf(rt,x),v=visible(x.html);n++;
   assert(v.includes('合計 '+e.signed(f.line.score)+'，判為「'+f.line.level+'」'),q+'/'+s);
   for(const p of f.line.parts)assert(v.includes(p.text+'（'+e.signed(p.delta)+'）'),q+'/'+s+' part '+p.text);
   assert(v.includes('位置是「'+f.line.stage+'」'),q+'/'+s);}
  assert(n>400);});

 test('fixed lawsuit book example: month and day factors, day twelve-stage +0.5, strength is not outcome, no vote or key-item causality',()=>{const rt=load(),x=bookCast(rt),v=visible(x.html);
  for(const s of ['月令相（月建生之）（+1.5）','帝旺於日辰子（+0.5）','合計 +2，判為「偏旺」','戌土在子日的位置是「帝旺」','整體傾向：偏凶（阻礙較多）'])assert(v.includes(s),s);
  assert(/力量「偏旺」只說這一爻自己的強弱，不能直接當成這件事順不順利、吉不吉/.test(v));assert(v.includes('兩者看的是不同層次'));
  assert(!v.includes('關鍵在於'));assert(!/助力?\s*\d+\s*(?:條|項|個)|阻力?\s*\d+\s*(?:條|項|個)|\d+\s*(?:比|對|vs)\s*\d+/.test(v));assert(!/(?:所以|因此)[^。]{0,12}(?:偏凶|判凶|整體偏)/.test(v));
  assert(v.includes('不是比條數')&&v.includes('不能只比有利或不利的項目數'));assert(v.includes('判斷依據：'));
  assert(!x.r.sections.decision,'this example has no recorded decisive special rule, so the guide must not invent one');});

 test('fixed lawsuit example does not describe a manual pick as automatic and keeps both same-kind lines visible with full labels',()=>{const rt=load(),x=bookCast(rt),v=visible(x.html),cs=cards(x.html);
  assert(v.includes('你已手動指定'));assert(!/自動判斷|自動取|系統自動/.test(v));
  const five=cs.find(t=>t.includes('五爻官鬼戌土')),three=cs.find(t=>t.includes('三爻官鬼辰土')),shi=cs.find(t=>t.includes('二爻子孫寅木'));
  assert(five&&/本次焦點/.test(five)&&/應爻/.test(five));assert(three&&/另一個同類爻/.test(three)&&!/本次焦點/.test(three));assert(shi&&/世爻/.test(shi));
  assert(/因為它持應/.test(v));assert(!/官鬼[^。]{0,20}(?:丈夫|男友|疾病|鬼神|上司)/.test(v));});

 test('hidden spirit is described as hidden under its flying line, never as the surface line itself',()=>{const rt=load();let n=0;
  for(const [q,sel] of [['求財','妻財'],['我何時生產','子孫'],['官司會順利解決嗎','官鬼']])for(let s=0;s<4096;s+=5){const x=cast(rt,{state:s,q,sel}),f=focusOf(rt,x);if(!f.fly)continue;n++;
   const v=visible(x.html),cs=cards(x.html);assert(v.includes('它藏在'+f.fly.name+'下面'),q+'/'+s);assert(v.includes('不是'+rt.env.YAO_SHORT[f.fly.idx]+'表面上的爻'),q+'/'+s);
   const card=cs.find(t=>t.includes(f.fly.name));assert(card&&card.includes('伏神'+f.line.name.slice(1))&&card.includes('這一爻本身是飛神'),q+'/'+s);
   assert(v.includes('伏神'+f.line.name.slice(1)+'：')||v.includes('伏神'+f.line.name.slice(1)),q+'/'+s);
   assert(v.includes('合計 '+rt.env.signed(f.line.score)),q+'/'+s+' hidden-spirit power');}
  assert(n>50,String(n));});

 test('yong marking never mislabels: manual, written in the question, automatic, and unknown origin stay distinct',()=>{
  let rt=load(),x=cast(rt,{state:1365,q:'我的工作能升職嗎',sel:'官鬼',manual:true}),v=visible(x.html);assert(v.includes('你已手動指定'));
  rt=load();x=cast(rt,{state:1365,q:'以官鬼為用，我的工作能升職嗎',sel:'官鬼',manual:false});v=visible(x.html);assert(v.includes('所問已寫明以它為用神'));assert(!/手動指定|自動判斷/.test(v));
  rt=load();rt.el('yongShen').classList.contains=c=>c==='auto-picked';x=cast(rt,{state:1365,q:'我的工作能升職嗎',sel:'官鬼',manual:false});v=visible(x.html);assert(v.includes('由系統依所問自動判斷；可在「所問」旁自行更改')&&!/判斷依據：/.test(v.split('① 看哪一爻')[0]));assert(!/手動指定|所問已寫明/.test(v));
  rt=load();rt.el('yongShen').classList.contains=c=>c==='auto-picked';x=cast(rt,{state:1365,q:'我的工作能升職嗎',sel:'官鬼',manual:true});v=visible(x.html);assert(v.includes('你已手動指定')&&!/自動判斷/.test(v),'manual choice wins over a stale auto-picked flag');
  rt=load();x=cast(rt,{state:1365,q:'我的工作能升職嗎',sel:'官鬼',manual:false});v=visible(x.html);assert(!/手動指定|自動判斷|所問已寫明/.test(v),'unknown origin must not claim any');
  rt=load();x=cast(rt,{state:1365,q:'',sel:'',manual:false});v=visible(x.html);assert(v.includes('你還沒選用神'));assert(!/手動指定|自動判斷/.test(v));});

 test('special conditions are visible outside the optional details and agree with the analysis and explanation pages',()=>{
  const cases=[[{state:132,q:'明天會下雨嗎',sel:'父母'},/請以氣象預報為準/],[{state:132,q:'我吃完藥可以開車嗎',sel:'世'},/藥品說明/],[{state:132,q:'我要不要去看醫生',sel:'世'},/不要只憑卦象決定/],
   [{state:80,q:'我何時生產',sel:'子孫'},/只看時間、不論吉凶/],[{state:80,q:'我何時生產',sel:'子孫'},/醫院/],[{state:849,q:'我是否懷孕',sel:'子孫'},/改看胎爻/],[{state:160,q:'我想離職',sel:'官鬼'},/反著看/],
   [{state:5,q:'我身體的病何時好',sel:'世'},/官鬼就是病/],[{state:69,q:'我和女友能走下去嗎',sel:'妻財'},/應爻（對方）/],[{state:132,q:'我的工作能升職嗎，另外官司會贏嗎',sel:'官鬼'},/一次問了多件事/]];
  for(const [o,re] of cases){const rt=load(),x=cast(rt,o),v=visible(x.html);assert(re.test(v),o.q+' '+re);
   assert(text(x.analysis).includes('整體傾向：'+x.r.verdict),o.q);assert(x.jie.includes('>'+x.r.verdict+'</div>'),o.q);assert(v.includes('整體傾向：'+x.r.verdict),o.q);}
  for(const [q,sel,re] of [['明天會下雨嗎','父母',/氣象預報/],['我吃完藥可以開車嗎','世',/藥品說明/],['我要不要去看醫生','世',/不要只憑卦象決定/]]){const rt=load(),x=cast(rt,{state:132,q,sel});assert(re.test(text(x.analysis))&&re.test(text(x.jie))&&re.test(visible(x.html)),q+' the three pages share the same limit');}});

 test('timing-only and pregnancy questions do not get invented outcome or timing wording',()=>{
  let rt=load(),x=cast(rt,{state:80,q:'我何時生產',sel:'子孫'}),v=visible(x.html);assert(v.includes('用神的現況（只當背景，不拿來斷吉凶）'));assert(!v.includes('判斷依據：'));assert(!/事終不成|看不到明確的好轉時機/.test(v));assert(/可能的出生日/.test(v));
  rt=load();x=cast(rt,{state:849,q:'我是否懷孕',sel:'子孫'});v=visible(x.html);assert(v.includes('子孫（用神）自己的旺衰只當背景'));assert(v.includes('沒有推算受孕或生產日期'));assert(!/卦中之病/.test(v),'no unresolved-problem timing claim when no timing is computed');assert(!/(?:^|[^沒])推算出(?:具體)?日期/.test(v));
  rt=load();x=cast(rt,{state:160,q:'我想離職',sel:'官鬼'});v=visible(x.html);assert(v.includes('支持這份工作的力量')&&v.includes('削弱這份工作的力量'),'resignation reverses the help and obstacle wording');assert(!/^幫助：/m.test(v));
  rt=load();x=cast(rt,{state:5,q:'我身體的病何時好',sel:'世'});v=visible(x.html);assert(v.includes('助長病情的力量')&&v.includes('壓制病情的力量（醫藥）'),'self illness reverses the help and obstacle wording');});

 test('dark movement and blocked actors are listed from the assessment; a quiet hexagram is not called free of dark movement',()=>{const rt=load();let dark=0,quiet=0,blocked=0;
  for(const [q,sel] of [['我的工作能升職嗎','官鬼'],['求財','妻財']])for(let s=0;s<4096;s+=2){const x=cast(rt,{state:s,q,sel}),v=visible(x.html);
   if(!x.g.hasMoving&&x.A.actors.length){dark++;for(const a of x.A.actors)assert(v.includes(a.label),q+'/'+s+' '+a.label);assert(/暗動/.test(v));}
   if(!x.g.hasMoving&&!x.A.actors.length){quiet++;assert(v.includes('六爻安靜不等於一定沒有暗動'),q+'/'+s);assert(!/完全沒有爻在作用|六爻安靜[^。]*沒有影響/.test(v));}
   for(const b of x.A.blocked){blocked++;assert(v.includes(b),q+'/'+s+' '+b);}}
  assert(dark>10&&quiet>10&&blocked>10,JSON.stringify({dark,quiet,blocked}));});

 test('false-empty line is described as temporarily empty, never as a guaranteed fulfilment',()=>{const rt=load();let n=0;
  for(const [q,sel] of topics)for(let s=0;s<4096;s+=3){const x=cast(rt,{state:s,q,sel}),f=focusOf(rt,x);if(!f.line.kongType||f.line.kongType.indexOf('假空')!==0)continue;n++;const v=visible(x.html);
   assert(v.includes('不保證'),q+'/'+s);for(const clause of v.split(/[。；，]/))if(/(?:一定|必定|保證)(?:會|能|可以)?(?:實現|應驗|成功)/.test(clause))assert(/不/.test(clause),q+'/'+s+' guarantee: '+clause);}
  assert(n>40,String(n));});

 test('the strength-versus-verdict remark appears only when the focus level and the existing verdict point different ways',()=>{const rt=load(),e=rt.env;let both=0,only=0;
  for(const [q,sel] of topics)for(let s=0;s<4096;s+=3){const x=cast(rt,{state:s,q,sel}),f=focusOf(rt,x),v=visible(x.html);
   const differs=(e.isStrongLv(f.line.level)&&x.r.tone==='bad')||(e.isWeakLv(f.line.level)&&x.r.tone==='good');
   assert.equal(v.includes('本卦就是這種情形'),differs,q+'/'+s);differs?both++:only++;
   assert(/不能直接當成這件事順不順利、吉不吉/.test(v),q+'/'+s);}
  assert(both>20&&only>20,JSON.stringify({both,only}));});

 test('generated source labels never appear in teaching, analysis, copy lines or the retained nine-step data; the user question stays escaped and intact',()=>{const rt=load(),e=rt.env;let n=0;
  for(const [q,sel] of [...topics,['我是否懷孕','子孫'],['我想離職','官鬼'],['我們能走下去嗎','妻財']])for(let s=0;s<4096;s+=17){const x=cast(rt,{state:s,q,sel,book:s%2===0});n++;
   for(const t of [text(x.html),text(x.analysis),e.buildAnalysisLines(x.g).join('\n'),JSON.stringify(e.teachingSteps(x.g))])assert(!sourceRE.test(t),q+'/'+s+' '+(t.match(sourceRE)||[])[0]);}
  const q='依課程第23集《卜筮正宗》與安易芳老師說"工作如何"？<img src=x onerror=alert(1)>',x=cast(rt,{q});
  for(const h of [x.html,x.analysis]){assert(text(h).includes(q));assert(!/<img\b/i.test(h));assert(h.includes('&lt;img src=x onerror=alert(1)&gt;'));}
  assert(n>200);});

 test('book mode never invents a calendar date and never reads the clock',()=>{const rt=load(),e=rt.env;
  e.Date=class extends Date{constructor(...a){if(!a.length)throw Error('today was read');super(...a)}};
  for(const [q,sel,lines] of [['官司會順利解決嗎','官鬼',[7,8,8,8,7,8]],['我何時生產','子孫',[8,7,8,7,8,7]],['求財','妻財',[9,8,8,8,7,8]]]){const x=bookCast(rt,{q,sel,lines}),v=visible(x.html);
   assert(!dateRE.test(v),q+' '+(v.match(dateRE)||[])[0]);assert(/未提供國曆/.test(v),q);assert(v.includes('巳')&&v.includes('甲子'),q);assert(!/今日|今天|本月|今年/.test(v),q);}});

 test('rendering the guide leaves the assessment, verdict and legacy nine-step API untouched',()=>{const rt=load(),e=rt.env;
  for(const [q,sel] of topics)for(const s of [0,3,80,132,341,849,1365,1430,4095]){const x=cast(rt,{state:s,q,sel}),g=x.g,key=()=>JSON.stringify([e.assessGua(g).lines.map(a=>[a.score,a.level,a.stage,a.moving,a.anDong,a.kong,a.yuePo]),e.buildDetailedAnalysis(g).verdict,e.buildDetailedAnalysis(g).sections.map(t=>t.items.map(i=>i.text))]);
   const before=key();e.teachingHtml(g);e.teachingHtml(g);assert.equal(key(),before,q+'/'+s);const st=e.teachingSteps(g);assert.equal(st.length,9);for(const t of st){assert(Array.isArray(t.apply)&&Array.isArray(t.rule)&&Array.isArray(t.pitfall)&&Array.isArray(t.quiz));}
   assert(text(x.html).includes('整體傾向：'+e.buildDetailedAnalysis(g).verdict),q+'/'+s);}});

 test('optional details hold only general rules and this case’s practice; stock quizzes about other cases are absent',()=>{const rt=load();
  for(const [q,sel] of topics)for(const s of [0,80,132,849,1365]){const x=cast(rt,{state:s,q,sel}),all=text(x.html);
   assert(!/父親的病何時好|女生問「和男友/.test(all),q+'/'+s);assert(!/丈夫.*男友.*疾病|鬼神.*上司/.test(all),q+'/'+s);
   if(!x.A.lines.some(a=>a.moving))assert(!all.includes('化進神有哪八組'),q+'/'+s+' generic practice with no moving line');}});

 test('css gives the guide a plain body font and open spacing without touching the shared card style',()=>{const raw=require('fs').readFileSync(require('path').join(__dirname,'..','3-2.html'),'utf8');
  const block=raw.match(/\.guide-text, \.guide-text \* \{[\s\S]*?\}/)[0];assert(/Microsoft JhengHei/.test(block)&&/sans-serif/.test(block));
  const body=raw.match(/\.guide-text \{[^}]*\}/)[0];const lh=+/line-height:\s*([\d.]+)/.exec(body)[1];assert(lh>=1.8,String(lh));
  assert.equal((raw.match(/(?:^|\n)\s*\.teach-step \{/g)||[]).length,1,'shared .teach-step rule must stay a single untouched rule');
  assert(/\.guide-more summary:focus-visible/.test(raw));});

 const failures=records.filter(r=>!r.pass).length;console.log(JSON.stringify({tested:records.length,failures,records},null,2));process.exitCode=failures?1:0;}
if(require.main===module)run();
