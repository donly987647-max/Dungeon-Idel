/* v0.13.12 — tactile interaction only.
 * Forge balance rendering now belongs to the forge module itself; no DOM observer here. */
(()=>{
  const interactive='button,[role="button"],.facility-row,.personnel-row,.mission-card:not(.locked),.inventory-slot,.gear-slot,.candidate-profile-btn,.dispatch-row';

  function interactiveTarget(target){
    const el=target?.closest?.(interactive);
    if(!el||el.matches('button:disabled,[aria-disabled="true"]'))return null;
    return el;
  }

  function tapBurst(x,y){
    const p=document.createElement('i');p.className='ui-tap-burst';p.style.left=`${x}px`;p.style.top=`${y}px`;document.body.appendChild(p);setTimeout(()=>p.remove(),230);
  }

  function haptic(el){
    if(!navigator.vibrate)return;
    if(el.closest?.('[data-forge-action="enhance"]'))navigator.vibrate(10);
    else if(el.matches?.('.primary-btn,.facility-row')||el.closest?.('#nav'))navigator.vibrate(5);
  }

  document.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    const el=interactiveTarget(e.target);if(!el)return;
    el.classList.add('ui-pressed');tapBurst(e.clientX,e.clientY);haptic(el);
    const clear=()=>el.classList.remove('ui-pressed');
    el.addEventListener('pointerup',()=>setTimeout(clear,45),{once:true});
    el.addEventListener('pointercancel',clear,{once:true});
    setTimeout(clear,260);
  },{passive:true,capture:true});

  document.addEventListener('click',e=>{
    const el=interactiveTarget(e.target);if(!el)return;
    el.classList.remove('ui-clicked');void el.offsetWidth;el.classList.add('ui-clicked');setTimeout(()=>el.classList.remove('ui-clicked'),150);
  },true);
})();
