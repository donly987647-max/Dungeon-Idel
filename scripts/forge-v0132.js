/* v0.13.2 — Blacksmith / equipment enhancement */
(()=>{
  const MAX_ENHANCE=10;
  const SLOT_ORDER=['weapon','armor','accessory'];
  const resultKo={success:'강화 성공',fail:'강화 실패',down:'강화 하락',destroy:'장비 파괴'};

  const profile=level=>{
    const lv=Math.max(0,Math.min(9,Number(level||0)));
    const table=[
      {cost:1, success:1.00,fail:0,down:0,destroy:0},
      {cost:2, success:.90,fail:.10,down:0,destroy:0},
      {cost:3, success:.80,fail:.20,down:0,destroy:0},
      {cost:4, success:.70,fail:.25,down:.05,destroy:0},
      {cost:6, success:.60,fail:.25,down:.10,destroy:.05},
      {cost:8, success:.52,fail:.28,down:.13,destroy:.07},
      {cost:11,success:.44,fail:.30,down:.17,destroy:.09},
      {cost:15,success:.36,fail:.32,down:.20,destroy:.12},
      {cost:20,success:.28,fail:.33,down:.24,destroy:.15},
      {cost:28,success:.20,fail:.35,down:.27,destroy:.18}
    ];
    return table[lv];
  };
  const rate=n=>`${Math.round(Number(n||0)*100)}%`;
  const enhanceMul=lv=>1+Math.max(0,Number(lv||0))*.08;
  const stones=()=>Number((S?.inventory||[]).find(x=>x.item_id==='강화석')?.qty||0);
  const currentGear=(mid,slot)=>(S?.equipment||[]).find(x=>x.monster_id===mid&&x.slot===slot)||null;
  const monster=(id)=>(S?.monsters||[]).find(x=>x.id===id)||null;

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
    const mul=enhanceMul(level),v=(n)=>Math.round(Number(n||0)*mul*100)/100;
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
    if(error)return [];
    return data||[];
  }

  function forgeGearRow(row){
    const m=monster(row.monster_id),d=itemDef(row.item_id),lv=Number(row.enhance_level||0),p=lv<MAX_ENHANCE?profile(lv):null,active=!!activeOf(row.monster_id),enough=p&&stones()>=p.cost;
    return `<article class="forge-gear-row ${rarityClass(d?.rarity)} ${lv>=4?'risk-zone':''}">
      <div class="forge-gear-icon">${itemSvg(itemAsset(row.item_id))}<i>+${lv}</i></div>
      <div class="forge-gear-copy"><header><b>${esc(row.item_id)} <em>+${lv}</em></b><span>${esc(m?.name||'몬스터')} · ${slotName(row.slot)}</span></header><small>${esc(statText(d,lv))}</small><div class="forge-mini-rates">${p?`<span class="success">성공 ${rate(p.success)}</span><span>유지 ${rate(p.fail)}</span><span class="down">하락 ${rate(p.down)}</span>${p.destroy?`<span class="destroy">파괴 ${rate(p.destroy)}</span>`:''}`:'<span class="max">MAX</span>'}</div></div>
      <button class="primary-btn forge-row-btn" data-forge-action="confirm" data-monster="${esc(row.monster_id)}" data-slot="${row.slot}" ${active||!p||!enough?'disabled':''}>${active?'출동 중':!p?'MAX':!enough?`석 ${p.cost}개 필요`:`강화 · ${p.cost}`}</button>
    </article>`;
  }

  window.forgeModal=async function(){
    if(!S)return;
    const stock=await equipmentStock();
    const rows=(S.equipment||[]).filter(x=>itemDef(x.item_id)?.slot);
    const stored=stock.filter(x=>Number(x.enhance_level||0)>0&&Number(x.qty||0)>0);
    modal(`<div class="sheet-head"><div><div class="section-kicker">BLACKSMITH · ENHANCEMENT</div><h2>대장간</h2><p>강화석을 사용해 장착 장비의 성능을 올립니다.</p></div><button class="close-btn" data-action="close">×</button></div>
      <section class="forge-stone-wallet"><div class="forge-stone-art">${itemSvg('crystal')}</div><span><small>보유 강화석</small><b>${fmt(stones())}개</b><em>각 챕터의 적 처치 시 획득</em></span></section>
      <section class="forge-rule-card"><b>강화 규칙</b><p>강화 1레벨마다 장비 기본 능력치가 <strong>8%</strong> 증가합니다. 강화가 높을수록 강화석 소모량은 늘고 성공률은 낮아집니다.</p><div><span>+3부터 하락 가능</span><span class="danger">+4부터 파괴 가능 · 최초 5%</span><span>최대 +10</span></div></section>
      <div class="forge-list-head"><b>장착 장비</b><small>강화는 본부 대기 중인 몬스터만 가능</small></div>
      <div class="forge-gear-list">${rows.length?rows.map(forgeGearRow).join(''):'<div class="forge-empty">장착 중인 장비가 없습니다.<br>몬스터 상세에서 장비를 먼저 장착하세요.</div>'}</div>
      ${stored.length?`<div class="forge-list-head stored"><b>보관 중 강화 장비</b><small>몬스터 장비 선택창에서 다시 장착 가능</small></div><div class="forge-stored-list">${stored.map(x=>`<div><span>${itemSvg(itemAsset(x.item_id))}</span><b>${esc(x.item_id)} +${x.enhance_level}</b><em>${fmt(x.qty)}개</em></div>`).join('')}</div>`:''}`,'forge-sheet');
    decorate();
  };

  function forgeConfirm(mid,slot){
    const row=currentGear(mid,slot),m=monster(mid);if(!row||!m){toast('강화할 장비를 찾을 수 없습니다.');return}
    const d=itemDef(row.item_id),lv=Number(row.enhance_level||0);if(lv>=MAX_ENHANCE){toast('이미 최대 강화입니다.');return}
    const p=profile(lv),next=lv+1,destruction=p.destroy>0;
    modal(`<div class="sheet-head"><div><div class="section-kicker">ENHANCE +${next}</div><h2>${esc(row.item_id)} +${lv} → +${next}</h2><p>${esc(m.name)} · ${slotName(slot)} · 강화석 ${p.cost}개 소모</p></div><button class="close-btn" data-action="close">×</button></div>
      <section class="forge-confirm-gear ${rarityClass(d?.rarity)}"><div>${itemSvg(itemAsset(row.item_id))}<i>+${lv}</i></div><span><small>현재 능력치</small><b>${esc(statText(d,lv))}</b><em>성공 시 장비 기본 능력치 +${next*8}%</em></span></section>
      <section class="forge-rate-grid"><div class="success"><small>성공</small><b>${rate(p.success)}</b><span>+${next}</span></div><div><small>실패</small><b>${rate(p.fail)}</b><span>+${lv} 유지</span></div><div class="down"><small>하락</small><b>${rate(p.down)}</b><span>${p.down?`+${Math.max(0,lv-1)}`:'없음'}</span></div><div class="destroy"><small>파괴</small><b>${rate(p.destroy)}</b><span>${p.destroy?'장비 소멸':'없음'}</span></div></section>
      ${destruction?`<div class="forge-destroy-warning"><b>파괴 위험 ${rate(p.destroy)}</b><span>파괴되면 장비는 복구되지 않고 해당 슬롯이 비게 됩니다.</span></div>`:''}
      <div class="forge-confirm-cost"><span>${itemSvg('crystal')} 강화석</span><b>${fmt(stones())} / ${p.cost}</b></div>
      <div class="forge-confirm-actions"><button class="soft-btn" data-forge-action="open">대장간으로</button><button class="primary-btn" data-forge-action="enhance" data-monster="${esc(mid)}" data-slot="${slot}" ${stones()<p.cost?'disabled':''}>강화 실행</button></div>`,'forge-sheet forge-confirm-sheet');
  }

  function resultModal(data,mid,slot){
    const result=String(data?.result||'fail'),prev=Number(data?.previousLevel||0),next=Number(data?.newLevel??prev),item=String(data?.itemId||'장비');
    const msg=result==='success'?`+${prev} → +${next}`:result==='down'?`+${prev} → +${next}`:result==='destroy'?`+${prev} 장비가 파괴되었습니다.`:`+${prev} 유지`;
    modal(`<div class="sheet-head"><div><div class="section-kicker">FORGE RESULT</div><h2>${resultKo[result]||'강화 결과'}</h2><p>${esc(item)}</p></div><button class="close-btn" data-action="close">×</button></div><section class="forge-result ${result}"><div class="forge-result-icon">${result==='destroy'?'×':result==='success'?'↑':result==='down'?'↓':'·'}</div><b>${esc(msg)}</b><span>강화석 ${fmt(data?.cost||0)}개 소모</span>${result==='destroy'?'<p>장비가 소멸해 해당 장비 슬롯이 비었습니다.</p>':result==='fail'?'<p>강화 레벨은 그대로 유지됩니다.</p>':result==='down'?'<p>장비는 보존되지만 강화 레벨이 1단계 하락했습니다.</p>':'<p>장비 능력치가 상승했습니다.</p>'}</section><div class="forge-result-actions"><button class="primary-btn" data-forge-action="open">계속 강화</button>${result==='destroy'?`<button class="soft-btn" data-forge-action="monster" data-monster="${esc(mid)}">몬스터 장비 확인</button>`:''}</div>`,'forge-sheet forge-result-sheet');
  }

  async function enhance(mid,slot){
    if(busy)return;busy=true;
    try{
      const {data,error}=await sb.rpc('game_enhance_equipped',{p_monster:mid,p_slot:slot});
      if(error)throw error;
      await api('state');
      resultModal(data||{},mid,slot);
      decorate();
    }catch(err){
      const msg=String(err?.message||'');
      if(msg.includes('stone_short'))toast('강화석이 부족합니다.');
      else if(msg.includes('monster_busy'))toast('출동 중인 몬스터의 장비는 강화할 수 없습니다.');
      else if(msg.includes('enhance_max'))toast('이미 최대 강화입니다.');
      else if(msg.includes('equipment_missing'))toast('강화할 장비가 없습니다.');
      else toast('강화 처리 중 오류가 발생했습니다.');
    }finally{busy=false}
  }

  function decorateHome(){
    if(!S||screen!=='home')return;
    const stack=document.querySelector('.facility-stack');if(!stack)return;
    let row=stack.querySelector('.facility-row.forge');
    if(!row){
      row=document.createElement('button');row.className='facility-row forge';row.dataset.forgeAction='open';
      row.innerHTML=`<img src="assets/icon-forge.svg" alt=""><span class="facility-copy"><b>대장간</b><small></small></span><span class="facility-side"><em>강화</em><i>›</i></span>`;
      const workshop=stack.querySelector('.facility-row.workshop');
      if(workshop)workshop.insertAdjacentElement('afterend',row);else stack.appendChild(row);
    }
    const small=row.querySelector('.facility-copy small'),text=`강화석 ${fmt(stones())}개 · 장착 장비 ${(S.equipment||[]).length}개`;
    if(small&&small.textContent!==text)small.textContent=text;
  }

  function decorateEnhancedStats(){
    if(!S)return;
    document.querySelectorAll('.personnel-row[data-id]').forEach(row=>{const m=monster(row.dataset.id),b=row.querySelector('.personnel-power>b');if(!m||!b)return;const text=fmt(window.forgePower(m));if(b.textContent!==text)b.textContent=text});
    document.querySelectorAll('.party-select-row[data-id]').forEach(row=>{const m=monster(row.dataset.id),s=row.querySelector('span:nth-child(2) small');if(!m||!s)return;const next=s.textContent.replace(/전투력\s[\d,]+/,`전투력 ${fmt(window.forgePower(m))}`);if(next!==s.textContent)s.textContent=next});

    const sheet=document.querySelector('.monster-detail-sheet-v10');
    if(sheet){
      const mid=sheet.querySelector('[data-action="personality"]')?.dataset.id,m=monster(mid);if(m){
        const st=enhancedStats(m),vals=[fmt(st.hp),fmt(st.atk),fmt(st.def),fmt(st.spd),`${Math.round(st.crit*100)}%`,`${Math.round(st.evade*100)}%`];
        sheet.querySelectorAll('.combat-stat-grid>div>b').forEach((b,i)=>{if(vals[i]!==undefined&&b.textContent!==vals[i])b.textContent=vals[i]});
        const eq=equippedFor(m.id);sheet.querySelectorAll('.gear-grid .gear-slot').forEach((g,i)=>{const r=eq.find(x=>x.slot===SLOT_ORDER[i]),lv=Number(r?.enhance_level||0);let badge=g.querySelector('.gear-inline-level');if(lv>0){if(!badge){badge=document.createElement('em');badge.className='gear-inline-level';g.appendChild(badge)}badge.textContent=`+${lv}`}else badge?.remove()});
      }
    }

    try{
      const selected=(S.monsters||[]).filter(m=>partyPick.includes(m.id));
      const sum=selected.reduce((a,m)=>a+window.forgePower(m),0);
      document.querySelectorAll('.party-summary span').forEach(el=>{if(el.textContent.startsWith('합산 전투력')){const t=`합산 전투력 ${fmt(sum)}`;if(el.textContent!==t)el.textContent=t}});
    }catch(_){}

    document.querySelectorAll('.mission-card[data-site]').forEach(card=>{
      const site=(S.sites||[]).find(x=>x.id===card.dataset.site),e=(S.expeditions||[]).find(x=>x.active&&x.site_id===card.dataset.site);if(!site||!e)return;
      const party=partyOf(e),sum=party.reduce((a,m)=>a+window.forgePower(m),0),ratio=Math.round(sum/Math.max(1,Number(site.recommended_power||1))*100);
      card.querySelectorAll('.mission-live-kpis>span').forEach(k=>{if(k.querySelector('small')?.textContent==='파티전투력'){const b=k.querySelector('b'),t=fmt(sum);if(b&&b.textContent!==t)b.textContent=t}});
      const p=card.querySelector('.live-bar-row.power');if(p){const em=p.querySelector('em'),b=p.querySelector('b');if(em)em.style.width=Math.max(0,Math.min(100,ratio))+'%';if(b)b.textContent=ratio+'%'}
    });
  }

  function decorateStoneVisuals(){
    document.querySelectorAll('.inventory-slot[data-id="강화석"] use').forEach(u=>u.setAttribute('href','assets/items.svg#crystal'));
    document.querySelectorAll('.source-drop-item').forEach(row=>{if(row.querySelector('b')?.textContent.trim()==='강화석')row.querySelector('use')?.setAttribute('href','assets/items.svg#crystal')});
    const sheet=document.querySelector('#modal .mission-party-sheet');if(!sheet||sheet.querySelector('.stone-any-enemy-group'))return;
    const title=sheet.querySelector('.sheet-head h2')?.textContent||'',site=(S?.sites||[]).find(x=>title.includes(x.name));if(!site)return;
    const all=(site.loot||[]).find(x=>x.id==='강화석'&&x.enemy==='*'),boss=(site.loot||[]).find(x=>x.id==='강화석'&&x.enemy===site.boss_name);if(!all)return;
    const list=sheet.querySelector('.drop-list');if(!list)return;
    list.insertAdjacentHTML('afterbegin',`<section class="loot-source-group stone-any-enemy-group"><header><b>모든 적 처치 · 강화석</b><small>일반 적을 실제로 처치했을 때 판정</small></header><div class="source-drop-item"><span class="source-drop-icon">${itemSvg('crystal')}</span><span><b>강화석</b><small>모든 적 처치 · 대장간 재료</small></span><strong>${rate(all.chance)}</strong></div>${boss?`<div class="source-drop-item boss-bonus"><span class="source-drop-icon">${itemSvg('crystal')}</span><span><b>보스 추가 강화석</b><small>${esc(site.boss_name)} 처치 · ${fmt(boss.min||1)}~${fmt(boss.max||1)}개</small></span><strong>${rate(boss.chance)}</strong></div>`:''}</section>`);
  }

  function decorate(){decorateHome();decorateEnhancedStats();decorateStoneVisuals()}

  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-forge-action]');if(!btn)return;
    e.preventDefault();e.stopImmediatePropagation();
    const a=btn.dataset.forgeAction;
    if(a==='open')forgeModal();
    else if(a==='confirm')forgeConfirm(btn.dataset.monster,btn.dataset.slot);
    else if(a==='enhance')enhance(btn.dataset.monster,btn.dataset.slot);
    else if(a==='monster'){closeModal(true);screen='monsters';render();requestAnimationFrame(()=>employeeModal(btn.dataset.monster,'roster'))}
  },true);

  setInterval(decorate,700);
  requestAnimationFrame(decorate);
})();
