/* v0.13.17 — readable primary flow for monster, hunt and battle screens */
(()=>{
  const text=(el,fallback='-')=>(el?.textContent||'').trim()||fallback;
  const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function makeTabs(sheet){
    if(!sheet||sheet.dataset.readabilityTabs==='1')return;
    const profile=sheet.querySelector('.monster-profile-v10');
    if(!profile)return;
    const role=profile.querySelector(':scope > .monster-role-card');
    const skill=profile.querySelector(':scope > .unique-skill-card');
    const note=profile.querySelector(':scope > .detail-note');
    const release=sheet.querySelector(':scope > .monster-release-zone');
    const stats=profile.querySelector(':scope > .combat-stat-grid');
    const roleName=text(role?.querySelector('header b'),'기본 전투원');
    const skillName=text(skill?.querySelector('b'),'미해금');
    const statusName=text(note?.querySelector('b'),'본부 대기');

    if(stats&&!profile.querySelector('.readability-quick-summary')){
      const quick=document.createElement('div');
      quick.className='readability-quick-summary';
      quick.innerHTML=`<span><small>역할</small><b>${escapeHtml(roleName)}</b></span><span><small>핵심 스킬</small><b class="accent">${escapeHtml(skillName)}</b></span><span><small>현재 상태</small><b>${escapeHtml(statusName)}</b></span>`;
      stats.insertAdjacentElement('afterend',quick);
    }

    const wrap=document.createElement('section');
    wrap.className='readability-tabs is-collapsed';
    wrap.dataset.readabilityTabs='1';
    wrap.innerHTML=`<div class="readability-tab-bar"><button type="button" data-readability-tab="combat" aria-expanded="false">역할 · 스킬 상세</button><button type="button" data-readability-tab="manage" aria-expanded="false">기록 · 관리</button></div><div class="readability-panel" data-readability-panel="combat" hidden></div><div class="readability-panel" data-readability-panel="manage" hidden></div>`;
    const combat=wrap.querySelector('[data-readability-panel="combat"]');
    const manage=wrap.querySelector('[data-readability-panel="manage"]');
    if(role)combat.append(role);
    if(skill)combat.append(skill);
    if(note)manage.append(note);
    if(release)manage.append(release);
    const battle=sheet.querySelector(':scope > .battle-actions');
    if(battle)sheet.insertBefore(wrap,battle);else sheet.append(wrap);
    sheet.dataset.readabilityTabs='1';
  }

  function wrapCandidateDetails(sheet){
    if(!sheet||sheet.dataset.readabilityCandidate==='1')return;
    const personality=sheet.querySelector(':scope > .candidate-personality');
    const note=sheet.querySelector(':scope > .candidate-detail-note');
    if(!personality&&!note)return;
    const details=document.createElement('details');
    details.className='secondary-details candidate-secondary';
    details.innerHTML='<summary>성격 · 모집 규칙 상세</summary><div class="secondary-content"></div>';
    const content=details.querySelector('.secondary-content');
    if(personality)content.append(personality);
    if(note)content.append(note);
    const actions=sheet.querySelector(':scope > .candidate-detail-actions');
    if(actions)sheet.insertBefore(details,actions);else sheet.append(details);
    sheet.dataset.readabilityCandidate='1';
  }

  function wrapEconomyGuide(sheet){
    if(!sheet||sheet.dataset.readabilityEconomy==='1')return;
    const note=sheet.querySelector(':scope > .economy-note');
    if(!note)return;
    const details=document.createElement('details');
    details.className='secondary-details economy-secondary';
    details.innerHTML='<summary>이용 안내</summary><div class="secondary-content"></div>';
    details.querySelector('.secondary-content').append(note);
    const jobs=sheet.querySelector(':scope > .econ-job-list, :scope > .job-list');
    if(jobs)sheet.insertBefore(details,jobs);else{
      const firstList=sheet.querySelector(':scope > .recipe-list, :scope > .shop-list');
      if(firstList)sheet.insertBefore(details,firstList);else sheet.append(details);
    }
    sheet.dataset.readabilityEconomy='1';
  }

  function wrapLootRule(sheet){
    if(!sheet||sheet.dataset.readabilityLoot==='1')return;
    const chips=[...sheet.querySelectorAll('.loot-rule-chip')].filter(x=>!x.closest('.secondary-details'));
    if(!chips.length)return;
    chips.forEach(chip=>{
      const details=document.createElement('details');
      details.className='secondary-details loot-secondary';
      details.innerHTML='<summary>전리품 획득 규칙</summary><div class="secondary-content"></div>';
      chip.parentNode.insertBefore(details,chip);
      details.querySelector('.secondary-content').append(chip);
    });
    sheet.dataset.readabilityLoot='1';
  }

  function simplifyMission(sheet){
    if(!sheet||sheet.dataset.huntSimple==='1')return;
    const intel=sheet.querySelector(':scope > .chapter-intel');
    const drops=sheet.querySelector(':scope > .drop-panel');
    const head=sheet.querySelector(':scope > .sheet-head');
    if(!head||(!intel&&!drops))return;

    const tools=document.createElement('div');
    tools.className='hunt-utility-row';
    tools.innerHTML='<button type="button" class="hunt-drop-toggle" data-hunt-drop-toggle aria-expanded="false"><span>드랍률 확인</span><i>›</i></button>';
    head.insertAdjacentElement('afterend',tools);

    const drawer=document.createElement('section');
    drawer.className='hunt-drop-drawer';
    drawer.hidden=true;
    drawer.dataset.huntDropDrawer='1';
    if(drops)drawer.append(drops);
    if(intel){
      const more=document.createElement('details');
      more.className='secondary-details mission-intel-details';
      more.innerHTML='<summary>지역 세부 정보</summary><div class="secondary-content"></div>';
      more.querySelector('.secondary-content').append(intel);
      drawer.append(more);
    }
    tools.insertAdjacentElement('afterend',drawer);

    const launch=sheet.querySelector('.party-launch .primary-btn');
    if(launch){
      const boss=/보스/.test(launch.textContent||'');
      launch.textContent=boss?'보스 약탈 시작':'약탈 시작';
    }
    const partyHead=sheet.querySelector('.party-select-head b');
    if(partyHead)partyHead.textContent='출동 파티 편성';
    sheet.dataset.huntSimple='1';
  }

  function simplifyBattle(sheet){
    if(!sheet||sheet.dataset.battleSimple==='1')return;
    const scene=sheet.querySelector('#battleScene');
    const center=scene?.querySelector('.battle-center-event');
    const floats=scene?.querySelector('#liveCombatFloats');
    if(center&&floats){
      center.append(floats);
    }

    const body=sheet.querySelector('.battle-report-body');
    const summary=body?.querySelector('.battle-summary.detailed');
    const zone=body?.querySelector('.battle-zone-copy');
    const logTitle=body?.querySelector('.combat-log-title');
    const log=body?.querySelector('#liveLog');
    if(body&&summary){
      summary.classList.add('battle-primary-summary');
      const cards=[...summary.children];
      const secondary=cards.slice(3);
      const details=document.createElement('details');
      details.className='battle-secondary-details';
      details.innerHTML='<summary><span>전투 기록</span><small>세부 수치 · 행동 로그</small></summary><div class="battle-secondary-content"></div>';
      const content=details.querySelector('.battle-secondary-content');
      if(zone)content.append(zone);
      if(secondary.length){
        const extra=document.createElement('div');
        extra.className='battle-extra-stats';
        secondary.forEach(x=>extra.append(x));
        content.append(extra);
      }
      if(logTitle)content.append(logTitle);
      if(log)content.append(log);
      summary.insertAdjacentElement('afterend',details);
    }
    const alert=body?.querySelector('#liveAlert');
    if(alert)alert.setAttribute('aria-live','polite');
    sheet.dataset.battleSimple='1';
  }

  window.applyReadability=function(root){
    const sheet=root||document.querySelector('#modal > .sheet');
    if(!sheet)return;
    if(sheet.classList.contains('monster-detail-sheet-v10'))makeTabs(sheet);
    if(sheet.classList.contains('candidate-detail-sheet'))wrapCandidateDetails(sheet);
    if(sheet.classList.contains('economy-v0128-sheet'))wrapEconomyGuide(sheet);
    if(sheet.classList.contains('mission-party-sheet'))simplifyMission(sheet);
    if(sheet.classList.contains('battle-report-sheet'))simplifyBattle(sheet);
    wrapLootRule(sheet);
  };

  document.addEventListener('click',e=>{
    const huntBtn=e.target.closest('[data-hunt-drop-toggle]');
    if(huntBtn){
      e.preventDefault();
      const sheet=huntBtn.closest('.mission-party-sheet');
      const drawer=sheet?.querySelector('[data-hunt-drop-drawer]');
      if(!drawer)return;
      const open=drawer.hidden;
      drawer.hidden=!open;
      huntBtn.classList.toggle('active',open);
      huntBtn.setAttribute('aria-expanded',open?'true':'false');
      const icon=huntBtn.querySelector('i');if(icon)icon.textContent=open?'⌄':'›';
      return;
    }

    const btn=e.target.closest('[data-readability-tab]');
    if(!btn)return;
    e.preventDefault();
    const tabs=btn.closest('.readability-tabs');
    if(!tabs)return;
    const key=btn.dataset.readabilityTab;
    const already=btn.classList.contains('active');
    tabs.querySelectorAll('[data-readability-tab]').forEach(x=>{x.classList.remove('active');x.setAttribute('aria-expanded','false')});
    tabs.querySelectorAll('[data-readability-panel]').forEach(x=>x.hidden=true);
    if(already){tabs.classList.add('is-collapsed');return}
    btn.classList.add('active');btn.setAttribute('aria-expanded','true');
    const panel=tabs.querySelector(`[data-readability-panel="${key}"]`);if(panel)panel.hidden=false;
    tabs.classList.remove('is-collapsed');
  },true);
})();
