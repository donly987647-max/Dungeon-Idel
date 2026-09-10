/* v0.13.6 — tactile interaction layer + canonical forge odds display */
(()=>{
  const FORGE_RATES=[
    {success:1.00,down:0,destroy:0},
    {success:.85,down:0,destroy:0},
    {success:.75,down:0,destroy:0},
    {success:.65,down:.07,destroy:0},
    {success:.55,down:.12,destroy:.05},
    {success:.47,down:.15,destroy:.07},
    {success:.39,down:.19,destroy:.09},
    {success:.32,down:.22,destroy:.12},
    {success:.25,down:.26,destroy:.15},
    {success:.18,down:.30,destroy:.18}
  ].map(x=>({...x,fail:Math.max(0,1-x.success-x.down-x.destroy)}));
  const pct=n=>`${Math.round(Number(n||0)*100)}%`;
  const interactive='button,[role="button"],.facility-row,.personnel-row,.mission-card:not(.locked),.inventory-slot,.gear-slot,.candidate-profile-btn,.dispatch-row';

  function interactiveTarget(target){
    const el=target?.closest?.(interactive);
    if(!el||el.matches('button:disabled,[aria-disabled="true"]'))return null;
    return el;
  }

  function tapBurst(x,y){
    const p=document.createElement('i');
    p.className='ui-tap-burst';
    p.style.left=`${x}px`;p.style.top=`${y}px`;
    document.body.appendChild(p);
    setTimeout(()=>p.remove(),230);
  }

  function haptic(el){
    if(!navigator.vibrate)return;
    if(el.closest?.('[data-forge-action="enhance"]'))navigator.vibrate(10);
    else if(el.matches?.('.primary-btn,.facility-row')||el.closest?.('#nav'))navigator.vibrate(5);
  }

  function levelOf(card){
    const text=card.querySelector('.forge-gear-icon i')?.textContent||card.querySelector('.forge-gear-copy header em')?.textContent||'';
    const m=text.match(/\+(\d+)/);return m?Math.max(0,Math.min(10,Number(m[1]))):0;
  }

  function patchForgeRates(root=document){
    const cards=[];
    if(root?.matches?.('[data-forge-gear]'))cards.push(root);
    root?.querySelectorAll?.('[data-forge-gear]').forEach(x=>cards.push(x));
    cards.forEach(card=>{
      const lv=levelOf(card),box=card.querySelector('.forge-mini-rates');
      if(!box||lv>=10)return;
      const r=FORGE_RATES[lv];if(!r)return;
      const desired=`<span class="success">성공 ${pct(r.success)}</span><span>유지 ${pct(r.fail)}</span><span class="down">하락 ${pct(r.down)}</span>${r.destroy?`<span class="destroy">파괴 ${pct(r.destroy)}</span>`:''}`;
      if(box.dataset.balanceV0136===String(lv)&&box.innerHTML===desired)return;
      box.innerHTML=desired;box.dataset.balanceV0136=String(lv);
    });
  }

  document.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    const el=interactiveTarget(e.target);if(!el)return;
    el.classList.add('ui-pressed');
    tapBurst(e.clientX,e.clientY);haptic(el);
    const clear=()=>el.classList.remove('ui-pressed');
    el.addEventListener('pointerup',()=>setTimeout(clear,45),{once:true});
    el.addEventListener('pointercancel',clear,{once:true});
    setTimeout(clear,260);
  },{passive:true,capture:true});

  document.addEventListener('click',e=>{
    const el=interactiveTarget(e.target);if(!el)return;
    el.classList.remove('ui-clicked');void el.offsetWidth;el.classList.add('ui-clicked');
    setTimeout(()=>el.classList.remove('ui-clicked'),150);
    requestAnimationFrame(()=>patchForgeRates(document));
  },true);

  function startObserver(){
    const modal=document.querySelector('#modal'),view=document.querySelector('#view');
    const observer=new MutationObserver(muts=>{
      let relevant=false;
      for(const m of muts){if(m.addedNodes.length||m.type==='childList'){relevant=true;break}}
      if(relevant)requestAnimationFrame(()=>patchForgeRates(document));
    });
    if(modal)observer.observe(modal,{childList:true,subtree:true});
    if(view)observer.observe(view,{childList:true,subtree:true});
    patchForgeRates(document);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startObserver,{once:true});
  else startObserver();
})();
