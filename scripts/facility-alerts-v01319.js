/* v0.13.19 — event-aware HQ facility alert dots */
(()=>{
  let raf=0,timer=0;
  const seenKey=kind=>`hero-extermination:v01319:${String(S?.account?.username||'local')}:${kind}`;
  const ids=rows=>[...(rows||[])].map(x=>String(x?.id||'')).filter(Boolean).sort();
  const readSeen=kind=>{try{return JSON.parse(localStorage.getItem(seenKey(kind))||'null')}catch(_){return null}};
  const writeSeen=(kind,value)=>{try{localStorage.setItem(seenKey(kind),JSON.stringify(value))}catch(_){}};
  const readyJobs=kind=>{
    const now=Date.now(),rows=kind==='craft'?(S?.craftJobs||[]):(S?.sellJobs||[]);
    return rows.filter(j=>j?.status==='ready'||(['running','queued'].includes(j?.status)&&new Date(j.finish_at).getTime()<=now));
  };
  function baseline(kind,current){if(readSeen(kind)===null){writeSeen(kind,current);return current}return readSeen(kind)||[]}
  function setDot(selector,on,count=0){
    const el=document.querySelector(selector);if(!el)return;
    el.classList.toggle('facility-has-alert',!!on);
    if(on){el.dataset.alertCount=String(Math.max(1,Number(count||1)));el.setAttribute('aria-label',`${el.querySelector('.facility-copy b')?.textContent||'시설'} · 새 알림 있음`)}
    else{delete el.dataset.alertCount;el.removeAttribute('aria-label')}
  }
  function scheduleNext(){
    clearTimeout(timer);if(!S)return;
    const now=Date.now(),times=[];
    for(const j of [...(S.craftJobs||[]),...(S.sellJobs||[])])if(['running','queued'].includes(j?.status)){const t=new Date(j.finish_at).getTime();if(Number.isFinite(t)&&t>now)times.push(t)}
    const cand=new Date(S?.player?.next_candidate_at||0).getTime();if(Number.isFinite(cand)&&cand>now)times.push(cand+2200);
    if(!times.length)return;
    const wait=Math.max(500,Math.min(86400000,Math.min(...times)-now+80));
    timer=setTimeout(()=>{apply();setTimeout(apply,2400)},wait);
  }
  function apply(){
    if(!S)return;
    const currentMonsters=ids(S.monsters),currentCandidates=ids(S.candidates);
    const seenMonsters=baseline('monsters',currentMonsters),seenCandidates=baseline('candidates',currentCandidates);
    const newMonsters=currentMonsters.filter(id=>!seenMonsters.includes(id));
    const newCandidates=currentCandidates.filter(id=>!seenCandidates.includes(id));
    const craftReady=readyJobs('craft').length,sellReady=readyJobs('sell').length;
    setDot('.facility-row.dorm',newMonsters.length>0,newMonsters.length);
    setDot('.facility-row.recruit',newCandidates.length>0,newCandidates.length);
    setDot('.facility-row.workshop',craftReady>0,craftReady);
    setDot('.facility-row.shop',sellReady>0,sellReady);
    scheduleNext();
  }
  function ack(kind){
    if(!S)return;
    if(kind==='monsters')writeSeen(kind,ids(S.monsters));
    if(kind==='candidates')writeSeen(kind,ids(S.candidates));
    requestAnimationFrame(apply);
  }
  function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;apply()})}
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-action="dorm"]'))ack('monsters');
    if(e.target.closest('[data-action="candidates"]'))ack('candidates');
    setTimeout(schedule,120);
  },true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
  const view=document.querySelector('#view');if(view)new MutationObserver(schedule).observe(view,{childList:true});
  window.refreshFacilityAlerts=schedule;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();