const RANKS=[
  {k:'SSS',name:'かみの指'},{k:'SS',name:'でんこうせっか'},{k:'S',name:'しっぷう'},
  {k:'A',name:'しゅんそく'},{k:'B',name:'いいちょうし'},{k:'C',name:'みならい'},{k:'D',name:'これから'}];
const RC=['#c78bff','#ffd23e','#ff9a3e','#ff5d6c','#5db8ff','#6ee7a0','#8b8f98'];
const MODES={
  1:{label:'1秒',bin:.1,th:[15,13,11,9,7,5]},
  5:{label:'5秒',bin:.5,th:[65,57,49,41,33,24]},
  10:{label:'10秒',bin:1,th:[125,110,95,80,64,48]},
  60:{label:'1分',bin:5,th:[660,570,480,400,320,240]}};
const SECS=[1,5,10,60];
SECS.forEach(s=>{MODES[s].th1=MODES[s].th.map(x=>Math.max(1,Math.round(x*.6)))});
const rankOf=(s,n)=>{const th=TH(s);for(let i=0;i<th.length;i++)if(n>=th[i])return i;return 6};

const TIERS=[
  {name:'ブロンズ',c:'#d08a55'},{name:'シルバー',c:'#c9cfd9'},{name:'ゴールド',c:'#ffd23e'},
  {name:'プラチナ',c:'#6ee7d8'},{name:'ダイヤ',c:'#7cb8ff'},{name:'マスター',c:'#c78bff'}];
const TSYM=['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','★'];
const BASE=[40,32,25,18,12,6,2];
const gainOf=(tier,r)=>BASE[r]-tier*4;

const KEY='renda-meter-v1';
let DB={sec:10,sound:true,h:{},lg:{tier:0,lp:0,log:[]}};
try{const s=JSON.parse(localStorage.getItem(KEY));if(s)DB=Object.assign(DB,s)}catch(e){}
['lg','lg1'].forEach(k=>{if(!DB[k]||typeof DB[k].tier!=='number')DB[k]={tier:0,lp:0,log:[]};if(!Array.isArray(DB[k].log))DB[k].log=[]});
['h','h1'].forEach(k=>{if(!DB[k])DB[k]={};SECS.forEach(s=>{if(!Array.isArray(DB[k][s]))DB[k][s]=[]})});
if(DB.style!=='one')DB.style='free';
const ONE=()=>DB.style==='one';
const HS=()=>ONE()?DB.h1:DB.h;
const LG=()=>ONE()?DB.lg1:DB.lg;
const TH=s=>ONE()?MODES[s].th1:MODES[s].th;
const LGNAME=()=>ONE()?'指一本リーグ':'レンダリーグ';
if(!MODES[DB.sec])DB.sec=10;
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(DB))}catch(e){}};
const bestOf=s=>HS()[s].reduce((m,e)=>Math.max(m,e.n),0);

const $=id=>document.getElementById(id);
const pad=$('pad'),cnt=$('count'),timeEl=$('time'),hint=$('hint'),barI=document.querySelector('#bar i');

/* ---- sound ---- */
let AC;
function ac(){if(!AC){try{AC=new(window.AudioContext||window.webkitAudioContext)()}catch(e){}}if(AC&&AC.state==='suspended')AC.resume();return AC}
function beep(f,d,type,v,slide,delay){
  if(!DB.sound)return;const a=ac();if(!a)return;
  const t=a.currentTime+(delay||0),o=a.createOscillator(),g=a.createGain();
  o.type=type||'square';o.frequency.setValueAtTime(f,t);
  if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+d);
  g.gain.setValueAtTime(v||.06,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);
  o.connect(g).connect(a.destination);o.start(t);o.stop(t+d+.03);
}
const sTap=()=>beep(1500+Math.random()*200,.035,'square',.035);
const sStart=()=>beep(880,.14,'square',.07);
const sEnd=()=>{beep(1760,.18,'square',.06);beep(1760,.4,'square',.06,null,.22)};
function sFanfare(r){
  const seq=r<=2?[523,659,784,1047,1319]:r<=4?[523,659,784]:[392,330];
  seq.forEach((f,i)=>beep(f,.22,'triangle',.12,null,i*.11));
}
function updSnd(){$('snd').textContent=DB.sound?'🔊':'🔇'}
$('styleBtn').onclick=()=>setStyle(ONE()?'free':'one');
$('snd').onclick=()=>{DB.sound=!DB.sound;save();updSnd();ac()};

/* ---- modes ---- */
function buildSeg(el,cur,fn){
  el.innerHTML='';
  SECS.forEach(s=>{const b=document.createElement('button');b.textContent=MODES[s].label;
    if(s===cur)b.className='on';b.onclick=()=>fn(s);el.appendChild(b)});
}
function buildStyles(){
  const opts=[['free','フリー'],['one','☝ 指一本']];
  document.querySelectorAll('.sstyle').forEach(el=>{el.innerHTML='';
    opts.forEach(([k,l])=>{const b=document.createElement('button');b.textContent=l;if(DB.style===k)b.className='on';
      b.onclick=()=>setStyle(k);el.appendChild(b)})});
}
function setStyle(k){if(state==='run'||DB.style===k)return;DB.style=k;save();applyStyle();reset();
  if(!$('hist').classList.contains('hidden'))renderHist();
  if(!$('league').classList.contains('hidden'))renderLeague();}
function applyStyle(){document.body.classList.toggle('one',ONE());buildStyles();
  $('styleBtn').innerHTML=(ONE()?'☝ 指一本':'✋ フリー')+'<small>タップできりかえ</small>';
  $('lTitle').textContent=LGNAME();$('rLgT').textContent=LGNAME();}
function setMode(s){if(state==='run')return;DB.sec=s;save();buildSeg($('modes'),s,setMode);reset()}

/* ---- game ---- */
let state='ready',t0=0,taps=[],raf=0;
const dur=()=>DB.sec;
function fmt(r){r=Math.max(0,r);if(dur()>=60){const m=Math.floor(r/60),s=(r-m*60).toFixed(1);return m+':'+s.padStart(4,'0')}return r.toFixed(2)}
function reset(){
  state='ready';cancelAnimationFrame(raf);taps=[];downs.clear();
  cnt.textContent='0';timeEl.textContent=fmt(dur());barI.style.transform='scaleX(1)';
  hint.textContent=ONE()?'まるをタップでスタート':'タップでスタート';hint.style.display='';pad.classList.remove('run');
  document.querySelector('.ctrl').classList.remove('lock');$('lgchip').classList.remove('lock');renderChip();
  const b=bestOf(dur());$('best').textContent=b?b+'回':'-';
  $('goal').textContent=TH(dur())[1]+'回';
}
function ripple(e,miss){
  const r=pad.getBoundingClientRect(),d=document.createElement('div');
  d.className=miss?'rip miss':'rip';d.style.left=(e.clientX-r.left)+'px';d.style.top=(e.clientY-r.top)+'px';
  d.addEventListener('animationend',()=>d.remove());pad.appendChild(d);
}
pad.addEventListener('pointerdown',e=>{
  e.preventDefault();
  if(state==='done')return;
  if(ONE()){
    const tr=tgt.getBoundingClientRect(),cx=tr.left+tr.width/2,cy=tr.top+tr.height/2;
    if(Math.hypot(e.clientX-cx,e.clientY-cy)>tr.width/2+6){ripple(e,true);return}
    const busy=downs.size>0;downs.add(e.pointerId);if(busy)return;
    tgt.animate([{transform:'scale(.86)'},{transform:'scale(1)'}],{duration:110});
  }
  const now=performance.now();
  if(state==='ready'){
    state='run';t0=now;taps=[];pad.classList.add('run');hint.style.display='none';
    document.querySelector('.ctrl').classList.add('lock');$('lgchip').classList.add('lock');sStart();raf=requestAnimationFrame(loop);
  }
  const el=(now-t0)/1000;
  if(el>dur()){finish();return}
  taps.push(el);
  cnt.textContent=taps.length;
  cnt.animate([{transform:'scale(1.09)'},{transform:'scale(1)'}],{duration:90});
  ripple(e);sTap();
},{passive:false});
const tgt=$('target'),downs=new Set();
['pointerup','pointercancel'].forEach(t=>window.addEventListener(t,e=>downs.delete(e.pointerId)));
pad.addEventListener('contextmenu',e=>e.preventDefault());
function loop(){
  const el=(performance.now()-t0)/1000;
  if(el>=dur()){finish();return}
  const rem=dur()-el;timeEl.textContent=fmt(rem);barI.style.transform='scaleX('+(rem/dur())+')';
  raf=requestAnimationFrame(loop);
}
function finish(){
  if(state!=='run')return;
  state='done';cancelAnimationFrame(raf);
  timeEl.textContent=fmt(0);barI.style.transform='scaleX(0)';
  const s=dur(),n=taps.length,r=rankOf(s,n),prev=bestOf(s);
  HS()[s].push({t:Date.now(),n,r});
  if(HS()[s].length>200)HS()[s]=HS()[s].slice(-200);
  const lr=applyLeague(r,prev>0&&n>prev);
  save();sEnd();
  if(navigator.vibrate)try{navigator.vibrate(120)}catch(e){}
  const snap=taps.slice();
  setTimeout(()=>showResult(s,n,r,prev,snap,lr),550);
}

/* ---- league ---- */
function applyLeague(r,bonus){
  const L=LG(),before={tier:L.tier,lp:L.lp};
  const d=gainOf(L.tier,r)+(bonus?5:0);
  L.lp+=d;let ev=0;
  while(L.lp>=100&&L.tier<TIERS.length-1){L.lp-=100;L.tier++;ev=1}
  if(L.lp<0){if(L.tier>0){L.tier--;L.lp+=100;ev=-1}else L.lp=0}
  L.log.push({t:Date.now(),d,tier:L.tier,lp:L.lp});
  if(L.log.length>300)L.log=L.log.slice(-300);
  return{before,d,ev,bonus};
}
const isTop=t=>t===TIERS.length-1;
const barPct=(t,lp)=>isTop(t)?100:Math.min(100,lp);
const lpText=(t,lp)=>isTop(t)?lp+' LP':lp+' / 100';
function setEmb(el,t){el.style.background=TIERS[t].c;el.textContent=TSYM[t]}
function renderChip(){
  const L=LG();setEmb($('cEmb'),L.tier);
  $('cName').textContent=(ONE()?'☝ ':'')+TIERS[L.tier].name;$('cName').style.color=TIERS[L.tier].c;
  const b=$('cBarL');b.style.background=TIERS[L.tier].c;b.style.width=barPct(L.tier,L.lp)+'%';
  $('cLp').textContent=lpText(L.tier,L.lp);
}
function sPromo(){[523,659,784,1047,784,1047,1319,1568].forEach((f,i)=>beep(f,.25,'triangle',.13,null,.9+i*.1))}
function sDemo(){[392,349,311,262].forEach((f,i)=>beep(f,.3,'triangle',.1,null,.9+i*.16))}
function showLeagueResult(lr){
  const L=LG(),t=L.tier,c=TIERS[t].c;
  setEmb($('rEmb'),t);$('rTier').textContent=TIERS[t].name;$('rTier').style.color=c;
  const dl=$('rDelta');dl.textContent=(lr.d>=0?'+':'')+lr.d+' LP'+(lr.bonus?' ✦':'');
  dl.style.color=lr.d>=0?'var(--acc)':'#ff7b86';
  const bn=$('rBanner');
  if(lr.ev===1){bn.textContent=TIERS[t].name+'リーグへ しょうかく!';bn.style.color=c;bn.style.display='';sPromo()}
  else if(lr.ev===-1){bn.textContent=TIERS[t].name+'リーグへ こうかく…';bn.style.color='#ff7b86';bn.style.display='';sDemo()}
  else bn.style.display='none';
  const bar=$('rBar');bar.style.background=c;bar.style.transition='none';
  bar.style.width=(lr.ev?0:barPct(lr.before.tier,lr.before.lp))+'%';
  bar.offsetWidth;bar.style.transition='';
  setTimeout(()=>{bar.style.width=barPct(t,L.lp)+'%'},250);
  $('rLp').textContent=lpText(t,L.lp);
}
function openLeague(){$('league').classList.remove('hidden');$('league').scrollTop=0;renderLeague()}
function renderLeague(){
  const L=LG(),t=L.tier,c=TIERS[t].c;
  setEmb($('lEmb'),t);$('lName').textContent=TIERS[t].name+'リーグ';$('lName').style.color=c;
  const b=$('lBar');b.style.background=c;b.style.width=barPct(t,L.lp)+'%';
  $('lLp').textContent=lpText(t,L.lp);
  $('lNext').textContent=isTop(t)?'さいこうリーグ!ポイントをどこまでのばせるかな':'あと '+(100-L.lp)+' LPで '+TIERS[t+1].name+'へしょうかく';
  $('lPts').innerHTML=RANKS.map((r,i)=>{const g=gainOf(t,i);
    return `<div><span style="color:${RC[i]}">${r.k}</span><small style="color:${g>=0?'var(--acc)':'#ff7b86'}">${g>=0?'+':''}${g}</small></div>`}).join('')
    +`<div><span style="color:var(--acc)">ベスト</span><small style="color:var(--acc)">+5</small></div>`;
  $('lLadder').innerHTML=TIERS.map((x,i)=>i).reverse().map(i=>{
    const cls=i===t?'tr cur':i>t?'tr lockt':'tr';
    const st=i===t?'いまここ':i<t?'クリア':'';
    return `<div class="${cls}" style="--c:${TIERS[i].c}"><span class="emb" style="background:${TIERS[i].c}">${TSYM[i]}</span><span style="color:${TIERS[i].c}">${TIERS[i].name}</span><span class="st">${st}</span></div>`}).join('');
  requestAnimationFrame(()=>drawLeague($('cLg')));
}
function drawLeague(cv){
  const{c,w,h}=setup(cv),log=LG().log.slice(-50);
  if(!log.length){c.fillStyle='#8b8f98';c.textAlign='center';c.textBaseline='middle';c.font='700 14px -apple-system,"Hiragino Sans",sans-serif';c.fillText('あそぶとグラフがでます',w/2,h/2);return}
  const v=log.map(e=>e.tier*100+e.lp);
  const lo=Math.floor(Math.min(...v)/100)*100;
  let hi=Math.max(Math.floor(Math.max(...v)/100)*100+100,lo+100);
  const L=10,R=10,T=8,B=8,pw=w-L-R,ph=h-T-B;
  const Y=x=>T+ph-(x-lo)/(hi-lo)*ph,X=i=>v.length===1?L+pw/2:L+i/(v.length-1)*pw;
  for(let y=lo;y<hi;y+=100){
    const ti=Math.min(TIERS.length-1,Math.floor(y/100)),top=isTop(ti)?hi:Math.min(hi,y+100);
    const y1=Y(top),y0=Y(y);
    c.fillStyle=TIERS[ti].c+'22';c.fillRect(L,y1,pw,y0-y1);
    c.fillStyle=TIERS[ti].c;c.font='900 11px -apple-system,"Hiragino Sans",sans-serif';c.textAlign='left';c.textBaseline='top';
    c.fillText(TIERS[ti].name,L+6,y1+4);
    if(isTop(ti))break;
  }
  c.strokeStyle='#f3f1ea';c.lineWidth=2;c.lineJoin='round';c.beginPath();
  v.forEach((x,i)=>{i?c.lineTo(X(i),Y(x)):c.moveTo(X(i),Y(x))});c.stroke();
  const li=v.length-1;c.fillStyle=TIERS[log[li].tier].c;c.beginPath();c.arc(X(li),Y(v[li]),5,0,7);c.fill();
}
$('lgchip').onclick=()=>{if(state!=='run')openLeague()};
$('lClose').onclick=()=>{$('league').classList.add('hidden');reset()};

/* ---- result ---- */
function showResult(s,n,r,prev,tp,lr){
  $('rMode').textContent=(ONE()?'☝ 指一本 ':'')+MODES[s].label+'チャレンジ';
  const rk=$('rRank');rk.textContent=RANKS[r].k;rk.className='rank'+(r===0?' sss':'');
  rk.style.color=r===0?'':RC[r];
  rk.style.animation='none';rk.offsetHeight;rk.style.animation='';
  $('rName').textContent='「'+RANKS[r].name+'」';
  $('rCount').textContent=n;
  $('rRate').textContent='1秒あたり '+(n/s).toFixed(1)+'回';
  $('rNew').style.display=(n>prev&&prev>0)||(prev===0&&n>0)?'':'none';
  $('rNext').textContent=r>0?'あと '+(TH(s)[r-1]-n)+'回で '+RANKS[r-1].k:'さいこうランク!';
  const sh=$('result');sh.classList.remove('hidden');sh.scrollTop=0;
  const btns=[$('again'),$('rHist')];btns.forEach(b=>b.classList.add('lockbtn'));
  setTimeout(()=>btns.forEach(b=>b.classList.remove('lockbtn')),700);
  requestAnimationFrame(()=>drawBars($('cBar'),tp,s));
  showLeagueResult(lr);
  setTimeout(()=>sFanfare(r),150);
}
$('again').onclick=()=>{$('result').classList.add('hidden');reset()};
$('rHist').onclick=()=>{$('result').classList.add('hidden');reset();openHist(DB.sec)};

/* ---- charts ---- */
function setup(cv){
  const dpr=window.devicePixelRatio||1,w=cv.clientWidth,h=cv.clientHeight;
  cv.width=w*dpr;cv.height=h*dpr;const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);
  c.clearRect(0,0,w,h);c.font='700 11px -apple-system,"Hiragino Sans",sans-serif';return{c,w,h};
}
function niceStep(max){const raw=max/4,p=Math.pow(10,Math.floor(Math.log10(raw))),m=raw/p;return(m<=1?1:m<=2?2:m<=5?5:10)*p}
function drawBars(cv,tp,s){
  const{c,w,h}=setup(cv),bin=MODES[s].bin,nb=Math.round(s/bin),v=new Array(nb).fill(0);
  tp.forEach(t=>{v[Math.min(nb-1,Math.floor(t/bin))]++});
  const rate=v.map(x=>x/bin),avg=tp.length/s;
  const L=34,R=8,T=10,B=22,pw=w-L-R,ph=h-T-B;
  const step=niceStep(Math.max(...rate,avg,1)*1.1),ymax=Math.ceil(Math.max(...rate,avg,1)*1.1/step)*step;
  c.textAlign='right';c.textBaseline='middle';
  for(let y=0;y<=ymax+1e-9;y+=step){const py=T+ph-y/ymax*ph;
    c.strokeStyle='#2c2f36';c.lineWidth=1;c.beginPath();c.moveTo(L,py);c.lineTo(w-R,py);c.stroke();
    c.fillStyle='#8b8f98';c.fillText(+y.toFixed(1),L-6,py)}
  const bw=pw/nb,gap=Math.min(4,bw*.2);
  rate.forEach((r,i)=>{const bh=r/ymax*ph,x=L+i*bw+gap/2,y=T+ph-bh;
    c.fillStyle='#d8ff3e';c.beginPath();
    if(c.roundRect)c.roundRect(x,y,bw-gap,bh,[3,3,0,0]);else c.rect(x,y,bw-gap,bh);c.fill()});
  const ay=T+ph-avg/ymax*ph;
  c.setLineDash([5,4]);c.strokeStyle='#f3f1ea';c.lineWidth=1.5;c.beginPath();c.moveTo(L,ay);c.lineTo(w-R,ay);c.stroke();c.setLineDash([]);
  c.textAlign='right';c.textBaseline='bottom';c.fillStyle='#f3f1ea';c.fillText('へいきん '+avg.toFixed(1),w-R-2,ay-3);
  c.textAlign='center';c.textBaseline='top';c.fillStyle='#8b8f98';
  const lab=t=>s>=60?t+'秒':(+t.toFixed(1))+'秒';
  [0,s/2,s].forEach((t,i)=>{c.textAlign=i===0?'left':i===2?'right':'center';c.fillText(lab(t),i===0?L:i===2?w-R:L+pw/2,T+ph+6)});
}
function drawHist(cv,s){
  const{c,w,h}=setup(cv),all=HS()[s],arr=all.slice(-30),th=TH(s);
  if(!arr.length){c.fillStyle='#8b8f98';c.textAlign='center';c.textBaseline='middle';c.font='700 14px -apple-system,"Hiragino Sans",sans-serif';c.fillText('まだきろくがありません',w/2,h/2);return}
  const L=40,R=12,T=10,B=22,pw=w-L-R,ph=h-T-B;
  const mx=Math.max(...arr.map(e=>e.n)),ymax=Math.max(th[0],mx)*1.08;
  const Y=n=>T+ph-n/ymax*ph,X=i=>arr.length===1?L+pw/2:L+i/(arr.length-1)*pw;
  c.textAlign='right';c.textBaseline='middle';
  th.forEach((t,i)=>{const py=Y(t);
    c.strokeStyle=RC[i]+'55';c.lineWidth=1;c.setLineDash([4,4]);c.beginPath();c.moveTo(L,py);c.lineTo(w-R,py);c.stroke();c.setLineDash([]);
    c.fillStyle=RC[i];c.font='900 11px -apple-system,"Hiragino Sans",sans-serif';c.fillText(RANKS[i].k,L-6,py)});
  c.strokeStyle='#2c2f36';c.beginPath();c.moveTo(L,T+ph);c.lineTo(w-R,T+ph);c.stroke();
  c.strokeStyle='#f3f1ea';c.lineWidth=2;c.lineJoin='round';c.beginPath();
  arr.forEach((e,i)=>{i?c.lineTo(X(i),Y(e.n)):c.moveTo(X(i),Y(e.n))});c.stroke();
  arr.forEach((e,i)=>{c.fillStyle=RC[e.r];c.beginPath();c.arc(X(i),Y(e.n),4.5,0,7);c.fill();
    c.strokeStyle='#1c1e23';c.lineWidth=1.5;c.stroke()});
  c.fillStyle='#8b8f98';c.font='700 11px -apple-system,"Hiragino Sans",sans-serif';c.textBaseline='top';
  const first=all.length-arr.length+1;
  c.textAlign='left';c.fillText(first+'回目',L,T+ph+6);
  if(arr.length>1){c.textAlign='right';c.fillText(all.length+'回目',w-R,T+ph+6)}
}

/* ---- history ---- */
let hSec=10;
function openHist(s){hSec=s;$('hist').classList.remove('hidden');$('hist').scrollTop=0;renderHist()}
function renderHist(){
  buildSeg($('hModes'),hSec,s=>{hSec=s;renderHist()});
  const a=HS()[hSec];
  $('sBest').textContent=a.length?bestOf(hSec):'-';
  $('sAvg').textContent=a.length?(a.reduce((m,e)=>m+e.n,0)/a.length).toFixed(1):'-';
  $('sCnt').textContent=a.length;
  requestAnimationFrame(()=>drawHist($('cHist'),hSec));
  const th=MODES[hSec].th;
  $('table').innerHTML=RANKS.map((r,i)=>`<div class="trow"><span class="k" style="color:${RC[i]}">${r.k}</span>${r.name}<span class="v">${i<6?th[i]+'〜':'〜'+(th[5]-1)}</span></div>`).join('');
  const rec=a.slice(-10).reverse();
  $('recent').innerHTML=rec.length?rec.map(e=>{const d=new Date(e.t);
    return `<div class="rec"><span class="k" style="color:${RC[e.r]}">${RANKS[e.r].k}</span><span class="n">${e.n}回</span><span class="d">${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}</span></div>`}).join('')
    :'<div class="empty">まだきろくがありません</div>';
}
$('toHist').onclick=()=>{if(state!=='run')openHist(DB.sec)};
$('hClose').onclick=()=>{$('hist').classList.add('hidden');reset()};
let clrT=0;
$('hClear').onclick=()=>{const b=$('hClear');
  if(!b.dataset.arm){b.dataset.arm=1;b.textContent='もういちど押すとけします';clearTimeout(clrT);
    clrT=setTimeout(()=>{delete b.dataset.arm;b.textContent='この時間のきろくをけす'},3000);return}
  delete b.dataset.arm;b.textContent='この時間のきろくをけす';HS()[hSec]=[];save();renderHist()};
window.addEventListener('resize',()=>{if(!$('hist').classList.contains('hidden'))drawHist($('cHist'),hSec)});

buildSeg($('modes'),DB.sec,setMode);updSnd();applyStyle();reset();
