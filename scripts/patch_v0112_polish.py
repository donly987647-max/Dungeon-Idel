from pathlib import Path

p=Path('app.js')
s=p.read_text()

def rep(old,new,label):
    global s
    if old not in s:
        raise SystemExit(f'missing target: {label}')
    s=s.replace(old,new,1)

rep("let screen='home',S=null,busy=false,session=null,watchingExpeditionId=null,partyPick=[],partySite=null;",
    "let screen='home',S=null,busy=false,session=null,watchingExpeditionId=null,partyPick=[],partySite=null,lastAnimatedScreen=null,modalCloseTimer=null;",'state')

rep("const inventoryUsed=()=>Number((S?.inventory||[]).reduce((a,x)=>a+Number(x.qty||0),0));",
    "const inventoryUsed=()=>Number((S?.inventory||[]).filter(x=>Number(x.qty||0)>0).length);",'storage slots')

rep("const leftText=t=>secText(Math.max(0,(new Date(t).getTime()-Date.now())/1000));",
    "const leftText=t=>secText(Math.max(0,(new Date(t).getTime()-Date.now())/1000));\nconst rawSaleDef=id=>{const d=itemDef(id);return d?.kind==='material'&&Number(d.sale_gold||0)>0?d:null};\nconst jobProgress=j=>{const a=new Date(j?.started_at||0).getTime(),b=new Date(j?.finish_at||0).getTime(),n=Date.now();if(!a||!b||b<=a)return 0;return Math.max(0,Math.min(100,(n-a)/(b-a)*100))};",'economy helpers')

rep("function closeModal(){const m=$('#modal');if(!m)return;m.classList.add('hidden');m.innerHTML='';watchingExpeditionId=null;partyPick=[];partySite=null}\nfunction modal(html,extra=''){const m=$('#modal');m.innerHTML=`<div class=\"sheet ${extra}\">${html}</div>`;m.classList.remove('hidden')}",
"function closeModal(immediate=false){const m=$('#modal');if(!m)return;clearTimeout(modalCloseTimer);watchingExpeditionId=null;partyPick=[];partySite=null;if(immediate){m.classList.add('hidden');m.classList.remove('open','closing');m.innerHTML='';return}m.classList.remove('open');m.classList.add('closing');modalCloseTimer=setTimeout(()=>{m.classList.add('hidden');m.classList.remove('closing');m.innerHTML=''},180)}\nfunction modal(html,extra=''){const m=$('#modal');clearTimeout(modalCloseTimer);m.classList.remove('hidden','closing','open');m.innerHTML=`<div class=\"sheet ${extra}\">${html}</div>`;requestAnimationFrame(()=>m.classList.add('open'))}", 'modal motion')

rep("function showAuth(){closeModal();S=null;session=null;$('#app').classList.add('hidden');$('#authGate').classList.remove('hidden');authMsg('')}",
    "function showAuth(){closeModal(true);S=null;session=null;$('#app').classList.add('hidden');$('#authGate').classList.remove('hidden');authMsg('')}",'auth close')

old_render="function render(){if(!S)return;updateChrome();$('#view').innerHTML=screen==='home'?hq():screen==='monsters'?monsters():screen==='hunt'?hunt():loot();requestAnimationFrame(paintCanvases);updateCandidateTimer()}"
new_render="function render(){if(!S)return;updateChrome();const v=$('#view'),changed=lastAnimatedScreen!==screen;v.innerHTML=screen==='home'?hq():screen==='monsters'?monsters():screen==='hunt'?hunt():loot();if(changed){v.classList.remove('view-enter');void v.offsetWidth;v.classList.add('view-enter');lastAnimatedScreen=screen;setTimeout(()=>v.classList.remove('view-enter'),280)}requestAnimationFrame(()=>{paintCanvases();updateEconomyProgress()});updateCandidateTimer()}"
rep(old_render,new_render,'render motion')

start=s.index('function workshopModal(){')
end=s.index('\nfunction shopModal(){',start)
new_workshop=r'''function workshopModal(){const lv=Number(S.player.workshop_level||1),running=(S.craftJobs||[]).filter(x=>x.status==='running'),queueFull=running.length>=Number(S.craftCapacity||1);modal(`<div class="sheet-head"><div><div class="section-kicker">WORKSHOP</div><h2>제작소</h2><p>재료를 판매용 제품으로 가공합니다.</p></div><button class="close-btn" data-action="close">×</button></div><div class="facility-upgrade"><span><small>제작소 Lv.${lv}</small><b>동시 제작 ${S.craftCapacity||1}칸 · 레벨별 제작법 해금</b></span><button class="soft-btn" data-action="upgrade" data-id="workshop">확장 ${fmt(facilityCost('workshop'))}G</button></div><div class="economy-note"><b>골드 규칙</b> · 전투에서는 골드가 나오지 않습니다. 제작 시간과 상점 판매 시간은 모두 <b>판매가 × 3초</b>를 기준으로 합니다.</div>${running.length?`<div class="job-list">${running.map(j=>{const pct=jobProgress(j);return `<div class="job-row craft-job" data-progress-start="${esc(j.started_at)}" data-progress-end="${esc(j.finish_at)}"><div class="job-copy"><b>${esc(j.output_item)} 제작 중</b><small>${esc((S.recipes||[]).find(r=>r.id===j.recipe_id)?.id||'제작')} · <span class="job-percent">${Math.floor(pct)}%</span></small><div class="craft-progress"><i class="craft-progress-fill" style="width:${pct}%"></i></div></div><strong class="job-left">${leftText(j.finish_at)}</strong></div>`}).join('')}</div>`:''}<div class="recipe-list">${(S.recipes||[]).map(r=>{const locked=lv<Number(r.workshop_level||1),inputs=Object.entries(r.inputs||{}),short=inputs.some(([id,q])=>inventoryQty(id)<Number(q)),disabled=locked||short||queueFull;return `<div class="recipe-row ${locked?'locked':''}"><div class="recipe-icon">${itemSvg(itemAsset(r.output_item))}</div><div class="recipe-main"><b>${esc(r.output_item)}</b><div class="recipe-meta"><span>판매 <strong>${fmt(r.sale_gold)}G</strong></span><span>제작 ${secText(r.craft_seconds)}</span><span>판매 ${secText(r.sell_seconds)}</span></div><div class="recipe-inputs">${inputs.map(([id,q])=>`<span class="${inventoryQty(id)<Number(q)?'short':''}">${esc(id)} ${fmt(inventoryQty(id))}/${fmt(q)}</span>`).join('')}</div></div><button class="primary-btn" data-action="craft" data-id="${r.id}" ${disabled?'disabled':''}>${locked?`Lv.${r.workshop_level}`:queueFull?'대기열':'제작'}</button></div>`}).join('')}</div>`,'economy-sheet');updateEconomyProgress()}'''
s=s[:start]+new_workshop+s[end:]

start=s.index('function shopModal(){')
end=s.index('\nfunction updateChrome(){',start)
new_shop=r'''function shopModal(){const running=(S.sellJobs||[]).find(x=>x.status==='running'),finished=(S.recipes||[]).map(r=>({...r,qty:inventoryQty(r.output_item),kind:'finished'})).filter(r=>r.qty>0),raw=(S.inventory||[]).map(x=>{const d=rawSaleDef(x.item_id);return d?{id:x.item_id,qty:Number(x.qty||0),sale_gold:Number(d.sale_gold||0),sell_seconds:Number(d.sell_seconds||0),kind:'raw'}:null}).filter(Boolean);const row=r=>`<div class="shop-item ${r.kind==='raw'?'raw-sale':''}"><div>${itemSvg(itemAsset(r.output_item||r.id))}</div><div><b>${esc(r.output_item||r.id)} × ${fmt(r.qty)}</b><small>${r.kind==='raw'?'<em>원재료 직판</em> · ':''}판매가 <strong>${fmt(r.sale_gold)}G</strong> · ${secText(r.sell_seconds)}</small></div><button class="primary-btn" data-action="sell" data-id="${esc(r.output_item||r.id)}" ${running?'disabled':''}>1개 판매</button></div>`;modal(`<div class="sheet-head"><div><div class="section-kicker">COMPANY SHOP</div><h2>상점</h2><p>완제품은 고수익, 원재료는 빠른 현금화용입니다.</p></div><button class="close-btn" data-action="close">×</button></div><div class="economy-note"><b>판매 원칙</b> · 원재료도 바로 팔 수 있지만 제작품보다 가치가 크게 낮습니다. 판매 시간은 원재료 역시 <b>판매가 × 3초</b>입니다.</div>${running?`<div class="job-list"><div class="job-row"><span><b>${esc(running.item_id)} 판매 중</b><small>완료 시 ${fmt(running.sale_gold)}G 입금</small></span><strong>${leftText(running.finish_at)}</strong></div></div>`:''}<div class="shop-section-title"><b>완제품</b><small>제작 후 판매 · 높은 수익</small></div><div class="shop-list">${finished.length?finished.map(row).join(''):'<div class="shop-empty">판매 가능한 완제품이 없습니다.</div>'}</div><div class="shop-section-title raw"><b>원재료 직판</b><small>낮은 가격 · 긴급 현금화</small></div><div class="shop-list">${raw.length?raw.map(row).join(''):'<div class="shop-empty">직접 판매할 원재료가 없습니다.</div>'}</div>`,'economy-sheet')}'''
s=s[:start]+new_shop+s[end:]

# Upgrade raw-material item detail with direct-sale information.
old="const used=(S.recipes||[]).filter(r=>Object.prototype.hasOwnProperty.call(r.inputs||{},itemId));modal(`<div class=\"sheet-head\"><div><div class=\"section-kicker\">CRAFT MATERIAL</div><h2>${esc(itemId)}</h2><p>제작 재료 · 보유 ${fmt(inv.qty)}개</p></div><button class=\"close-btn\" data-action=\"close\">×</button></div><div class=\"material-detail\">${itemSvg(itemAsset(itemId))}<b>제작소 원재료</b><p>${used.length?`사용처: ${used.map(r=>esc(r.output_item)).join(' · ')}`:'현재 등록된 제작법에는 사용되지 않습니다.'}</p><button class=\"primary-btn\" data-action=\"workshop\">제작소로 이동</button></div>`);return}"
new="const used=(S.recipes||[]).filter(r=>Object.prototype.hasOwnProperty.call(r.inputs||{},itemId)),raw=rawSaleDef(itemId);modal(`<div class=\"sheet-head\"><div><div class=\"section-kicker\">CRAFT MATERIAL</div><h2>${esc(itemId)}</h2><p>제작 재료 · 보유 ${fmt(inv.qty)}개</p></div><button class=\"close-btn\" data-action=\"close\">×</button></div><div class=\"material-detail\">${itemSvg(itemAsset(itemId))}<b>제작소 원재료</b><p>${used.length?`사용처: ${used.map(r=>esc(r.output_item)).join(' · ')}`:'현재 등록된 제작법에는 사용되지 않습니다.'}${raw?`<br>직접 판매 ${fmt(raw.sale_gold)}G · ${secText(raw.sell_seconds)} (가공품보다 저가)`:''}</p><div class=\"material-actions\"><button class=\"primary-btn\" data-action=\"workshop\">제작소</button>${raw?'<button class=\"soft-btn\" data-action=\"shop\">상점</button>':''}</div></div>`);return}"
rep(old,new,'raw item detail')

insert_before="async function refresh(){"
progress_fn="""function updateEconomyProgress(){document.querySelectorAll('[data-progress-start][data-progress-end]').forEach(el=>{const a=new Date(el.dataset.progressStart).getTime(),b=new Date(el.dataset.progressEnd).getTime(),n=Date.now(),pct=!a||!b||b<=a?0:Math.max(0,Math.min(100,(n-a)/(b-a)*100)),fill=el.querySelector('.craft-progress-fill'),pc=el.querySelector('.job-percent'),left=el.querySelector('.job-left');if(fill)fill.style.width=pct+'%';if(pc)pc.textContent=Math.floor(pct)+'%';if(left)left.textContent=secText(Math.max(0,(b-n)/1000))})}\n\n"""
if insert_before not in s: raise SystemExit('missing refresh target')
s=s.replace(insert_before,progress_fn+insert_before,1)

rep("setInterval(updateCandidateTimer,1000);",
    "setInterval(updateCandidateTimer,1000);\nsetInterval(updateEconomyProgress,1000);",'progress timer')

p.write_text(s)
