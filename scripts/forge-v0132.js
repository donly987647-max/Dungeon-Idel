/* v0.13.12 — Blacksmith / event-driven fast enhancement loop */
(()=>{
  const MAX_ENHANCE=10;
  const SLOT_ORDER=['weapon','armor','accessory'];
  const enhancing=new Set();
  let lastStock=[];
  let decorateRaf=0;

  const profile=level=>{
    const lv=Math.max(0,Math.min(9,Number(level||0)));
    return [
      {cost:1, success:1.00,fail:0,down:0,destroy:0},
      {cost:2, success:.85,fail:.15,down:0,destroy:0},
      {cost:3, success:.75,fail:.25,down:0,destroy:0},
      {cost:4, success:.65,fail:.28,down:.07,destroy:0},
      {cost:6, success:.55,fail:.28,down:.12,destroy:.05},
      {cost:8, success:.47,fail:.31,down:.15,destroy:.07},
      {cost:11,success:.39,fail:.33,down:.19,destroy:.09},
      {cost:15,success:.32,fail:.34,down:.22,destroy:.12},
      {cost:20,success:.25,fail:.34,down:.26,destroy:.15},
      {cost:28,success:.18,fail:.34,down:.30,destroy:.18}
    ][lv];
  };
  const rate=n=>`${Math.round(Number(n||0)*100)}%`;
  const enhanceMul=lv=>1+Math.max(0,Number(lv||0))*.08;
  const stones=()=>Number((S?.inventory||[]).find(x=>x.item_id==='강화석')?.qty||0);
  const currentGear=(mid,slot)=>(S?.equipment||[]).find(x=>x.monster_id===mid&&x.slot===slot)||null;
  const monster=id=>(S?.monsters||[]).find(x=>x.id===id)||null;
  const gearKey=(mid,slot)=>`${mid}:${slot}`;

  function enhancedStats(m){
    const eq=equippedFor(m.id).map(row=>({row,d:itemDef(row.item_id)})).filter(x=>x.d);
    const sum=k=>eq.reduce((a,x)=>a+Number(x.d[k]||0)*enhanceMul(x.row.enhance_level),0);
    const p=m.personality||'침착',tr=m.trait||'',g=growthMul(m),lv=Math.max(1,Number(m.level||1));
    let st={
      hp:Math.round(Number(m.hp_base||120)+(lv-1)*9*g+Math.max(0,Number(m.talent||80)-80)*2+sum('hp')),
      atk:Number(m.atk_base||18)+(lv-1)*2*g+Math.max(0,Number(m.talent||80)-80)*.22+sum('atk'),
      def:Number(m.def_base||8)+(lv-1)*.8*g+sum('def'),
      spd:Number(m.spd_base||10)+(lv-1)*.18*g+sum('spd'),
      crit:Number(m.crit_base||.05)+sum('crit'),
      evade:Number(m.evade_base||.03)+sum('evade'),
      human:sum('human_damage')
    };
    if(tr==='질긴 가죽')st.def*=1.10;else if(tr==='재빠름'){st.spd*=1.08;st.evade+=.02}
    if(p==='광전사'){st.atk*=1.15;st.def*=.90;st.crit+=.05}
    else if(p==='겁쟁이'){st.atk*=.95;st.spd*=1.05;st.evade+=.08}
    else if(p==='인간혐오'){st.human+=.12}
    else if(p==='침착'){st.def*=1.10;st.evade+=.02}
    else if(p==='야행성'&&(kstHour()>=18||kstHour()<6)){st.atk*=1.12;st.spd*=1.12}
    st.atk=Math.round(st.atk);st.def=Math.round(st.def);st.spd=Math.round(st.spd);st.crit=Math.min(.45,st.crit);st.evade=Math.min(.35,st.evade);
    return st;
  }

  window.forgePower=m=>{
    const st=enhancedStats(m);
    return Math.floor(Number(m.power_base||0)+(Number(m.level||1)-1)*12+Math.max(0,Number(m.talent||80)-80)*1.2+(st.atk-Number(m.atk_base||18))*.8+(st.def-Number(m.def_base||8))*.55+(st.hp-Number(m.hp_base||120))*.03+utilityPower(m));
  };

  function statText(d,level){
    if(!d)return '-';
    const mul=enhanceMul(level),v=n=>Math.round(Number(n||0)*mul*100)/100;
    return [
      Number(d.atk)&&`공격 +${fmt(v(d.atk))}`,
      Number(d.def)&&`방어 +${fmt(v(d.def))}`,
      Number(d.hp)&&`HP +${fmt(v(d.hp))}`,
      Number(d.spd)&&`속도 +${fmt(v(d.spd))}`,
      Number(d.crit)&&`치명 +${Math.round(v(d.crit)*100)}%`,
      Number(d.evade)&&`회피 +${Math.round(v(d.evade)*100)}%`,
      Number(d.human_damage)&&`인간 피해 +${Math.round(v(d.human_damage)*100)}%`
    ].filter(Boolean).join(' · ')||'능력치 없음';
  }

  async function equipmentStock(){
    const {data,error}=await sb.rpc('game_equipment_inventory');
    if(error)return lastStock;
    lastStock=data||[];
    return lastStock;
  }

  function levelPips(lv){return `<div class="forge-level-track" aria-label="강화 +${lv}">${Array.from({length:10},(_,i)=>`<i class="${i<lv?'on':''} ${i>=4?'risk':''}"></i>`).join('')}</div>`}

  function forgeGearRow(row){
    const m=monster(row.monster_id),d=itemDef(row.item_id),lv=Number(row.enhance_level||0),p=lv<MAX_ENHANCE?profile(lv):null;
    const active=!!activeOf(row.monster_id),enough=p&&stones()>=p.cost,key=gearKey(row.monster_id,row.slot),working=enhancing.has(key),danger=p?.destroy>0;
    return `<article class="forge-gear-row forge-fast-row ${rarityClass(d?.rarity)} ${lv>=4?'risk-zone':''}" data-forge-gear="${esc(key)}" data-monster="${esc(row.monster_id)}" data-slot="${row.slot}"><div class="forge-gear-icon">${itemSvg(itemAsset(row.item_id))}<i>+${lv}</i></div><div class="forge-gear-copy"><header><b>${esc(row.item_id)} <em>+${lv}</em></b><span>${esc(m?.name||'몬스터')} · ${slotName(row.slot)}</span></header><small>${esc(statText(d,lv))}</small>${levelPips(lv)}<div class="forge-mini-rates">${p?`<span class="success">성공 ${rate(p.success)}</span><span>유지 ${rate(p.fail)}</span><span class="down">하락 ${rate(p.down)}</span>${danger?`<span class="destroy">파괴 ${rate(p.destroy)}</span>`:''}`:'<span class="max">MAX 강화 완료</span>'}</div></div><div class="forge-fast-action">${danger?`<small class="forge-risk-label">파괴 ${rate(p.destroy)}</small>`:''}<button class="primary-btn forge-row-btn forge-hit-btn" data-forge-action="enhance" data-monster="${esc(row.monster_id)}" data-slot="${row.slot}" ${active||!p||!enough||working?'disabled':''}>${working?'두드리는 중…':active?'출동 중':!p?'MAX':!enough?`석 ${p.cost}개 필요`:`강화 ${p.cost}`}</button></div></article>`;
  }

  function storedHtml(stock=lastStock){
    const stored=(stock||[]).filter(x=>Number(x.enhance_level||0)>0&&Number(x.qty||0)>0);
    return stored.length?`<div class="forge-list-head stored"><b>보관 중 강화 장비</b><small>장비 선택창에서 다시 장착 가능</small></div><div class="forge-stored-list">${stored.map(x=>`<div><span>${itemSvg(itemAsset(x.item_id))}</span><b>${esc(x.item_id)} +${x.enhance_level}</b><em>${fmt(x.qty)}개</em></div>`).join('')}</div>`:'';
  }

  function rowsHtml(){const rows=(S?.equipment||[]).filter(x=>itemDef(x.item_id)?.slot);return rows.length?rows.map(forgeGearRow).join(''):'<div class="forge-empty">장착 중인 장비가 없습니다.<br>몬스터 상세에서 장비를 먼저 장착하세요.</div>'}

  window.forgeModal=function(){
    if(!S)return;
    modal(`<div class="sheet-head"><div><div class="section-kicker">BLACKSMITH · QUICK ENHANCE</div><h2>대장간</h2><p>확인창 없이 바로 강화합니다. 결과는 장비 카드에서 즉시 표시됩니다.</p></div><button class="close-btn" data-action="close">×</button></div><section class="forge-stone-wallet forge-fast-wallet"><div class="forge-stone-art">${itemSvg('crystal')}</div><span><small>보유 강화석</small><b data-forge-stones>${fmt(stones())}개</b><em>강화 버튼을 눌러 즉시 시도</em></span><strong>FAST</strong></section><div class="forge-live-result idle" data-forge-result><b>망치를 준비했습니다</b><span>강화할 장비의 버튼을 누르세요.</span></div><section class="forge-rule-card forge-quick-rules"><div><span>1강당 능력치 +8%</span><span>+3부터 하락</span><span class="danger">+4부터 파괴</span><span>최대 +10</span></div></section><div class="forge-list-head"><b>장착 장비</b><small>버튼을 연속해서 눌러 빠르게 강화</small></div><div class="forge-gear-list" data-forge-list>${rowsHtml()}</div><div data-forge-stored></div>`,'forge-sheet forge-fast-sheet');
    decorate();
    equipmentStock().then(stock=>{const host=document.querySelector('[data-forge-stored]');if(host)host.innerHTML=storedHtml(stock)}).catch(()=>{});
  };

  function applyLocalResult(data,mid,slot){
    const result=String(data?.result||'fail'),prev=Number(data?.previousLevel||0),next=Number(data?.newLevel??prev),cost=Number(data?.cost||0);
    const inv=(S?.inventory||[]).find(x=>x.item_id==='강화석');if(inv)inv.qty=Math.max(0,Number(inv.qty||0)-cost);
    const idx=(S?.equipment||[]).findIndex(x=>x.monster_id===mid&&x.slot===slot);if(idx>=0){if(result==='destroy')S.equipment.splice(idx,1);else S.equipment[idx].enhance_level=next}
    return {result,prev,next,cost,item:String(data?.itemId||currentGear(mid,slot)?.item_id||'장비')};
  }

  function showForgeResult(info){
    const box=document.querySelector('[data-forge-result]');if(!box)return;
    const label=info.result==='success'?'강화 성공!':info.result==='down'?'강화 하락':info.result==='destroy'?'장비 파괴':'강화 실패';
    const detail=info.result==='success'?`+${info.prev} → +${info.next}`:info.result==='down'?`+${info.prev} → +${info.next}`:info.result==='destroy'?`+${info.prev} 장비 소멸`:`+${info.prev} 유지`;
    box.className=`forge-live-result ${info.result}`;box.innerHTML=`<b>${label}</b><span>${esc(info.item)} · ${detail} · 강화석 ${fmt(info.cost)}개</span>`;box.classList.remove('pop');void box.offsetWidth;box.classList.add('pop');
  }

  function refreshForgeView(info,mid,slot){
    const stoneEl=document.querySelector('[data-forge-stones]');if(stoneEl)stoneEl.textContent=`${fmt(stones())}개`;
    const list=document.querySelector('[data-forge-list]');if(!list)return;
    const key=gearKey(mid,slot),old=list.querySelector(`[data-forge-gear="${CSS.escape(key)}"]`),row=currentGear(mid,slot);
    if(info.result==='destroy'){if(old){old.classList.add('result-destroy');old.innerHTML=`<div class="forge-destroyed-card"><b>장비 파괴</b><span>${esc(info.item)} +${info.prev} 소멸</span></div>`;setTimeout(()=>{old.remove();if(!list.querySelector('.forge-gear-row'))list.innerHTML=rowsHtml()},650)}return}
    if(row){const wrap=document.createElement('div');wrap.innerHTML=forgeGearRow(row);const fresh=wrap.firstElementChild;fresh.classList.add(`result-${info.result}`);if(old)old.replaceWith(fresh);else list.appendChild(fresh);setTimeout(()=>fresh.classList.remove(`result-${info.result}`),650)}
  }

  async function enhance(mid,slot){
    const key=gearKey(mid,slot);if(enhancing.has(key))return;
    const row=currentGear(mid,slot);if(!row){toast('강화할 장비가 없습니다.');return}
    const lv=Number(row.enhance_level||0),p=lv<MAX_ENHANCE?profile(lv):null;if(!p){toast('이미 최대 강화입니다.');return}if(stones()<p.cost){toast('강화석이 부족합니다.');return}if(activeOf(mid)){toast('출동 중인 몬스터의 장비는 강화할 수 없습니다.');return}
    enhancing.add(key);const card=document.querySelector(`[data-forge-gear="${CSS.escape(key)}"]`),btn=card?.querySelector('.forge-hit-btn');if(card)card.classList.add('forging');if(btn){btn.disabled=true;btn.textContent='두드리는 중…'}
    try{
      const {data,error}=await sb.rpc('game_enhance_equipped',{p_monster:mid,p_slot:slot});if(error)throw error;
      const info=applyLocalResult(data||{},mid,slot);showForgeResult(info);enhancing.delete(key);refreshForgeView(info,mid,slot);decorateEnhancedStats();scheduleDecorate();window.__frontendPollNow?.();
    }catch(err){
      enhancing.delete(key);if(card)card.classList.remove('forging');const msg=String(err?.message||'');
      if(msg.includes('stone_short'))toast('강화석이 부족합니다.');else if(msg.includes('monster_busy'))toast('출동 중인 몬스터의 장비는 강화할 수 없습니다.');else if(msg.includes('enhance_max'))toast('이미 최대 강화입니다.');else if(msg.includes('equipment_missing'))toast('강화할 장비가 없습니다.');else toast('강화 처리 중 오류가 발생했습니다.');
      const latest=currentGear(mid,slot);if(card&&latest){const wrap=document.createElement('div');wrap.innerHTML=forgeGearRow(latest);card.replaceWith(wrap.firstElementChild)}
    }
  }

  function decorateHome(){
    if(!S||screen!=='home')return;const row=document.querySelector('.facility-row.forge');if(!row)return;
    const small=row.querySelector('.facility-copy small'),text=`강화석 ${fmt(stones())}개 · 장착 장비 ${(S.equipment||[]).length}개`;if(small&&small.textContent!==text)small.textContent=text;
  }

  function decorateEnhancedStats(){
    if(!S)return;
    document.querySelectorAll('.personnel-row[data-id]').forEach(row=>{const m=monster(row.dataset.id),b=row.querySelector('.personnel-power>b');if(!m||!b)return;const text=fmt(window.forgePower(m));if(b.textContent!==text)b.textContent=text});
    document.querySelectorAll('.party-select-row[data-id]').forEach(row=>{const m=monster(row.dataset.id),s=row.querySelector('span:nth-child(2) small');if(!m||!s)return;const next=s.textContent.replace(/전투력\s[\d,]+/,`전투력 ${fmt(window.forgePower(m))}`);if(next!==s.textContent)s.textContent=next});
    const sheet=document.querySelector('.monster-detail-sheet-v10');if(sheet){const mid=sheet.querySelector('[data-action="personality"]')?.dataset.id,m=monster(mid);if(m){const st=enhancedStats(m),vals=[fmt(st.hp),fmt(st.atk),fmt(st.def),fmt(st.spd),`${Math.round(st.crit*100)}%`,`${Math.round(st.evade*100)}%`];sheet.querySelectorAll('.combat-stat-grid>div>b').forEach((b,i)=>{if(vals[i]!==undefined&&b.textContent!==vals[i])b.textContent=vals[i]});const eq=equippedFor(m.id);sheet.querySelectorAll('.gear-grid .gear-slot').forEach((g,i)=>{const r=eq.find(x=>x.slot===SLOT_ORDER[i]),lv=Number(r?.enhance_level||0);let badge=g.querySelector('.gear-inline-level');if(lv>0){if(!badge){badge=document.createElement('em');badge.className='gear-inline-level';g.appendChild(badge)}badge.textContent=`+${lv}`}else badge?.remove()})}}
    try{const selected=(S.monsters||[]).filter(m=>partyPick.includes(m.id)),sum=selected.reduce((a,m)=>a+window.forgePower(m),0);document.querySelectorAll('.party-summary span').forEach(el=>{if(el.textContent.startsWith('합산 전투력')){const t=`합산 전투력 ${fmt(sum)}`;if(el.textContent!==t)el.textContent=t}})}catch(_){}
    document.querySelectorAll('.mission-card[data-site]').forEach(card=>{const site=(S.sites||[]).find(x=>x.id===card.dataset.site),e=(S.expeditions||[]).find(x=>x.active&&x.site_id===card.dataset.site);if(!site||!e)return;const party=partyOf(e),sum=party.reduce((a,m)=>a+window.forgePower(m),0),ratio=Math.round(sum/Math.max(1,Number(site.recommended_power||1))*100);card.querySelectorAll('.mission-live-kpis>span').forEach(k=>{if(k.querySelector('small')?.textContent==='파티전투력'){const b=k.querySelector('b'),t=fmt(sum);if(b&&b.textContent!==t)b.textContent=t}});const p=card.querySelector('.live-bar-row.power');if(p){const em=p.querySelector('em'),b=p.querySelector('b');if(em)em.style.width=Math.max(0,Math.min(100,ratio))+'%';if(b)b.textContent=ratio+'%'}});
  }

  function decorateStoneVisuals(){
    document.querySelectorAll('.inventory-slot[data-id="강화석"] use').forEach(u=>u.setAttribute('href','assets/items.svg#crystal'));
    document.querySelectorAll('.source-drop-item').forEach(row=>{if(row.querySelector('b')?.textContent.trim()==='강화석')row.querySelector('use')?.setAttribute('href','assets/items.svg#crystal')});
    const sheet=document.querySelector('#modal .mission-party-sheet');if(!sheet||sheet.querySelector('.stone-any-enemy-group'))return;const title=sheet.querySelector('.sheet-head h2')?.textContent||'',site=(S?.sites||[]).find(x=>title.includes(x.name));if(!site)return;
    const all=(site.loot||[]).find(x=>x.id==='강화석'&&x.enemy==='*'),boss=(site.loot||[]).find(x=>x.id==='강화석'&&x.enemy===site.boss_name);if(!all)return;const list=sheet.querySelector('.drop-list');if(!list)return;
    list.insertAdjacentHTML('afterbegin',`<section class="loot-source-group stone-any-enemy-group"><header><b>모든 적 처치 · 강화석</b><small>일반 적을 실제로 처치했을 때 판정</small></header><div class="source-drop-item"><span class="source-drop-icon">${itemSvg('crystal')}</span><span><b>강화석</b><small>모든 적 처치 · 대장간 재료</small></span><strong>${rate(all.chance)}</strong></div>${boss?`<div class="source-drop-item boss-bonus"><span class="source-drop-icon">${itemSvg('crystal')}</span><span><b>보스 추가 강화석</b><small>${esc(site.boss_name)} 처치 · ${fmt(boss.min||1)}~${fmt(boss.max||1)}개</small></span><strong>${rate(boss.chance)}</strong></div>`:''}</section>`);
  }

  function decorate(){decorateHome();decorateEnhancedStats();decorateStoneVisuals()}
  function scheduleDecorate(){if(decorateRaf)return;decorateRaf=requestAnimationFrame(()=>{decorateRaf=0;decorate()})}
  window.refreshForgeEnhancements=scheduleDecorate;

  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-forge-action]');if(!btn)return;e.preventDefault();e.stopImmediatePropagation();const a=btn.dataset.forgeAction;
    if(a==='open')forgeModal();else if(a==='enhance')enhance(btn.dataset.monster,btn.dataset.slot);else if(a==='monster'){closeModal(true);screen='monsters';render();requestAnimationFrame(()=>employeeModal(btn.dataset.monster,'roster'))}
  },true);

  requestAnimationFrame(decorate);
})();
