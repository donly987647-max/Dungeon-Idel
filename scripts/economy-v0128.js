/* v0.12.8 Economy completion UX
 * - Human-readable hour/minute durations
 * - Craft/sale rewards are claimed manually after timers finish
 * - Finished jobs do not block the next queued job
 */
(()=>{
  const claiming=new Set();
  const durationText=seconds=>{
    const n=Math.max(0,Math.ceil(Number(seconds||0)));
    const d=Math.floor(n/86400),h=Math.floor((n%86400)/3600),m=Math.floor((n%3600)/60),s=n%60;
    if(d)return `${d}일 ${h}시간${m?` ${m}분`:''}`;
    if(h)return `${h}시간 ${m}분`;
    if(m)return `${m}분 ${String(s).padStart(2,'0')}초`;
    return `${s}초`;
  };
  const remaining=t=>durationText(Math.max(0,(new Date(t).getTime()-Date.now())/1000));
  const activeJobs=(type)=>[...(type==='craft'?(S?.craftJobs||[]):(S?.sellJobs||[]))].filter(j=>['running','queued'].includes(j.status));
  const readyJobs=(type)=>[...(type==='craft'?(S?.craftJobs||[]):(S?.sellJobs||[]))].filter(j=>j.status==='ready'||(['running','queued'].includes(j.status)&&new Date(j.finish_at).getTime()<=Date.now()));
  const visibleJobs=(type)=>[...(type==='craft'?(S?.craftJobs||[]):(S?.sellJobs||[]))]
    .filter(j=>['running','queued','ready'].includes(j.status))
    .sort((a,b)=>{
      const ar=a.status==='ready'||new Date(a.finish_at).getTime()<=Date.now(),br=b.status==='ready'||new Date(b.finish_at).getTime()<=Date.now();
      if(ar!==br)return ar?-1:1;
      return new Date(a.started_at)-new Date(b.started_at);
    });

  function jobRows(type){
    const jobs=visibleJobs(type);
    if(!jobs.length)return '';
    return `<div class="job-list econ-job-list">${jobs.map(j=>{
      const now=Date.now(),start=new Date(j.started_at).getTime(),finish=new Date(j.finish_at).getTime(),ready=j.status==='ready'||finish<=now,waiting=!ready&&start>now,working=claiming.has(String(j.id));
      const qty=Number(type==='craft'?j.batch_qty:j.quantity||1),pct=ready?100:waiting?0:jobProgress(j),item=type==='craft'?j.output_item:j.item_id;
      const state=ready?(type==='craft'?'제작 완료':'판매 완료'):waiting?'대기':'진행 중';
      const note=ready?(type==='craft'?'완제품 수령 대기':`${fmt(j.sale_gold)}G 정산 대기`):waiting?'앞 작업 종료 후 시작':`<span class="job-percent">${Math.floor(pct)}%</span>`;
      const right=ready
        ?`<button class="primary-btn econ-claim-btn" data-econ-action="${type==='craft'?'claim-craft':'claim-sell'}" data-id="${esc(j.id)}" ${working?'disabled':''}>${working?(type==='craft'?'수령 중…':'정산 중…'):'완료'}</button>`
        :`<strong>${waiting?'대기 '+remaining(j.started_at):remaining(j.finish_at)}</strong>`;
      return `<div class="job-row craft-job ${waiting?'queued':''} ${ready?'ready-to-claim':''}" data-econ-job="1" data-econ-type="${type}" data-job-id="${esc(j.id)}" data-job-item="${esc(item)}" data-job-qty="${qty}" data-job-gold="${Number(j.sale_gold||0)}" data-progress-start="${esc(j.started_at)}" data-progress-end="${esc(j.finish_at)}" data-job-status="${ready?'ready':j.status}"><div class="job-copy"><b>${esc(item)} × ${fmt(qty)} · <span class="econ-job-state">${state}</span></b><small class="econ-job-note">${note}</small><div class="craft-progress"><i class="craft-progress-fill" style="width:${pct}%"></i></div></div><div class="job-left econ-job-right">${right}</div></div>`;
    }).join('')}</div>`;
  }

  function workshop(){
    const lv=Number(S.player.workshop_level||1),active=activeJobs('craft'),ready=readyJobs('craft'),cap=Number(S.craftCapacity||lv),queueFull=active.length>=cap;
    modal(`<div class="sheet-head"><div><div class="section-kicker">WORKSHOP · v0.12.8</div><h2>제작소</h2><p>제작이 끝나면 완료 버튼을 눌러 창고로 수령합니다.</p></div><button class="close-btn" data-action="close">×</button></div><div class="facility-upgrade"><span><small>제작소 Lv.${lv}</small><b>작업 ${active.length}/${cap}${ready.length?` · 완료 대기 ${ready.length}`:''}</b></span><button class="soft-btn" data-action="upgrade" data-id="workshop">확장 ${fmt(facilityCost('workshop'))}G</button></div><div class="economy-note">완료된 제작품은 자동으로 창고에 들어오지 않습니다. <b>완료</b>를 눌러 수령하세요. 완료 대기 중이어도 다음 대기열은 계속 진행됩니다.</div>${jobRows('craft')}<div class="recipe-list">${(S.recipes||[]).map(r=>{const inputs=Object.entries(r.inputs||{}),max=craftMaxQty(r),disabled=max<1||queueFull;return `<div class="recipe-row"><div class="recipe-icon">${itemSvg(itemAsset(r.output_item))}</div><div class="recipe-main"><b>${esc(r.output_item)}</b><div class="recipe-meta"><span>판매 <strong>${fmt(r.sale_gold)}G</strong></span><span>1개 제작 ${durationText(r.craft_seconds)}</span><span>1개 판매 ${durationText(Math.ceil(Number(r.craft_seconds||1)/1.2))}</span></div><div class="recipe-inputs">${inputs.map(([id,q])=>`<span class="${inventoryQty(id)<Number(q)?'short':''}">${esc(id)} ${fmt(inventoryQty(id))} / 개당 ${fmt(q)}</span>`).join('')}</div></div><button class="primary-btn" data-econ-action="craft-setup" data-id="${esc(r.id)}" ${disabled?'disabled':''}>${queueFull?'대기열':'제작'}</button></div>`}).join('')}</div>`,'economy-sheet economy-v0128-sheet');
    updateTimers();
  }

  function shop(){
    const lv=Number(S.player.shop_level||1),active=activeJobs('sell'),ready=readyJobs('sell'),cap=Number(S.shopCapacity||lv),queueFull=active.length>=cap;
    const finished=(S.recipes||[]).map(r=>({...r,qty:inventoryQty(r.output_item),kind:'finished'})).filter(r=>r.qty>0);
    const raw=(S.inventory||[]).map(x=>{const d=rawSaleDef(x.item_id);return d?{id:x.item_id,qty:Number(x.qty||0),kind:'raw'}:null}).filter(Boolean);
    const itemRow=r=>{const id=r.output_item||r.id,si=saleInfo(id);return `<div class="shop-item ${r.kind==='raw'?'raw-sale':''}"><div>${itemSvg(itemAsset(id))}</div><div><b>${esc(id)} × ${fmt(r.qty)}</b><small>${r.kind==='raw'?'<em>원재료 직판</em> · ':''}개당 <strong>${fmt(si?.unitGold)}G</strong> · ${durationText(si?.unitSeconds)}</small></div><button class="primary-btn" data-econ-action="sell-setup" data-id="${esc(id)}" ${queueFull?'disabled':''}>${queueFull?'대기열':'판매'}</button></div>`};
    modal(`<div class="sheet-head"><div><div class="section-kicker">COMPANY SHOP · v0.12.8</div><h2>상점</h2><p>판매가 끝나면 완료 버튼을 눌러 대금을 정산합니다.</p></div><button class="close-btn" data-action="close">×</button></div><div class="facility-upgrade"><span><small>상점 Lv.${lv}</small><b>판매 ${active.length}/${cap}${ready.length?` · 정산 대기 ${ready.length}`:''}</b></span><button class="soft-btn" data-action="upgrade" data-id="shop">확장 ${fmt(facilityCost('shop'))}G</button></div><div class="economy-note">판매 시간이 끝나도 골드는 자동 입금되지 않습니다. <b>완료</b>를 눌러 금고에 정산하세요. 완료 대기 중이어도 다음 판매는 계속 진행됩니다.</div>${jobRows('sell')}<div class="shop-section-title"><b>완제품</b><small>가공 후 고수익 판매</small></div><div class="shop-list">${finished.length?finished.map(itemRow).join(''):'<div class="shop-empty">판매 가능한 완제품이 없습니다.</div>'}</div><div class="shop-section-title raw"><b>원재료 직판</b><small>낮은 가격 · 긴급 현금화</small></div><div class="shop-list">${raw.length?raw.map(itemRow).join(''):'<div class="shop-empty">직접 판매할 원재료가 없습니다.</div>'}</div>`,'economy-sheet economy-v0128-sheet');
    updateTimers();
  }

  function quantity(mode,id){
    if(mode==='craft'){
      const r=(S.recipes||[]).find(x=>x.id===id);if(!r)return;const max=craftMaxQty(r);if(max<1){toast('제작 재료가 부족합니다.');return}
      modal(`<div class="sheet-head"><div><div class="section-kicker">BATCH PRODUCTION</div><h2>${esc(r.output_item)} 제작</h2><p>1 ~ ${fmt(max)}개 중 생산 수량을 선택하세요.</p></div><button class="close-btn" data-action="close">×</button></div>${quantityBody(mode,id,max)}`,'economy-sheet economy-v0128-sheet');
    }else{
      const si=saleInfo(id),max=inventoryQty(id);if(!si||max<1)return;
      modal(`<div class="sheet-head"><div><div class="section-kicker">BATCH SALE</div><h2>${esc(id)} 판매</h2><p>1 ~ ${fmt(max)}개 중 판매 수량을 선택하세요.</p></div><button class="close-btn" data-action="close">×</button></div>${quantityBody(mode,id,max)}`,'economy-sheet economy-v0128-sheet');
    }
    updateQuantity();
  }

  function quantityBody(mode,id,max){
    const item=mode==='craft'?(S.recipes||[]).find(x=>x.id===id)?.output_item:id;
    return `<div class="batch-picker"><div class="batch-hero">${itemSvg(itemAsset(item))}<span><small>선택 수량</small><b id="econQtyValue">1개</b></span></div><input id="econQtySlider" type="range" min="1" max="${max}" value="1" data-mode="${mode}" data-id="${esc(id)}"><div class="slider-scale"><span>1</span><span>최대 ${fmt(max)}</span></div><div id="econQtySummary" class="batch-summary"></div><div class="qty-step"><button class="soft-btn" data-econ-action="qty-dec">−</button><button class="soft-btn" data-econ-action="qty-inc">＋</button></div><button class="primary-btn batch-confirm" data-econ-action="${mode==='craft'?'craft-confirm':'sell-confirm'}" data-id="${esc(id)}">${mode==='craft'?'제작':'판매'} 대기열에 추가</button></div>`;
  }

  function updateQuantity(){
    const r=document.querySelector('#econQtySlider'),sum=document.querySelector('#econQtySummary'),val=document.querySelector('#econQtyValue');if(!r||!sum||!val)return;
    const qty=Math.max(1,Math.min(Number(r.max||1),Number(r.value||1)));r.value=String(qty);val.textContent=`${fmt(qty)}개`;
    if(r.dataset.mode==='craft'){
      const x=(S.recipes||[]).find(v=>v.id===r.dataset.id);if(!x)return;
      sum.innerHTML=`<div><small>총 제작시간</small><b>${durationText(Number(x.craft_seconds||0)*qty)}</b></div><div><small>완제품 가치</small><b>${fmt(Number(x.sale_gold||0)*qty)}G</b></div><div class="wide"><small>총 필요 재료</small><p>${Object.entries(x.inputs||{}).map(([id,n])=>`${esc(id)} <b>${fmt(Number(n)*qty)}</b> / 보유 ${fmt(inventoryQty(id))}`).join('<br>')}</p></div>`;
    }else{
      const si=saleInfo(r.dataset.id);if(!si)return;
      sum.innerHTML=`<div><small>총 판매시간</small><b>${durationText(si.unitSeconds*qty)}</b></div><div><small>총 입금액</small><b>${fmt(si.unitGold*qty)}G</b></div><div class="wide"><small>판매 수량</small><p>${fmt(qty)}개 / 보유 ${fmt(inventoryQty(r.dataset.id))}개</p></div>`;
    }
  }

  function makeReady(row){
    if(!row)return;
    row.dataset.jobStatus='ready';row.classList.remove('queued');row.classList.add('ready-to-claim');
    const type=row.dataset.econType,gold=Number(row.dataset.jobGold||0),state=row.querySelector('.econ-job-state'),note=row.querySelector('.econ-job-note'),fill=row.querySelector('.craft-progress-fill'),right=row.querySelector('.econ-job-right'),working=claiming.has(String(row.dataset.jobId||''));
    if(state)state.textContent=type==='craft'?'제작 완료':'판매 완료';
    if(note)note.textContent=type==='craft'?'완제품 수령 대기':`${fmt(gold)}G 정산 대기`;
    if(fill)fill.style.width='100%';
    if(right&&!right.querySelector('.econ-claim-btn'))right.innerHTML=`<button class="primary-btn econ-claim-btn" data-econ-action="${type==='craft'?'claim-craft':'claim-sell'}" data-id="${esc(row.dataset.jobId)}" ${working?'disabled':''}>${working?(type==='craft'?'수령 중…':'정산 중…'):'완료'}</button>`;
  }

  function updateTimers(){
    document.querySelectorAll('[data-econ-job]').forEach(row=>{
      const start=new Date(row.dataset.progressStart).getTime(),finish=new Date(row.dataset.progressEnd).getTime(),now=Date.now(),fill=row.querySelector('.craft-progress-fill'),pc=row.querySelector('.job-percent'),right=row.querySelector('.econ-job-right');
      if(finish<=now){makeReady(row);return}
      const waiting=start>now,pct=waiting?0:Math.max(0,Math.min(100,(now-start)/(finish-start)*100));
      if(fill)fill.style.width=pct+'%';if(pc)pc.textContent=waiting?'대기':Math.floor(pct)+'%';if(right)right.innerHTML=`<strong>${waiting?'대기 '+durationText((start-now)/1000):durationText((finish-now)/1000)}</strong>`;
    });
    decorateHome();
  }

  function decorateHome(){
    if(!S)return;const cReady=readyJobs('craft').length,sReady=readyJobs('sell').length,cActive=activeJobs('craft').length,sActive=activeJobs('sell').length;
    const c=document.querySelector('.facility-row.workshop .facility-copy small'),s=document.querySelector('.facility-row.shop .facility-copy small');
    if(c)c.textContent=`작업 ${cActive}/${S.craftCapacity||5}${cReady?` · 완료 ${cReady}`:''}`;
    if(s)s.textContent=`판매 ${sActive}/${S.shopCapacity||5}${sReady?` · 정산 ${sReady}`:''}`;
  }

  function removeLocalJob(type,id){
    const key=type==='craft'?'craftJobs':'sellJobs';
    S[key]=[...(S?.[key]||[])].filter(j=>String(j.id)!==String(id));
  }

  function addLocalInventory(item,qty){
    if(!item||!Number(qty))return;let row=(S.inventory||[]).find(x=>x.item_id===item);
    if(row)row.qty=Number(row.qty||0)+Number(qty);else{S.inventory=S.inventory||[];S.inventory.push({item_id:item,qty:Number(qty)})}
  }

  async function claim(type,id){
    const key=String(id||'');if(!key||claiming.has(key))return;claiming.add(key);
    const row=document.querySelector(`[data-econ-job][data-job-id="${CSS.escape(key)}"]`),btn=row?.querySelector('.econ-claim-btn');
    row?.classList.add('claiming');if(btn){btn.disabled=true;btn.textContent=type==='craft'?'수령 중…':'정산 중…'}
    try{
      const fn=type==='craft'?'game_claim_craft':'game_claim_sell';
      const {data,error}=await sb.rpc(fn,{p_job:id});if(error)throw error;
      removeLocalJob(type,id);
      if(type==='craft'){addLocalInventory(data?.itemId,Number(data?.quantity||0));workshop();toast(`${data?.itemId||'완제품'} × ${fmt(data?.quantity||0)} 수령 완료`)}
      else{S.player.gold=Number(S.player.gold||0)+Number(data?.gold||0);updateChrome();shop();toast(`${fmt(data?.gold||0)}G 정산 완료`)}
      queueMicrotask(()=>window.__frontendPollNow?.());
    }catch(err){
      const msg=String(err?.message||err||'');
      if(btn&&btn.isConnected){btn.disabled=false;btn.textContent='완료'}
      row?.classList.remove('claiming');
      if(msg.includes('job_not_ready'))toast('아직 작업이 완료되지 않았습니다.');
      else if(msg.includes('job_already_claimed')){toast('이미 완료 처리된 작업입니다.');window.__frontendPollNow?.()}
      else if(msg.includes('job_missing')){toast('작업 정보를 찾을 수 없습니다.');window.__frontendPollNow?.()}
      else toast('완료 처리 중 오류가 발생했습니다.');
    }finally{claiming.delete(key)}
  }

  async function start(mode,id){
    if(busy)return;const slider=document.querySelector('#econQtySlider'),qty=Number(slider?.value||1);busy=true;
    try{
      if(mode==='craft'){await api('craft',{recipeId:id,quantity:qty});workshop();toast(`${fmt(qty)}개 제작 예약`)}
      else{await api('sell',{itemId:id,quantity:qty});shop();toast(`${fmt(qty)}개 판매 예약`)}
      render();
    }catch(err){toast(errorKo(err.message))}finally{busy=false}
  }

  document.addEventListener('click',e=>{
    const legacy=e.target.closest('[data-action]');
    if(legacy&&['workshop','shop'].includes(legacy.dataset.action)){
      e.preventDefault();e.stopImmediatePropagation();
      legacy.dataset.action==='workshop'?workshop():shop();return;
    }
    const b=e.target.closest('[data-econ-action]');if(!b)return;
    e.preventDefault();e.stopImmediatePropagation();const a=b.dataset.econAction;
    if(a==='craft-setup'){quantity('craft',b.dataset.id);return}
    if(a==='sell-setup'){quantity('sell',b.dataset.id);return}
    if(a==='qty-dec'||a==='qty-inc'){const q=document.querySelector('#econQtySlider');if(q){q.value=String(Math.max(Number(q.min||1),Math.min(Number(q.max||1),Number(q.value||1)+(a==='qty-inc'?1:-1))));updateQuantity()}return}
    if(a==='craft-confirm'){start('craft',b.dataset.id);return}
    if(a==='sell-confirm'){start('sell',b.dataset.id);return}
    if(a==='claim-craft'){claim('craft',b.dataset.id);return}
    if(a==='claim-sell'){claim('sell',b.dataset.id);return}
  },true);

  document.addEventListener('input',e=>{if(e.target?.id==='econQtySlider')updateQuantity()});
  setInterval(updateTimers,500);
})();
