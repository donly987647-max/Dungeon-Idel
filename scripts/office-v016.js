/* Office progression, accessible notifications and idle policy. */
(()=>{
 const enabled=()=>S?.sites?.some(s=>s.chapter?.version>=16);
 const seenKey=k=>`office-v016:${S?.player?.device_id||S?.account?.username||'local'}:${k}`;
 const seen=k=>{try{return JSON.parse(localStorage.getItem(seenKey(k))||'[]')}catch{return []}};
 const current=k=>k==='candidates'?(S.candidates||[]).map(x=>x.id):k==='staff'?(S.monsters||[]).map(x=>x.id):k==='gear'?(S.inventory||[]).filter(x=>itemDef(x.item_id)?.kind==='equipment').map(x=>x.item_id):(k==='craft'?S.craftJobs:S.sellJobs||[]).filter(x=>x.status==='done').map(x=>x.id);
 const news=k=>current(k).filter(x=>!seen(k).includes(x));
 function ack(k){if(!S)return;try{localStorage.setItem(seenKey(k),JSON.stringify(current(k)))}catch{}window.Campaign?.refresh();refresh();}
 const actions={candidates:['영입소','candidates'],staff:['숙소','dorm'],gear:['새 장비','warehouse'],craft:['제작 완료','workshop'],sell:['판매 완료','shop']};
 function notices(){if(!enabled())return '';const entries=Object.keys(actions).map(k=>[k,news(k).length]).filter(([,n])=>n);
  return `<section class="office-notices" aria-label="새 소식"><div><b>사내 알림</b><span>${entries.length?'놓친 소식을 확인하세요':'모든 업무가 정상 진행 중입니다'}</span></div>${entries.map(([k,n])=>`<button data-action="${actions[k][1]}" data-office-ack="${k}"><em>NEW</em> ${actions[k][0]} <b>${n}</b></button>`).join('')}</section>`;
 }
 function guide(){if(!enabled())return '';const active=S.expeditions.filter(e=>e.active),down=S.monsters.filter(m=>m.recovery_actions>0),working=S.player.idle_automation!==false;
  return `<div data-campaign-guide>${notices()}<section class="office-idle-summary"><div><small>사장님이 쉬는 동안에도</small><b>${active.length?'박멸조가 계속 일하고 있어요':'첫 박멸조를 출정시켜 주세요'}</b><p>${active.length?`원정 ${active.length}건 · ${down.length?`회복 대기 ${down.length}명 · `:''}전멸해도 자동 재출정`:'회복 담당과 공격수를 무료 영입한 뒤 출정하면 자동 성장이 시작됩니다.'}<br>상품 자동운영 ${working?'ON':'OFF'} · 보유 재료 12개씩은 제작을 위해 보존</p></div><button class="soft-btn" data-idle-action="policy">운영 방침</button></section></div>`;
 }
 function profile(m){if(!enabled())return '';const points=Number(m.service_points||0),next={C:['B',200],B:['A',800],A:['S',2000]}[m.growth_grade],branches=branchesFor(m),chosen=m.evolution_plan?.[m.form_id]||[...branches].sort((a,b)=>a.id.localeCompare(b.id))[0]?.id;
  const department=OfficeRoster.departments[m.family];
  return `<section class="office-service"><div><span class="office-rank rank-${m.growth_grade}">${esc(m.growth_grade)}</span><div><small>${esc(department?.job||'회사 직원')}</small><b>${next?`다음 근속 승급 ${next[0]}`:'최고 근속 등급'}</b><p>${next?`${fmt(points)} / ${fmt(next[1])}전 · 완료한 전투마다 공적 +1`:`총 ${fmt(points)}전 근속 · 모든 성장 보너스 적용`}</p></div></div>${next?`<i class="idle-progress"><em style="width:${Math.min(100,points/next[1]*100)}%"></em></i>`:''}<p>${esc(department?.story||'')} 높은 등급으로 영입하면 먼저 출발하고, 모든 직원은 근속으로 S까지 승급합니다.</p>${m.recovery_actions?`<b class="office-recovery">회복 중 · 원정 행동 ${m.recovery_actions}회 뒤 자동 부활</b>`:''}</section>${branches.length?`<section class="office-evolution"><div><small>AUTO EVOLUTION · Lv.${branches[0].required_level}</small><b>미리 정하는 다음 보직</b><p>레벨에 도달하면 전투 종료 후 자동 전직합니다.</p></div>${branches.map(b=>{const sk=S.skillDefs.find(k=>k.id===b.skill_id);return `<button class="office-route ${chosen===b.id?'chosen':''}" data-idle-action="plan" data-monster="${esc(m.id)}" data-evolution="${esc(b.id)}" aria-pressed="${chosen===b.id}"><span>${window.OfficeArt?.monster(m.family,`form-${b.target_form_id}`)||''}</span><div><b>${esc(b.target_name)}</b><small>${esc(sk?.name||'')}</small><p>${esc(sk?.description||b.description)}</p></div><em>${chosen===b.id?'예약됨':'예약'}</em></button>`}).join('')}</section>`:'<section class="office-evolution"><b>최종 보직에 도달했습니다</b><p>Lv.60까지 성장하며 근속 등급과 장비를 완성하세요.</p></section>'}`;
 }
 function policy(){const items=[['idle_automation','상품 자동운영','전리품 운송, 일반 상품 가공·판매. 희소 재료와 장비는 보존합니다.'],['auto_reinvest','필요 시설 자동 확장','다음 챕터에 필요한 제작소와 공간이 부족한 창고에만 재투자합니다.'],['auto_equip','좋은 장비 자동 장착','전투 사이 역할에 맞는 장비로 교체합니다. 기존 장비와 강화는 보존됩니다.'],['auto_advance','다음 챕터 자동 진출','보스를 처음 처치한 뒤 다음 챕터로 이동합니다. 끄면 현재 챕터를 반복합니다.']];
  modal(`<div class="sheet-head"><div><div class="section-kicker">OFFICE POLICY</div><h2>운영 방침</h2><p>한 번 정한 방침으로 접속하지 않아도 운영됩니다.</p></div><button class="close-btn" data-action="close">×</button></div><div class="office-policies">${items.map(([k,title,copy])=>`<label><span><b>${title}</b><small>${copy}</small></span><input type="checkbox" data-idle-policy="${k}" ${S.player[k]!==false?'checked':''}></label>`).join('')}</div><div class="idle-auto-note"><b>기본 복지</b><p>쓰러진 직원은 12행동 후 부활, 전멸한 파티는 15행동 후 재출정합니다. 수동 복귀해도 회복 대기는 유지됩니다. 전직은 직원 상세에서 예약하세요.</p></div>`,'office-policy-sheet');
 }
 function refresh(){if(!enabled())return;const map={recruit:'candidates',dorm:'staff',workshop:'craft',shop:'sell',storage:'gear'};
  for(const [cls,key] of Object.entries(map)){const row=document.querySelector('.facility-row.'+cls),title=row?.querySelector('.facility-copy b');if(!title)continue;const count=news(key).length;row.classList.remove('facility-has-alert');row.querySelector('.office-new-badge')?.remove();if(count){const tag=document.createElement('em');tag.className='office-new-badge';tag.textContent='NEW '+count;title.append(tag);row.setAttribute('aria-label',actions[key][0]+' 새 소식 '+count+'건');}}
  window.IdleEconomy?.refresh();window.DefenseUI?.refresh();
 }
 document.addEventListener('click',async e=>{const ackButton=e.target.closest('[data-office-ack]');if(ackButton)ack(ackButton.dataset.officeAck);
  const old=e.target.closest('[data-action]');if(old){const kind={candidates:'candidates',dorm:'staff',warehouse:'gear',workshop:'craft',shop:'sell'}[old.dataset.action];if(kind)ack(kind);}
  const b=e.target.closest('[data-idle-action]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();
  if(b.dataset.idleAction==='policy'){policy();return;}if(b.dataset.idleAction==='plan'&&!busy){busy=true;try{await api('plan-evolution',{monsterId:b.dataset.monster,evolutionId:b.dataset.evolution});employeeModal(b.dataset.monster);toast('자동 전직 경로를 예약했습니다.');}catch(err){toast(errorKo(err.message))}finally{busy=false}}
 },true);
 document.addEventListener('change',async e=>{const box=e.target.closest('[data-idle-policy]');if(!box)return;if(busy){box.checked=!box.checked;return;}busy=true;box.disabled=true;try{await api('idle-policy',{settings:{[box.dataset.idlePolicy]:box.checked}});render();}catch(err){box.checked=!box.checked;toast(errorKo(err.message));}finally{box.disabled=false;busy=false}});
 document.addEventListener('game:render',refresh);window.OfficeUI={enabled,guide,profile,policy,refresh,ack};
})();
