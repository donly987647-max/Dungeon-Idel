from pathlib import Path

p=Path('scripts/idle-economy-v016.js');s=p.read_text()
if 'window.ShopCraftingUsage.label' not in s:
    assert s.count("mode==='craft'?S.craftJobs:S.sellJobs||[]")==1
    s=s.replace("mode==='craft'?S.craftJobs:S.sellJobs||[]","mode==='craft'?(S?.craftJobs||[]):(S?.sellJobs||[])")
    a=s.index('  list.innerHTML=all.slice');b=s.index("  document.querySelector('.idle-more')",a)
    s=s[:a]+'''  list.innerHTML=all.slice(0,limit).map(x=>{const r=x.recipe,locked=current==='craft'&&r.workshop_level>S.player.workshop_level,disabled=locked||x.qty<1;
   const copy=`<small>${esc(x.def?.rarity||'회사 상품')}${x.def?.slot?' · '+slotName(x.def.slot):''}</small><b>${esc(x.item)}</b><p>${current==='craft'?`제작 ${duration(r.craft_seconds)}${r.sale_gold>0?' · 판매 '+fmt(r.sale_gold)+'G':''}`:`보유 ${fmt(x.qty)}개 · 개당 ${fmt(x.sale.unitGold)}G`}</p>${current==='craft'?`<small>${Object.entries(r.inputs).map(([id,q])=>`${esc(id)} ${fmt(inventoryQty(id))}/${q}`).join(' · ')}</small>`:`<span class="idle-usage-cue">${window.ShopCraftingUsage.label(x.item)} <i aria-hidden="true">›</i></span>`}`;
   return `<article class="idle-item ${current==='sell'?'idle-sale-item ':''}${rarityClass(x.def?.rarity)}">${current==='sell'?`<button type="button" class="idle-item-open" data-idle-econ="usage" data-id="${esc(x.item)}" aria-label="${esc(x.item)} 제작 용도 확인"><span class="idle-item-icon">${itemSvg(itemAsset(x.item))}</span><span class="idle-item-copy">${copy}</span></button>`:`<span>${itemSvg(itemAsset(x.item))}</span><div>${copy}</div>`}<button type="button" class="primary-btn idle-item-queue" data-idle-econ="setup" data-id="${esc(x.id)}" data-mode="${current}" ${disabled?'disabled':''}>${locked?'제작소 Lv.'+r.workshop_level:x.qty<1?'재료 부족':current==='sell'?'판매':'추가'}</button></article>`;
  }).join('')||'<p class="idle-empty">조건에 맞는 아이템이 없습니다.</p>';
'''+s[b:]
    a=s.index(' function setup(');b=s.index(' async function run(',a)
    s=s[:a]+''' function setup(id,mode=current){
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
'''+s[b:]
    a=s.index(" document.addEventListener('click'");b=s.index('\n})();',a)
    s=s[:a]+''' document.addEventListener('click',e=>{const old=e.target.closest('[data-action="workshop"],[data-action="shop"]'),b=e.target.closest('[data-idle-econ]');if(!old&&!b)return;e.preventDefault();e.stopImmediatePropagation();if(old){show(old.dataset.action==='workshop'?'craft':'sell');return;}if(b.disabled)return;readCatalogContext();const a=b.dataset.idleEcon;if(a==='usage'){window.ShopCraftingUsage.show(b.dataset.id);return;}if(a==='usage-filter'){window.ShopCraftingUsage.refresh(b.dataset.filter);return;}if(a==='usage-sell'){setup(b.dataset.id,'sell');return;}if(a==='usage-craft'){setup(b.dataset.id,'craft');return;}if(a==='catalog')openCatalog();else if(a==='hide')document.querySelector('.idle-catalog').hidden=true;else if(a==='more'){limit+=24;catalog();}else if(a==='setup')setup(b.dataset.id,b.dataset.mode||current);else if(a==='confirm'||a==='cancel')run(b);},true);
 document.addEventListener('input',e=>{if(!e.target.matches('[data-idle-filter]'))return;readCatalogContext();filters[e.target.dataset.idleFilter]=e.target.type==='checkbox'?e.target.checked:e.target.value;limit=24;catalog();});
 document.addEventListener('change',e=>{if(!e.target.matches('select[data-idle-filter]'))return;readCatalogContext();filters[e.target.dataset.idleFilter]=e.target.value;limit=24;catalog();});
 function refresh(){window.ShopCraftingUsage?.refresh();const box=document.querySelector('[data-idle-jobs]');if(box){const html=jobs(box.dataset.idleJobs);if(html!==box.innerHTML)box.innerHTML=html;}}
 setInterval(refresh,1000);window.IdleEconomy={show,refresh,duration,setup,getJobs:rows};'''+s[b:]
    p.write_text(s)
p=Path('scripts/navigation-v0130.js');s=p.read_text()
if 'const item=box.querySelector' not in s:
    old="    return [cls,kicker,h2].filter(Boolean).join('|')";assert s.count(old)==1
    s=s.replace(old,"    const item=box.querySelector('[data-usage-item]')?.dataset.usageItem||'';\n    return [cls,kicker,h2,item].filter(Boolean).join('|')")
if 'persist filters/quantities' not in s:
    old='    const clone=sheet.cloneNode(true);\n';assert s.count(old)==1
    s=s.replace(old,old+'''    // innerHTML does not preserve live form properties; persist filters/quantities before capture.
    const controls=[...sheet.querySelectorAll('input,select,textarea')];
    clone.querySelectorAll('input,select,textarea').forEach((copy,index)=>{
      const control=controls[index];
      if(control.tagName==='SELECT'){
        [...copy.options].forEach((option,i)=>option.toggleAttribute('selected',control.options[i].selected));
      }else if(control.tagName==='TEXTAREA')copy.textContent=control.value;
      else if(control.type==='checkbox'||control.type==='radio')copy.toggleAttribute('checked',control.checked);
      else if(!['password','file'].includes(control.type))copy.setAttribute('value',control.value);
    });
''')
p.write_text(s)
p=Path('index.html');s=p.read_text()
s=s.replace('v0.17.0','v0.17.1').replace('scripts/idle-economy-v016.js?v=017a','scripts/idle-economy-v016.js?v=0171a').replace('scripts/navigation-v0130.js?v=017a','scripts/navigation-v0130.js?v=0171a')
if 'ui-shop-usage.css' not in s:s=s.replace('<link rel="icon"','<link rel="stylesheet" href="ui-shop-usage.css?v=0171a">\n<link rel="icon"',1)
if 'scripts/shop-crafting-usage.js' not in s:s=s.replace('<script defer src="scripts/idle-economy-v016.js?v=0171a"></script>','<script defer src="scripts/idle-economy-v016.js?v=0171a"></script>\n<script defer src="scripts/shop-crafting-usage.js?v=0171a"></script>')
p.write_text(s)
print('SHOP_USAGE_SOURCE_APPLIED')
