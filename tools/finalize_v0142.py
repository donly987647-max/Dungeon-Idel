"""One-time source repair. Only runs on the maintenance branch, never in the browser."""
from pathlib import Path
import re

p=Path('app.js'); s=p.read_text()
assert s.startswith("const SB_URL="), 'Source is not the complete original JavaScript'
assert 'Warning: truncated output' not in s

def once(old,new):
    global s
    assert s.count(old)==1, f'Expected exactly one source anchor: {old[:100]} (found {s.count(old)})'
    s=s.replace(old,new,1)

start=s.index('function updateChrome()'); end=s.index('\nfunction render()',start)
s=s[:start]+'''function updateChrome(){
  if(!S)return;
  const text=(selector,value)=>{const el=$(selector);if(el)el.textContent=value};
  text('#gold',fmt(S.player.gold));
  text('#screenTitle',({home:'본부',monsters:'몬스터',hunt:'작전',loot:'창고'}[screen]||'본부'));
  text('#briefLine',briefText());
  $$('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.screen===screen));
}'''+s[end:]
# Health is carried through exploration, not only during combat/result.
once("if(mh)mh.style.width=vm.active||vm.result?`${Math.max(0,Math.min(100,vm.mmax?vm.mhp/vm.mmax*100:100))}%`:'100%';", "if(mh)mh.style.width=`${Math.max(0,Math.min(100,vm.mmax?vm.mhp/vm.mmax*100:0))}%`;")
once("if(mht)mht.textContent=vm.active||vm.result?`${fmt(vm.mhp)}/${fmt(vm.mmax)}`:'이동/탐색 중';", "if(mht)mht.textContent=`HP ${fmt(vm.mhp)} / ${fmt(vm.mmax)}`;")
once("${vm.active||vm.result?`${fmt(vm.mhp)}/${fmt(vm.mmax)}`:'이동/탐색 중'}", "${`HP ${fmt(vm.mhp)} / ${fmt(vm.mmax)}`}")
# Do not replay the previous encounter's skill/death display during exploration.
once("skills=Array.isArray(bs.skills)?bs.skills:Array.isArray(log.skills)?log.skills:[],deaths=Array.isArray(last.deaths)?last.deaths:[]", "skills=(active||result)?(Array.isArray(bs.skills)?bs.skills:Array.isArray(log.skills)?log.skills:[]):[],deaths=(active||result)&&Array.isArray(last.deaths)?last.deaths:[]")
once("if(deaths.length)takenText=", "if(!active&&!result){const rec=log.recovery||{};if(Number(rec.heal)>0){typeText=({well:'우물 발견',potion:'회복약 획득',camp:'야영지 발견'}[rec.kind]||'체력 회복');badge='회복';resultText='생존 몬스터 일부 회복';damageText=`HP +${fmt(rec.heal)}`;takenText='';}else{resultText='남은 체력으로 다음 구역 탐색';damageText='체력 유지';takenText='';}}if(deaths.length)takenText=")
# Explicit callbacks from the renderer; do not layer another MutationObserver/wrapper.
once("requestAnimationFrame(()=>m.classList.add('open'))}", "requestAnimationFrame(()=>{m.classList.add('open');window.refreshExpeditionPartyUI?.()})}")
once("paintCanvases();updateEconomyProgress()});updateCandidateTimer()}", "paintCanvases();updateEconomyProgress()});updateCandidateTimer();document.dispatchEvent(new Event('game:render'))}")
# An active dungeon is a locked party view, never a live add-member list.
once("if(!keep||partySite!==siteId){partySite=siteId;partyPick=[]}", "if(window.ExpeditionUI?.showActive(siteId))return;if(!keep||partySite!==siteId){partySite=siteId;partyPick=[]}")
old="if(busy)return;try{busy=true;if(a==='deploy-party'){const partyCount=partyPick.length;await api('deploy',{monsterIds:[...partyPick],siteId:b.dataset.site});closeModal();toast(`${partyCount}마리 박멸조 출정`);render()}else if(a==='recall')"
new="if(a==='deploy-party'){await window.ExpeditionUI.launch(b.dataset.site,[...partyPick]);return}if(busy)return;try{busy=true;if(a==='recall')"
once(old,new)
# Remove the duplicate list action and stale evolution-reset copy from the recovered source.
once('<button class="monster-back-btn" data-action="monster-back">‹ 목록</button>','')
s=s.replace('전직 후 Lv.1부터 새로운 성장 시작','현재 레벨을 유지하며 전직').replace('→ 선택한 진화체 Lv.1','→ 선택한 진화체 Lv.${m.level}').replace('전직하면 현재 레벨과 XP는 초기화됩니다. 이름·재능·성격·특성·장비·누적 박멸 기록은 유지됩니다.','전직해도 현재 레벨은 유지됩니다. 전직 후 이름은 진화명으로 바뀌고 재능·성격·특성·장비·누적 박멸 기록은 유지됩니다.').replace("${d.evolution?.formName||'전직'} 완료 · Lv.1", "${d.evolution?.formName||'전직'} 완료")
once("ops_full:'작전실", "expedition_changed:'이미 종료되거나 변경된 원정입니다.',party_unchanged:'파티 구성을 변경한 뒤 재출정해 주세요.',ops_full:'작전실")
# Preserve static definitions even when an action requests lite state directly.
once("if(d.state)S=d.state;return d}", "if(d.state)S=action==='state-lite'?{...S,...d.state}:d.state;return d}")
# Finished expeditions get an explicit restart action rather than a dead recall button.
once("if(cluster)cluster.innerHTML=battlePartyHtml(e);", "if(cluster){const hpKey=JSON.stringify([vm.bs.partyHp,vm.bs.partyMaxHp,partyOf(e).map(m=>[m.id,m.form_id,m.level])]);if(cluster.dataset.hpKey!==hpKey){cluster.innerHTML=battlePartyHtml(e);cluster.dataset.hpKey=hpKey;}}const endButton=document.querySelector('.battle-report-actions .retreat');if(endButton&&!e.active){endButton.dataset.action='mission';endButton.dataset.id=e.site_id;endButton.textContent='파티 편성 · 다시 출정';}")
p.write_text(s)

p=Path('scripts/stability-v0133.js'); s=p.read_text()
old="try{const fullRender=render;render=function(){fullRender();patchVisible()}}catch(_){}"
assert old in s
s=s.replace(old,"document.addEventListener('game:render',patchVisible);")
s=s.replace("try{window.refreshHuntEnhancements?.()}catch(_){}", "try{window.refreshHuntEnhancements?.()}catch(_){}try{window.refreshExpeditionPartyUI?.()}catch(_){}")
s=s.replace('몬스터별 자유 파견','던전당 1개 파티 · 최대 4명')
p.write_text(s)

p=Path('index.html'); s=p.read_text().replace('v0.14.1','v0.14.2').replace('app.js?v=0141b','app.js?v=0142a').replace('app.js?v=0140a','app.js?v=0142a')
s=re.sub(r'(scripts/(?:stability-v0133|expedition-v0141)\.js)\?v=[^"\s]+',r'\1?v=0142a',s)
s=re.sub(r'(ui-v0141\.css)\?v=[^"\s]+',r'\1?v=0142a',s)
p.write_text(s)

p=Path('ui-v0141.css'); s=p.read_text()
s+='''
/* v0.14.2: shared, bounded party cards and readable carried health. */
.exp-active-party-sheet .exp-active-slots,.exp-reconfigure-sheet .exp-edit-slots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.exp-active-party-sheet .exp-party-slot,.exp-reconfigure-sheet .exp-party-slot{min-width:0;display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 8px;overflow:hidden}
.exp-party-slot .exp-party-avatar{width:48px;height:48px;display:grid;place-items:center;flex:none;overflow:hidden}
.exp-party-slot .exp-party-avatar>*{width:44px!important;height:44px!important;max-width:44px;max-height:44px;flex:none}
.exp-party-slot b{font-size:14px;line-height:1.35;max-width:100%;overflow-wrap:anywhere;text-align:center}
.exp-party-slot small{font-size:12px;line-height:1.5;font-variant-numeric:tabular-nums;text-align:center}
.exp-party-slot>i{display:block;width:100%;height:6px;background:#171421;overflow:hidden}.exp-party-slot>i>em{display:block;height:100%;background:#a8d880}
.exp-party-slot.down{opacity:.6}.exp-active-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.exp-active-actions button,.exp-redeploy-confirm{min-height:44px;font-size:14px}
.exp-active-party-sheet .exp-restart-warning,.exp-reconfigure-sheet .exp-restart-warning{font-size:13px;line-height:1.7;word-break:keep-all;overflow-wrap:anywhere}
#modal .battle-report-actions .retreat{font-size:14px;min-height:44px;white-space:normal}
#modal .hp-text{font-variant-numeric:tabular-nums;font-size:12px!important;line-height:1.5;white-space:normal!important;overflow-wrap:anywhere}
@media(min-width:560px){.exp-active-party-sheet .exp-active-slots,.exp-reconfigure-sheet .exp-edit-slots{grid-template-columns:repeat(4,minmax(0,1fr))}}
'''
p.write_text(s)
print('V0142_DIRECT_SOURCE_PATCH_OK')
