const SB_URL='https://xtvhisddjtfnsumprgpm.supabase.co';
const PUB='sb_publishable_pYdQeWXJJjNHGwchtshJGQ_ybwDsQ5O';
const API=SB_URL+'/functions/v1/dungeon-idel-api';
const sb=window.supabase.createClient(SB_URL,PUB,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});

let screen='home',S=null,busy=false,session=null;
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const fmt=n=>Number(n||0).toLocaleString('ko-KR');
const titleMap={home:'본부',monsters:'몬스터',hunt:'박멸',loot:'전리품'};
const fam=k=>({slime:'슬라임',goblin:'고블린',troll:'트롤'}[k]||k);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const power=m=>Math.floor(m.power_base+(m.level-1)*12+Math.max(0,m.talent-80)*1.2);
const validKoreanId=u=>/^[가-힣]{2,12}$/.test(String(u||'').normalize('NFC'));
const validPin=p=>/^\d{4}$/.test(String(p||''));
const activeOf=mid=>(S?.expeditions||[]).find(e=>e.active&&e.monster_id===mid);
const expeditionAt=site=>(S?.expeditions||[]).filter(e=>e.active&&e.site_id===site.id);
const lootCount=e=>Object.values(e?.pending_loot||{}).reduce((a,b)=>a+Number(b||0),0);
const totalPending=()=>S?(S.expeditions||[]).reduce((a,e)=>a+lootCount(e),0):0;
const inventoryCount=()=>S?(S.inventory||[]).reduce((a,x)=>a+Number(x.qty||0),0):0;

function authMsg(text='',ok=false){const e=$('#authMsg');if(!e)return;e.textContent=text;e.classList.toggle('ok',ok)}
function toast(t){const e=$('#toast');if(!e)return;e.textContent=t;e.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>e.classList.remove('show'),1700)}

async function currentSession(){const {data,error}=await sb.auth.getSession();if(error)throw error;session=data.session;return session}
async function api(action,payload={}){
  const s=await currentSession();
  if(!s)throw new Error('unauthorized');
  const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','apikey':PUB,'Authorization':'Bearer '+s.access_token},body:JSON.stringify({action,...payload})});
  const d=await r.json().catch(()=>({error:'bad_response'}));
  if(!r.ok)throw new Error(d.error||'server_error');
  if(d.state)S=d.state;
  return d;
}
async function registerAccount(username,password){
  const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','apikey':PUB},body:JSON.stringify({action:'register',username,password})});
  const d=await r.json().catch(()=>({error:'bad_response'}));
  if(!r.ok)throw new Error(d.error||'register_failed');
  return d;
}
async function loginAccount(username,password){
  const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','apikey':PUB},body:JSON.stringify({action:'login',username,password})});
  const d=await r.json().catch(()=>({error:'bad_response'}));
  if(!r.ok)throw new Error(d.error||'invalid_credentials');
  return d;
}
async function applySession(authSession){
  if(!authSession?.access_token||!authSession?.refresh_token)throw new Error('invalid_credentials');
  const {data,error}=await sb.auth.setSession({access_token:authSession.access_token,refresh_token:authSession.refresh_token});
  if(error||!data.session)throw new Error('invalid_credentials');
  session=data.session;
}

function closeModal(){const m=$('#modal');if(!m)return;m.classList.add('hidden');m.innerHTML=''}
function showAuth(){closeModal();S=null;session=null;$('#app')?.classList.add('hidden');$('#authGate')?.classList.remove('hidden');authMsg('')}
async function enterGame(){
  const s=await currentSession();
  if(!s){showAuth();return}
  $('#authGate').classList.add('hidden');$('#app').classList.remove('hidden');
  try{await api('state');render()}catch(e){if(e.message==='unauthorized'){await sb.auth.signOut();showAuth()}else{toast('서버 상태를 불러오지 못했습니다.')}}
}

/* pixel art */
function px(g,x,y,w,h,c){g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))}
function drawMonster(c,m,x,y,scale=1,flip=false){
  const g=c.getContext('2d');g.save();g.translate(x,y);if(flip)g.scale(-1,1);g.scale(scale,scale);g.imageSmoothingEnabled=false;
  const body=m.family==='slime'?'#67bd76':m.family==='goblin'?'#91ac4e':'#758464';
  const dark=m.family==='slime'?'#376a43':m.family==='goblin'?'#4e6130':'#3e4938';
  px(g,-13,13,26,5,'#171917');
  if(m.family==='slime'){
    px(g,-12,-5,24,16,body);px(g,-9,-10,18,7,body);px(g,-7,-13,14,4,body);px(g,-10,7,20,5,dark);
  }else if(m.family==='goblin'){
    px(g,-10,-8,20,22,body);px(g,-7,-14,14,8,body);px(g,-13,-10,5,6,body);px(g,8,-10,5,6,body);px(g,-8,9,6,7,dark);px(g,2,9,6,7,dark);
  }else{
    px(g,-14,-6,28,21,body);px(g,-9,-14,18,10,body);px(g,-18,-3,6,17,dark);px(g,12,-3,6,17,dark);px(g,-9,10,7,8,dark);px(g,2,10,7,8,dark);
  }
  px(g,-6,-5,4,4,'#eee7c5');px(g,3,-5,4,4,'#eee7c5');px(g,-5,-4,2,2,'#1d211b');px(g,4,-4,2,2,'#1d211b');
  if(m.level>=5){px(g,-14,-15,5,5,'#d18a36');px(g,9,-15,5,5,'#d18a36')}
  g.restore();
}
function drawEnemy(c,x,y,scale=1,variant=0){
  const g=c.getContext('2d');g.save();g.translate(x,y);g.scale(scale,scale);g.imageSmoothingEnabled=false;
  const shirt=['#5879a0','#8c6248','#626d85','#9a824f'][variant%4];
  px(g,-8,-12,16,12,'#d5aa88');px(g,-7,-16,14,5,'#5e4838');px(g,-10,0,20,16,shirt);px(g,-9,14,7,9,'#4f4034');px(g,2,14,7,9,'#4f4034');px(g,10,1,3,17,'#d5aa88');px(g,13,-3,3,15,'#c9c7bd');px(g,-3,-7,2,2,'#2b2723');px(g,4,-7,2,2,'#2b2723');
  g.restore();
}
function drawSiteScene(c,site,dim=false){
  const g=c.getContext('2d'),w=c.width,h=c.height;g.imageSmoothingEnabled=false;
  if(site.id==='mountain_village'){
    px(g,0,0,w,h,'#496f69');
    for(let i=0;i<10;i++){const x=i*(w/9)-18;px(g,x,0,24,h*.72,i%2?'#385451':'#2f4946');px(g,x-22,h*.18,70,18,'#31564b');px(g,x-12,h*.08,52,17,'#3d6658')}
    px(g,0,h*.67,w,h*.33,'#557345');px(g,w*.34,h*.58,w*.32,h*.42,'#835f45');px(g,w*.43,h*.55,w*.14,h*.45,'#9a7655');
    px(g,w*.76,h*.42,w*.17,h*.28,'#6e5039');px(g,w*.74,h*.38,w*.21,h*.08,'#3c332b');px(g,w*.81,h*.53,w*.04,h*.17,'#d0a66e');
    for(let i=0;i<18;i++)px(g,(i*47)%w,h*.72+(i%4)*8,22,7,i%2?'#36583b':'#426643');
  }else if(site.id==='farm_road'){
    px(g,0,0,w,h,'#7fa2a0');px(g,0,h*.52,w,h*.48,'#7e8b4f');px(g,w*.3,h*.42,w*.38,h*.58,'#a47b50');px(g,w*.42,h*.42,w*.16,h*.58,'#c09a67');
    for(let i=0;i<12;i++){px(g,i*55,h*.58,32,5,'#d0b76f');px(g,i*55+8,h*.44,4,34,'#6e5939')}
    px(g,w*.72,h*.27,w*.2,h*.31,'#745139');px(g,w*.69,h*.23,w*.26,h*.08,'#493d31');
  }else{
    px(g,0,0,w,h,'#536172');px(g,0,h*.64,w,h*.36,'#343b42');px(g,w*.58,h*.15,w*.42,h*.62,'#4c5054');px(g,w*.64,h*.04,w*.07,h*.26,'#3d4145');px(g,w*.84,h*.02,w*.08,h*.28,'#3d4145');
    for(let y=0;y<5;y++)for(let x=0;x<8;x++)px(g,w*.58+x*34+(y%2)*10,h*.23+y*22,26,13,(x+y)%2?'#5f6469':'#565b60');
    px(g,w*.68,h*.48,w*.11,h*.29,'#1f2429');px(g,w*.83,h*.48,w*.1,h*.29,'#24292e');
    for(let i=0;i<10;i++)px(g,i*70,h*.74+(i%2)*8,42,6,'#68717a');
  }
  if(dim){g.fillStyle='rgba(0,0,0,.22)';g.fillRect(0,0,w,h)}
}
function paintPortrait(c,m){const g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);px(g,0,0,c.width,c.height,m.family==='slime'?'#243329':m.family==='goblin'?'#303423':'#292e27');drawMonster(c,m,c.width/2,c.height*.61,Math.max(1.3,c.width/48))}
function drawBattle(c,e){
  const m=S?.monsters.find(x=>x.id===e.monster_id),site=S?.sites.find(x=>x.id===e.site_id);if(!m||!site)return;
  drawSiteScene(c,site,true);const g=c.getContext('2d'),w=c.width,h=c.height,t=Date.now()/220;const swing=Math.sin(t);const attack=Math.max(0,swing)*18;const enemyVariant=Math.abs((e.battle_count||0))%4;
  drawMonster(c,w*.25+attack,h*.72+Math.sin(t*.65)*2,3.15,false);drawEnemy(c,w*.72-attack*.45,h*.69,3.0,enemyVariant);
  px(g,w*.13,h*.84,w*.24,8,'#2b2c2b');px(g,w*.13,h*.84,w*.19,8,'#65bd70');px(g,w*.61,h*.84,w*.24,8,'#2b2c2b');px(g,w*.61,h*.84,w*.14,8,'#dc6d68');
  if(swing>.72){g.save();g.globalAlpha=(swing-.72)*3.4;px(g,w*.61,h*.42,40,8,'#f1cf83');px(g,w*.65,h*.38,8,40,'#f1cf83');g.restore()}
  g.font='bold 18px sans-serif';g.fillStyle='#f0e7d2';g.fillText(m.name,18,26);g.textAlign='right';g.fillText(e.battle_state?.enemy||site.enemy_names?.[0]||'인간',w-18,26);g.textAlign='left';
  if(e.battle_state?.result==='win'){g.font='bold 24px sans-serif';g.fillStyle='#65d36c';g.fillText('박멸 성공',18,h-20)}
}

/* screen templates */
function home(){
  const p=S.player,cap=1+(Math.max(1,p.quarters_level)-1)*2,active=S.expeditions.filter(e=>e.active),unlocked=S.sites.filter(s=>s.unlocked).length;
  const costQ=Math.floor(220*Math.pow(1.8,p.quarters_level-1)),costT=Math.floor(260*Math.pow(1.85,p.tavern_level-1));
  return `<section class="company-card">
    <div><h2>${esc(S.account?.username||'무명')} 박멸 본부</h2><p>${active.length?`현재 ${active.length}개 박멸 작전 진행 중`:'대기 중인 몬스터를 인간 지역으로 파견하세요.'}</p></div>
    <div class="company-badge"><b>${fmt(p.fame)}</b><small>회사 악명</small></div>
  </section>
  <div class="facility-list">
    <article class="facility-row">
      <span class="facility-icon"></span><div class="facility-info"><b>숙소</b><span>${S.monsters.length}/${cap} 몬스터</span></div>
      <div class="facility-action"><button data-action="upgrade" data-id="quarters">확장</button><small>${fmt(costQ)} G</small></div>
    </article>
    <article class="facility-row">
      <span class="facility-icon recruit"></span><div class="facility-info"><b>영입소</b><span>${S.candidates.length}명 대기 ${S.candidates.length?'<em>신규!</em>':''}</span><span id="candidateTimer" style="font-size:12px;margin-top:3px"></span></div>
      <div class="facility-action"><button data-action="candidates">보기</button><button data-action="upgrade" data-id="tavern" style="margin-top:5px">강화</button><small>${fmt(costT)} G</small></div>
    </article>
    <article class="facility-row" data-go="loot">
      <span class="facility-icon storage"></span><div class="facility-info"><b>전리품 창고</b><span>${inventoryCount()}개 보관 · ${totalPending()}개 미수령</span></div>
      <div class="facility-action"><button data-go="loot">열기</button></div>
    </article>
    <article class="facility-row" data-go="hunt">
      <span class="facility-icon ops"></span><div class="facility-info"><b>박멸 작전실</b><span>${unlocked}/${S.sites.length} 지역 개방 · ${active.length}개 작전</span></div>
      <div class="facility-action"><button data-go="hunt">작전</button></div>
    </article>
  </div>`;
}
function monsterRow(m){
  const e=activeOf(m.id),need=m.level*100,pct=Math.min(100,Math.floor(m.xp/need*100));
  return `<article class="monster-row ${e?'':'idle'}" data-action="monster-detail" data-id="${m.id}">
    <canvas width="76" height="76" data-mid="${m.id}"></canvas><span class="monster-level">Lv.${m.level}</span>
    <div class="monster-main"><b>${esc(m.name)}</b><span>${fam(m.family)}, ${esc(m.trait||'평범')}</span><div class="monster-status">${e?`${esc(S.sites.find(s=>s.id===e.site_id)?.name||'작전')} 파견 중`:`대기 · XP ${pct}%`}</div></div>
    <div class="stat-slots"><div class="stat-slot"><b>전투력</b><strong>${fmt(power(m))}</strong></div><div class="stat-slot"><b>재능</b><strong>${m.talent}</strong></div><div class="stat-slot"><b>처치</b><strong>${fmt(m.kills)}</strong></div></div>
  </article>`;
}
function monsters(){return `<div class="roster-tools"><b>${S.monsters.length} 몬스터 보유</b><button data-action="candidates">영입 후보 ${S.candidates.length}</button></div><div class="monster-list">${S.monsters.map(monsterRow).join('')}</div>`}
function cyclePct(e){
  if(!e?.active)return 0;const site=S.sites.find(s=>s.id===e.site_id);const sec=Math.max(2,Number(site?.battle_seconds||8));const base=new Date(e.last_tick||e.updated_at||e.started_at||Date.now()).getTime();const elapsed=Math.max(0,(Date.now()-base)/1000);return Math.min(100,(elapsed%sec)/sec*100)
}
function siteCard(site){
  const ex=expeditionAt(site),lead=ex[0];
  const status=!site.unlocked?'아직 접근할 수 없습니다':ex.length?(lead?.battle_state?.result==='win'?'박멸 진행 중...':'교전 중...'):'파견 대기';
  return `<article class="site-card ${site.unlocked?'':'locked'}" data-action="site-open" data-id="${site.id}">
    <canvas class="site-art" width="600" height="208" data-site-art="${site.id}"></canvas><div class="site-shade"></div><i class="site-hint"></i>
    <div class="site-content"><div><div class="site-name">${esc(site.name)}</div><div class="party-line">${ex.map(e=>`<canvas width="45" height="45" data-mid="${e.monster_id}"></canvas>`).join('')||'<span style="color:#9fa19e;font-size:13px;padding-top:10px">파견된 몬스터 없음</span>'}</div><div class="site-status">${status}</div><div class="progress"><i data-cycle-eid="${lead?.id||''}" style="width:${lead?cyclePct(lead):0}%"></i></div></div>
    <div class="site-side"><div class="threat-box"><b>${fmt(site.recommended_power)}</b><small>권장 전투력</small></div><div class="loot-box"></div></div></div>
  </article>`;
}
function hunt(){
  const active=S.expeditions.filter(e=>e.active).length;
  return `<div class="hunt-summary"><span>개방 <strong>${S.sites.filter(s=>s.unlocked).length}</strong></span><span>·</span><span>작전 중 <strong>${active}</strong></span><span>·</span><span>미수령 <strong>${totalPending()}</strong></span></div><div class="site-list">${S.sites.map(siteCard).join('')}</div>`;
}
function loot(){
  const pending=S.expeditions.filter(e=>lootCount(e)>0);
  return `<div class="loot-toolbar"><h2>전리품 보관함</h2><button class="primary-btn" data-action="collect-all" ${totalPending()?'':'disabled'}>전체 수령</button></div>
    ${pending.map(e=>{const m=S.monsters.find(x=>x.id===e.monster_id),site=S.sites.find(x=>x.id===e.site_id);return `<section class="loot-group"><div class="loot-group-head"><div><b>${esc(site?.name||'작전')} · ${esc(m?.name||'몬스터')}</b><div style="font-size:11px;color:#b9bab7;margin-top:3px">미수령 ${lootCount(e)}개</div></div><button class="small-btn" data-action="collect-one" data-id="${e.id}">수령</button></div><div class="loot-items">${Object.entries(e.pending_loot||{}).map(([k,v])=>`<div class="loot-item"><span class="item-icon"></span><div><b>${esc(k)}</b><span>작전 획득품</span></div><strong class="qty">${fmt(v)}</strong></div>`).join('')}</div></section>`}).join('')||'<div class="empty-state">아직 수령할 전리품이 없습니다.</div>'}
    <section class="loot-group"><div class="loot-group-head"><b>회사 창고</b><span>${inventoryCount()}개</span></div><div class="loot-items">${S.inventory.map(x=>`<div class="loot-item"><span class="item-icon"></span><div><b>${esc(x.item_id)}</b><span>보관 중</span></div><strong class="qty">${fmt(x.qty)}</strong></div>`).join('')||'<div class="empty-state" style="border:0;border-radius:0">창고가 비어 있습니다.</div>'}</div></section>`;
}

function updateHeader(){
  if(!S)return;$('#screenTitle').textContent=titleMap[screen]||'본부';$('#gold').textContent=fmt(S.player.gold);$('#fame').textContent=fmt(S.player.fame);$('#monsterCount').textContent=S.monsters.length;$('#activeCount').textContent=S.expeditions.filter(e=>e.active).length;$('#pendingCount').textContent=totalPending();$('#candidateBadge').classList.toggle('hidden',!S.candidates.length);$('#lootBadge').classList.toggle('hidden',!totalPending());
}
function render(){
  if(!S)return;updateHeader();$('#view').innerHTML=screen==='home'?home():screen==='monsters'?monsters():screen==='hunt'?hunt():loot();$$('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.screen===screen));paintCanvases();updateCandidateTimer();updateCycleBars();
}
function paintCanvases(){
  requestAnimationFrame(()=>{
    $$('canvas[data-mid]').forEach(c=>{const m=S?.monsters.find(x=>x.id===c.dataset.mid);if(m)paintPortrait(c,m)});
    $$('canvas[data-site-art]').forEach(c=>{const site=S?.sites.find(x=>x.id===c.dataset.siteArt);if(site)drawSiteScene(c,site)});
    const w=$('#watchCanvas');if(w){const e=S?.expeditions.find(x=>x.id===w.dataset.eid);if(e)drawBattle(w,e)}
  });
}
function updateCandidateTimer(){
  const e=$('#candidateTimer');if(!e||!S?.player?.next_candidate_at)return;const d=Math.max(0,new Date(S.player.next_candidate_at).getTime()-Date.now());if(!d){e.textContent=S.candidates.length?'후보 도착':'곧 도착';return}const h=Math.floor(d/3600000),m=Math.floor((d%3600000)/60000),s=Math.floor((d%60000)/1000);e.textContent=`다음 후보 ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function updateCycleBars(){
  $$('[data-cycle-eid]').forEach(el=>{const e=S?.expeditions.find(x=>x.id===el.dataset.cycleEid);el.style.width=e?cyclePct(e)+'%':'0%'});
}

/* modals */
function modal(html){const m=$('#modal');m.innerHTML=`<div class="sheet">${html}</div>`;m.classList.remove('hidden');paintCanvases()}
function menu(){modal(`<div class="menu-sheet"><div class="sheet-head"><h2>회사 메뉴</h2><button data-action="close">닫기</button></div><div class="menu-account"><b>${esc(S.account?.username||'무명')} 대표</b><span>용사 박멸 주식회사 · 서버 저장 중</span><span>v0.7.0</span></div><button class="danger-btn" data-action="logout">로그아웃</button></div>`)}
function candidates(){
  modal(`<div class="sheet-head"><h2>영입 후보</h2><button data-action="close">닫기</button></div><div class="candidate-list">${S.candidates.map(c=>{const cost=90+Math.floor(c.talent*1.7);return `<div class="candidate-row"><div><b>${esc(c.name)} · ${fam(c.family)}</b><span>재능 ${c.talent} · ${esc(c.trait)} · 전투력 ${c.power_base}</span></div><div class="buttons"><button class="primary-btn" data-action="hire" data-id="${c.id}">${cost}G</button><button class="small-btn" data-action="reject" data-id="${c.id}">거절</button></div></div>`}).join('')||'<div class="empty-state">현재 찾아온 후보가 없습니다.</div>'}</div>`)
}
function monsterDetail(id){
  const m=S.monsters.find(x=>x.id===id);if(!m)return;const e=activeOf(id),site=e&&S.sites.find(x=>x.id===e.site_id),need=m.level*100;
  modal(`<div class="sheet-head"><h2>${esc(m.name)} · ${fam(m.family)}</h2><button data-action="close">닫기</button></div><div class="menu-account"><b>Lv.${m.level} · 전투력 ${fmt(power(m))}</b><span>재능 ${m.talent} · 특성 ${esc(m.trait)} · 누적 처치 ${fmt(m.kills)}</span><span>XP ${fmt(m.xp)} / ${fmt(need)}</span><span>${e?`${esc(site?.name||'작전')} 파견 중`:'본부 대기 중'}</span></div>${e?`<div class="sheet-actions"><button class="primary-btn" data-action="watch" data-id="${e.id}">전투 관전</button><button class="danger-btn" data-action="recall" data-id="${e.id}">복귀</button></div>`:''}`)
}
function siteOpen(siteId){
  const site=S.sites.find(x=>x.id===siteId);if(!site)return;if(!site.unlocked){toast('아직 접근할 수 없는 지역입니다.');return}const ex=expeditionAt(site);
  modal(`<div class="sheet-head"><div><h2>${esc(site.name)}</h2><div style="color:#c2c4c0;font-size:12px;margin-top:4px">권장 전투력 ${fmt(site.recommended_power)} · ${esc(site.description||'')}</div></div><button data-action="close">닫기</button></div>${ex.length?`<div class="candidate-list">${ex.map(e=>{const m=S.monsters.find(x=>x.id===e.monster_id);return `<div class="candidate-row"><div><b>${esc(m?.name||'몬스터')}</b><span>서버 전투 ${fmt(e.battle_count)}회 · 처치 ${fmt(e.kills)} · 전리품 ${lootCount(e)}개</span></div><div class="buttons"><button class="primary-btn" data-action="watch" data-id="${e.id}">관전</button><button class="small-btn" data-action="recall" data-id="${e.id}">복귀</button></div></div>`}).join('')}</div>`:'<div class="empty-state" style="margin-top:12px">현재 이 지역에 파견된 몬스터가 없습니다.</div>'}<div class="sheet-actions"><button class="primary-btn" data-action="deploy-open" data-id="${site.id}">${ex.length?'추가 파견':'몬스터 파견'}</button></div>`)
}
function deployOpen(siteId){
  const site=S.sites.find(x=>x.id===siteId);if(!site)return;
  modal(`<div class="sheet-head"><h2>${esc(site.name)} 파견</h2><button data-action="close">닫기</button></div><div class="candidate-list">${S.monsters.map(m=>{const e=activeOf(m.id);return `<div class="candidate-row"><div><b>${esc(m.name)} · Lv.${m.level}</b><span>전투력 ${fmt(power(m))}${e?' · 기존 작전에서 재배치됨':' · 대기 중'}</span></div><button class="primary-btn" data-action="deploy" data-site="${siteId}" data-id="${m.id}">${e?'재배치':'파견'}</button></div>`}).join('')}</div>`)
}
function watch(id){
  const e=S.expeditions.find(x=>x.id===id);if(!e)return;const m=S.monsters.find(x=>x.id===e.monster_id),site=S.sites.find(x=>x.id===e.site_id);
  modal(`<div class="sheet-head"><div><h2>${esc(site?.name||'작전')}</h2><div style="font-size:12px;color:#c8c9c6;margin-top:3px">${esc(m?.name||'몬스터')} 실시간 서버 전투</div></div><button data-action="close">닫기</button></div><div class="battle-stage"><canvas id="watchCanvas" data-eid="${e.id}" width="640" height="400"></canvas></div><div class="battle-log">${(e.battle_log||[]).slice(0,8).map(x=>`<div class="${x.result==='win'?'win':'hit'}">${new Date(x.t).toLocaleTimeString('ko-KR')} · ${esc(x.enemy)} · ${x.result==='win'?'박멸 성공':'교전 실패'}</div>`).join('')||'서버 전투 기록을 기다리는 중...'}</div><div class="sheet-actions"><button class="danger-btn" data-action="recall" data-id="${e.id}">후퇴하기</button><button class="small-btn" data-action="close">닫기</button></div>`);paintCanvases()
}

async function refresh(){
  if(busy||!session||!S)return;try{const modalOpen=!$('#modal').classList.contains('hidden');const y=window.scrollY;await api('state');if(modalOpen){updateHeader();paintCanvases();updateCycleBars()}else{render();requestAnimationFrame(()=>window.scrollTo(0,y))}}catch(e){if(e.message==='unauthorized'){await sb.auth.signOut();showAuth()}}
}
function errorKo(code){return {username_format:'아이디는 한글 2~12글자로 입력해 주세요.',password_format:'비밀번호는 숫자 4자리로 입력해 주세요.',username_taken:'이미 사용 중인 아이디입니다.',invalid_credentials:'아이디 또는 비밀번호가 맞지 않습니다.',unauthorized:'로그인이 만료되었습니다.',quarters_full:'숙소가 가득 찼습니다.',gold_short:'자금이 부족합니다.',locked:'아직 갈 수 없는 지역입니다.',candidate_missing:'영입 후보가 사라졌습니다.',invalid_target:'대상을 찾을 수 없습니다.',server_error:'서버 처리 중 오류가 발생했습니다.'}[code]||code}

/* auth events */
$$('[data-auth-tab]').forEach(b=>b.addEventListener('click',()=>{$$('[data-auth-tab]').forEach(x=>x.classList.toggle('active',x===b));const signup=b.dataset.authTab==='signup';$('#loginForm').classList.toggle('hidden',signup);$('#signupForm').classList.toggle('hidden',!signup);authMsg('')}));
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;const u=$('#loginId').value.trim().normalize('NFC'),p=$('#loginPw').value;if(!validKoreanId(u)){authMsg('아이디는 한글 2~12글자로 입력해 주세요.');return}if(!validPin(p)){authMsg('비밀번호는 숫자 4자리입니다.');return}busy=true;authMsg('로그인 중...');try{const d=await loginAccount(u,p);await applySession(d.session);authMsg('');await enterGame()}catch(err){authMsg(errorKo(err.message))}finally{busy=false}});
$('#signupForm').addEventListener('submit',async e=>{e.preventDefault();if(busy)return;const u=$('#signupId').value.trim().normalize('NFC'),p=$('#signupPw').value,p2=$('#signupPw2').value;if(!validKoreanId(u)){authMsg('아이디는 한글 2~12글자로 입력해 주세요.');return}if(!validPin(p)){authMsg('비밀번호는 숫자 4자리입니다.');return}if(p!==p2){authMsg('비밀번호 확인이 일치하지 않습니다.');return}busy=true;authMsg('회사를 설립 중...');try{const d=await registerAccount(u,p);await applySession(d.session);authMsg('회사 설립 완료.',true);await enterGame()}catch(err){authMsg(errorKo(err.message))}finally{busy=false}});

/* game events */
document.addEventListener('click',async e=>{
  const nav=e.target.closest('[data-screen]');if(nav){screen=nav.dataset.screen;closeModal();render();window.scrollTo(0,0);return}
  const go=e.target.closest('[data-go]');if(go){screen=go.dataset.go;closeModal();render();window.scrollTo(0,0);return}
  const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;
  if(a==='menu'){menu();return}if(a==='close'){closeModal();return}if(a==='candidates'){candidates();return}if(a==='monster-detail'){monsterDetail(b.dataset.id);return}if(a==='site-open'){siteOpen(b.dataset.id);return}if(a==='deploy-open'){deployOpen(b.dataset.id);return}if(a==='watch'){watch(b.dataset.id);return}
  if(a==='logout'){if(busy)return;busy=true;try{await sb.auth.signOut();showAuth()}finally{busy=false}return}
  try{
    busy=true;
    if(a==='deploy'){await api('deploy',{monsterId:b.dataset.id,siteId:b.dataset.site});closeModal();toast('박멸 작전을 시작했습니다.');screen='hunt';render()}
    else if(a==='recall'){await api('recall',{expeditionId:b.dataset.id});closeModal();toast('몬스터가 본부로 복귀했습니다.');render()}
    else if(a==='collect-all'){await api('collect');toast('전리품을 모두 수령했습니다.');render()}
    else if(a==='collect-one'){await api('collect',{expeditionId:b.dataset.id});toast('전리품을 수령했습니다.');render()}
    else if(a==='hire'){await api('hire',{candidateId:b.dataset.id});closeModal();toast('새 몬스터를 영입했습니다.');screen='monsters';render()}
    else if(a==='reject'){await api('reject',{candidateId:b.dataset.id});candidates();toast('후보를 돌려보냈습니다.')}
    else if(a==='upgrade'){await api('upgrade',{facility:b.dataset.id});toast('시설을 강화했습니다.');render()}
  }catch(err){toast(errorKo(err.message)||'처리에 실패했습니다.')}finally{busy=false}
});

sb.auth.onAuthStateChange((_event,newSession)=>{session=newSession});
setInterval(updateCandidateTimer,1000);setInterval(updateCycleBars,250);setInterval(refresh,5000);setInterval(()=>{const w=$('#watchCanvas');if(w&&S){const e=S.expeditions.find(x=>x.id===w.dataset.eid);if(e)drawBattle(w,e)}},180);
(async()=>{try{const s=await currentSession();if(s)await enterGame();else showAuth()}catch(e){showAuth();authMsg('초기 연결에 실패했습니다.')}})();
