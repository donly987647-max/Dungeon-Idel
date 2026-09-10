/* v0.14.2 — explicit expedition screens. No render wrappers or periodic DOM decoration. */
(()=>{
  let editor=null,working=false;
  const q=s=>document.querySelector(s);
  const activeForSite=id=>(S?.expeditions||[]).find(e=>e.active&&e.site_id===id)||null;
  const idsFor=e=>(S?.expeditionMembers||[]).filter(x=>x.expedition_id===e?.id).sort((a,b)=>a.position-b.position).map(x=>x.monster_id);
  const monster=id=>(S?.monsters||[]).find(m=>m.id===id)||null;
  const hpFor=(e,m)=>{const bs=e?.battle_state||{},max=Math.max(1,Number(bs.partyMaxHp?.[m.id]||monsterStats(m).hp)),hp=Math.max(0,Math.min(max,Number(bs.partyHp?.[m.id]??m.field_hp??max)));return {hp,max,pct:hp/max*100}};
  function slots(ids,e,locked=false){return Array.from({length:4},(_,i)=>{const m=monster(ids[i]);if(!m)return `<div class="exp-party-slot empty"><span>+</span><small>${locked?'재편 시 배치':'빈 자리'}</small></div>`;const h=hpFor(e,m);return `<div class="exp-party-slot ${h.hp===0?'down':''}" data-exp-monster="${esc(m.id)}"><span class="exp-party-avatar">${charSvg(monsterAsset(m.family),'party-sprite '+formClass(m))}</span><b>${esc(formName(m))}</b><small data-exp-hp>${h.hp===0?`회복 ${m.recovery_actions||12}행동`:`HP ${fmt(h.hp)} / ${fmt(h.max)}`}</small><i><em style="width:${h.pct}%"></em></i></div>`}).join('')}
  function showActive(siteId){
    const e=activeForSite(siteId),site=(S?.sites||[]).find(x=>x.id===siteId);if(!e||!site)return false;
    editor=null;watchingExpeditionId=null;partySite=siteId;partyPick=[];const ids=idsFor(e);
    modal(`<div class="sheet-head"><div><div class="section-kicker">현재 출동 파티</div><h2>${esc(site.name)}</h2><p>파티 ${ids.length}/4 · 던전당 최대 4명</p></div><button class="close-btn" data-action="close">×</button></div><div class="exp-active-slots">${slots(ids,e,true)}</div><p class="exp-restart-warning">탐험 중에는 즉시 충원할 수 없습니다. 파티 재편을 확정하면 현재 전투를 취소하고 새 원정으로 출발합니다.</p><div class="exp-active-status" role="status">${esc(e.phase||'탐색')}</div>${window.Campaign?.activeIntel(site,e)||''}<div class="exp-active-actions"><button class="primary-btn" data-exp-action="watch" data-site="${esc(siteId)}">전투 화면</button><button class="soft-btn" data-exp-action="edit" data-site="${esc(siteId)}">파티 재편</button><button class="soft-btn" data-exp-action="drops" data-site="${esc(siteId)}">드랍률 확인</button>${site.chapter?`<button class="danger-btn" data-action="recall" data-id="${esc(e.id)}">본부 복귀</button>`:''}</div>`,'exp-active-party-sheet');
    q('.exp-active-party-sheet').dataset.expeditionId=e.id;return true;
  }
  function showDrops(siteId){if(window.Campaign?.enabled()){Campaign.openIntel(siteId,'rewards');return}const site=(S?.sites||[]).find(x=>x.id===siteId);if(!site)return;modal(`<div class="sheet-head"><div><h2>${esc(site.name)} 드랍률</h2><p>기본 확률 · 성격과 특성 보정 전</p></div><button class="close-btn" data-action="close">×</button></div><div class="drop-list">${(site.loot||[]).map(l=>`<div class="drop-row"><span class="drop-icon">${itemSvg(itemAsset(l.id))}</span><span class="drop-name"><b>${esc(l.id)}</b><small>${esc(l.enemy||'일반 적')} · ${fmt(l.min||1)}~${fmt(l.max||1)}개</small></span><strong>${dropRate(l.chance)}</strong></div>`).join('')}</div>`,'exp-drops-sheet')}
  function openEditor(siteId){
    const e=activeForSite(siteId),site=(S?.sites||[]).find(x=>x.id===siteId);if(!e||!site){missionModal(siteId);return}
    const original=idsFor(e);editor={siteId,expeditionId:e.id,original,selected:new Set(original)};watchingExpeditionId=null;
    const rows=(S.monsters||[]).map(m=>{const active=activeOf(m.id),available=!active||active.id===e.id,sel=editor.selected.has(m.id);return `<button class="exp-edit-row ${sel?'selected':''}" data-exp-action="toggle" data-id="${m.id}" ${available?'':'disabled'}><span>${charSvg(monsterAsset(m.family),'party-sprite '+formClass(m))}</span><span><b>${esc(formName(m))} · Lv.${m.level}</b><small>${esc(roleOf(m))} · 전투력 ${fmt(power(m))}${available?'':' · 다른 던전 출동 중'}</small></span><em>${sel?'선택':available?'+':'출동 중'}</em></button>`}).join('');
    modal(`<div class="sheet-head"><div><div class="section-kicker">파티 재편</div><h2>${esc(site.name)}</h2><p>최대 4명 · 바꿀 몬스터를 선택하세요.</p></div><button class="close-btn" data-action="close">×</button></div><div class="exp-restart-warning"><b>현재 전투 취소 후 새 원정</b><p>재편을 확정하기 전까지 기존 전투는 계속됩니다. 기존 승리 진행도와 획득 전리품은 보존되고, 현재 체력과 회복 대기는 새 원정에도 이어집니다. 쓰러진 직원은 12행동 후 자동 부활합니다.</p></div><div class="exp-edit-slots">${slots(original,null)}</div><div class="exp-edit-count"><b data-exp-count>${original.length}/4</b><small>던전당 최대 4명</small></div><div class="exp-edit-list">${rows}</div><button class="primary-btn exp-redeploy-confirm" data-exp-action="confirm" disabled>구성을 변경해 주세요</button>`,'exp-reconfigure-sheet');
  }
  function updateEditor(){
    if(!editor)return;const ids=[...editor.selected],changed=JSON.stringify(ids)!==JSON.stringify(editor.original);
    const holder=q('.exp-edit-slots');if(holder)holder.innerHTML=slots(ids,null);const count=q('[data-exp-count]');if(count)count.textContent=`${ids.length}/4`;
    const btn=q('.exp-redeploy-confirm');if(btn){btn.disabled=working||!ids.length||!changed;btn.textContent=changed?'현재 전투 취소 후 재출정':'구성을 변경해 주세요'}
    document.querySelectorAll('.exp-edit-row').forEach(row=>{const sel=editor.selected.has(row.dataset.id);row.classList.toggle('selected',sel);const label=row.querySelector('em');if(label&&!row.disabled)label.textContent=sel?'선택':'+'});
  }
  async function launch(siteId,ids){
    if(working||busy||!ids.length)return;if(activeForSite(siteId)){showActive(siteId);return}
    working=true;busy=true;const btn=q('[data-action="deploy-party"]');if(btn){btn.disabled=true;btn.textContent='출정 중…'}
    try{const d=await api('deploy',{monsterIds:ids,siteId});const e=(d.state?.expeditions||S?.expeditions||[]).find(x=>x.active&&x.site_id===siteId);closeModal(true);render();if(e)watchModal(e.id);toast(`${ids.length}마리 박멸조 출정`)}catch(err){toast(errorKo(err.message));if(btn?.isConnected){btn.disabled=false;btn.textContent='약탈 시작'}}finally{working=false;busy=false}
  }
  async function confirm(){
    if(working||busy||!editor||!editor.selected.size)return;
    const edit=editor,ids=[...edit.selected];if(JSON.stringify(ids)===JSON.stringify(edit.original))return;
    working=true;busy=true;const btn=q('.exp-redeploy-confirm');if(btn){btn.disabled=true;btn.textContent='재편 처리 중…'}
    try{
      const {data,error}=await sb.rpc('game_restart_expedition',{p_expedition:edit.expeditionId,p_monsters:ids});if(error)throw error;
      if(!data?.expedition?.id||!Array.isArray(data.members))throw new Error('bad_response');
      S={...S,expeditions:[data.expedition,...(S.expeditions||[]).filter(e=>e.id!==data.expedition.id).map(e=>e.id===data.previousExpeditionId?{...e,active:false,phase:'파티 재편 · 복귀',battle_state:{...e.battle_state,active:false,result:'cancelled'}}:e)],expeditionMembers:[...(S.expeditionMembers||[]).filter(m=>m.expedition_id!==data.expedition.id),...data.members]};
      editor=null;closeModal(true);render();watchModal(data.expeditionId);toast('전투 취소 완료 · 새 파티로 탐험 시작');
    }catch(err){toast(errorKo(String(err?.message||'server_error')))}finally{working=false;busy=false;updateEditor();window.__frontendPollNow?.()}
  }
  function refresh(){
    const sheet=q('.exp-active-party-sheet');if(!sheet||!S)return;const e=(S.expeditions||[]).find(x=>x.id===sheet.dataset.expeditionId);if(!e)return;
    sheet.querySelectorAll('[data-exp-monster]').forEach(slot=>{const m=monster(slot.dataset.expMonster);if(!m)return;const h=hpFor(e,m),label=slot.querySelector('[data-exp-hp]'),bar=slot.querySelector('i>em'),text=h.hp===0?`회복 ${m.recovery_actions||12}행동`:`HP ${fmt(h.hp)} / ${fmt(h.max)}`;if(label&&label.textContent!==text)label.textContent=text;if(bar)bar.style.width=`${h.pct}%`;slot.classList.toggle('down',h.hp===0)});
    const status=sheet.querySelector('.exp-active-status');if(status)status.textContent=e.active?(e.phase||'탐색'):'원정 종료 · 파티를 다시 편성하세요';
    const edit=sheet.querySelector('[data-exp-action="edit"]');if(edit)edit.textContent=e.active?'파티 재편':'다시 편성';
  }
  document.addEventListener('click',event=>{
    const btn=event.target.closest('[data-exp-action]');if(!btn||btn.disabled)return;event.preventDefault();event.stopImmediatePropagation();
    const action=btn.dataset.expAction;if(action==='watch'){const e=activeForSite(btn.dataset.site);if(e)watchModal(e.id);return}
    if(action==='edit'){openEditor(btn.dataset.site);return}if(action==='drops'){showDrops(btn.dataset.site);return}
    if(action==='toggle'&&editor&&!working){const id=btn.dataset.id,other=activeOf(id);if(other&&other.id!==editor.expeditionId){toast('다른 던전에 출동 중입니다.');return}if(editor.selected.has(id))editor.selected.delete(id);else{if(editor.selected.size>=4){toast('파티는 최대 4명입니다.');return}editor.selected.add(id)}updateEditor();return}
    if(action==='confirm')confirm();
  },true);
  window.ExpeditionUI=Object.freeze({showActive,launch});window.refreshExpeditionPartyUI=refresh;
})();
