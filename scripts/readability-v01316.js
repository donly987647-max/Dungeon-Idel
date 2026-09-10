/* v0.13.16 — event-driven information hierarchy */
(()=>{
  const text=(el,fallback='-')=>(el?.textContent||'').trim()||fallback;

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

  function escapeHtml(v){
    return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  window.applyReadability=function(root){
    const sheet=root||document.querySelector('#modal > .sheet');
    if(!sheet)return;
    if(sheet.classList.contains('monster-detail-sheet-v10'))makeTabs(sheet);
    if(sheet.classList.contains('candidate-detail-sheet'))wrapCandidateDetails(sheet);
    if(sheet.classList.contains('economy-v0128-sheet'))wrapEconomyGuide(sheet);
    wrapLootRule(sheet);
  };

  document.addEventListener('click',e=>{
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
