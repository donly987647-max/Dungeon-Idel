/* v0.13.10 — responsive chapter loot collection
   Replaces the legacy sequential collector with immediate UI feedback and concurrent expedition collection. */

collectSiteLoot = async function(siteId){
  if(busy)return;
  const before=siteExpeditions(siteId).filter(e=>lootCount(e)>0||expeditionPendingXp(e)>0);
  if(!before.length){toast('수거할 전리품이 없습니다.');return}

  const button=document.querySelector(`.chapter-loot-btn[data-site="${siteId}"]`);
  if(button){
    button.disabled=true;
    button.classList.add('collecting');
    button.dataset.collectLabel=button.innerHTML;
    button.innerHTML='<span class="collect-pulse" aria-hidden="true"></span>수거 중...';
  }

  const snapshotMonsters=new Map((S?.monsters||[]).map(m=>[m.id,{name:m.name,family:m.family}]));
  const xp={};
  const loot={};
  let durationSeconds=0;

  for(const e of before){
    const start=new Date(e.last_loot_collected_at||e.started_at||Date.now()).getTime();
    const end=e.active?Date.now():new Date(e.updated_at||Date.now()).getTime();
    if(Number.isFinite(start)&&Number.isFinite(end))durationSeconds=Math.max(durationSeconds,Math.max(0,(end-start)/1000));
    for(const [mid,amount] of Object.entries(e.pending_xp||{})){
      const n=Math.max(0,Number(amount||0));
      if(!n)continue;
      const meta=snapshotMonsters.get(mid)||{};
      if(!xp[mid])xp[mid]={xp:0,name:meta.name||'몬스터',family:meta.family||'slime'};
      xp[mid].xp+=n;
    }
  }

  try{
    busy=true;
    const results=await Promise.all(before.map(e=>api('collect',{expeditionId:e.id})));
    for(const d of results){
      for(const [id,q] of Object.entries(d.collected||{}))loot[id]=(loot[id]||0)+Number(q||0);
    }
    /* Parallel collect responses can finish out of order; one final state read guarantees the newest server snapshot. */
    await api('state');
    render();
    collectionResultModal(siteId,{durationSeconds,xp,loot});
  }catch(err){
    try{await api('state');render()}catch(_){}
    toast(errorKo(err.message));
  }finally{
    busy=false;
    const liveButton=document.querySelector(`.chapter-loot-btn[data-site="${siteId}"]`);
    if(liveButton){
      liveButton.classList.remove('collecting');
      if(liveButton.dataset.collectLabel)liveButton.innerHTML=liveButton.dataset.collectLabel;
    }
  }
};
