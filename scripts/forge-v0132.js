/* v0.13.14 — Blacksmith +20 / dedicated enhancement chamber */
(()=>{
  const MAX_ENHANCE=20;
  const SLOT_ORDER=['weapon','armor','accessory'];
  const enhancing=new Set();
  let lastStock=[];
  let decorateRaf=0;

  const PROFILES=[
    {cost:1,success:1.00,fail:0,down:0,destroy:0},
    {cost:2,success:.85,fail:.15,down:0,destroy:0},
    {cost:3,success:.75,fail:.25,down:0,destroy:0},
    {cost:4,success:.65,fail:.28,down:.07,destroy:0},
    {cost:6,success:.55,fail:.28,down:.12,destroy:.05},
    {cost:8,success:.47,fail:.31,down:.15,destroy:.07},
    {cost:11,success:.39,fail:.33,down:.19,destroy:.09},
    {cost:15,success:.32,fail:.34,down:.22,destroy:.12},
    {cost:20,success:.25,fail:.34,down:.26,destroy:.15},
    {cost:28,success:.18,fail:.34,down:.30,destroy:.18},
    {cost:38,success:.16,fail:.34,down:.31,destroy:.19},
    {cost:50,success:.15,fail:.33,down:.32,destroy:.20},
    {cost:65,success:.14,fail:.32,down:.33,destroy:.21},
    {cost:82,success:.13,fail:.31,down:.34,destroy:.22},
    {cost:102,success:.12,fail:.30,down:.35,destroy:.23},
    {cost:125,success:.11,fail:.29,down:.36,destroy:.24},
    {cost:152,success:.10,fail:.28,down:.37,destroy:.25},
    {cost:184,success:.09,fail:.27,down:.38,destroy:.26},
    {cost:220,success:.08,fail:.26,down:.39,destroy:.27},
    {cost:260,success:.07,fail:.25,down:.40,destroy:.28}
  ];
  const profile=level=>{const lv=Number(level||0);return lv>=0&&lv<MAX_ENHANCE?PROFILES[lv]:null};
  const rate=n=>`${Math.round(Number(n||0)*100)}%`;
  const enhanceMul=lv=>1+Math.max(0,Number(lv||0))*.08;
  const stones=()=>Number((S?.inventory||[]).find(x=>x.item_id==='강화석')?.qty||0);
  const currentGear=(mid,slot)=>(S?.equipment||[]).find(x=>x.monster_id===mid&&x.slot===slot)||null;
  const monster=id=>(S?.monsters||[]).find(x=>x.id===id)||null;
  const gearKey=(mid,slot)=>`${mid}:${slot}`;
  const tierClass=lv=>lv>=20?'mythic':lv>=15?'legend':lv>=10?'master':lv>=4?'danger':'safe';

  function enhancedStats(m,equipmentRows=equippedFor(m.id)){
    const eq=equipmentRows.map(row=>({row,d:itemDef(row.item_id)})).filter(x=>x.d);
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

  window.forgeStats=enhancedStats;
  window.forgeCompare=(m,itemId,level=0)=>{
    const d=itemDef(itemId),rows=equippedFor(m.id);
    return {before:enhancedStats(m,rows),after:enhancedStats(m,[...rows.filter(r=>r.slot!==d.slot),{monster_id:m.id,item_id:itemId,slot:d.slot,enhance_level:level}])};
  };
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

  function levelPips(lv){return `<div class="forge-level-track forge-level-track-20" aria-label="강화 +${lv}">${Array.from({length:MAX_ENHANCE},(_,i)=>`<i class="${i<lv?'on':''} ${i>=4?'risk':''} ${i===9||i===14||i===19?'milestone':''}"></i>`).join('')}</div>`}

  function forgeGearRow(row){
    const m=monster(row.monster_id),d=itemDef(row.item_id),lv=Number(row.enhance_level||0),p=profile(lv),active=!!activeOf(row.monster_id);
    return `<button type="button" class="forge-gear-row forge-select-row ${rarityClass(d?.rarity)} ${tierClass(lv)}" data-forge-action="select" data-monster="${esc(row.monster_id)}" data-slot="${esc(row.slot)}"><div class="forge-gear-icon">${itemSvg(itemAsset(row.item_id))}<i>+${lv}</i></div><div class="forge-gear-copy"><header><b>${esc(row.item_id)} <em>+${lv}</em></b><span>${esc(m?.name||'몬스터')} · ${slotName(row.slot)}</span></header><small>${esc(statText(d,lv))}</small>${levelPips(lv)}<div class="forge-mini-rates">${p?`<span class="success">성공 ${rate(p.success)}</span><span class="down">하락 ${rate(p.down)}</span><span class="destroy">파괴 ${rate(p.destroy)}</span>`:'<span class="max">MAX +20 달성</span>'}</div></div><div class="forge-select-cta"><small>${active?'출동 중 · 강화 불가':p?`강화석 ${p.cost}개`:'최종 강화'}</small><b>${p?'강화하기':'완성'} ›</b></div></button>`;
  }

  function storedHtml(stock=lastStock){
    const stored=(stock||[]).filter(x=>Number(x.enhance_level||0)>0&&Number(x.qty||0)>0);
    return stored.length?`<div class="forge-list-head stored"><b>보관 중 강화 장비</b><small>몬스터에게 장착 후 강화 가능</small></div><div class="forge-stored-list">${stored.map(x=>`<div><span>${itemSvg(itemAsset(x.item_id))}</span><b>${esc(x.item_id)} +${x.enhance_level}</b><em>${fmt(x.qty)}개</em></div>`).join('')}</div>`:'';
  }

  function rowsHtml(){const rows=(S?.equipment||[]).filter(x=>itemDef(x.item_id)?.slot);return rows.length?rows.map(forgeGearRow).join(''):'<div class="forge-empty">장착 중인 장비가 없습니다.<br>몬스터 상세에서 장비를 먼저 장착하세요.</div>'}

  window.forgeModal=function(){
    if(!S)return;
    modal(`<div class="sheet-head"><div><div class="section-kicker">BLACKSMITH · EQUIPMENT FORGE</div><h2>대장간</h2><p>강화할 장비를 선택하면 전용 강화실로 이동합니다.</p></div><button class="close-btn" data-action="close">×</button></div><section class="forge-stone-wallet"><div class="forge-stone-art">${itemSvg('crystal')}</div><span><small>보유 강화석</small><b data-forge-stones>${fmt(stones())}개</b><em>장비 강화 최대 +20 · 1강당 장비 기본 능력치 +8%</em></span></section><section class="forge-rule-card forge-browser-rules"><div><span>+0 → +1 확정</span><span>+3부터 하락</span><span class="danger">+4부터 파괴</span><span>+10 이후 초고위험</span><span>MAX +20</span></div></section><div class="forge-list-head"><b>장착 장비</b><small>장비를 눌러 강화실 입장</small></div><div class="forge-gear-list" data-forge-list>${rowsHtml()}</div><div data-forge-stored></div>`,'forge-sheet forge-browser-sheet');
    decorate();
    equipmentStock().then(stock=>{const host=document.querySelector('[data-forge-stored]');if(host)host.innerHTML=storedHtml(stock)}).catch(()=>{});
  };

  function ratesHtml(p){if(!p)return `<div class="forge-max-banner"><b>MAX +20</b><span>최종 강화 단계에 도달했습니다.</span></div>`;return `<div class="forge-rate-grid forge-rate-grid-detail"><div class="success"><small>성공</small><b>${rate(p.success)}</b><span>+1 상승</span></div><div><small>유지</small><b>${rate(p.fail)}</b><span>현재 강화 유지</span></div><div class="down"><small>하락</small><b>${rate(p.down)}</b><span>-1 하락</span></div><div class="destroy"><small>파괴</small><b>${rate(p.destroy)}</b><span>장비 소멸</span></div></div>`}
  function chamberFxNodes(){return `<div class="forge-flare"></div><div class="forge-runes">${Array.from({length:8},(_,i)=>`<i style="--i:${i}"></i>`).join('')}</div><div class="forge-sparks">${Array.from({length:18},(_,i)=>`<i style="--i:${i}"></i>`).join('')}</div>`}

  window.forgeDetailModal=function(mid,slot){
    const row=currentGear(mid,slot);if(!row){toast('강화할 장비가 없습니다.');forgeModal();return}
    const m=monster(mid),d=itemDef(row.item_id),lv=Number(row.enhance_level||0),p=profile(lv),active=!!activeOf(mid),enough=p&&stones()>=p.cost,working=enhancing.has(gearKey(mid,slot)),next=p?statText(d,Math.min(MAX_ENHANCE,lv+1)):statText(d,lv);
    modal(`<div class="sheet-head"><div><div class="section-kicker">FORGE CHAMBER · +${lv}</div><h2>${esc(row.item_id)} 강화</h2><p>${esc(m?.name||'몬스터')} · ${slotName(slot)} · 최대 +20</p></div><button class="close-btn" data-action="close">×</button></div><section class="forge-chamber ${tierClass(lv)}" data-forge-chamber>${chamberFxNodes()}<div class="forge-hammer" aria-hidden="true"><i></i><b></b></div><div class="forge-anvil" aria-hidden="true"><i></i><b></b></div><div class="forge-focus-item ${rarityClass(d?.rarity)}" data-forge-focus>${itemSvg(itemAsset(row.item_id))}<strong data-detail-level>+${lv}</strong></div><div class="forge-chamber-result idle" data-forge-result><b>강화 준비</b><span>망치를 내려쳐 장비를 강화하세요.</span></div></section><section class="forge-detail-card"><div class="forge-detail-title"><span><small>현재 강화</small><b data-detail-level-text>+${lv} / +${MAX_ENHANCE}</b></span><span><small>강화 효과</small><b>기본 능력치 +${lv*8}%</b></span></div><div data-detail-pips>${levelPips(lv)}</div><div class="forge-stat-compare"><div><small>현재</small><b data-detail-current>${esc(statText(d,lv))}</b></div><i>›</i><div><small>${p?'성공 시':'최종'}</small><b data-detail-next>${esc(next)}</b></div></div><div data-detail-rates>${ratesHtml(p)}</div></section><section class="forge-detail-action"><div class="forge-detail-cost"><span>${itemSvg('crystal')}<small>필요 강화석</small></span><b data-detail-cost>${p?`${fmt(p.cost)}개`:'-'}</b><em data-forge-stones>보유 ${fmt(stones())}개</em></div><button class="forge-strike-btn" data-forge-action="enhance" data-monster="${esc(mid)}" data-slot="${esc(slot)}" ${active||!p||!enough||working?'disabled':''}>${working?'강화 중…':active?'출동 중이라 강화 불가':!p?'MAX +20':!enough?`강화석 ${p.cost}개 필요`:`망치 내려치기 · +${lv} → +${lv+1}`}</button><p>${p&&p.destroy>0?`파괴 확률 ${rate(p.destroy)} · 파괴 시 장비는 영구 소멸합니다.`:p?'안전 구간입니다. 파괴되지 않습니다.':'최종 강화가 완료되었습니다.'}</p></section>`,'forge-sheet forge-detail-sheet');
    decorate();
  };

  function applyLocalResult(data,mid,slot){
    const result=String(data?.result||'fail'),prev=Number(data?.previousLevel||0),next=Number(data?.newLevel??prev),cost=Number(data?.cost||0);
    const inv=(S?.inventory||[]).find(x=>x.item_id==='강화석');if(inv)inv.qty=Math.max(0,Number(inv.qty||0)-cost);
    const idx=(S?.equipment||[]).findIndex(x=>x.monster_id===mid&&x.slot===slot);if(idx>=0){if(result==='destroy')S.equipment.splice(idx,1);else S.equipment[idx].enhance_level=next}
    return {result,prev,next,cost,item:String(data?.itemId||currentGear(mid,slot)?.item_id||'장비')};
  }

  function pulseDevice(result){try{if(!navigator.vibrate)return;const pattern=result==='success'?[18,24,45]:result==='destroy'?[50,30,70,30,90]:result==='down'?[35,25,35]:[14,40,14];navigator.vibrate(pattern)}catch(_){}}

  function playForgeEffect(info){
    const chamber=document.querySelector('[data-forge-chamber]'),box=document.querySelector('[data-forge-result]');if(!chamber||!box)return;
    chamber.classList.remove('is-striking','result-success','result-fail','result-down','result-destroy','fx-burst');void chamber.offsetWidth;chamber.classList.add('is-striking');
    setTimeout(()=>{if(!chamber.isConnected)return;chamber.classList.add(`result-${info.result}`,'fx-burst');pulseDevice(info.result)},210);
    const label=info.result==='success'?'강화 성공!':info.result==='down'?'강화 하락':info.result==='destroy'?'장비 파괴':'강화 실패';
    const detail=info.result==='success'?`+${info.prev} → +${info.next}`:info.result==='down'?`+${info.prev} → +${info.next}`:info.result==='destroy'?`+${info.prev} 장비 소멸`:`+${info.prev} 유지`;
    setTimeout(()=>{if(!box.isConnected)return;box.className=`forge-chamber-result ${info.result} pop`;box.innerHTML=`<b>${label}</b><span>${esc(info.item)} · ${detail}</span>`},220);
  }

  function refreshDetail(mid,slot){
    const stoneEls=document.querySelectorAll('[data-forge-stones]');stoneEls.forEach((el,i)=>el.textContent=i===0?`${fmt(stones())}개`:`보유 ${fmt(stones())}개`);
    const row=currentGear(mid,slot);
    if(!row){const btn=document.querySelector('.forge-strike-btn');if(btn){btn.disabled=true;btn.textContent='장비 파괴됨'}const note=document.querySelector('.forge-detail-action>p');if(note)note.textContent='파괴된 장비는 복구할 수 없습니다. 뒤로가기를 눌러 다른 장비를 선택하세요.';return}
    const d=itemDef(row.item_id),lv=Number(row.enhance_level||0),p=profile(lv),active=!!activeOf(mid),enough=p&&stones()>=p.cost;
    document.querySelectorAll('[data-detail-level]').forEach(el=>el.textContent=`+${lv}`);
    const levelText=document.querySelector('[data-detail-level-text]');if(levelText)levelText.textContent=`+${lv} / +${MAX_ENHANCE}`;
    const pips=document.querySelector('[data-detail-pips]');if(pips)pips.innerHTML=levelPips(lv);
    const cur=document.querySelector('[data-detail-current]');if(cur)cur.textContent=statText(d,lv);
    const next=document.querySelector('[data-detail-next]');if(next)next.textContent=p?statText(d,lv+1):statText(d,lv);
    const rates=document.querySelector('[data-detail-rates]');if(rates)rates.innerHTML=ratesHtml(p);
    const cost=document.querySelector('[data-detail-cost]');if(cost)cost.textContent=p?`${fmt(p.cost)}개`:'-';
    const chamber=document.querySelector('[data-forge-chamber]');if(chamber){chamber.classList.remove('safe','danger','master','legend','mythic');chamber.classList.add(tierClass(lv))}
    const btn=document.querySelector('.forge-strike-btn');if(btn){btn.disabled=active||!p||!enough;btn.textContent=active?'출동 중이라 강화 불가':!p?'MAX +20':!enough?`강화석 ${p.cost}개 필요`:`망치 내려치기 · +${lv} → +${lv+1}`}
    const note=document.querySelector('.forge-detail-action>p');if(note)note.textContent=p&&p.destroy>0?`파괴 확률 ${rate(p.destroy)} · 파괴 시 장비는 영구 소멸합니다.`:p?'안전 구간입니다. 파괴되지 않습니다.':'최종 강화가 완료되었습니다.';
    decorateEnhancedStats();scheduleDecorate();
  }

  async function enhance(mid,slot){
    const key=gearKey(mid,slot);if(enhancing.has(key))return;
    const row=currentGear(mid,slot);if(!row){toast('강화할 장비가 없습니다.');return}
    const lv=Number(row.enhance_level||0),p=profile(lv);if(!p){toast('이미 최대 강화입니다.');return}if(stones()<p.cost){toast('강화석이 부족합니다.');return}if(activeOf(mid)){toast('출동 중인 몬스터의 장비는 강화할 수 없습니다.');return}
    enhancing.add(key);const btn=document.querySelector('.forge-strike-btn');if(btn){btn.disabled=true;btn.textContent='망치를 드는 중…'}
    const chamber=document.querySelector('[data-forge-chamber]');if(chamber){chamber.classList.remove('is-striking','fx-burst');void chamber.offsetWidth;chamber.classList.add('pre-strike')}
    try{
      const {data,error}=await sb.rpc('game_enhance_equipped',{p_monster:mid,p_slot:slot});if(error)throw error;
      const info=applyLocalResult(data||{},mid,slot);enhancing.delete(key);if(chamber)chamber.classList.remove('pre-strike');playForgeEffect(info);setTimeout(()=>refreshDetail(mid,slot),500);queueMicrotask(()=>window.__frontendPollNow?.());
    }catch(err){
      enhancing.delete(key);if(chamber)chamber.classList.remove('pre-strike');const msg=String(err?.message||'');
      if(msg.includes('stone_short'))toast('강화석이 부족합니다.');else if(msg.includes('monster_busy'))toast('출동 중인 몬스터의 장비는 강화할 수 없습니다.');else if(msg.includes('enhance_max'))toast('이미 최대 강화입니다.');else if(msg.includes('equipment_missing'))toast('강화할 장비가 없습니다.');else toast('강화 처리 중 오류가 발생했습니다.');
      refreshDetail(mid,slot);
    }
  }

  function decorateHome(){if(!S||screen!=='home')return;const row=document.querySelector('.facility-row.forge');if(!row)return;const small=row.querySelector('.facility-copy small'),text=`강화석 ${fmt(stones())}개 · 장착 장비 ${(S.equipment||[]).length}개`;if(small&&small.textContent!==text)small.textContent=text}
  function decorateForgeBrowser(){const list=document.querySelector('.forge-browser-sheet [data-forge-list]');if(!list)return;const sig=(S?.equipment||[]).map(x=>`${x.monster_id}:${x.slot}:${x.item_id}:${x.enhance_level||0}`).join('|');if(list.dataset.sig===sig)return;list.dataset.sig=sig;list.innerHTML=rowsHtml();const stone=document.querySelector('.forge-browser-sheet [data-forge-stones]');if(stone)stone.textContent=`${fmt(stones())}개`}

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

  function decorate(){decorateHome();decorateForgeBrowser();decorateEnhancedStats();decorateStoneVisuals()}
  function scheduleDecorate(){if(decorateRaf)return;decorateRaf=requestAnimationFrame(()=>{decorateRaf=0;decorate()})}
  window.refreshForgeEnhancements=scheduleDecorate;

  document.addEventListener('click',e=>{const btn=e.target.closest('[data-forge-action]');if(!btn)return;e.preventDefault();e.stopImmediatePropagation();const a=btn.dataset.forgeAction;if(a==='open')forgeModal();else if(a==='select')forgeDetailModal(btn.dataset.monster,btn.dataset.slot);else if(a==='enhance')enhance(btn.dataset.monster,btn.dataset.slot);else if(a==='monster'){closeModal(true);screen='monsters';render();requestAnimationFrame(()=>employeeModal(btn.dataset.monster,'roster'))}},true);
  const modalHost=document.querySelector('#modal');if(modalHost)new MutationObserver(()=>scheduleDecorate()).observe(modalHost,{childList:true});
  requestAnimationFrame(decorate);
})();
