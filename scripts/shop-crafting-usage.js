/* Item-to-recipe inspection. Read-only until an existing queue action is explicitly chosen. */
(()=>{
 const duration=n=>window.IdleEconomy.duration(n);
 const rows=mode=>window.IdleEconomy.getJobs(mode);
 const header=(name,sub)=>`<div class="sheet-head"><div><div class="section-kicker">ITEM USES</div><h2>${name}</h2><p>${sub}</p></div><button class="close-btn" data-action="close" aria-label="닫기">×</button></div>`;
 // Index actual recipe inputs, including recipes locked by facility level.
 // Cache only static relationships; stock and availability are read when displayed.
 let recipeSource=null,usageIndex=new Map(),outputIndex=new Map();
 function recipeIndexes(){
  const source=S?.recipes;
  if(source===recipeSource)return;
  recipeSource=source;usageIndex=new Map();outputIndex=new Map();
  for(const recipe of Array.isArray(source)?source:[]){
   if(!recipe?.id||!recipe.output_item)continue;
   const inputs=Object.entries(recipe.inputs||{}).filter(([,qty])=>Number(qty)>0);
   if(!inputs.length)continue;
   if(!outputIndex.has(recipe.output_item))outputIndex.set(recipe.output_item,[]);
   outputIndex.get(recipe.output_item).push(recipe);
   for(const [item] of inputs){
    if(!usageIndex.has(item))usageIndex.set(item,[]);
    usageIndex.get(item).push(recipe);
   }
  }
 }
 function recipesUsing(item){recipeIndexes();return usageIndex.get(item)||[];}
 function isGear(recipe){const def=itemDef(recipe.output_item);return def?.kind==='equipment'||!!def?.slot;}
 function recipeState(recipe){
  const required=Math.max(1,Number(recipe.workshop_level)||1),locked=required>Number(S?.player?.workshop_level||1);
  const max=Math.max(0,craftMaxQty(recipe));
  const full=rows('craft').filter(j=>j.status!=='ready').length>=Number(S?.craftCapacity||Number(S?.player?.workshop_level||1)+4);
  return {locked,max,full,required,disabled:locked||max<1||full,label:locked?`제작소 Lv.${required} 필요`:max<1?'재료 부족':full?'제작 대기열 가득 참':'지금 제작 가능'};
 }
 function saleState(item){
  const sale=saleInfo(item),qty=Math.max(0,inventoryQty(item)),gear=itemDef(item)?.kind==='equipment';
  const full=rows('sell').filter(j=>j.status!=='ready').length>=Number(S?.shopCapacity||Number(S?.player?.shop_level||1)+4);
  const allowed=!!sale&&Number(sale.unitGold)>0&&!gear;
  return {sale,qty,allowed,full,disabled:!allowed||qty<1||full,label:!allowed?'상점 판매 불가':qty<1?'보유 수량 없음':full?'판매 대기열 가득 참':'판매 수량 선택'};
 }
 function itemUsageLabel(item){
  if(!Array.isArray(S?.recipes))return '제작법 확인 필요';
  const n=recipesUsing(item).length;
  if(n)return `상위 제작 ${n}종`;
  if(item==='강화석')return '대장간 강화 재료';
  return '상위 제작법 없음';
 }
 function ingredientList(recipe,selected){
  return `<ul class="usage-ingredients">${Object.entries(recipe.inputs||{}).map(([item,need])=>{
   const stock=inventoryQty(item),short=stock<Number(need);
   return `<li class="${item===selected?'usage-selected-material':''}"><button type="button" data-idle-econ="usage" data-id="${esc(item)}" aria-label="${esc(item)} 제작 용도 확인"><span class="usage-small-icon">${itemSvg(itemAsset(item))}</span><span>${esc(item)}</span></button><span class="usage-ingredient-count ${short?'short':''}"><b>필요 ${fmt(need)}</b><small>보유 ${fmt(stock)}${short?' · 부족':''}</small></span></li>`;
  }).join('')}</ul>`;
 }
 function gearStats(item){
  const d=itemDef(item)||{};
  const parts=[['hp','HP'],['atk','공격'],['def','방어'],['spd','속도']].filter(([key])=>Number(d[key])).map(([key,label])=>`${label} ${Number(d[key])>0?'+':''}${fmt(d[key])}`);
  for(const [key,label] of [['crit','치명'],['evade','회피'],['human_damage','인간 피해']])if(Number(d[key]))parts.push(`${label} +${Math.round(Number(d[key])*100)}%`);
  return parts.length?`<p class="usage-gear-stats">${parts.map(x=>`<span>${esc(x)}</span>`).join('')}</p>`:'';
 }
 function usageRecipeCard(recipe,item){
  const state=recipeState(recipe),def=itemDef(recipe.output_item),equipment=isGear(recipe),made=Math.max(1,Number(recipe.output_qty)||1);
  return `<article class="usage-product" data-usage-recipe="${esc(recipe.id)}"><button type="button" class="usage-product-open" data-idle-econ="usage" data-id="${esc(recipe.output_item)}" aria-label="${esc(recipe.output_item)} 상세 확인"><span class="usage-product-icon">${itemSvg(itemAsset(recipe.output_item))}</span><span><small>${equipment?`${esc(def?.rarity||'장비')} · ${slotName(def?.slot)}`:'회사 상품'}</small><b>${esc(recipe.output_item)}</b><span class="usage-product-meta">이 재료 ×${fmt(recipe.inputs[item])} → ${fmt(made)}개 제작</span></span><i aria-hidden="true">›</i></button><div class="usage-product-status"><span class="${state.locked?'locked':state.max<1?'short':'available'}">${state.label}</span><span>${duration(recipe.craft_seconds)}</span></div><details data-usage-details="${esc(recipe.id)}"><summary>재료${equipment?' · 능력치':''} 확인</summary>${ingredientList(recipe,item)}${equipment?gearStats(recipe.output_item):`<p class="usage-sale-value">완제품 개당 판매 ${fmt(saleInfo(recipe.output_item)?.unitGold||recipe.sale_gold)}G</p>`}</details><button type="button" class="soft-btn usage-craft" data-idle-econ="usage-craft" data-id="${esc(recipe.id)}" ${state.disabled?'disabled':''}>${state.locked?'시설 레벨 부족':state.max<1?'재료 부족':state.full?'제작 예약 가득 참':'제작 수량 선택'}</button></article>`;
 }
 function usageSignature(){return JSON.stringify([S?.inventory,S?.player?.workshop_level,S?.player?.shop_level,S?.craftCapacity,S?.shopCapacity,rows('craft').map(j=>[j.id,j.status]),rows('sell').map(j=>[j.id,j.status]),S?.recipes]);}
 function usageContent(item,filter='all'){
  const recipes=recipesUsing(item),gear=recipes.filter(isGear),goods=recipes.filter(r=>!isGear(r)),s=saleState(item),def=itemDef(item),madeBy=outputIndex.get(item)||[];
  const special=item==='강화석'?'대장간에서 장비 강화에도 사용합니다.':def?.kind==='equipment'?'몬스터가 장착하는 장비입니다.':'';
  const noUse=!recipes.length&&!special;
  const sorted=[...recipes].filter(r=>filter==='gear'?isGear(r):filter==='goods'?!isGear(r):true).sort((a,b)=>Number(recipeState(a).disabled)-Number(recipeState(b).disabled)||(Number(a.workshop_level)||1)-(Number(b.workshop_level)||1)||(Number(a.sort_order)||0)-(Number(b.sort_order)||0));
  return `<div class="usage-item-hero"><span class="usage-hero-icon">${itemSvg(itemAsset(item))}</span><div><small>${esc(def?.kind==='equipment'?slotName(def.slot):madeBy.some(r=>Number(r.sale_gold)>0)?'회사 상품':'재료')}</small><b>${esc(item)}</b><span>보유 <strong>${fmt(s.qty)}</strong>개</span></div></div><div class="usage-purpose ${noUse?'no-recipe':''}"><b>${special||(!Array.isArray(S?.recipes)?'제작법 정보를 불러오지 못했습니다.':recipes.length?`상위 제작품 ${recipes.length}종에 사용`:madeBy.some(r=>Number(r.sale_gold)>0)?'판매용 상품 · 상위 제작법 없음':'등록된 상위 제작법 없음')}</b>${special&&recipes.length?`<span>상위 제작품 ${recipes.length}종에도 사용</span>`:''}${noUse?'<span>현재 등록된 제작법 기준입니다. 다른 용도는 아이템 설명을 확인하세요.</span>':''}</div>${def?.description?`<details class="usage-description"><summary>아이템 설명</summary><p>${esc(def.description)}</p>${def.kind==='equipment'?gearStats(item):''}</details>`:''}<div class="usage-sale-actions">${s.allowed?`<div><small>개당 판매</small><b>${fmt(s.sale.unitGold)}G</b><span>${duration(s.sale.unitSeconds)}</span></div><button type="button" class="primary-btn" data-idle-econ="usage-sell" data-id="${esc(item)}" ${s.disabled?'disabled':''}>${s.label}</button>`:`<span>${def?.kind==='equipment'?'장비는 상점 판매 대상이 아닙니다.':'상점에서 판매할 수 없는 아이템입니다.'}</span>`}</div>${madeBy.length?`<details class="usage-made-from"><summary>이 아이템 제작법</summary>${madeBy.map(r=>`<section><b>${fmt(Math.max(1,Number(r.output_qty)||1))}개 제작 · ${duration(r.craft_seconds)}</b>${ingredientList(r,item)}</section>`).join('')}</details>`:''}<div class="usage-section-title"><h3>상위 제작품</h3><span>${recipes.length}종</span></div>${recipes.length?`<div class="usage-tabs" role="group" aria-label="상위 제작품 종류">${[['all','전체',recipes.length],['gear','장비',gear.length],['goods','상품',goods.length]].map(([id,title,count])=>`<button type="button" data-idle-econ="usage-filter" data-filter="${id}" aria-pressed="${filter===id}" class="${filter===id?'active':''}">${title} ${count}</button>`).join('')}</div><div class="usage-products">${sorted.map(r=>usageRecipeCard(r,item)).join('')||'<p class="usage-empty">해당 종류의 상위 제작품이 없습니다.</p>'}</div>`:`<p class="usage-empty">${Array.isArray(S?.recipes)?'이 아이템을 재료로 사용하는 제작법이 없습니다.':'제작법 정보를 불러오지 못했습니다. 상점을 다시 열어 확인해 주세요.'}</p>`}`;
 }
 function showUsage(item){
  if(!item||(!itemDef(item)&&!recipesUsing(item).length&&!outputIndex.has(item)&&inventoryQty(item)<=0))return;
  modal(`${header('제작 용도',esc(item))}<section class="shop-usage-root" data-usage-item="${esc(item)}" data-usage-filter="all">${usageContent(item)}</section>`,'economy-sheet shop-usage-sheet');
  document.querySelector('.shop-usage-root').dataset.usageSignature=usageSignature();
 }
 function refreshUsage(filter){
  const root=document.querySelector('.shop-usage-root');if(!root)return;
  const signature=usageSignature();if(!filter&&root.dataset.usageSignature===signature)return;
  const open=[...root.querySelectorAll('details[open]')].map(el=>el.dataset.usageDetails||el.className),sheet=root.closest('.sheet'),scroll=sheet?.scrollTop||0;
  root.dataset.usageFilter=filter||root.dataset.usageFilter||'all';
  root.innerHTML=usageContent(root.dataset.usageItem,root.dataset.usageFilter);root.dataset.usageSignature=signature;
  root.querySelectorAll('details').forEach(el=>{el.open=open.includes(el.dataset.usageDetails||el.className);});
  if(sheet)sheet.scrollTop=scroll;
 }
 window.ShopCraftingUsage={label:itemUsageLabel,show:showUsage,refresh:refreshUsage,recipeState,saleState};
})();
