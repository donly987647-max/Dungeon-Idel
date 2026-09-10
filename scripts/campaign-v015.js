/* Campaign screens use explicit render/update entry points, not DOM observers. */
(()=>{
  const enabled=()=>!!S?.sites?.some(s=>s.chapter?.version>=15);
  const siteBy=id=>(S?.sites||[]).find(s=>s.id===id);
  const expedition=id=>(S?.expeditions||[]).find(e=>e.site_id===id&&e.active);
  const art=s=>`assets/art-v015/${({mountain_village:'village',farm_road:'small-country',border_outpost:'small-kingdom',grand_castle:'castle',hero_kingdom:'hero-kingdom'})[s.id]||'village'}.webp`;
  const battles=s=>Number(s.progress?.normal_battles??s.progress?.normal_wins??0);
  const unlocked=s=>!!(s.progress?.boss_ready||s.progress?.boss_cleared||battles(s)>=500);
  const date=t=>t&&Number.isFinite(new Date(t).getTime())?new Intl.DateTimeFormat('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(t)):'기록 없음';
  const percent=n=>`${(Number(n)*100).toLocaleString('ko-KR',{maximumFractionDigits:3})}%`;
  const title=(kicker,name,sub='')=>`<div class="sheet-head"><div><div class="section-kicker">${esc(kicker)}</div><h2>${esc(name)}</h2>${sub?`<p>${esc(sub)}</p>`:''}</div><button class="close-btn" data-action="close" aria-label="닫기">×</button></div>`;
  let selected=[],partySiteId=null,intelSite=null,intelTab='enemies';
  function progressText(s){return unlocked(s)?'보스 출현 해금 · 조우당 1.5%':`보스 출현까지 ${fmt(Math.max(0,500-battles(s)))}전`;}
  const clearReward=s=>s.id==='hero_kingdom'?'첫 보스 처치로 용사 왕국 인수 완료':'첫 보스 처치 시 다음 챕터 개방';
  function profile(s){return s.chapter?.profiles?.[s.boss_name]||null;}
  function assessment(s,monsters,e=null){
    const p=profile(s);if(!p)return '';
    const party=monsters.map(m=>{const stats=window.forgeStats?.(m)||monsterStats(m);return {stats,skill:skillDef(m),hp:Math.min(stats.hp,Number(e?.battle_state?.partyHp?.[m.id]??stats.hp))}});
    const result=CampaignMath.assess(party,p);
    return `<section class="campaign-assessment ${result.key}" aria-live="polite"><div><small>선택 파티의 보스 대응력</small><b>${esc(result.label)}</b></div><ul>${result.reasons.map(r=>`<li>${esc(r)}</li>`).join('')}</ul><p>장비·스킬·현재 HP를 반영한 추정입니다. 치명타·회피·회복 시점에 따라 결과가 달라집니다.</p></section>`;
  }
  function card(s){
    const e=expedition(s.id),p=s.progress||{},party=e?partyOf(e):[],clears=Number(p.boss_victories||(p.boss_cleared?1:0));
    const alive=party.filter(m=>Number(e.battle_state?.partyHp?.[m.id]??1)>0).length;
    return `<article class="campaign-card ${s.unlocked?'':'locked'}" data-campaign-site="${esc(s.id)}" style="--chapter-color:${esc(s.chapter.color||'#d3aa68')}"><button class="campaign-cover" data-campaign-action="mission" data-site="${esc(s.id)}" aria-label="${esc(s.name)} ${s.unlocked?'파티 편성':'해금 조건'}"><img src="${art(s)}" alt="${esc(s.name)} 작전 지역" width="1536" height="1024" loading="lazy"><span class="campaign-cover-copy"><small>${esc(s.chapter.subtitle)}</small><b>${esc(s.name)}</b><span>권장 Lv.${s.chapter.level.join('–')}${s.unlocked?'':' · 이전 보스 처치 필요'}</span></span>${p.boss_cleared?'<em class="campaign-clear">인수 완료</em>':''}</button><div class="campaign-card-body"><p class="campaign-objective">${esc(s.chapter.objective)}</p><div class="campaign-progress"><span><i style="width:${unlocked(s)?100:Math.min(100,battles(s)/5)}%"></i></span><small>${unlocked(s)?'출현 해금':`${fmt(Math.min(500,battles(s)))}/500전`}</small></div><div class="campaign-live"><b>${e?e.battle_state?.active&&e.battle_state?.boss?'보스 교전 중':`${esc(e.phase||'탐색')} · 생존 ${alive}/${party.length}`:progressText(s)}</b><small>${clears?`보스 ${fmt(clears)}회 처치 · ${date(p.boss_cleared_at)}`:clearReward(s)}</small></div><div class="campaign-card-actions"><button data-campaign-action="mission" data-site="${esc(s.id)}">${e?'파티 확인':s.unlocked?'파티 편성':'해금 조건'}</button><button data-campaign-action="intel" data-site="${esc(s.id)}">적·보상 도감</button><button data-action="collect-site" data-site="${esc(s.id)}" ${siteHasCollectable(s.id)?'':'disabled'}>수거 ${fmt(sitePending(s.id))}</button></div></div></article>`;
  }
  function hunt(){return `<div class="campaign-heading"><small>EXPANSION PLAN</small><h2>오늘의 박멸 영업</h2><p>산골 첫 영업부터 용사 왕국 인수까지.</p></div><aside class="campaign-rule">일반 전투 <b>500회</b> 완료 → 보스 출현 해금<br>이후 조우마다 <b>1.5%</b>로 등장 · 첫 처치 시 다음 챕터 개방</aside><div class="campaign-list">${S.sites.map(card).join('')}</div>`;}
  function nextStep(){
    const active=(S.expeditions||[]).filter(e=>e.active),current=S.sites.find(s=>s.unlocked&&!s.progress?.boss_cleared)||[...S.sites].reverse().find(s=>s.unlocked);
    const readySell=(S.sellJobs||[]).find(j=>j.status==='ready'),readyCraft=(S.craftJobs||[]).find(j=>j.status==='ready');
    if(readySell)return {title:'판매 대금이 도착했습니다',copy:'상점에서 정산하고 다음 시설 확장에 투자하세요.',action:'shop',label:'상점 정산'};
    if(readyCraft&&!inventoryQty(readyCraft.output_item)&&inventoryUsed()>=Number(S.storageCapacity||40))return {title:'완성품을 받을 공간이 필요합니다',copy:'재고를 판매하거나 창고를 확장하세요. 완성품은 제작소에 안전하게 보관됩니다.',action:'shop',label:'재고 판매'};
    if(readyCraft)return {title:'완성품을 출고하세요',copy:'제작소에서 수령한 뒤 상점에 판매할 수 있습니다.',action:'workshop',label:'제작소 확인'};
    const down=active.find(e=>partyOf(e).some(m=>Number(e.battle_state?.partyHp?.[m.id]??1)<=0));
    if(down)return {title:'전투불능 직원이 있습니다',copy:'파티를 재편해 부상으로 비어 있는 자리를 채우세요.',site:down.site_id,label:'파티 재정비'};
    const evolve=S.monsters.find(m=>readyBranches(m).length);
    if(evolve){
      const deployed=activeOf(evolve.id);
      if(deployed)return {title:`${evolve.name}, 전직 준비 완료`,copy:'성장 한도에 도달했습니다. 파티를 복귀시킨 뒤 전직하면 다시 성장할 수 있습니다.',site:deployed.site_id,label:'파티 확인'};
      return {title:`${evolve.name}, 전직할 시간입니다`,copy:'레벨을 유지하며 새 스킬과 능력치를 얻습니다.',action:'evolution',id:evolve.id,label:'전직 선택'};
    }
    if(S.monsters.length<3&&S.candidates.length)return {title:'첫 박멸조를 꾸리세요',copy:'영입은 무료입니다. 회복 담당과 공격수를 함께 고용해 보세요.',action:'candidates',label:'직원 영입'};
    const incoming=new Set(S.expeditions.flatMap(e=>Object.entries(e.pending_loot||{}).filter(([id,n])=>n>0&&!inventoryQty(id)).map(([id])=>id)));
    if(inventoryUsed()+incoming.size>Number(S.storageCapacity||40)&&S.player.gold>=facilityCost('storage'))return {title:'새 전리품을 위한 창고 확장',copy:`새 품목 ${incoming.size}종이 현장에 보관되어 있습니다. 창고를 확장하면 안전하게 수거할 수 있습니다.`,action:'warehouse',label:'창고 확장'};
    if(inventoryUsed()>=Number(S.storageCapacity||40)-2)return {title:'창고에 여유를 만드세요',copy:'재고를 판매하거나 창고를 확장하면 전리품을 계속 수거할 수 있습니다. 현장 보상은 사라지지 않습니다.',action:'shop',label:'재고 판매'};
    const cargo=S.sites.find(s=>siteHasCollectable(s.id)&&sitePending(s.id)>=20);
    if(cargo)return {title:'현장 전리품을 회수하세요',copy:`${cargo.name}의 물품으로 제작과 장비 준비를 이어가세요.`,action:'collect-site',site:cargo.id,label:'전리품 수거'};
    const product=(S.inventory||[]).find(row=>row.qty>0&&S.recipes.some(r=>r.output_item===row.item_id));
    if(product&&!activeSellJobs().length)return {title:'완성품을 매출로 바꾸세요',copy:`창고의 ${product.item_id}을 판매해 시설 확장 자금을 마련하세요.`,action:'shop',label:'판매 시작'};
    const lockedCraft=(S.recipes||[]).find(r=>r.workshop_level>(S.player.workshop_level||1)&&craftMaxQty(r)>0);
    if(lockedCraft&&S.player.gold>=facilityCost('workshop'))return {title:'제작소를 확장할 시간입니다',copy:`${lockedCraft.output_item}의 재료가 모였습니다. 제작소 Lv.${lockedCraft.workshop_level}에서 가공할 수 있습니다.`,action:'workshop',label:'제작소 확장'};
    const craft=(S.recipes||[]).find(r=>r.workshop_level<=(S.player.workshop_level||1)&&craftMaxQty(r)>0);
    if(craft&&!activeCraftJobs().length)return {title:'전리품을 매출로 바꿀 시간',copy:`${craft.output_item}을 만들 재료가 모였습니다.`,action:'workshop',label:'제작 시작'};
    if(current)return {title:active.some(e=>e.site_id===current.id)?progressText(current):`${current.name} 영업을 시작하세요`,copy:current.chapter.objective,site:current.id,label:active.some(e=>e.site_id===current.id)?'작전 확인':'파티 편성'};
    return null;
  }
  function guide(){if(!enabled())return '';const step=nextStep();if(!step)return '';return `<section class="campaign-next" data-campaign-guide><span class="campaign-guide-seal" aria-hidden="true">!</span><div><small>비서실의 다음 업무</small><b>${esc(step.title)}</b><p>${esc(step.copy)}</p></div><button ${step.action?`data-action="${step.action}"`:'data-campaign-action="mission"'} ${step.site?`data-site="${esc(step.site)}"`:''} ${step.id?`data-id="${esc(step.id)}"`:''}>${esc(step.label)} →</button></section>`;}
  function openMission(id,keep=false){
    const s=siteBy(id);if(!s?.chapter)return false;
    if(!s.unlocked){openIntel(id,'boss');return true;}
    if(window.ExpeditionUI?.showActive(id))return true;
    if(!keep||partySiteId!==id){selected=[];partySiteId=id;}
    selected=selected.filter(mid=>S.monsters.some(m=>m.id===mid)&&!activeOf(mid));
    const party=S.monsters.filter(m=>selected.includes(m.id));
    // Selecting a colleague updates the existing sheet, preserving scroll and
    // keyboard focus even with a long roster.
    const sheet=document.querySelector('.campaign-party-sheet');
    if(keep&&sheet){
      sheet.querySelectorAll('[data-campaign-action="pick"]').forEach(row=>{
        const chosen=selected.includes(row.dataset.id);
        row.classList.toggle('selected',chosen);row.setAttribute('aria-pressed',String(chosen));
        row.querySelector('em').textContent=chosen?'선택':row.disabled?'출동 중':'+';
      });
      sheet.querySelector('.campaign-assessment').outerHTML=assessment(s,party);
      sheet.querySelector('.campaign-launch>span').textContent=`${party.length}/4명 선택 · 출정 후 자동 탐험`;
      sheet.querySelector('[data-campaign-action="launch"]').disabled=!party.length;
      return true;
    }
    modal(`${title(s.chapter.subtitle,s.name,progressText(s))}<p class="campaign-objective">${esc(s.chapter.objective)}</p><button class="campaign-info-link" data-campaign-action="intel" data-site="${esc(id)}">적 스킬 · 보스 기록 · 전리품 보기 →</button><div class="campaign-party-list">${S.monsters.map(m=>{const occupied=!!activeOf(m.id),chosen=selected.includes(m.id);return `<button class="campaign-party-row ${chosen?'selected':''}" data-campaign-action="pick" data-site="${esc(id)}" data-id="${esc(m.id)}" aria-pressed="${chosen}" ${occupied?'disabled':''}><span>${charSvg(monsterAsset(m.family),'party-sprite '+formClass(m))}</span><span><b>${esc(m.name)} · Lv.${m.level}</b><small>${esc(roleOf(m))}${occupied?' · 다른 작전 출동 중':''}</small></span><em>${chosen?'선택':occupied?'출동 중':'+'}</em></button>`}).join('')}</div>${assessment(s,party)}<div class="campaign-launch"><span>${party.length}/4명 선택 · 출정 후 자동 탐험</span><button class="primary-btn" data-campaign-action="launch" data-site="${esc(id)}" ${party.length?'':'disabled'}>박멸조 출정</button></div>`,'campaign-party-sheet');
    return true;
  }
  function activeIntel(s,e){if(!s.chapter)return '';return `<div data-campaign-active-intel>${assessment(s,partyOf(e),e)}<button class="campaign-info-link" data-campaign-action="intel" data-site="${esc(s.id)}">${esc(progressText(s))} · 공략과 기록 →</button></div>`;}
  function dropRows(s,enemy=null){
    const loot=s.loot.filter(l=>enemy?l.source==='kill'&&[enemy,'*'].includes(l.enemy):l.source==='scavenge');
    return `<div class="campaign-drops">${loot.map(l=>{const d=itemDef(l.id);return `<div class="campaign-drop ${rarityClass(d?.rarity)}"><span>${itemSvg(itemAsset(l.id))}</span><div><b>${esc(l.id)}</b><small>${esc(d?.rarity||'재료')} · ${l.min===l.max?l.min:`${l.min}–${l.max}`}개</small></div><strong>${percent(l.chance)}</strong></div>`}).join('')}</div>`;
  }
  function enemies(s){return `<p class="campaign-hint">능력치는 1배 기준입니다. 실제 전투에서는 살아 있는 파티 인원에 따라 적 HP와 공격력이 조정됩니다.</p>${s.enemy_names.map(name=>{const p=s.chapter.profiles[name];return `<details class="campaign-enemy"><summary><span>${charSvg(enemyAsset(name))}</span><span><b>${esc(name)}</b><small>${esc(p.role)} · HP ${p.hp} · 공격 ${p.atk} · 방어 ${p.def}</small></span><i>＋</i></summary><div><p><b>${esc(p.skill.name)}</b> · ${p.skill.every}번째 공격마다</p><p>${esc(p.counter)}</p>${dropRows(s,name)}</div></details>`}).join('')}`;}
  function boss(s){const p=s.progress||{},b=profile(s),e=expedition(s.id),party=e?partyOf(e):[];return `<section class="campaign-boss-header"><span>${charSvg(enemyAsset(s.boss_name),'campaign-boss-sprite')}</span><div><small>최종 결재권자</small><h3>${esc(s.boss_name)}</h3><p>HP ${b.hp} · 공격 ${b.atk} · 방어 ${b.def}</p></div></section><p class="campaign-rule">${esc(progressText(s))}<br>${clearReward(s)}. 이후에도 같은 확률로 다시 만납니다.</p><section class="campaign-boss-plan"><b>${esc(b.skill.name)}</b><p>${b.skill.every}번째 공격마다 피해 ×${b.skill.multiplier}${b.skill.ignore?` · 방어 ${percent(b.skill.ignore)} 관통`:''}${b.skill.heal?` · 자기 HP ${percent(b.skill.heal)} 회복`:''}</p><p>${esc(b.counter)}</p></section>${party.length?assessment(s,party,e):'<p class="campaign-hint">파티 편성에서 직원을 선택하면 보스 대응력을 확인할 수 있습니다.</p>'}<dl class="campaign-record"><div><dt>처치 / 조우</dt><dd>${fmt(p.boss_victories||(p.boss_cleared?1:0))} / ${fmt(p.boss_attempts||0)}</dd></div><div><dt>최초 처치</dt><dd>${date(p.first_boss_cleared_at||p.boss_cleared_at)}</dd></div><div><dt>최근 처치</dt><dd>${date(p.boss_cleared_at)}</dd></div></dl><div class="campaign-history">${(p.boss_history||[]).slice(0,5).map(h=>`<div><b>${h.result==='win'?'박멸 성공':h.result==='loss'?'패배':'전투 종료'}</b><span>${date(h.at)} · ${h.rounds||'-'}턴</span></div>`).join('')||'<p>아직 저장된 보스 전적이 없습니다.</p>'}</div><h3 class="campaign-subtitle">보스 전리품</h3><p class="campaign-hint">이 챕터의 모든 적 전리품과 전설 전용 장비. 전설은 한 번에 최대 1개이며, 두 장비의 기본 확률은 각각 0.75%입니다.</p>${dropRows(s,s.boss_name)}`;}
  function rewards(s){return `<h3 class="campaign-subtitle">바닥에서만 줍는 재료</h3><p class="campaign-hint">아래 확률은 물품을 발견했을 때의 선택 비율입니다. 수색 행동의 기본 발견율은 10%, 수거 행동은 18%입니다. 적이나 보스에게서는 나오지 않습니다. 현장 재료는 3,000개까지 보관하며, 장비는 별도 보관되어 재료 한도 때문에 사라지지 않습니다.</p>${dropRows(s)}<h3 class="campaign-subtitle">적 처치 보상</h3><p class="campaign-hint">적별 전용 재료와 장비는 ‘출현 적’에서 확인하세요. 보스는 같은 챕터의 적 보상을 공유합니다. 약탈광·수집광 보너스는 최대 20%까지 곱해집니다.</p><h3 class="campaign-subtitle">이 지역의 회사 상품</h3>${S.recipes.filter(r=>r.id.startsWith('campaign_'+s.id+'_')).map(r=>`<div class="campaign-product"><b>${esc(r.output_item)}</b><p>${Object.entries(r.inputs).map(([k,n])=>`${esc(k)} ×${n}`).join(' · ')}</p><small>판매 ${fmt(r.sale_gold)}G · 제작소 Lv.${r.workshop_level}</small></div>`).join('')}`;}
  function openIntel(id,tab='enemies'){
    const s=siteBy(id);if(!s?.chapter)return;intelSite=id;intelTab=tab;
    modal(`${title('작전 도감',s.name,s.chapter.subtitle)}<nav class="campaign-tabs" aria-label="도감 분류">${[['enemies','출현 적'],['boss','보스·전적'],['rewards','획득·제작']].map(([key,label])=>`<button data-campaign-action="tab" data-tab="${key}" aria-pressed="${key===tab}">${label}</button>`).join('')}</nav><div class="campaign-intel-body">${tab==='boss'?boss(s):tab==='rewards'?rewards(s):enemies(s)}</div><button class="campaign-info-link" data-campaign-action="mission" data-site="${esc(id)}">${s.unlocked?'파티 화면으로 돌아가기':'이전 챕터 보스 처치 후 출정할 수 있습니다.'}</button>`,'campaign-intel-sheet');
  }
  function refresh(){if(!enabled())return;
    document.querySelectorAll('.campaign-card').forEach(el=>{const s=siteBy(el.dataset.campaignSite);if(s){const wrap=document.createElement('div');wrap.innerHTML=card(s);if(el.outerHTML!==wrap.firstElementChild.outerHTML)el.replaceWith(wrap.firstElementChild);}});
    const g=document.querySelector('[data-campaign-guide]');if(g){const wrap=document.createElement('div');wrap.innerHTML=guide();if(wrap.firstElementChild&&g.outerHTML!==wrap.firstElementChild.outerHTML)g.replaceWith(wrap.firstElementChild);}
    const a=document.querySelector('[data-campaign-active-intel]'),e=a&&expedition(partySite);if(a&&e){const wrap=document.createElement('div');wrap.innerHTML=activeIntel(siteBy(e.site_id),e);if(a.outerHTML!==wrap.firstElementChild.outerHTML)a.replaceWith(wrap.firstElementChild);}
    const body=document.querySelector('.campaign-intel-sheet .campaign-intel-body'),s=siteBy(intelSite);
    if(body&&s&&intelTab==='boss'){
      const wrap=document.createElement('div');wrap.innerHTML=boss(s);
      if(body.innerHTML!==wrap.innerHTML){
        const sheet=body.closest('.sheet'),scroll=sheet.scrollTop;
        body.replaceChildren(...wrap.childNodes);sheet.scrollTop=scroll;
      }
    }
  }
  document.addEventListener('click',event=>{
    const b=event.target.closest('[data-campaign-action]');if(!b)return;
    const action=b.dataset.campaignAction,id=b.dataset.site;
    if(action==='mission')openMission(id,partySiteId===id);
    else if(action==='intel')openIntel(id);
    else if(action==='tab')openIntel(intelSite,b.dataset.tab);
    else if(action==='pick'){if(selected.includes(b.dataset.id))selected=selected.filter(x=>x!==b.dataset.id);else if(selected.length<4)selected.push(b.dataset.id);else{toast('파티는 최대 4명입니다.');return}openMission(id,true);}
    else if(action==='launch')window.ExpeditionUI?.launch(id,[...selected]);
  });
  window.Campaign={enabled,hunt,guide,openMission,openIntel,activeIntel,refresh,assessment,art};
})();
