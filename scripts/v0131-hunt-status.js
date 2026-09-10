/* v0.13.1 — clearer extermination status + explicit loot sources */
(()=>{
  let lastMissionSite=null;
  let refreshing=false;

  const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number(n||0)));
  const hpSum=o=>Object.values(o||{}).reduce((a,v)=>a+Math.max(0,Number(v||0)),0);
  const battleEnds=e=>(e?.battle_log||[]).filter(x=>x?.type==='battle-end').slice(0,6);
  const statusClass=s=>({combat:'combat',boss:'boss',danger:'danger',warn:'warn',good:'good',idle:'idle'}[s]||'idle');
  const powerState=(partyPower,recommended)=>{
    if(!partyPower)return {key:'idle',label:'파티 없음'};
    const ratio=partyPower/Math.max(1,Number(recommended||1));
    if(ratio>=1.35)return {key:'good',label:'우세'};
    if(ratio>=0.95)return {key:'good',label:'적정'};
    if(ratio>=0.70)return {key:'warn',label:'주의'};
    return {key:'danger',label:'위험'};
  };
  const percentText=n=>`${Math.round(clamp(n))}%`;

  function currentExp(siteId){
    return (S?.expeditions||[]).find(e=>e.active&&e.site_id===siteId)||null;
  }

  function missionState(site,e){
    const progress=site?.progress||{};
    if(!e){
      if(progress.boss_ready&&!progress.boss_cleared)return {key:'boss',label:'보스 대기',detail:'500/500 달성 · 보스 박멸조 편성 필요'};
      if(progress.boss_cleared)return {key:'good',label:'파밍 가능',detail:'보스 격파 완료 · 자유 파밍 중'};
      return {key:'idle',label:'출정 대기',detail:'파티를 편성해 탐사를 시작하세요.'};
    }
    const bs=e.battle_state||{},recent=battleEnds(e),last=recent[0]||{};
    if(bs.active){
      const turn=bs.turn==='party'?'몬스터 턴':'인간 턴';
      return {key:bs.boss?'boss':'combat',label:bs.boss?'보스 전투':'전투 중',detail:`${bs.enemy||'인간'} · ${turn}`};
    }
    if(last.result==='loss'){
      if(last.boss||bs.boss)return {key:'danger',label:'보스 실패',detail:`전멸 · 진행도 ${Math.min(500,Number(progress.normal_wins||0))}/500부터 재시작`};
      return {key:'warn',label:'재정비',detail:`최근 ${last.enemy||'인간'}에게 패배 · 탐사 재개 중`};
    }
    if(progress.boss_ready&&!progress.boss_cleared)return {key:'boss',label:'보스 조우 준비',detail:'다음 전투 조우는 보스전입니다.'};
    return {key:'idle',label:'탐색 중',detail:e.event_state?.text||e.phase||'주변을 탐색하고 있습니다.'};
  }

  function liveMetrics(site,e){
    const party=e?partyOf(e):[];
    const partyPower=party.reduce((a,m)=>a+power(m),0);
    const ps=powerState(partyPower,site?.recommended_power);
    const bs=e?.battle_state||{};
    const hp=bs.partyHp||{},mx=bs.partyMaxHp||{};
    const tracked=Object.keys(mx).length>0;
    const maxHp=tracked?hpSum(mx):party.reduce((a,m)=>a+monsterStats(m).hp,0);
    const curHp=tracked?hpSum(hp):maxHp;
    const alive=tracked?Object.values(hp).filter(v=>Number(v)>0).length:party.length;
    const partyHpPct=maxHp?curHp/maxHp*100:100;
    const enemyMax=Math.max(1,Number(bs.enemyMaxHp||1)),enemyCur=Math.max(0,Number(bs.enemyHp||0));
    const enemyPct=bs.active?enemyCur/enemyMax*100:0;
    const recent=battleEnds(e),wins=recent.filter(x=>x.result==='win').length,losses=recent.filter(x=>x.result==='loss').length;
    return {party,partyPower,ps,alive,partyHpPct,enemyPct,recent,wins,losses,bs};
  }

  function dashboardHtml(site,e){
    const state=missionState(site,e),m=liveMetrics(site,e),progress=site?.progress||{};
    const normalWins=Math.min(500,Number(progress.normal_wins||0));
    const bossCleared=!!progress.boss_cleared;
    const trend=m.recent.length?`최근 ${m.recent.length}전 ${m.wins}승 ${m.losses}패`:'전투 기록 없음';
    const powerRatio=m.party.length?clamp(m.partyPower/Math.max(1,Number(site.recommended_power||1))*100):0;
    return `<section class="mission-live-dashboard state-${statusClass(state.key)}">
      <div class="mission-live-top">
        <span class="mission-live-state"><i></i><b>${esc(state.label)}</b></span>
        <strong class="power-state ${m.ps.key}">${esc(m.ps.label)}</strong>
      </div>
      <p>${esc(state.detail)}</p>
      <div class="mission-live-kpis">
        <span><small>진행</small><b>${bossCleared?'CLEAR':`${normalWins}/500`}</b></span>
        <span><small>생존</small><b>${m.party.length?`${m.alive}/${m.party.length}`:'-'}</b></span>
        <span><small>최근</small><b>${esc(trend)}</b></span>
        <span><small>파티전투력</small><b>${m.party.length?fmt(m.partyPower):'-'}</b></span>
      </div>
      ${m.party.length?`<div class="live-bar-row"><span>파티 HP</span><i><em style="width:${clamp(m.partyHpPct)}%"></em></i><b>${percentText(m.partyHpPct)}</b></div>`:''}
      ${m.bs.active?`<div class="live-bar-row enemy"><span>${esc(m.bs.enemy||'적')} HP</span><i><em style="width:${clamp(m.enemyPct)}%"></em></i><b>${percentText(m.enemyPct)}</b></div>`:''}
      ${m.party.length?`<div class="live-bar-row power"><span>권장 대비</span><i><em style="width:${powerRatio}%"></em></i><b>${Math.round(m.partyPower/Math.max(1,Number(site.recommended_power||1))*100)}%</b></div>`:''}
      <div class="loot-rule-chip">장비·주요 재료는 <b>해당 적 처치 성공</b> 시에만 드롭</div>
    </section>`;
  }

  function enhanceHuntCards(){
    if(!S||screen!=='hunt')return;
    document.querySelectorAll('.mission-card[data-site]').forEach(card=>{
      const site=(S.sites||[]).find(x=>x.id===card.dataset.site);
      if(!site)return;
      const e=currentExp(site.id),html=dashboardHtml(site,e);
      let dash=card.querySelector('.mission-live-dashboard');
      if(!dash){
        const middle=card.querySelector('.mission-middle');
        middle?.insertAdjacentHTML('afterend',html);
      }else{
        const wrap=document.createElement('div');
        wrap.innerHTML=html;
        dash.replaceWith(wrap.firstElementChild);
      }
      card.classList.add('hunt-v0131-enhanced');
    });
  }

  function itemLine(l,sourceLabel){
    const d=itemDef(l.id),eq=d?.kind==='equipment';
    const qty=Number(l.min||1)===Number(l.max||1)?`${fmt(l.min||1)}개`:`${fmt(l.min||1)}~${fmt(l.max||1)}개`;
    const chance=l.source==='scavenge'?'소량 습득':dropRate(Number(l.chance||0));
    return `<div class="source-drop-item ${eq?'equipment':''}">
      <span class="source-drop-icon">${itemSvg(itemAsset(l.id))}</span>
      <span><b>${esc(l.id)}</b><small>${esc(sourceLabel)} · ${eq?esc(d?.rarity||'일반'):'재료'} · ${qty}</small></span>
      <strong>${esc(chance)}</strong>
    </div>`;
  }

  function enhanceDropPanel(){
    if(!S)return;
    const sheet=document.querySelector('#modal .mission-party-sheet');
    if(!sheet)return;
    let site=(S.sites||[]).find(x=>x.id===lastMissionSite);
    if(!site){
      const title=sheet.querySelector('.sheet-head h2')?.textContent||'';
      site=(S.sites||[]).find(x=>title.includes(x.name));
    }
    if(!site)return;
    const panel=sheet.querySelector('.drop-panel'),list=panel?.querySelector('.drop-list');
    if(!panel||!list||list.dataset.v0131==='1')return;
    const loot=site.loot||[],scavenge=loot.filter(l=>(l.source||'kill')==='scavenge'),kills=loot.filter(l=>(l.source||'kill')==='kill');
    const enemies=[...(site.enemy_names||[]),site.boss_name].filter(Boolean);
    const groups=enemies.map(enemy=>({enemy,items:kills.filter(l=>(l.enemy||'*')===enemy)})).filter(g=>g.items.length);
    const head=panel.querySelector('header');
    if(head){
      const b=head.querySelector('b'),small=head.querySelector('small'),em=head.querySelector('em');
      if(b)b.textContent='드롭 출처';
      if(small)small.textContent='바닥 습득과 적 처치 드롭을 분리 표시';
      if(em)em.textContent=`${new Set(loot.map(l=>l.id)).size}종`;
    }
    list.innerHTML=`
      <section class="loot-source-group ground"><header><b>탐색 중 바닥 줍기</b><small>전투 승리 없이도 드물게 1개씩 습득</small></header>${scavenge.map(l=>itemLine(l,'바닥 습득')).join('')||'<p class="loot-source-empty">습득 가능한 잡동사니 없음</p>'}</section>
      ${groups.map(g=>`<section class="loot-source-group ${g.enemy===site.boss_name?'boss':''}"><header><b>${esc(g.enemy)} 처치 드롭${g.enemy===site.boss_name?' · BOSS':''}</b><small>이 적을 실제로 쓰러뜨렸을 때만 판정</small></header>${g.items.map(l=>itemLine(l,g.enemy+' 처치')).join('')}</section>`).join('')}`;
    list.dataset.v0131='1';
    const note=panel.querySelector(':scope > p');
    if(note)note.innerHTML='※ 전투 패배 시 처치 드롭은 <b>0개</b>입니다. 탐색 중에는 위의 잡동사니만 낮은 확률로 습득합니다. 약탈광·수집광은 처치 드롭 확률에 보너스를 줍니다.';
  }

  function enhanceWatch(){
    const sheet=document.querySelector('#modal .battle-report-sheet');
    if(!sheet)return;
    const copy=sheet.querySelector('.battle-zone-copy span');
    if(copy&&!copy.dataset.v0131){
      copy.dataset.v0131='1';
      copy.textContent='2초마다 탐색·이동·조우 또는 전투 턴이 진행됩니다. 전투 패배 시 처치 드롭은 없으며, 보스전 전멸 시 해당 챕터 진행도가 0/500으로 초기화됩니다.';
    }
    sheet.querySelectorAll('.combat-log-row.explore em').forEach(em=>{em.textContent=em.textContent.replace('전리품','바닥 습득')});
  }

  function decorate(){enhanceHuntCards();enhanceDropPanel();enhanceWatch()}

  document.addEventListener('click',e=>{
    const mission=e.target.closest('[data-action="mission"][data-site], [data-action="mission"][data-id]');
    if(mission)lastMissionSite=mission.dataset.site||mission.dataset.id||lastMissionSite;
    const watch=e.target.closest('[data-action="watch"][data-id]');
    if(watch){const ex=(S?.expeditions||[]).find(x=>x.id===watch.dataset.id);if(ex)lastMissionSite=ex.site_id}
  },true);

  const observer=new MutationObserver(()=>requestAnimationFrame(decorate));
  observer.observe(document.body,{subtree:true,childList:true});
  setInterval(decorate,700);
  setInterval(async()=>{
    if(refreshing||document.hidden||screen!=='hunt'||!S||!session)return;
    refreshing=true;
    try{await api('state');enhanceHuntCards()}catch(_){/* next normal refresh will recover */}finally{refreshing=false}
  },3000);
  requestAnimationFrame(decorate);
})();