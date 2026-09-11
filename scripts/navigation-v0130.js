/* v0.13.16 — universal modal navigation history + post-render UI hook */
(()=>{
  const baseModal=modal;
  const baseCloseModal=closeModal;
  let stack=[];
  let currentKey=null;
  let restoring=false;

  const navState=()=>({
    screen,
    monsterDetailOrigin,
    watchingExpeditionId,
    partySite,
    partyPick:[...(partyPick||[])],
    lastBattleVisualKey
  });

  const restoreNavState=s=>{
    if(!s)return;
    screen=s.screen??screen;
    monsterDetailOrigin=s.monsterDetailOrigin??monsterDetailOrigin;
    watchingExpeditionId=s.watchingExpeditionId??null;
    partySite=s.partySite??null;
    partyPick=[...(s.partyPick||[])];
    lastBattleVisualKey=s.lastBattleVisualKey??null;
  };

  const modalKey=(html,extra='')=>{
    const box=document.createElement('div');
    box.innerHTML=String(html||'');
    const h2=(box.querySelector('h2')?.textContent||'').trim();
    const kicker=(box.querySelector('.section-kicker')?.textContent||'').trim();
    const cls=String(extra||'').trim().replace(/\s+/g,'.');
    const item=box.querySelector('[data-usage-item]')?.dataset.usageItem||'';
    return [cls,kicker,h2,item].filter(Boolean).join('|')||String(html||'').replace(/\s+/g,' ').slice(0,96);
  };

  const captureCurrent=()=>{
    const host=document.querySelector('#modal');
    if(!host||host.classList.contains('hidden'))return null;
    const sheet=host.querySelector(':scope > .sheet');
    if(!sheet)return null;
    const clone=sheet.cloneNode(true);
    // innerHTML does not preserve live form properties; persist filters/quantities before capture.
    const controls=[...sheet.querySelectorAll('input,select,textarea')];
    clone.querySelectorAll('input,select,textarea').forEach((copy,index)=>{
      const control=controls[index];
      if(control.tagName==='SELECT'){
        [...copy.options].forEach((option,i)=>option.toggleAttribute('selected',control.options[i].selected));
      }else if(control.tagName==='TEXTAREA')copy.textContent=control.value;
      else if(control.type==='checkbox'||control.type==='radio')copy.toggleAttribute('checked',control.checked);
      else if(!['password','file'].includes(control.type))copy.setAttribute('value',control.value);
    });
    clone.querySelectorAll('.global-back-btn,.global-nav-fallback').forEach(x=>x.remove());
    clone.classList.remove('global-nav-sheet');
    clone.querySelector('.sheet-head')?.classList.remove('has-global-back');
    return {
      root:false,
      key:currentKey||modalKey(clone.innerHTML,[...clone.classList].filter(x=>x!=='sheet').join(' ')),
      html:clone.innerHTML,
      extra:[...clone.classList].filter(x=>x!=='sheet').join(' '),
      scrollTop:sheet.scrollTop||0,
      state:navState()
    };
  };

  const findStackKey=key=>{
    for(let i=stack.length-1;i>=0;i--)if(!stack[i].root&&stack[i].key===key)return i;
    return -1;
  };

  function injectBack(){
    const host=document.querySelector('#modal');
    if(!host||host.classList.contains('hidden'))return;
    const sheet=host.querySelector(':scope > .sheet');
    if(!sheet||sheet.querySelector('.global-back-btn'))return;
    sheet.classList.add('global-nav-sheet');
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='global-back-btn';
    btn.dataset.globalBack='1';
    btn.setAttribute('aria-label','뒤로가기');
    btn.innerHTML='<span aria-hidden="true">←</span><b>뒤로</b>';
    const head=sheet.querySelector(':scope > .sheet-head');
    if(head){
      head.classList.add('has-global-back');
      head.prepend(btn);
    }else{
      const row=document.createElement('div');
      row.className='global-nav-fallback';
      row.appendChild(btn);
      sheet.prepend(row);
    }
  }

  function afterModalRender(){
    injectBack();
    const sheet=document.querySelector('#modal > .sheet');
    window.applyReadability?.(sheet);
  }

  modal=function(html,extra=''){
    const newKey=modalKey(html,extra);
    const current=captureCurrent();
    if(!restoring){
      if(!current){
        stack.push({root:true,state:navState()});
      }else if(newKey!==currentKey){
        const parentIndex=findStackKey(newKey);
        if(parentIndex>=0){
          stack=stack.slice(0,parentIndex);
        }else{
          stack.push(current);
        }
      }
    }
    baseModal(html,extra);
    currentKey=newKey;
    requestAnimationFrame(afterModalRender);
  };

  closeModal=function(immediate=false){
    if(!restoring){stack=[];currentKey=null}
    return baseCloseModal(immediate);
  };

  function back(){
    if(!stack.length){
      restoring=true;
      try{baseCloseModal()}finally{restoring=false;currentKey=null}
      return;
    }
    const prev=stack.pop();
    restoreNavState(prev.state);
    if(prev.root){
      restoring=true;
      try{baseCloseModal();render()}finally{restoring=false;currentKey=null}
      return;
    }
    restoring=true;
    try{
      baseModal(prev.html,prev.extra||'');
      currentKey=prev.key;
      requestAnimationFrame(()=>{
        const sheet=document.querySelector('#modal > .sheet');
        if(sheet)sheet.scrollTop=prev.scrollTop||0;
        afterModalRender();
      });
    }finally{restoring=false}
  }

  document.addEventListener('click',e=>{
    const backBtn=e.target.closest('[data-global-back]');
    const legacyBack=e.target.closest('[data-action="monster-back"],[data-action="release-cancel"]');
    const softClose=e.target.closest('[data-action="close"]:not(.close-btn)');
    if(backBtn||legacyBack||softClose){
      e.preventDefault();
      e.stopImmediatePropagation();
      back();
      return;
    }
    const hardClose=e.target.closest('.close-btn[data-action="close"]');
    if(hardClose){stack=[];currentKey=null;return}
    if(e.target?.id==='modal'&&!e.target.classList.contains('hidden')){stack=[];currentKey=null;return}
    if(e.target.closest('[data-screen],[data-go]')){stack=[];currentKey=null}
  },true);

  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    const host=document.querySelector('#modal');
    if(!host||host.classList.contains('hidden'))return;
    e.preventDefault();
    back();
  });

  const observer=new MutationObserver(()=>requestAnimationFrame(injectBack));
  const host=document.querySelector('#modal');
  if(host)observer.observe(host,{childList:true,subtree:false});
  window.gameBack=back;
})();