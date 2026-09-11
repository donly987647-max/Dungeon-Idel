/* Queue-first production and sales, with server-owned automatic completion. */
(()=>{
 const filters={text:'',chapter:'',rarity:'',slot:'',kind:'',available:false};let current='craft',limit=24;
 const duration=n=>{n=Math.max(0,Math.ceil(Number(n)||0));return n>=3600?`${Math.floor(n/3600)}시간 ${Math.floor(n%3600/60)}분`:n>=60?`${Math.floor(n/60)}분 ${n%60}초`:`${n}초`};
 const rows=mode=>(mode==='craft'?(S?.craftJobs||[]):(S?.sellJobs||[])).filter(j=>['running','queued','ready'].includes(j.status)).sort((a,b)=>new Date(a.started_at)-new Date(b.started_at));
 const header=(name,sub)=>`<div class="sheet-head"><div><div class="section-kicker">COMPANY OPERATIONS</div><h2>${name}</h2><p>${sub}</p></div><button class="close-btn" data-action="close" aria-label="닫기">×</button></div>`;
 function jobs(mode){const list=rows(mode);return list.length?list.map(j=>{
  const item=mode==='craft'?j.output_item:j.item_id,qty=mode==='craft'?j.output_qty:j.quantity,start=+new Date(j.started_at),end=+new Date(j.finish_at),waiting=start>Date.now(),left=Math.max(0,(end-Date.now())/1000),pct=Math.min(100,Math.max(0,(Date.now()-start)/Math.max(1,end-start)*100));
  return `<article class="idle-job" data-idle-job="${esc(j.id)}"><span>${itemSvg(itemAsset(item))}</span><div><b>${esc(item)} ×${fmt(qty)}</b><small>${j.status==='ready'?'창고 공간 확보 후 자동 수령':left===0?'자동 처리 중':waiting?'예약 · '+duration((start-Date.now())/1000)+' 후 시작':duration(left)+' 남음'}</small><i class="idle-progress"><em style="width:${pct}%"></em></i></div>${left>0?`<button class="soft-btn" data-idle-econ="cancel" data-mode="${mode}" data-id="${esc(j.id)}">취소</button>`:''}</article>`;
 }).join(''):`<div class="idle-empty"><span>${mode==='craft'?'⚒':'▣'}</span><b>진행 중인 ${mode==='craft'?'제작':'판매'}이 없습니다</b><p>${mode==='craft'?'아래에서 만들 상품이나 장비를 선택해 제작을 예약하세요.':'아래에서 판매할 품목과 수량을 선택하세요.'}</p></div>`;}
 function show(mode){window.OfficeUI?.ack(mode);current=mode;limit=24;Object.assign(filters,{text:'',chapter:'',rarity:'',slot:'',kind:'',available:false});const facility=mode==='craft'?'workshop':'shop',lv=S.player[facility+'_level'];
  modal(`${header(mode==='craft'?'제작소':'상점','완성품 수령과 판매 대금 정산은 자동으로 처리됩니다.')}<div class="idle-facility"><span>Lv.${lv} · 예약 ${rows(mode).filter(j=>j.status!=='ready').length}/${lv+4}</span>${lv<5?`<button class="soft-btn" data-action="upgrade" data-id="${facility}">확장 ${fmt(facilityCost(facility))}G</button>`:'<b>최대 확장</b>'}</div><div class="idle-jobs" data-idle-jobs="${mode}">${jobs(mode)}</div><button class="primary-btn idle-add" data-idle-econ="catalog">＋ ${mode==='craft'?'제작':'판매'} 대기열 추가</button><section class="idle-catalog" hidden></section>`,'economy-sheet idle-economy-sheet');document.querySelector('.idle-economy-sheet').dataset.mode=mode;
 }
 function options(values){return values.map(([v,n])=>`<option value="${esc(v)}">${esc(n)}</option>`).join('')}
 function openCatalog(){const panel=document.querySelector('.idle-catalog');if(!panel)return;panel.hidden=false;
  panel.innerHTML=`<div class="idle-filter-head"><b>${current==='craft'?'제작할 아이템':'판매할 아이템'}</b><button class="soft-btn" data-idle-econ="hide">목록 접기</button></div><div class="idle-filters"><input type="search" aria-label="아이템 검색" placeholder="이름으로 검색" data-idle-filter="text"><select aria-label="챕터 필터" data-idle-filter="chapter">${options([['','모든 챕터'],...S.sites.map(s=>[s.id,s.name])])}</select><select aria-label="종류 필터" data-idle-filter="kind">${options([['','모든 종류'],['goods','회사 상품'],['equipment','장비'],['material','재료']])}</select><select aria-label="등급 필터" data-idle-filter="rarity">${options([['','모든 등급'],...['일반','희귀','영웅','전설'].map(n=>[n,n])])}</select><select aria-label="부위 필터" data-idle-filter="slot">${options([['','모든 부위'],['weapon','무기'],['armor','방어구'],['accessory','장신구']])}</select>${current==='craft'?'<label><input type="checkbox" data-idle-filter="available"> 지금 제작 가능</label>':''}</div><p class="idle-filter-count" aria-live="polite"></p><div class="idle-catalog-list"></div><button class="soft-btn idle-more" data-idle-econ="more">더 보기</button>`;catalog();panel.querySelector('input').focus();
 }
 function availableItems(){
  if(current==='craft')return S.recipes.map(r=>({id:r.id,item:r.output_item,recipe:r,qty:craftMaxQty(r),def:itemDef(r.output_item),kind:r.sale_gold>0?'goods':'equipment'}));
  return S.inventory.filter(x=>x.qty>0).map(x=>({id:x.item_id,item:x.item_id,qty:x.qty,def:itemDef(x.item_id),recipe:S.recipes.find(r=>r.output_item===x.item_id&&r.sale_gold>0),sale:saleInfo(x.item_id)})).filter(x=>x.sale&&x.sale.unitGold>0&&x.def?.kind!=='equipment').map(x=>({...x,kind:x.recipe?'goods':'material'}));
 }
 function catalog(){const all=availableItems().filter(x=>{
  const site=x.def?.acquisition?.site||Object.keys(x.recipe?.inputs||{}).map(id=>itemDef(id)?.acquisition?.site).find(Boolean);
  return (!filters.text||x.item.includes(filters.text))&&(!filters.chapter||site===filters.chapter)&&(!filters.kind||x.kind===filters.kind)&&(!filters.rarity||x.def?.rarity===filters.rarity)&&(!filters.slot||x.def?.slot===filters.slot)&&(!filters.available||(x.qty>0&&x.recipe.workshop_level<=S.player.workshop_level));
 });const list=document.querySelector('.idle-catalog-list');if(!list)return;
  document.querySelector('.idle-filter-count').textContent=`${all.length}종 · ${Math.min(all.length,limit)}종 표시`;
  list.innerHTML=all.slice(0,limit).map(x=>{const r=x.recipe,locked=current==='craft'&&r.workshop_level>S.player.workshop_level,disabled=locked||x.qty<1;
   const copy=`<small>${esc(x.def?.rarity||'회사 상품')}${x.def?.slot?' · '+slotName(x.def.slot):''}</small><b>${esc(x.item)}</b><p>${current==='craft'?`제작 ${duration(r.craft_seconds)}${r.sale_gold>0?' · 판매 '+fmt(r.sale_gold)+'G':''}`:`보유 ${fmt(x.qty)}개 · 개당 ${fmt(x.sale.unitGold)}G`}</p>${current==='craft'?`<small>${Object.entries(r.inputs).map(([id,q])=>`${esc(id)} ${fmt(inventoryQty(id))}/${q}`).join(' · ')}</small>`:`<span class="idle-usage-cue">${window.ShopCraftingUsage.label(x.item)} <i aria-hidden="true">›</i></span>`}`;
   return `<article class="idle-item ${current==='sell'?'idle-sale-item ':''}${rarityClass(x.def?.rarity)}">${current==='sell'?`<button type="button" class="idle-item-open" data-idle-econ="usage" data-id="${esc(x.item)}" aria-label="${esc(x.item)} 제작 용도 확인"><span class="idle-item-icon">${itemSvg(itemAsset(x.item))}</span><span class="idle-item-copy">${copy}</span></button>`:`<span>${itemSvg(itemAsset(x.item))}</span><div>${copy}</div>`}<button type="button" class="primary-btn idle-item-queue" data-idle-econ="setup" data-id="${esc(x.id)}" data-mode="${current}" ${disabled?'disabled':''}>${locked?'제작소 Lv.'+r.workshop_level:x.qty<1?'재료 부족':current==='sell'?'판매':'추가'}</button></article>`;
  }).join('')||'<p class="idle-empty">조건에 맞는 아이템이 없습니다.</p>';
  document.querySelector('.idle-more').hidden=all.length<=limit;
 }
 function setup(id,mode=current){
  current=mode;
  const x=availableItems().find(x=>x.id===id);if(!x){toast(mode==='sell'?'판매 가능한 재고가 없습니다.':'제작법을 찾을 수 없습니다.');return;}
  const check=mode==='craft'?window.ShopCraftingUsage.recipeState(x.recipe):window.ShopCraftingUsage.saleState(x.item);
  if(check.disabled){toast(check.label);return;}
  const max=Math.min(100,x.qty);
  modal(`${header(esc(x.item),'예약 수량을 선택하세요.')}<div class="idle-batch-icon">${itemSvg(itemAsset(x.item))}</div><label class="idle-quantity">수량 <input type="number" min="1" max="${max}" value="1" id="idleQuantity" inputmode="numeric"></label><p>최대 ${fmt(max)}개 · 개당 ${duration(current==='craft'?x.recipe.craft_seconds:x.sale.unitSeconds)}</p><button class="primary-btn idle-add" data-idle-econ="confirm" data-id="${esc(id)}" data-mode="${current}">${current==='craft'?'제작':'판매'} 대기열에 추가</button>`,'economy-sheet idle-quantity-sheet');
 }
 function readCatalogContext(){
  const mode=document.querySelector('[data-idle-jobs]')?.dataset.idleJobs;
  if(mode==='craft'||mode==='sell')current=mode;
  document.querySelectorAll('[data-idle-filter]').forEach(input=>{filters[input.dataset.idleFilter]=input.type==='checkbox'?input.checked:input.value;});
 }
 async function run(button){if(busy)return;busy=true;button.disabled=true;try{const mode=button.dataset.mode||current,id=button.dataset.id;
  if(button.dataset.idleEcon==='cancel'){const {error}=await sb.rpc(mode==='craft'?'game_cancel_craft':'game_cancel_sell',{p_job:id});if(error)throw error;await api('state-lite');show(mode);toast('예약을 취소하고 투입 물품을 돌려받았습니다.');}
  else{const input=document.querySelector('#idleQuantity'),qty=Math.floor(Number(input.value));if(!Number.isFinite(qty)||qty<1||qty>Number(input.max))throw Error('quantity_invalid');await api(mode==='craft'?'craft':'sell',mode==='craft'?{recipeId:id,quantity:qty}:{itemId:id,quantity:qty});show(mode);toast('대기열에 추가했습니다.');}render();
 }catch(e){toast(errorKo(e.message));button.disabled=false;}finally{busy=false;}}
 document.addEventListener('click',e=>{const old=e.target.closest('[data-action="workshop"],[data-action="shop"]'),b=e.target.closest('[data-idle-econ]');if(!old&&!b)return;e.preventDefault();e.stopImmediatePropagation();if(old){show(old.dataset.action==='workshop'?'craft':'sell');return;}if(b.disabled)return;readCatalogContext();const a=b.dataset.idleEcon;if(a==='usage'){window.ShopCraftingUsage.show(b.dataset.id);return;}if(a==='usage-filter'){window.ShopCraftingUsage.refresh(b.dataset.filter);return;}if(a==='usage-sell'){setup(b.dataset.id,'sell');return;}if(a==='usage-craft'){setup(b.dataset.id,'craft');return;}if(a==='catalog')openCatalog();else if(a==='hide')document.querySelector('.idle-catalog').hidden=true;else if(a==='more'){limit+=24;catalog();}else if(a==='setup')setup(b.dataset.id,b.dataset.mode||current);else if(a==='confirm'||a==='cancel')run(b);},true);
 document.addEventListener('input',e=>{if(!e.target.matches('[data-idle-filter]'))return;readCatalogContext();filters[e.target.dataset.idleFilter]=e.target.type==='checkbox'?e.target.checked:e.target.value;limit=24;catalog();});
 document.addEventListener('change',e=>{if(!e.target.matches('select[data-idle-filter]'))return;readCatalogContext();filters[e.target.dataset.idleFilter]=e.target.value;limit=24;catalog();});
 function refresh(){window.ShopCraftingUsage?.refresh();const box=document.querySelector('[data-idle-jobs]');if(box){const html=jobs(box.dataset.idleJobs);if(html!==box.innerHTML)box.innerHTML=html;}}
 setInterval(refresh,1000);window.IdleEconomy={show,refresh,duration,setup,getJobs:rows};
})();
