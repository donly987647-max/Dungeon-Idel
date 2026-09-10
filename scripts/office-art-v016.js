/* Sprite atlases plus server-driven attack/hit/heal motion. */
(()=>{
 const families=['slime','goblin','troll','mandrake','pixie','imp','wisp','golem','mimic'];let lastEvent='';
 function monster(family,cls=''){
  const i=families.indexOf(family);if(i<0)return '';const form=cls.match(/(?:^|\s)form-([\w-]+)/)?.[1]||family,meta=OfficeRoster.forms[form]||{tier:0,branch:0};
  return `<span class="pixel-char office-monster ${cls} office-tier-${meta.tier} office-branch-${meta.branch} office-family-${family}" data-office-family="${family}" aria-hidden="true"><i style="background-image:url('assets/art-v016/monsters-${meta.tier===0?'base':'tier'+meta.tier}.png');background-position:${i%3*50}% ${Math.floor(i/3)*50}%"></i>${meta.tier?`<em class="office-evolution-mark">${meta.tier===2?'◆':'✦'}</em>`:''}</span>`;
 }
 function animate(node,name){if(!node||matchMedia('(prefers-reduced-motion: reduce)').matches)return;node.classList.remove('office-strike','office-hit','office-heal','office-revive');void node.offsetWidth;node.classList.add(name);setTimeout(()=>node.classList.remove(name),650);}
 function motion(e){if(!e)return;const log=e.battle_log?.[0]||{},key=JSON.stringify([e.id,e.idle_actions,log.type,log.round,log.side]);if(key===lastEvent)return;lastEvent=key;
  const units=[...document.querySelectorAll('#livePartyCluster [data-monster-id]')],foe=document.querySelector('#liveEnemyActor');
  if(log.side==='party'||log.type==='battle-end'&&log.result==='win'){
   for(const unit of units.filter(u=>!u.classList.contains('dead'))){const heals=(log.skills||[]).some(s=>s.monsterId===unit.dataset.monsterId&&s.effect==='heal');animate(unit,heals?'office-heal':'office-strike');}
   if(Number(log.damage||0)>0)animate(foe,'office-hit');
  }else if(log.side==='enemy'){animate(foe,'office-strike');animate(units.find(u=>u.dataset.monsterId===log.targetId)||units.find(u=>u.querySelector('small')?.textContent===log.target),'office-hit');}
  for(const m of S.monsters.filter(m=>m.recovery_actions===0&&e.battle_state?.revived?.some(r=>r.monsterId===m.id)))animate(units.find(u=>u.dataset.monsterId===m.id),'office-revive');
 }
 window.OfficeArt={monster,motion,animate};
})();
