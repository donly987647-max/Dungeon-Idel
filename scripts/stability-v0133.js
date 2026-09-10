/* v0.13.12 — frontend runtime stability
 * One state poll, no legacy full-screen polling, no duplicate economy timer writer.
 * Server state patches visible DOM in place so menus do not blink or get recreated.
 */
(()=>{
  const nativeSetInterval=window.setInterval.bind(window);
  const nativeClearInterval=window.clearInterval.bind(window);
  const suppressed=new Set(['refresh','updateEconomyProgress']);
  let pollInFlight=false;
  let started=false;

  window.setInterval=function(fn,delay,...args){
    const name=typeof fn==='function'?(fn.name||''):'';
    if(suppressed.has(name)){
      window.__v01312SuppressedIntervals=window.__v01312SuppressedIntervals||{};
      window.__v01312SuppressedIntervals[name]=true;
      return -1;
    }
    return nativeSetInterval(fn,delay,...args);
  };
  window.clearInterval=function(id){if(id===-1)return;return nativeClearInterval(id)};

  const readyJobs=type=>{
    const jobs=type==='craft'?(S?.craftJobs||[]):(S?.sellJobs||[]),now=Date.now();
    return jobs.filter(j=>j.status==='ready'||(['running','queued'].includes(j.status)&&new Date(j.finish_at).getTime()<=now));
  };
  const activeJobs=type=>(type==='craft'?(S?.craftJobs||[]):(S?.sellJobs||[])).filter(j=>['running','queued'].includes(j.status));
  const siteCargoCapacity=sid=>Math.min(9000,3000+Math.max(0,(typeof activeAt==='function'?activeAt(sid).length:1)-1)*1500);

  function ensureForgeRow(){
    if(!S||screen!=='home')return;
    const stack=document.querySelector('.facility-stack');if(!stack)return;
    let row=stack.querySelector('.facility-row.forge');
    if(!row){
      row=document.createElement('button');row.className='facility-row forge';row.dataset.forgeAction='open';
      row.innerHTML='<img src="assets/icon-forge.svg" alt=""><span class="facility-copy"><b>대장간</b><small></small></span><span class="facility-side"><em>강화</em><i>›</i></span>';
      const workshop=stack.querySelector('.facility-row.workshop');if(workshop)workshop.insertAdjacentElement('afterend',row);else stack.appendChild(row);
    }
    const stoneQty=Number((S.inventory||[]).find(x=>x.item_id==='강화석')?.qty||0),text=`강화석 ${fmt(stoneQty)}개 · 장착 장비 ${(S.equipment||[]).length}개`,small=row.querySelector('.facility-copy small');
    if(small&&small.textContent!==text)small.textContent=text;
  }

  function patchHome(){
    if(!S||screen!=='home')return;ensureForgeRow();
    const cActive=activeJobs('craft').length,sActive=activeJobs('sell').length,cReady=readyJobs('craft').length,sReady=readyJobs('sell').length;
    const c=document.querySelector('.facility-row.workshop .facility-copy small'),s=document.querySelector('.facility-row.shop .facility-copy small'),dorm=document.querySelector('.facility-row.dorm .facility-copy small'),recruit=document.querySelector('.facility-row.recruit .facility-copy small'),storage=document.querySelector('.facility-row.storage .facility-copy small');
    const ct=`작업 ${cActive}/${Number(S.craftCapacity||5)}${cReady?` · 완료 ${cReady}`:''}`,st=`판매 ${sActive}/${Number(S.shopCapacity||5)}${sReady?` · 정산 ${sReady}`:''}`;
    if(c&&c.textContent!==ct)c.textContent=ct;if(s&&s.textContent!==st)s.textContent=st;
    if(dorm){const t=`${S.monsters.length}/${capacity()} 몬스터`;if(dorm.textContent!==t)dorm.textContent=t}
    if(recruit){const t=`4시간마다 ${recruitBatch()}명 · 현재 ${(S.candidates||[]).length}명`;if(recruit.textContent!==t)recruit.textContent=t}
    if(storage){const t=`${fmt(inventoryTotal())}개 보관 · ${inventoryUsed()}종`;if(storage.textContent!==t)storage.textContent=t}
  }

  function patchRoster(){
    if(!S||screen!=='monsters')return;
    document.querySelectorAll('.personnel-row[data-id]').forEach(row=>{const m=(S.monsters||[]).find(x=>x.id===row.dataset.id);if(!m)return;const e=activeOf(m.id),status=row.querySelector('.personnel-info em'),level=row.querySelector('.personnel-power i'),p=row.querySelector('.personnel-power b');row.classList.toggle('deployed',!!e);if(status)status.textContent=e?'현장 출동':'본부 대기';if(level)level.textContent=`LV.${m.level}`;if(p){const value=typeof window.forgePower==='function'?window.forgePower(m):power(m),t=fmt(value);if(p.textContent!==t)p.textContent=t}});
  }

  function patchHuntBase(){
    if(!S||screen!=='hunt')return;
    const active=(S.expeditions||[]).filter(e=>e.active),head=document.querySelector('.compact-head small');if(head){const t=`${active.length}개 파티 출동 중 · 몬스터별 자유 파견`;if(head.textContent!==t)head.textContent=t}
    document.querySelectorAll('.mission-card[data-site]').forEach(card=>{const site=(S.sites||[]).find(x=>x.id===card.dataset.site);if(!site)return;const ex=activeAt(site.id),pending=sitePending(site.id),wins=Number(site.progress?.normal_wins||0),bossReady=!!site.progress?.boss_ready,bossCleared=!!site.progress?.boss_cleared,party=ex[0]?partyOf(ex[0]):[];const op=card.querySelector('.op-state'),bar=card.querySelector('.stage-progress i'),label=card.querySelector('.stage-progress small'),collect=card.querySelector('.chapter-loot-btn strong');if(op&&ex.length){const t=`${ex[0]?.phase||'탐색'} · ${party.length}인 · 화물 ${pending}`;if(op.textContent!==t)op.textContent=t}const pct=bossCleared?100:Math.min(100,wins/500*100);if(bar)bar.style.width=pct+'%';if(label)label.textContent=bossCleared?'완료':bossReady?'500/500':`${Math.min(500,wins)}/500`;if(collect)collect.textContent=`(${fmt(pending)}/${fmt(siteCargoCapacity(site.id))})`});
  }

  function patchVisible(){
    if(!S)return;
    try{updateChrome()}catch(_){}try{updateCandidateTimer()}catch(_){}try{patchHome()}catch(_){}try{patchRoster()}catch(_){}try{patchHuntBase()}catch(_){}try{window.refreshHuntEnhancements?.()}catch(_){}try{if(watchingExpeditionId)syncWatchPanel()}catch(_){}
  }

  async function pollState(){
    if(pollInFlight||document.hidden||typeof S==='undefined'||!S||typeof session==='undefined'||!session||typeof busy!=='undefined'&&busy)return;
    pollInFlight=true;
    try{await api('state');patchVisible()}catch(err){if(err?.message==='unauthorized'){try{await sb.auth.signOut();showAuth()}catch(_){}}else{const line=document.querySelector('#briefLine');if(line)line.textContent='서버 재연결 중...'}}finally{pollInFlight=false}
  }

  function start(){
    if(started)return;started=true;document.body.classList.add('frontend-stable-v01312');
    try{const fullRender=render;render=function(){fullRender();patchVisible()}}catch(_){}
    patchVisible();nativeSetInterval(pollState,2000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)pollState()});window.__frontendPollNow=pollState;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else queueMicrotask(start);
})();
