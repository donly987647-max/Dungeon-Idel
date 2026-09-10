/* v0.12.9 — cancellable economy queues + evolution-ready visibility */
(()=>{
  const nextEvolutionLevel=m=>{
    if(!m||!S)return null;
    const form=m.form_id||m.family;
    const levels=(S.evolutionDefs||[])
      .filter(x=>x.base_family===m.family&&x.from_form_id===form)
      .map(x=>Number(x.required_level||0))
      .filter(x=>x>0);
    return levels.length?Math.min(...levels):null;
  };
  const evolutionReady=m=>{const lv=nextEvolutionLevel(m);return lv!==null&&Number(m?.level||0)>=lv};
  const monsterById=id=>(S?.monsters||[]).find(m=>m.id===id)||null;

  function addReadyBadge(host,text='전직 가능'){
    if(!host||host.querySelector(':scope > .evolution-ready-badge'))return;
    const badge=document.createElement('span');
    badge.className='evolution-ready-badge';
    badge.textContent=text;
    host.appendChild(badge);
  }

  function decorateEvolutionReady(){
    if(!S)return;
    document.querySelectorAll('.personnel-row[data-id],.lodge-row[data-id],.party-select-row[data-id]').forEach(row=>{
      const m=monsterById(row.dataset.id),ready=evolutionReady(m);
      row.classList.toggle('evolution-ready-monster',!!ready);
      const avatar=row.querySelector('.personnel-avatar,.lodge-avatar')||row.querySelector(':scope > span:first-child');
      if(avatar)avatar.classList.toggle('evo-glow-target',!!ready);
      const old=row.querySelector('.evolution-ready-badge');
      if(!ready){old?.remove();return}
      const host=row.querySelector('.personnel-info,.lodge-info')||row.querySelector(':scope > span:nth-child(2)');
      addReadyBadge(host);
    });

    const detailEvolutionBtn=document.querySelector('.monster-detail-sheet-v10 [data-action="evolution"][data-id],.evolution-status [data-action="evolution"][data-id]');
    const detailId=detailEvolutionBtn?.dataset.id;
    const detailMonster=detailId?monsterById(detailId):null;
    const detailReady=evolutionReady(detailMonster);
    const detailSheet=document.querySelector('.monster-detail-sheet-v10');
    const portrait=detailSheet?.querySelector('.detail-portrait');
    detailSheet?.classList.toggle('evolution-ready-monster',!!detailReady);
    portrait?.classList.toggle('evo-glow-target',!!detailReady);
    if(portrait){
      const old=portrait.querySelector('.evolution-ready-detail-badge');
      if(detailReady&&!old){
        const b=document.createElement('span');
        b.className='evolution-ready-detail-badge';
        b.textContent='전직 가능';
        portrait.appendChild(b);
      }else if(!detailReady){old?.remove()}
    }
  }

  function jobIsCancelable(row){
    if(!row)return false;
    const status=row.dataset.jobStatus||'';
    const finish=new Date(row.dataset.progressEnd||0).getTime();
    return ['running','queued'].includes(status)&&finish>Date.now();
  }

  function decorateEconomyCancel(){
    document.querySelectorAll('[data-econ-job]').forEach(row=>{
      const start=new Date(row.dataset.progressStart||0).getTime(),finish=new Date(row.dataset.progressEnd||0).getTime(),now=Date.now();
      if(finish>now&&start<=now&&['running','queued'].includes(row.dataset.jobStatus||'')){
        row.dataset.jobStatus='running';
        row.classList.remove('queued');
        const state=row.querySelector('.econ-job-state'),note=row.querySelector('.econ-job-note');
        if(state)state.textContent='진행 중';
        if(note&&!note.querySelector('.job-percent'))note.innerHTML='<span class="job-percent">0%</span>';
      }

      const existing=row.querySelector('.econ-cancel-btn');
      if(!jobIsCancelable(row)){
        existing?.remove();
        row.classList.remove('has-cancel');
        return;
      }
      row.classList.add('has-cancel');
      if(existing){
        existing.textContent=new Date(row.dataset.progressStart).getTime()>Date.now()?'대기 취소':'취소';
        return;
      }
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='soft-btn econ-cancel-btn';
      btn.dataset.v0129Action='cancel-job';
      btn.dataset.id=row.dataset.jobId||'';
      btn.dataset.type=row.dataset.econType||'';
      btn.textContent=new Date(row.dataset.progressStart).getTime()>Date.now()?'대기 취소':'취소';
      row.appendChild(btn);
    });
  }

  function refundPreview(type,item,qty){
    if(type==='sell')return `<div class="cancel-refund-row"><b>${esc(item)}</b><strong>× ${fmt(qty)}</strong></div>`;
    const recipe=recipeForOutput(item);
    const rows=Object.entries(recipe?.inputs||{});
    return rows.length?rows.map(([id,n])=>`<div class="cancel-refund-row"><b>${esc(id)}</b><strong>× ${fmt(Number(n||0)*qty)}</strong></div>`).join(''):'<div class="cancel-refund-row"><b>사용 재료</b><strong>전량 반환</strong></div>';
  }

  function openCancelConfirm(btn){
    const row=btn.closest('[data-econ-job]');
    if(!row||!jobIsCancelable(row)){toast('이미 완료된 작업은 취소할 수 없습니다.');return}
    const type=row.dataset.econType,item=row.dataset.jobItem||'',qty=Number(row.dataset.jobQty||1),waiting=new Date(row.dataset.progressStart).getTime()>Date.now();
    modal(`<div class="sheet-head"><div><div class="section-kicker">CANCEL ${type==='craft'?'PRODUCTION':'SALE'}</div><h2>${waiting?'대기 작업 취소':'진행 작업 취소'}</h2><p>${esc(item)} × ${fmt(qty)}</p></div><button class="close-btn" data-action="close">×</button></div><section class="economy-cancel-card"><div class="cancel-warning"><b>${waiting?'대기열에서 이 작업을 제거합니다.':'진행 중인 작업을 중단합니다.'}</b><p>${type==='craft'?'투입한 제작 재료는 전량 창고로 반환됩니다.':'판매를 맡긴 물품은 전량 창고로 반환됩니다.'} 뒤에 예약된 작업은 빈 시간만큼 자동으로 앞으로 당겨집니다.</p></div><div class="cancel-refund"><small>반환 예정</small>${refundPreview(type,item,qty)}</div><div class="cancel-actions"><button class="soft-btn" data-action="close">계속 진행</button><button class="danger-btn" data-v0129-action="cancel-confirm" data-id="${esc(row.dataset.jobId||'')}" data-type="${esc(type||'')}">작업 취소</button></div></section>`,'economy-cancel-sheet');
  }

  function reopenEconomy(type){
    const ghost=document.createElement('button');
    ghost.type='button';
    ghost.dataset.action=type==='craft'?'workshop':'shop';
    ghost.hidden=true;
    document.body.appendChild(ghost);
    ghost.click();
    ghost.remove();
  }

  async function cancelJob(type,id){
    if(busy)return;
    busy=true;
    try{
      const fn=type==='craft'?'game_cancel_craft':'game_cancel_sell';
      const {data,error}=await sb.rpc(fn,{p_job:id});
      if(error)throw error;
      await api('state-lite');
      closeModal(true);
      render();
      requestAnimationFrame(()=>reopenEconomy(type));
      toast(type==='craft'?`${data?.itemId||'제작'} 취소 · 재료 반환`:`${data?.itemId||'판매'} 취소 · 물품 반환`);
    }catch(err){
      const msg=String(err?.message||err||'');
      if(msg.includes('job_not_cancelable'))toast('이미 완료된 작업은 취소할 수 없습니다.');
      else if(msg.includes('job_missing'))toast('작업 정보를 찾을 수 없습니다.');
      else toast('작업 취소 중 오류가 발생했습니다.');
    }finally{busy=false}
  }

  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-v0129-action]');
    if(!btn)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const action=btn.dataset.v0129Action;
    if(action==='cancel-job'){openCancelConfirm(btn);return}
    if(action==='cancel-confirm'){cancelJob(btn.dataset.type,btn.dataset.id)}
  },true);

  function decorate(){decorateEvolutionReady();decorateEconomyCancel()}
  setInterval(decorate,450);
  requestAnimationFrame(decorate);
})();