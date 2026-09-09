from pathlib import Path

p=Path('app.js')
s=p.read_text()
start=s.index('function watchModal(expId){')
end=s.index('function menuModal()', start)
new=r'''function battleUi(siteId){return ({
  mountain_village:{alert:'산골 마을 외곽에서 인간 순찰대가 우리 박멸조를 발견했습니다.',copy:'사람의 발길이 드문 숲길을 따라 마을 외곽에 진입했습니다. 민가 주변의 저항 세력을 제거하고 쓸 만한 물자를 회수합니다.'},
  farm_road:{alert:'농촌 길목에서 무장한 호위대가 이동 경로를 가로막았습니다.',copy:'농지와 창고가 이어진 길목입니다. 행상인과 경비병이 자주 지나가므로 교전이 잦지만, 식량과 장비를 확보하기 좋습니다.'},
  border_outpost:{alert:'변경 초소의 경보종이 울렸습니다. 병사들이 박멸조를 포위하려 합니다.',copy:'왕국 변경의 감시 초소입니다. 병사와 기사가 상주해 위험하지만 철제 장비와 왕국 물자를 노릴 수 있습니다.'}
}[siteId]||{alert:'인간 세력이 우리 박멸조의 움직임을 눈치챘습니다.',copy:'현장 상황을 파악하며 저항 세력을 제거하고 전리품을 회수합니다.'})}
function battleHash(v){let h=0;for(const c of String(v||''))h=(h*31+c.charCodeAt(0))>>>0;return h}
function battleLogHtml(e,m,site){const rows=(e.battle_log||[]).slice(0,10);if(!rows.length)return '<div class="combat-log-empty">첫 교전 기록을 기다리는 중...</div>';return rows.map((x,i)=>{const seed=battleHash(`${x.t}|${x.enemy}|${i}`),dmg=Math.max(7,Math.round(power(m)*(.55+(seed%46)/100))),hurt=Math.max(4,Math.round(Number(site?.recommended_power||40)*(.12+(seed%22)/100))),crit=(seed%5===0),enemy=esc(x.enemy||'용사');if(x.result==='win')return `<div class="combat-log-row"><b class="ally">${esc(m.name)}</b>이(가) <b class="enemy">${enemy}</b>에게 <strong>${fmt(dmg)}</strong> 피해를 줬습니다.${crit?'<em>치명타!</em>':''}</div><div class="combat-log-row system">박멸 성공 · 현장 화물 회수 중</div>`;return `<div class="combat-log-row fail"><b class="enemy">${enemy}</b>의 반격! <b class="ally">${esc(m.name)}</b>이(가) <strong>${fmt(hurt)}</strong> 피해를 입었습니다.</div>`}).join('')}
function watchModal(expId){const e=S.expeditions.find(x=>x.id===expId);if(!e)return;const m=S.monsters.find(x=>x.id===e.monster_id),site=S.sites.find(x=>x.id===e.site_id),enemy=e.battle_state?.enemy||site?.enemy_names?.[0]||'용사',ui=battleUi(e.site_id),seed=battleHash(enemy+e.battle_count),floatDmg=Math.max(7,Math.round(power(m)*(.6+(seed%35)/100)));watchingExpeditionId=expId;modal(`<div class="battle-report-head"><div><h2>${esc(site?.name||'현장')}</h2><small>${siteCode(e.site_id)} · 실시간 박멸 작전</small></div><button class="battle-report-close" data-action="close">×</button></div><div class="battle-report-scene ${e.site_id}"><div class="battle-scene-top"><span class="battle-opcode">${siteCode(e.site_id)}</span><span class="battle-server-badge">SERVER LIVE</span></div><div class="battle-party"><div class="battle-actor monster-actor"><div class="actor-frame">${m?charSvg(monsterAsset(m.family),'battle-sprite'):''}</div><span class="battle-name">${esc(m?.name||'몬스터')}</span><span class="battle-hp"><i></i></span></div><div class="battle-impact"></div><div id="liveDamageFloat" class="battle-dmg-float">-${fmt(floatDmg)}</div><div class="battle-actor enemy-actor"><div id="liveEnemySprite" class="actor-frame">${charSvg(enemyAsset(enemy),'battle-sprite')}</div><span id="liveEnemyName" class="battle-name">${esc(enemy)}</span><span class="battle-hp"><i></i></span></div></div></div><div class="battle-report-body"><div id="liveAlert" class="battle-alert">${esc(ui.alert)}</div><div class="battle-zone-copy"><span>${esc(ui.copy)}</span></div><div class="battle-summary"><div><small>교전</small><b><span id="liveBattleCount">${fmt(e.battle_count)}</span>회</b></div><div><small>박멸</small><b><span id="liveKills">${fmt(e.kills)}</span>명</b></div><div><small>회수 화물</small><b><span id="liveLoot">${lootCount(e)}</span>개</b></div></div><div id="liveLog" class="combat-log">${battleLogHtml(e,m,site)}</div></div><div class="battle-report-actions"><button class="retreat" data-action="recall" data-id="${e.id}">현장 철수</button><button class="close" data-action="close">닫기</button></div>`,'battle-report-sheet');syncWatchPanel()}

'''
s=s[:start]+new+s[end:]

start=s.index('function syncWatchPanel(){')
end=s.index('async function refresh()', start)
new_sync=r'''function syncWatchPanel(){if(!watchingExpeditionId||!S)return;const e=S.expeditions.find(x=>x.id===watchingExpeditionId);if(!e)return;const m=S.monsters.find(x=>x.id===e.monster_id),site=S.sites.find(x=>x.id===e.site_id),enemy=e.battle_state?.enemy||site?.enemy_names?.[0]||'용사',ui=battleUi(e.site_id),seed=battleHash(enemy+e.battle_count),floatDmg=Math.max(7,Math.round(power(m)*(.6+(seed%35)/100)));const bc=$('#liveBattleCount'),k=$('#liveKills'),l=$('#liveLoot'),n=$('#liveEnemyName'),log=$('#liveLog'),holder=$('#liveEnemySprite'),alert=$('#liveAlert'),dmg=$('#liveDamageFloat');if(bc)bc.textContent=fmt(e.battle_count);if(k)k.textContent=fmt(e.kills);if(l)l.textContent=lootCount(e);if(n)n.textContent=enemy;if(alert)alert.textContent=ui.alert;if(dmg)dmg.textContent='-'+fmt(floatDmg);if(holder){const u=holder.querySelector('use');if(u)u.setAttribute('href',`assets/characters.svg#${enemyAsset(enemy)}`)}if(log&&m)log.innerHTML=battleLogHtml(e,m,site)}
'''
s=s[:start]+new_sync+'\n'+s[end:]
p.write_text(s)

h=Path('index.html')
t=h.read_text()
t=t.replace('v0.9.1','v0.9.2').replace('0910','0920')
if 'battle-v092.css' not in t:
    t=t.replace('<link rel="stylesheet" href="ui-hotfix-v091.css?v=0920">','<link rel="stylesheet" href="ui-hotfix-v091.css?v=0920">\n<link rel="stylesheet" href="battle-v092.css?v=0920">')
h.write_text(t)
