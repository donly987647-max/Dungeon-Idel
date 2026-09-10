/* v0.13.12 — generated pixel assets + server-driven combat motion, scoped DOM observer */
(()=>{
  const STATIC_SHEET='assets/generated-monsters-v0137.png';
  const ITEM_SHEET='assets/generated-items-v0137.png';
  const ATTACK_SHEET='assets/generated-monster-attack-v0137.png';
  const HURT_SHEET='assets/generated-monster-hurt-v0137.png';
  const families=['slime','goblin','troll','mandrake','pixie','imp','wisp','golem','mimic'];
  const animFamilies=['slime','goblin','troll','mandrake','pixie','imp','wisp','golem'];
  const staticCell={slime:[0,0],goblin:[1,0],troll:[2,0],mandrake:[0,1],pixie:[1,1],imp:[2,1],wisp:[0,2],golem:[1,2],mimic:[2,2]};
  const animRow=Object.fromEntries(animFamilies.map((x,i)=>[x,i]));
  const itemCell={club:[0,0],sickle:[1,0],sword:[2,0],leather:[3,0],iron:[0,1],medal:[1,1],herb:[2,1],crystal:[3,1],fang:[0,2],gel:[1,2],seed:[2,2],talisman:[3,2],stone:[0,3],mimiccore:[1,3],golemfrag:[2,3],fairydust:[3,3]};
  let raf=0,lastMotionKey='',motionTimer=0;
  const pendingRoots=new Set();

  const pos=(n,total)=>`${(n/(total-1))*100}%`;
  const familyFromSvg=svg=>{const href=svg?.querySelector('use')?.getAttribute('href')||'';const m=href.match(/#monster-([a-z]+)/);return m&&families.includes(m[1])?m[1]:null};
  const itemKey=name=>{
    const s=String(name||'').replace(/\+\d+/g,'').trim();
    if(/강화석/.test(s))return 'stone';if(/몽둥이|곤봉/.test(s))return 'club';if(/낫/.test(s))return 'sickle';if(/검/.test(s))return 'sword';if(/철갑|갑옷/.test(s))return 'iron';if(/조끼|가죽/.test(s))return 'leather';if(/훈장|메달/.test(s))return 'medal';if(/약초/.test(s))return 'herb';if(/마나.*(수정|결정)|푸른.*(수정|결정)/.test(s))return 'crystal';if(/송곳니|이빨/.test(s))return 'fang';if(/슬라임.*(젤|점액)|젤/.test(s))return 'gel';if(/씨앗/.test(s))return 'seed';if(/부적/.test(s))return 'talisman';if(/미믹.*(핵|코어)/.test(s))return 'mimiccore';if(/골렘.*(조각|파편)/.test(s))return 'golemfrag';if(/요정.*(가루|분말)|페어리.*더스트/.test(s))return 'fairydust';return null;
  };
  function itemNameFor(svg){
    const byId=svg.closest?.('[data-id]')?.dataset?.id;if(byId&&itemKey(byId))return byId;
    const row=svg.closest?.('.source-drop-item,.forge-gear-row,.forge-stored-list>div,.equipment-detail,.material-detail,.inventory-slot'),label=row?.querySelector?.('b')?.textContent||'';if(itemKey(label))return label;
    const head=svg.closest?.('.sheet')?.querySelector?.('.sheet-head h2')?.textContent||'';if(itemKey(head))return head;
    const href=svg.querySelector('use')?.getAttribute('href')||'';if(/#club\b/.test(href))return '몽둥이';if(/#sickle\b/.test(href))return '낫';if(/#sword\b/.test(href))return '검';if(/#leather\b/.test(href))return '조끼';if(/#iron\b/.test(href))return '철갑';if(/#crystal\b/.test(href))return '강화석';return '';
  }
  function copyBoxStyle(from,to){if(from.getAttribute('style'))to.setAttribute('style',from.getAttribute('style'));for(const a of ['title','aria-label'])if(from.hasAttribute(a))to.setAttribute(a,from.getAttribute(a))}
  function setStatic(el,fam){const c=staticCell[fam]||staticCell.slime;el.dataset.gfxFamily=fam;el.dataset.gfxMode='static';el.style.backgroundImage=`url('${STATIC_SHEET}')`;el.style.backgroundSize='300% 300%';el.style.backgroundPosition=`${pos(c[0],3)} ${pos(c[1],3)}`}
  function replaceMonsterSvg(svg){if(svg.dataset.gfxDone)return svg;const fam=familyFromSvg(svg);if(!fam)return svg;const el=document.createElement('span');el.className=`${svg.getAttribute('class')||'pixel-char'} generated-monster-gfx`;el.setAttribute('aria-hidden','true');copyBoxStyle(svg,el);setStatic(el,fam);svg.replaceWith(el);return el}
  function replaceItemSvg(svg){if(svg.dataset.gfxDone)return svg;const name=itemNameFor(svg),key=itemKey(name),c=itemCell[key];if(!c)return svg;const el=document.createElement('span');el.className=`${svg.getAttribute('class')||'pixel-item'} generated-item-gfx`;el.setAttribute('aria-hidden','true');copyBoxStyle(svg,el);el.dataset.gfxItem=key;el.style.backgroundImage=`url('${ITEM_SHEET}')`;el.style.backgroundSize='400% 400%';el.style.backgroundPosition=`${pos(c[0],4)} ${pos(c[1],4)}`;svg.replaceWith(el);return el}
  function decorate(root=document){if(root?.matches?.('svg.pixel-char'))replaceMonsterSvg(root);if(root?.matches?.('svg.pixel-item'))replaceItemSvg(root);root?.querySelectorAll?.('svg.pixel-char').forEach(replaceMonsterSvg);root?.querySelectorAll?.('svg.pixel-item').forEach(replaceItemSvg)}
  function setAnimFrame(el,fam,type,frame){if(!el||animRow[fam]===undefined)return;el.dataset.gfxMode=type;el.style.backgroundImage=`url('${type==='attack'?ATTACK_SHEET:HURT_SHEET}')`;el.style.backgroundSize='400% 800%';el.style.backgroundPosition=`${pos(frame,4)} ${pos(animRow[fam],8)}`}
  function restore(el,fam){if(el?.isConnected)setStatic(el,fam)}
  function playFrames(el,fam,type){
    if(!el)return;
    if(animRow[fam]===undefined){el.classList.remove('gfx-fallback-attack','gfx-fallback-hurt');void el.offsetWidth;el.classList.add(type==='attack'?'gfx-fallback-attack':'gfx-fallback-hurt');setTimeout(()=>el.classList.remove('gfx-fallback-attack','gfx-fallback-hurt'),420);return}
    const frames=[0,1,2,3],delays=[0,85,175,285];frames.forEach((f,i)=>setTimeout(()=>{if(!el.isConnected)return;setAnimFrame(el,fam,type,f);el.classList.toggle('gfx-impact-frame',i===2)},delays[i]));setTimeout(()=>{if(el.isConnected){el.classList.remove('gfx-impact-frame');restore(el,fam)}},410);
  }
  function battleUnitData(e){const party=typeof partyOf==='function'?partyOf(e):[];return [...document.querySelectorAll('#livePartyCluster .battle-party-unit')].map((node,i)=>({node,m:party[i],gfx:node.querySelector('.generated-monster-gfx')})).filter(x=>x.m&&x.gfx)}
  function chooseAttacker(units,last){const alive=units.filter(x=>!x.node.classList.contains('dead'));if(!alive.length)return null;const owner=(last?.skills||[])[0]?.owner;if(owner){const exact=alive.find(x=>x.node.querySelector('small')?.textContent===owner);if(exact)return exact}const round=Math.max(1,Number(last?.round||1));return alive[(round-1)%alive.length]}
  function chooseTarget(units,last){const target=String(last?.target||''),matches=units.filter(x=>x.node.querySelector('small')?.textContent===target);if(matches.length){const round=Math.max(1,Number(last?.round||1));return matches[(round-1)%matches.length]}const alive=units.filter(x=>!x.node.classList.contains('dead'));return alive[0]||units[0]||null}
  function impact(scene,type){if(!scene)return;scene.classList.remove('gfx-party-impact','gfx-enemy-impact');void scene.offsetWidth;scene.classList.add(type==='attack'?'gfx-party-impact':'gfx-enemy-impact');setTimeout(()=>scene.classList.remove('gfx-party-impact','gfx-enemy-impact'),360)}
  function battleMotion(){
    if(typeof watchingExpeditionId==='undefined'||!watchingExpeditionId||typeof S==='undefined'||!S||typeof battleViewModel!=='function')return;const scene=document.querySelector('#battleScene');if(!scene)return;const e=(S.expeditions||[]).find(x=>x.id===watchingExpeditionId);if(!e)return;const vm=battleViewModel(e),last=vm.last||{};if(!vm.active||last.type!=='battle-turn'||!last.side)return;
    const key=[e.id,e.event_state?.t||vm.log?.t||'',last.round||'',last.side,last.target||'',last.damage||''].join('|');if(!key||key===lastMotionKey)return;lastMotionKey=key;const units=battleUnitData(e);if(!units.length)return;clearTimeout(motionTimer);
    if(last.side==='party'){const who=chooseAttacker(units,last);if(!who)return;playFrames(who.gfx,who.m.family,'attack');setTimeout(()=>{impact(scene,'attack');document.querySelector('#liveEnemyActor')?.classList.add('gfx-enemy-recoil')},175);motionTimer=setTimeout(()=>document.querySelector('#liveEnemyActor')?.classList.remove('gfx-enemy-recoil'),430)}
    else if(last.side==='enemy'){const who=chooseTarget(units,last);if(!who)return;setTimeout(()=>{playFrames(who.gfx,who.m.family,'hurt');impact(scene,'hurt')},70)}
  }

  function schedule(root){
    if(root?.nodeType===1)pendingRoots.add(root);
    if(raf)return;
    raf=requestAnimationFrame(()=>{raf=0;const roots=[...pendingRoots];pendingRoots.clear();if(roots.length)roots.forEach(decorate);battleMotion()});
  }
  const obs=new MutationObserver(muts=>{for(const m of muts){for(const n of m.addedNodes){if(n.nodeType===1)schedule(n)}}});
  function start(){decorate(document);obs.observe(document.body,{childList:true,subtree:true});schedule(document.body)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
