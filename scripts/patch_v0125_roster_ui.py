from pathlib import Path
import re

app=Path('app.js')
css=Path('app.css')
idx=Path('index.html')
edge=Path('supabase/functions/dungeon-idel-api/index.ts')

s=app.read_text()

s=s.replace("let screen='home',S=null,busy=false,session=null,watchingExpeditionId=null,partyPick=[],partySite=null,lastAnimatedScreen=null,modalCloseTimer=null,lastBattleVisualKey=null;","let screen='home',S=null,busy=false,session=null,watchingExpeditionId=null,partyPick=[],partySite=null,lastAnimatedScreen=null,modalCloseTimer=null,lastBattleVisualKey=null,monsterDetailOrigin='roster';")

# Preserve where the monster detail was opened from.
dorm_start=s.index('function dormModal()')
dorm_end=s.index('\n\nfunction monsters()',dorm_start)
dorm=s[dorm_start:dorm_end].replace('data-action="employee" data-id="${m.id}"','data-action="employee" data-origin="dorm" data-id="${m.id}"')
s=s[:dorm_start]+dorm+s[dorm_end:]
mon_start=s.index('function monsters()')
mon_end=s.index('\n\nfunction hunt()',mon_start)
mon=s[mon_start:mon_end].replace('data-action="employee" data-id="${m.id}"','data-action="employee" data-origin="roster" data-id="${m.id}"')
s=s[:mon_start]+mon+s[mon_end:]

new_candidate=r'''function candidateModal(){const lv=Number(S.player.tavern_level||1),batch=recruitBatch(),cap=capacity(),room=Math.max(0,cap-S.monsters.length),locked=(S.candidates||[]).filter(c=>c.is_locked).length;modal(`<div class="sheet-head"><div><div class="section-kicker">RECRUITING</div><h2>영입소</h2><p>4시간마다 지원자 명단이 갱신됩니다. 잠근 후보만 다음 갱신에도 남습니다.</p></div><button class="close-btn" data-action="close">×</button></div><div class="facility-upgrade recruit-summary"><span><small>영입소 Lv.${lv}</small><b>다음 명단 ${candidateText()}</b><em>${batch}명 슬롯 · 잠금 ${locked}명 · 숙소 여유 ${room}/${cap}</em></span><button class="soft-btn" data-action="upgrade" data-id="tavern">확장 ${fmt(nextTavernCost())}G</button></div><div class="recruit-free-note"><b>무료 영입</b><span>후보 카드를 누르면 상세 능력치를 확인할 수 있습니다.</span></div><div class="candidate-list">${(S.candidates||[]).length?S.candidates.map(c=>{const cp=power({...c,level:1,xp:0});return `<article class="candidate-card ${c.is_locked?'locked-candidate':''}"><button class="candidate-profile-btn" data-action="candidate-detail" data-id="${c.id}"><span class="candidate-avatar">${charSvg(monsterAsset(c.family),'candidate-sprite')}</span><span class="candidate-identity"><b><i class="candidate-grade ${esc(c.growth_grade||'C')}">${esc(c.growth_grade||'C')}</i>${esc(c.name)}</b><small>${fam(c.family)} · ${esc(c.personality||'침착')}</small><em>${esc(c.trait||'무특성')}</em></span><span class="candidate-power"><small>전투력</small><b>${fmt(cp)}</b></span><span class="candidate-card-stats"><i><small>HP</small><b>${fmt(c.hp_base)}</b></i><i><small>공격</small><b>${fmt(c.atk_base)}</b></i><i><small>방어</small><b>${fmt(c.def_base)}</b></i><i><small>속도</small><b>${fmt(c.spd_base)}</b></i></span>${c.is_locked?'<span class="candidate-lock-badge">잠금 · 다음 명단 유지</span>':'<span class="candidate-detail-cue">상세 보기 ›</span>'}</button><div class="actions candidate-actions"><button class="primary-btn" data-action="hire" data-id="${c.id}" ${room<1?'disabled':''}>${room<1?'숙소 만원':'영입'}</button><button class="soft-btn" data-action="candidate-lock" data-id="${c.id}" data-locked="${c.is_locked?'false':'true'}">${c.is_locked?'잠금 해제':'잠금'}</button></div></article>`}).join(''):`<div class="empty-state">현재 대기 중인 지원자가 없습니다.<br>다음 명단까지 ${candidateText()}</div>`}</div>`,'recruit-sheet') }'''
s=re.sub(r"function candidateModal\(\)\{.*?\n\nfunction candidateDetailModal",new_candidate+'\n\nfunction candidateDetailModal',s,count=1,flags=re.S)

# Upgrade monster detail navigation without duplicating the existing detail implementation.
s=s.replace("function employeeModal(id){const m=S.monsters.find(x=>x.id===id);","function employeeModal(id,origin='roster'){monsterDetailOrigin=origin||monsterDetailOrigin||'roster';const m=S.monsters.find(x=>x.id===id);")
emp_start=s.index('function employeeModal(')
emp_end=s.index('\n\nfunction evolutionModal',emp_start)
emp=s[emp_start:emp_end]
emp=emp.replace('<div class="sheet-head"><div><div class="section-kicker">MONSTER FILE','<div class="sheet-head monster-detail-headbar"><button class="monster-back-btn" data-action="monster-back">‹ 목록</button><div><div class="section-kicker">MONSTER FILE',1)
needle="<div class=\"detail-note compact\"><b>${e?'현장 근무 중':'본부 대기'}</b><br>${e?`${esc(site?.name||'현장')} · 현재 ${esc(e.phase||'탐색')} 단계`:'박멸 화면에서 원하는 던전에 배치할 수 있습니다.'}</div></div>${e?"
replace="<div class=\"detail-note compact\"><b>${e?'현장 근무 중':'본부 대기'}</b><br>${e?`${esc(site?.name||'현장')} · 현재 ${esc(e.phase||'탐색')} 단계`:'박멸 화면에서 원하는 던전에 배치할 수 있습니다.'}</div></div><div class=\"monster-release-zone\"><span><small>ROSTER MANAGEMENT</small><b>몬스터 방출</b><em>${e?'출동 중에는 방출할 수 없습니다.':'장착 장비는 창고로 반환되고 과거 전투 기록은 유지됩니다.'}</em></span><button class=\"danger-btn monster-release-btn\" data-action=\"release-confirm-open\" data-id=\"${m.id}\" ${e?'disabled':''}>${e?'출동 중':'방출'}</button></div>${e?"
if needle not in emp:
    raise SystemExit('employee detail tail marker not found')
emp=emp.replace(needle,replace,1)
s=s[:emp_start]+emp+s[emp_end:]

release_fn=r'''
function releaseConfirmModal(id){const m=S.monsters.find(x=>x.id===id);if(!m)return;const e=activeOf(m.id),eq=equippedFor(m.id);if(e){toast('출동 중에는 방출할 수 없습니다.');employeeModal(id,monsterDetailOrigin);return}modal(`<div class="sheet-head release-confirm-head"><button class="monster-back-btn" data-action="release-cancel" data-id="${m.id}">‹ 상세</button><div><div class="section-kicker">RELEASE MONSTER</div><h2>${esc(m.name)} 방출</h2><p>${esc(formName(m))} · Lv.${m.level} · 전투력 ${fmt(power(m))}</p></div><button class="close-btn" data-action="close">×</button></div><div class="release-confirm-card"><div class="release-confirm-monster">${charSvg(monsterAsset(m.family),'release-sprite '+formClass(m))}<span><b>${esc(m.name)}</b><small>${esc(m.growth_grade||'C')}급 · 재능 ${fmt(m.talent)} · ${esc(m.trait||'무특성')}</small></span></div><div class="release-warning"><b>방출 후 보유 목록에서 사라집니다.</b><p>이 작업은 되돌릴 수 없습니다. 장착 중인 장비 ${eq.length}개는 자동으로 창고에 반환되며, 과거 박멸 기록은 삭제하지 않습니다.</p></div><div class="release-confirm-actions"><button class="soft-btn" data-action="release-cancel" data-id="${m.id}">취소</button><button class="danger-btn" data-action="release-confirm" data-id="${m.id}">정말 방출</button></div></div>`,'release-confirm-sheet')}
'''
s=s.replace('\n\nfunction evolutionModal',release_fn+'\nfunction evolutionModal',1)

s=s.replace("if(a==='employee'){employeeModal(b.dataset.id);return}","if(a==='employee'){employeeModal(b.dataset.id,b.dataset.origin||'roster');return}if(a==='monster-back'){if(monsterDetailOrigin==='dorm')dormModal();else{closeModal();screen='monsters';render()}return}if(a==='release-confirm-open'){releaseConfirmModal(b.dataset.id);return}if(a==='release-cancel'){employeeModal(b.dataset.id,monsterDetailOrigin);return}")
s=s.replace("}else if(a==='reject'){b.disabled=true;await api('reject',{candidateId:b.dataset.id});candidateModal();toast('지원자를 돌려보냈습니다.')}","}else if(a==='reject'){b.disabled=true;await api('reject',{candidateId:b.dataset.id});candidateModal();toast('지원자를 돌려보냈습니다.')}else if(a==='release-confirm'){b.disabled=true;const d=await api('release',{monsterId:b.dataset.id});closeModal();render();toast(`${d.release?.name||'몬스터'} 방출 완료`)}")

app.write_text(s)

# Append focused layout rules; these replace the old candidate-card positioning behavior at runtime.
c=css.read_text()
marker='/* v0.12.5 roster/recruit layout */'
if marker not in c:
    c += r'''

/* v0.12.5 roster/recruit layout */
.recruit-sheet .candidate-list{display:grid;gap:10px;padding-bottom:8px}
.recruit-sheet .candidate-card{display:block;height:auto;min-height:0;padding:0;overflow:hidden;border-radius:12px}
.recruit-sheet .candidate-profile-btn{position:relative;display:grid!important;grid-template-columns:66px minmax(0,1fr) auto;grid-template-rows:auto auto auto;width:100%;min-height:0;height:auto!important;padding:12px 12px 10px;gap:7px 10px;text-align:left;align-items:center;overflow:visible}
.recruit-sheet .candidate-avatar{grid-column:1;grid-row:1/4;width:60px;height:60px;display:grid;place-items:center;align-self:start}
.recruit-sheet .candidate-avatar .pixel-char{width:58px;height:58px}
.recruit-sheet .candidate-identity{grid-column:2;grid-row:1;min-width:0;display:grid;gap:2px}
.recruit-sheet .candidate-identity>b{font-size:15px;display:flex;align-items:center;gap:6px;min-width:0}
.recruit-sheet .candidate-identity small,.recruit-sheet .candidate-identity em{font-size:11px;line-height:1.25;white-space:normal;overflow:visible;text-overflow:clip}
.recruit-sheet .candidate-grade{display:inline-grid;place-items:center;min-width:23px;height:23px;border-radius:6px;font-style:normal;font-size:12px;flex:none}
.recruit-sheet .candidate-power{grid-column:3;grid-row:1;display:grid;justify-items:end;align-self:start;min-width:48px}
.recruit-sheet .candidate-power small{font-size:9px;opacity:.65}.recruit-sheet .candidate-power b{font-size:16px;line-height:1.1}
.recruit-sheet .candidate-card-stats{grid-column:2/4;grid-row:2;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;width:100%}
.recruit-sheet .candidate-card-stats i{display:grid;gap:1px;padding:6px 4px;border-radius:7px;text-align:center;font-style:normal;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.07)}
.recruit-sheet .candidate-card-stats small{font-size:9px;opacity:.62}.recruit-sheet .candidate-card-stats b{font-size:12px;line-height:1.1}
.recruit-sheet .candidate-detail-cue,.recruit-sheet .candidate-lock-badge{grid-column:2/4;grid-row:3;position:static!important;justify-self:start;margin:0;font-size:10px;line-height:1.2}
.recruit-sheet .candidate-card>.actions,.recruit-sheet .candidate-actions{position:static!important;display:grid!important;grid-template-columns:1fr 1fr;gap:7px;width:auto;margin:0;padding:0 10px 10px;transform:none!important}
.recruit-sheet .candidate-actions button{min-height:40px;margin:0!important}
.recruit-sheet .recruit-summary span{display:grid;gap:2px}.recruit-sheet .recruit-summary em{font-style:normal;font-size:10px;opacity:.65}
.monster-detail-headbar{grid-template-columns:auto minmax(0,1fr) auto;align-items:start;gap:8px}
.monster-detail-headbar>div{min-width:0}.monster-back-btn{min-width:58px;height:34px;padding:0 10px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.055);color:inherit;font-weight:800;font-size:12px}
.monster-release-zone{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0 0;padding:12px;border-radius:10px;border:1px solid rgba(205,77,66,.28);background:rgba(112,35,31,.12)}
.monster-release-zone span{display:grid;gap:2px;min-width:0}.monster-release-zone small{font-size:9px;opacity:.55}.monster-release-zone b{font-size:13px}.monster-release-zone em{font-size:10px;line-height:1.35;font-style:normal;opacity:.72}
.monster-release-btn{flex:none;min-width:66px}.monster-release-btn:disabled{opacity:.45}
.release-confirm-head{grid-template-columns:auto minmax(0,1fr) auto;gap:8px}.release-confirm-card{display:grid;gap:12px}.release-confirm-monster{display:flex;align-items:center;gap:12px;padding:12px;border-radius:10px;background:rgba(255,255,255,.045)}
.release-confirm-monster .release-sprite{width:64px;height:64px}.release-confirm-monster span{display:grid;gap:3px}.release-confirm-monster b{font-size:17px}.release-confirm-monster small{font-size:11px;opacity:.7}
.release-warning{padding:13px;border-radius:10px;border:1px solid rgba(205,77,66,.32);background:rgba(112,35,31,.14)}.release-warning b{font-size:13px}.release-warning p{margin:6px 0 0;font-size:11px;line-height:1.55;opacity:.78}
.release-confirm-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.release-confirm-actions button{min-height:44px}
@media(max-width:420px){.recruit-sheet .candidate-profile-btn{grid-template-columns:54px minmax(0,1fr) auto;padding:10px;gap:6px 8px}.recruit-sheet .candidate-avatar{width:50px;height:50px}.recruit-sheet .candidate-avatar .pixel-char{width:48px;height:48px}.recruit-sheet .candidate-card-stats{grid-column:1/4;margin-top:2px}.recruit-sheet .candidate-detail-cue,.recruit-sheet .candidate-lock-badge{grid-column:1/4}.monster-release-zone{align-items:flex-start;flex-direction:column}.monster-release-btn{width:100%}}
'''
css.write_text(c)

h=idx.read_text().replace('v0.12.4','v0.12.5').replace('0124b','0125a')
idx.write_text(h)

e=edge.read_text()
e=e.replace("db.from('game_monsters').select('*').eq('player_id',player).order('created_at')","db.from('game_monsters').select('*').eq('player_id',player).is('released_at',null).order('created_at')")
e=e.replace("db.from('game_monsters').select('*').eq('player_id',player).in('id',monsterIds)","db.from('game_monsters').select('*').eq('player_id',player).is('released_at',null).in('id',monsterIds)")
release_api="""  if(action==='release'){\n   const id=String(body.monsterId||'');const {data,error}=await db.rpc('game_release_monster',{p_player:player,p_monster:id});if(error){const msg=String(error.message||'');for(const code of ['monster_missing','monster_busy','player_missing'])if(msg.includes(code))return json({error:code},400);throw error}return json({ok:true,release:data||{},state:await state(player)})\n  }\n"""
if "if(action==='release')" not in e:
    e=e.replace("  if(action==='upgrade'){",release_api+"  if(action==='upgrade'){",1)
edge.write_text(e)
