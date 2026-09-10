/* v0.14.1 — one active party per dungeon, direct battle launch, explicit party restart */
(()=>{
  let edit=null;
  let working=false;
  const q=s=>document.querySelector(s);
  const activeForSite=siteId=>(S?.expeditions||[]).find(e=>e.active&&e.site_id===siteId)||null;
  const partyIds=e=>(S?.expeditionMembers||[]).filter(x=>x.expedition_id===e?.id).sort((a,b)=>a.position-b.position).map(x=>x.monster_id);
  const monsterById=id=>(S?.monsters||[]).find(m=>m.id===id)||null;
  const hpOf=(e,id)=>{
    const bs=e?.battle_state||{},mx=Number(bs.partyMaxHp?.[id]||0),hp=Number(bs.partyHp?.[id] ?? mx);
    if(!mx)return {hp:null,max:null,pct:100};
    return {hp,max:mx,pct:Math.max(0,Math.min(100,Math.round(hp/mx*100)))};
  };
  const slotHtml=(m,e,emptyLocked=false)=>{
    if(!m)return `<div class="exp-party-slot empty ${emptyLocked?'locked':''}"><span>+</span><small>${emptyLocked?'재편 필요':'빈 자리'}</small></div>`;
    const h=hpOf(e,m.id),dead=h.hp===0;
    return `<div class="exp-party-slot ${dead?'down':''}"><span class="exp-party-avatar">${charSvg(monsterAsset(m.family),'party-sprite '+formClass(m))}</span><b>${esc(m.name)}</b><small>${dead?'전투불능':h.hp===null?'출동 중':`HP ${fmt(h.hp)} / ${fmt(h.max)}`}</small>${h.hp!==null?`<i><em style="width:${h.pct}%"></em></i>`:''}</div>`;
  };
  function fourSlots(ids,e,locked=false){
    const mons=ids.slice(0,4).map(monsterById).filter(Boolean),out=[];
    for(let i=0;i<4;i++)out.push(slotHtml(mons[i]||null,e,locked));
    return out.join('');
  }
  function decorateMission(){
    const sheet=q('#modal .mission-party-sheet');
    if(!sheet||!S)return;
    const siteId=typeof partySite!=='undefined'&&partySite?partySite:null;
    if(!siteId)return;
    const e=activeForSite(siteId),head=sheet.querySelector('.party-select-head'),list=sheet.querySelector('.party-select-list'),launch=sheet.querySelector('.party-launch');
    if(!e){
      if(head){const sm=head.querySelector('small');if(sm)sm.textContent=`던전당 최대 4명 · 현재 ${Array.isArray(partyPick)?partyPick.length:0}/4`;}
      return;
    }
    if(sheet.dataset.expLocked===e.id)return;
    sheet.dataset.expLocked=e.id;
    sheet.querySelector('.brief-list')?.classList.add('exp-hide-duplicate');
    const ids=partyIds(e);
    if(head)head.innerHTML='<b>현재 출동 파티</b><small>전투 중 즉시 충원 불가 · 던전당 최대 4명</small>';
    if(list){
      list.className='exp-active-party';
      list.innerHTML=`<div class="exp-active-slots">${fourSlots(ids,e,true)}</div><p>빈자리가 있어도 진행 중인 전투에 몬스터를 바로 추가할 수 없습니다. 구성 변경 시 현재 전투를 취소하고 새 파티로 탐험을 다시 시작합니다.</p>`;
    }
    if(launch){
      launch.className='exp-active-actions';
      launch.innerHTML=`<button class="primary-btn" data-exp-action="watch" data-site="${esc(siteId)}">전투 화면</button><button class="soft-btn" data-exp-action="reconfigure" data-site="${esc(siteId)}">파티 재편</button>`;
    }
  }
  function openReconfigure(siteId){
    const e=activeForSite(siteId),site=(S?.sites||[]).find(x=>x.id===siteId);if(!e||!site)return;
    edit={siteId,expeditionId:e.id,selected:new Set(partyIds(e))};
    const rows=(S.monsters||[]).map(m=>{
      const other=activeOf(m.id),available=!other||other.id===e.id,sel=edit.selected.has(m.id);
      return `<button class="exp-edit-row ${sel?'selected':''}" data-exp-action="toggle" data-id="${m.id}" ${available?'':'disabled'}><span>${charSvg(monsterAsset(m.family),'party-sprite '+formClass(m))}</span><span><b>${esc(m.name)} · Lv.${m.level}</b><small>${esc(formName(m))} · ${esc(roleOf(m))} · 전투력 ${fmt(power(m))}${available?'':' · 다른 던전 출동 중'}</small></span><em>${sel?'선택':available?'+':'출동중'}</em></button>`;
    }).join('');
    modal(`<div class="sheet-head"><div><div class="section-kicker">PARTY REDEPLOY</div><h2>${esc(site.name)} 파티 재편</h2><p>현재 전투를 종료하고 새 파티로 탐험을 다시 시작합니다.</p></div><button class="close-btn" data-action="close">×</button></div><div class="exp-restart-warning"><b>전투 중 교대 투입 불가</b><span>재편을 확정하면 지금 진행 중인 전투는 취소됩니다. 던전 승리 진행도와 이미 모은 전리품은 유지되지만, 새 파티의 탐험 HP는 최대치에서 새로 시작합니다.</span></div><div class="exp-edit-slots" data-exp-edit-slots>${fourSlots([...edit.selected],null,false)}</div><div class="exp-edit-count"><b data-exp-edit-count>${edit.selected.size}/4</b><small>최대 4명</small></div><div class="exp-edit-list">${rows}</div><button class="primary-btn exp-redeploy-confirm" data-exp-action="confirm" ${edit.selected.size?'':'disabled'}>현재 전투 취소 후 재출정</button>`,'mission-party-sheet exp-reconfigure-sheet');
  }
  function updateEditor(){
    if(!edit)return;const ids=[...edit.selected];
    const slots=q('[data-exp-edit-slots]');if(slots)slots.innerHTML=fourSlots(ids,null,false);
    const count=q('[data-exp-edit-count]');if(count)count.textContent=`${ids.length}/4`;
    q('.exp-redeploy-confirm')?.toggleAttribute('disabled',ids.length===0);
    document.querySelectorAll('.exp-edit-row[data-id]').forEach(row=>{const sel=edit.selected.has(row.dataset.id);row.classList.toggle('selected',sel);const em=row.querySelector('em');if(em&&!row.disabled)em.textContent=sel?'선택':'+';});
  }
  async function launch(siteId,ids){
    if(working||!ids.length)return;working=true;
    try{
      const d=await api('deploy',{monsterIds:ids,siteId});
      const ex=(d.state?.expeditions||S?.expeditions||[]).find(x=>x.active&&x.site_id===siteId);
      closeModal(true);render();toast(`${ids.length}마리 박멸조 출정`);if(ex)watchModal(ex.id);
    }catch(err){toast(errorKo(err.message));}
    finally{working=false;}
  }
  async function redeploy(){
    if(working||!edit||edit.selected.size<1)return;working=true;
    const siteId=edit.siteId,oldId=edit.expeditionId,ids=[...edit.selected];const btn=q('.exp-redeploy-confirm');if(btn){btn.disabled=true;btn.textContent='파티 재편 중…';}
    try{
      await api('recall',{expeditionId:oldId});
      const d=await api('deploy',{monsterIds:ids,siteId});
      const ex=(d.state?.expeditions||S?.expeditions||[]).find(x=>x.active&&x.site_id===siteId);
      edit=null;closeModal(true);render();toast('기존 전투 취소 · 새 파티로 탐험 재시작');if(ex)watchModal(ex.id);
    }catch(err){toast(errorKo(err.message));if(activeForSite(siteId))openReconfigure(siteId);else{closeModal(true);render();}}
    finally{working=false;}
  }
  document.addEventListener('click',e=>{
    const custom=e.target.closest('[data-exp-action]');
    if(custom){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      const a=custom.dataset.expAction;
      if(a==='watch'){const ex=activeForSite(custom.dataset.site);if(ex)watchModal(ex.id);return;}
      if(a==='reconfigure'){openReconfigure(custom.dataset.site);return;}
      if(a==='toggle'&&edit){const id=custom.dataset.id;if(edit.selected.has(id))edit.selected.delete(id);else{if(edit.selected.size>=4){toast('파티는 최대 4명입니다.');return;}edit.selected.add(id);}updateEditor();return;}
      if(a==='confirm'){redeploy();return;}
    }
    const deploy=e.target.closest('[data-action="deploy-party"]');
    if(deploy){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      const siteId=deploy.dataset.site,active=activeForSite(siteId);
      if(active){openReconfigure(siteId);return;}
      launch(siteId,[...(Array.isArray(partyPick)?partyPick:[])]);return;
    }
  },true);
  document.addEventListener('click',e=>{if(e.target.closest('[data-action="mission"],[data-action="toggle-party"]'))requestAnimationFrame(()=>requestAnimationFrame(decorateMission));});
  window.refreshExpeditionPartyUI=decorateMission;
})();