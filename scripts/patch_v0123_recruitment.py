from pathlib import Path
import re

app_path=Path('app.js')
app=app_path.read_text(encoding='utf-8')

# Recruitment cadence is four hours everywhere in the UI.
app=app.replace('3시간마다 ${recruitBatch()}명','4시간마다 ${recruitBatch()}명')

candidate_block=r'''function candidateModal(){const lv=Number(S.player.tavern_level||1),batch=recruitBatch(),cap=capacity(),room=Math.max(0,cap-S.monsters.length),locked=(S.candidates||[]).filter(c=>c.is_locked).length;modal(`<div class="sheet-head"><div><div class="section-kicker">RECRUITING</div><h2>영입소</h2><p>4시간마다 지원자 명단이 갱신됩니다. 잠근 후보만 다음 갱신에도 남습니다.</p></div><button class="close-btn" data-action="close">×</button></div><div class="facility-upgrade"><span><small>영입소 Lv.${lv}</small><b>다음 명단 ${candidateText()} · ${batch}명 슬롯 · 잠금 ${locked}명 · 숙소 여유 ${room}/${cap}</b></span><button class="soft-btn" data-action="upgrade" data-id="tavern">확장 ${fmt(nextTavernCost())}G</button></div><div class="recruit-free-note"><b>영입 비용 0G</b><span>4시간 갱신 · 잠근 후보 유지 · 숙소 정원만 사용</span></div><div class="candidate-list">${(S.candidates||[]).length?S.candidates.map(c=>`<div class="candidate-card ${c.is_locked?'locked-candidate':''}"><button class="candidate-profile-btn" data-action="candidate-detail" data-id="${c.id}"><span class="candidate-avatar">${charSvg(monsterAsset(c.family),'candidate-sprite')}</span><span class="candidate-copy"><b><span class="candidate-grade ${esc(c.growth_grade||'C')}">${esc(c.growth_grade||'C')}</span>${esc(c.name)} · ${fam(c.family)}</b><small>재능 ${c.talent} · ${esc(c.personality||'침착')} · ${esc(c.trait||'무특성')}</small><span class="candidate-fit">HP ${fmt(c.hp_base)} · 공격 ${fmt(c.atk_base)} · 방어 ${fmt(c.def_base)}</span>${c.is_locked?'<em class="candidate-lock-badge">잠금 · 다음 명단 유지</em>':''}</span></button><div class="actions"><button class="primary-btn" data-action="hire" data-id="${c.id}" ${room<1?'disabled':''}>${room<1?'숙소 만원':'무료 영입'}</button><button class="soft-btn" data-action="candidate-lock" data-id="${c.id}" data-locked="${c.is_locked?'false':'true'}">${c.is_locked?'잠금 해제':'잠금'}</button></div></div>`).join(''):`<div class="empty-state">현재 대기 중인 지원자가 없습니다.<br>다음 명단까지 ${candidateText()}</div>`}</div>`,'recruit-sheet') }

function candidateDetailModal(id){const c=(S.candidates||[]).find(x=>x.id===id);if(!c){candidateModal();return}const cap=capacity(),room=Math.max(0,cap-S.monsters.length),meta=personalityMeta(c.personality||'침착'),locked=!!c.is_locked,cp=power({...c,level:1,xp:0});modal(`<div class="candidate-detail-head"><div><div class="section-kicker">RECRUIT FILE</div><h2>${esc(c.name)}</h2><p>${fam(c.family)} · 성장 ${esc(c.growth_grade||'C')} · 재능 ${fmt(c.talent)}</p></div>${locked?'<span class="candidate-detail-lock">LOCKED</span>':''}</div><div class="candidate-detail-hero"><div class="candidate-detail-avatar">${charSvg(monsterAsset(c.family),'candidate-detail-sprite')}</div><div><small>예상 전투력</small><b>${fmt(cp)}</b><span>${esc(c.trait||'무특성')}</span></div></div><div class="candidate-detail-stats"><div><small>HP</small><b>${fmt(c.hp_base)}</b></div><div><small>공격</small><b>${fmt(c.atk_base)}</b></div><div><small>방어</small><b>${fmt(c.def_base)}</b></div><div><small>속도</small><b>${fmt(c.spd_base)}</b></div><div><small>치명</small><b>${Math.round(Number(c.crit_base||0)*100)}%</b></div><div><small>회피</small><b>${Math.round(Number(c.evade_base||0)*100)}%</b></div></div><section class="candidate-personality"><small>성격 · ${esc(c.personality||'침착')}</small><b>${esc(meta.summary)}</b><p>${meta.effects.map(x=>esc(x)).join(' · ')}</p></section><div class="candidate-detail-note">4시간 후 명단이 갱신되면 <b>잠그지 않은 후보는 사라집니다.</b> 잠금 후보는 다음 명단에도 유지됩니다.</div><div class="candidate-detail-actions"><button class="soft-btn" data-action="candidate-lock" data-id="${c.id}" data-locked="${locked?'false':'true'}">${locked?'잠금 해제':'후보 잠금'}</button><button class="primary-btn" data-action="hire" data-id="${c.id}" ${room<1?'disabled':''}>${room<1?'숙소 만원':'무료 영입'}</button><button class="danger-btn" data-action="reject" data-id="${c.id}">돌려보내기</button></div><div class="dim-close-hint">바깥 영역을 눌러 닫기</div>`,'candidate-detail-sheet')}
'''

pattern=r"function candidateModal\(\)\{.*?\n\n\nfunction employeeModal"
if not re.search(pattern,app,re.S):
    raise SystemExit('candidateModal marker missing')
app=re.sub(pattern,candidate_block+'\nfunction employeeModal',app,count=1,flags=re.S)

old="if(a==='candidates'){candidateModal();return}if(a==='dorm')"
new="if(a==='candidates'){candidateModal();return}if(a==='candidate-detail'){candidateDetailModal(b.dataset.id);return}if(a==='dorm')"
if old not in app: raise SystemExit('candidate detail action marker missing')
app=app.replace(old,new,1)

old="if(a==='logout'){if(busy)return;busy=true;try{await sb.auth.signOut();showAuth()}finally{busy=false}return}try{busy=true;"
new="if(a==='logout'){if(busy)return;busy=true;try{await sb.auth.signOut();showAuth()}finally{busy=false}return}if(busy)return;try{busy=true;"
if old not in app: raise SystemExit('busy guard marker missing')
app=app.replace(old,new,1)

old="else if(a==='hire'){await api('hire',{candidateId:b.dataset.id});candidateModal();toast('무료 영입 완료 · 숙소에 배치했습니다.')}else if(a==='reject'){await api('reject',{candidateId:b.dataset.id});candidateModal();toast('지원자를 돌려보냈습니다.')}"
new="else if(a==='candidate-lock'){const id=b.dataset.id,want=b.dataset.locked==='true',detailOpen=!!document.querySelector('.candidate-detail-sheet');b.disabled=true;await api('candidate-lock',{candidateId:id,locked:want});if(detailOpen)candidateDetailModal(id);else candidateModal();toast(want?'후보를 잠갔습니다. · 다음 명단에도 유지':'후보 잠금을 해제했습니다.')}else if(a==='hire'){b.disabled=true;await api('hire',{candidateId:b.dataset.id});candidateModal();toast('무료 영입 완료 · 후보가 숙소로 이동했습니다.')}else if(a==='reject'){b.disabled=true;await api('reject',{candidateId:b.dataset.id});candidateModal();toast('지원자를 돌려보냈습니다.')}"
if old not in app: raise SystemExit('hire action marker missing')
app=app.replace(old,new,1)

app_path.write_text(app,encoding='utf-8')

css_path=Path('app.css')
css=css_path.read_text(encoding='utf-8')
old_css='.candidate-card{display:grid;grid-template-columns:58px 1fr auto;align-items:center;border:1px solid #48544b;background:#151b16;padding:7px}'
new_css='.candidate-card{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;border:1px solid #48544b;background:#151b16;padding:7px}'
if old_css not in css: raise SystemExit('candidate css marker missing')
css=css.replace(old_css,new_css,1)
css += r'''

/* v0.12.3 recruitment detail + safe candidate flow */
.candidate-profile-btn{min-width:0;border:0;background:transparent;color:inherit;padding:0;display:grid;grid-template-columns:58px minmax(0,1fr);gap:8px;align-items:center;text-align:left}.candidate-profile-btn:active{background:#202821}.candidate-copy{min-width:0}.candidate-copy>b,.candidate-copy>small,.candidate-copy>.candidate-fit{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.candidate-card.locked-candidate{border-color:#b17a3d;background:#1d1c16}.candidate-lock-badge{display:inline-block!important;width:max-content;max-width:100%;margin-top:4px;padding:2px 5px;border:1px solid #9f713c;background:#312315;color:#f1bd74!important;font-size:7px!important;font-style:normal}.candidate-card .actions{min-width:82px}.candidate-card .actions button{width:100%;min-height:31px}.candidate-detail-sheet{max-height:min(86vh,760px);overflow:auto}.candidate-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px}.candidate-detail-head h2{margin:0;font-size:21px}.candidate-detail-head p{margin:3px 0 0;color:#879289;font-size:9px}.candidate-detail-lock{border:1px solid #a9753c;background:#362719;color:#efbc77;padding:5px 7px;font:800 8px monospace}.candidate-detail-hero{display:grid;grid-template-columns:92px 1fr;gap:12px;align-items:center;border:1px solid #465248;background:#111612;padding:10px}.candidate-detail-avatar{height:92px;display:grid;place-items:center;background:#0b0f0c;border:1px solid #364138}.candidate-detail-sprite{width:84px;height:84px;image-rendering:pixelated}.candidate-detail-hero small{display:block;color:#79867d;font-size:8px}.candidate-detail-hero b{display:block;font-size:24px;color:#efbb78}.candidate-detail-hero span{display:block;font-size:10px;color:#aeb8b0;margin-top:3px}.candidate-detail-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:8px}.candidate-detail-stats div{border:1px solid #39443b;background:#101511;padding:8px}.candidate-detail-stats small{display:block;font-size:7px;color:#748078}.candidate-detail-stats b{font-size:13px}.candidate-personality{margin-top:8px;border-left:3px solid #7da36d;background:#182019;padding:9px}.candidate-personality small{display:block;font-size:8px;color:#8db07d}.candidate-personality b{display:block;font-size:11px;margin-top:2px}.candidate-personality p{margin:4px 0 0;color:#89958c;font-size:8px;line-height:1.5}.candidate-detail-note{margin-top:8px;border:1px solid #59472f;background:#201a13;padding:9px;color:#aa9d8a;font-size:9px;line-height:1.5}.candidate-detail-note b{color:#efbb78}.candidate-detail-actions{display:grid;grid-template-columns:1fr 1.25fr 1fr;gap:6px;margin-top:10px}.candidate-detail-actions button{min-height:38px}
@media(max-width:430px){.candidate-profile-btn{grid-template-columns:50px minmax(0,1fr);gap:6px}.candidate-card .actions{min-width:76px}.candidate-detail-actions{grid-template-columns:1fr 1fr}.candidate-detail-actions .danger-btn{grid-column:1/-1}.candidate-detail-hero{grid-template-columns:78px 1fr}.candidate-detail-avatar{height:78px}.candidate-detail-sprite{width:72px;height:72px}}
'''
css_path.write_text(css,encoding='utf-8')

api_path=Path('supabase/functions/dungeon-idel-api/index.ts')
api=api_path.read_text(encoding='utf-8')
hire_pattern=r"  if\(action==='hire'\)\{.*?\n  \}\n  if\(action==='reject'\)"
hire_block="""  if(action==='hire'){\n   const id=String(body.candidateId||'');const {data,error}=await db.rpc('game_hire_candidate',{p_player:player,p_candidate:id});if(error){const msg=String(error.message||'');for(const code of ['candidate_missing','quarters_full','player_missing'])if(msg.includes(code))return json({error:code},400);throw error}return json({ok:true,hire:data||{},state:await state(player)})\n  }\n  if(action==='candidate-lock'){\n   const id=String(body.candidateId||''),locked=body.locked===true;const {data,error}=await db.rpc('game_set_candidate_lock',{p_player:player,p_candidate:id,p_locked:locked});if(error){const msg=String(error.message||'');for(const code of ['candidate_missing','player_missing'])if(msg.includes(code))return json({error:code},400);throw error}return json({ok:true,locked:!!data,state:await state(player)})\n  }\n  if(action==='reject')"""
if not re.search(hire_pattern,api,re.S): raise SystemExit('api hire marker missing')
api=re.sub(hire_pattern,hire_block,api,count=1,flags=re.S)
api_path.write_text(api,encoding='utf-8')

index_path=Path('index.html')
html=index_path.read_text(encoding='utf-8')
html=html.replace('v0.12.2','v0.12.3').replace('0122a','0123a')
index_path.write_text(html,encoding='utf-8')
