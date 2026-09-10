/* Render server-awarded receipts, never client-side loot rolls. */
(()=>{
  const rank={전설:5,영웅:4,희귀:3,고급:2,일반:1};
  const entries=drops=>Object.entries(drops||{}).filter(([,qty])=>Number(qty)>0)
    .sort(([a],[b])=>(rank[itemDef(b)?.rarity]||0)-(rank[itemDef(a)?.rarity]||0)||a.localeCompare(b,'ko'));
  function receipt(drops,{gearOnly=false,stored=false}={}){
    const rows=entries(drops).filter(([id])=>!gearOnly||itemDef(id)?.kind==='equipment');
    if(!rows.length)return '';
    return `<div class="campaign-receipt">${rows.map(([id,qty])=>{const d=itemDef(id),gear=d?.kind==='equipment';return `<div class="campaign-receipt-row ${rarityClass(d?.rarity)} ${gear?'gear':''}"><span>${itemSvg(itemAsset(id))}</span><div><small>${gear?esc(d.rarity)+' 장비 발견':'획득 재료'}</small><b>${esc(id)}</b>${gear?`<p>${esc(d.description||'')}</p>`:''}</div><strong>×${fmt(qty)}</strong></div>`}).join('')}<small class="campaign-receipt-note">${stored?'창고 보관 완료 · 장비는 직원 상세에서 비교·장착하세요.':'현장에 보관 중 · 전리품 수거로 창고에 옮기세요.'}</small></div>`;
  }
  function source(itemId){
    const d=itemDef(itemId),a=d?.acquisition,site=(S?.sites||[]).find(s=>s.id===a?.site);
    if(!site)return '';
    const text=a.source==='scavenge'?'바닥 수색 전용':a.bossExclusive?`${site.boss_name} 전용`:[a.enemy,a.boss].filter(Boolean).join(' · ')||a.enemy||'적 처치';
    return `<div class="campaign-source"><small>획득처</small><b>${esc(site.name)} · ${esc(text)}</b><button class="campaign-info-link" data-campaign-action="intel" data-site="${esc(site.id)}">획득 확률과 공략 보기</button></div>`;
  }
  function comparison(m,def,level){
    if(!window.forgeCompare)return '';
    const {before,after}=forgeCompare(m,def.id,level);
    const fields=[['hp','HP'],['atk','공격'],['def','방어'],['spd','속도'],['crit','치명'],['evade','회피'],['human','인간 피해']];
    const changes=fields.map(([key,label])=>{const percent=['crit','evade','human'].includes(key),delta=(after[key]-before[key])*(percent?100:1);return {key,label,percent,delta:Math.round(delta*100)/100}}).filter(x=>x.delta!==0);
    return `<span class="campaign-compare" aria-label="현재 장비 대비 능력치 변화">${changes.length?changes.map(x=>`<span class="${x.delta>0?'up':'down'}">${x.label} ${x.delta>0?'+':''}${x.delta}${x.percent?'%p':''}</span>`).join(''):'<span>현재 장비와 능력치 동일</span>'}</span>`;
  }
  function pending(e){
    const gear=entries(e.pending_loot).filter(([id])=>itemDef(id)?.kind==='equipment');
    if(!gear.length)return '';
    return `<section class="campaign-pending-gear"><h3>현장에서 발견한 장비</h3>${receipt(Object.fromEntries(gear.slice(0,3)),{gearOnly:true})}${gear.length>3?`<p>외 ${gear.length-3}종의 장비가 보관되어 있습니다.</p>`:''}<button class="campaign-info-link" data-action="collect-site" data-site="${esc(e.site_id)}">장비와 전리품 수거</button></section>`;
  }
  window.CampaignLoot={receipt,source,comparison,pending};
})();
