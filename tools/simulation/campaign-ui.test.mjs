import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {root,baseline} from './database.mjs';
import {roster} from '../../content/roster-v015.mjs';
const catalog=JSON.parse(readFileSync(root+'content/campaign-v015.json','utf8'));
const base=process.env.QA_BASE_URL||'http://127.0.0.1:8125';
const output=root+'tools/simulation/results/ui';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.QA_BROWSER_CHANNEL=== 'chromium'?{}:{channel:process.env.QA_BROWSER_CHANNEL||'chrome'})});
const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const time='2026-09-10T13:00:00Z';
const monsters=roster.slice(0,6).map((r,i)=>({id:`00000000-0000-4000-8000-00000000000${i}`,name:r.name,family:r.family,form_id:r.family,evolution_tier:0,skill_id:r.skill,level:8,xp:0,talent:86,growth_grade:'B',trait:'학습 본능',personality:'침착',hp_base:r.hp,atk_base:r.atk,def_base:r.def,spd_base:r.spd,crit_base:r.crit,evade_base:r.evade,power_base:r.power,kills:0}));
const progress=catalog.sites.map((s,i)=>({site_id:s.id,normal_battles:i===0?500:0,normal_wins:i===0?498:0,boss_ready:i===0,boss_cleared:i===0,boss_victories:i===0?2:0,boss_attempts:i===0?3:0,boss_cleared_at:i===0?time:null,first_boss_cleared_at:i===0?'2026-09-09T10:00:00Z':null,boss_history:i===0?[{at:time,result:'win',rounds:8}]:[]}));
let state={account:{username:'합성검증'},player:{device_id:'10000000-0000-4000-8000-000000000001',gold:1600,fame:35,quarters_level:3,tavern_level:1,storage_level:2,workshop_level:1,shop_level:1,next_candidate_at:'2099-01-01T00:00:00Z'},monsters,candidates:[],expeditions:[],expeditionMembers:[],sites:catalog.sites.map((s,i)=>({...s,unlocked:i<=1,progress:progress[i]})),stageProgress:progress,inventory:[],equipment:[],itemDefs:catalog.items,recipes:catalog.recipes,craftJobs:[],sellJobs:[],evolutionDefs:baseline.evolutions,skillDefs:baseline.skills,storageCapacity:80,quartersCapacity:7,craftCapacity:5,shopCapacity:5,facilityCosts:{quarters:8100,tavern:1800,storage:3600,workshop:1600,shop:1500}};
const calls=[];
await page.route('https://cdn.jsdelivr.net/npm/@supabase/**',route=>route.fulfill({contentType:'application/javascript',body:`window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:window.__qaSession||null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({})},rpc:async()=>({data:[],error:null})})};`}));
await page.route('https://xtvhisddjtfnsumprgpm.supabase.co/**',async route=>{
 const body=route.request().postDataJSON()||{};calls.push(body.action);
 if(body.action==='deploy'){
   const id='20000000-0000-4000-8000-000000000001';
   state.expeditions=[{id,player_id:state.player.device_id,site_id:body.siteId,monster_id:body.monsterIds[0],active:true,phase:'탐색',started_at:time,updated_at:time,battle_state:{},battle_log:[],event_state:{text:'탐험 중'},pending_loot:{},pending_xp:{},kills:0}];
   state.expeditionMembers=body.monsterIds.map((m,i)=>({expedition_id:id,monster_id:m,position:i+1,player_id:state.player.device_id}));
 }
 await route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,state})});
});
async function install(){await page.evaluate(x=>{S=x;window.__qaSession={access_token:'synthetic-only'};session=window.__qaSession;document.querySelector('#authGate').classList.add('hidden');document.querySelector('#app').classList.remove('hidden');render()},state);}
async function layout(label){
 const errors=await page.evaluate(()=>{
  const out=[];if(document.documentElement.scrollWidth>innerWidth+2)out.push('document overflow');
  const sheet=document.querySelector('#modal:not(.hidden) .sheet');if(sheet&&sheet.scrollWidth>sheet.clientWidth+2)out.push('sheet overflow');
  for(const el of document.querySelectorAll('.campaign-card-actions button,.campaign-tabs button,.campaign-party-row'))if(el.getBoundingClientRect().height>0&&el.getBoundingClientRect().height<40)out.push('small tap target');
  return out;
 });assert.deepEqual(errors,[],label);
}
try{
 await page.goto(base,{waitUntil:'networkidle'});await install();
 assert.equal(await page.locator('[data-campaign-guide]').count(),1);
 assert(await page.evaluate(()=>{
  const saved=S.inventory;S.inventory=[{item_id:S.recipes[0].output_item,qty:1}];
  const visible=Campaign.guide().includes('완성품을 매출로 바꾸세요');S.inventory=saved;return visible;
 }),'finished products lead to selling');
 assert.equal(await page.locator('.status-rail').count(),0);
 await page.locator('[data-screen="hunt"]').click();
 assert.equal(await page.locator('.campaign-card').count(),5);
 assert.deepEqual(await page.locator('.campaign-cover-copy>b').allTextContents(),['산골 마을','변두리 소국','작은 왕국','거대한 성','용사 왕국']);
 assert.equal(await page.evaluate(()=>new Set(S.sites.flatMap(s=>[...s.enemy_names,s.boss_name].map(n=>CampaignArt.enemyCell(n).join(',')))).size),25);
 await page.evaluate(()=>Promise.all(['enemies','items'].map(name=>new Promise((resolve,reject)=>{const i=new Image();i.onload=resolve;i.onerror=reject;i.src=`assets/art-v015/${name}.webp`}))));
 assert((await page.locator('.campaign-rule').textContent()).includes('1.5%'));
 for(const width of [360,390,768,1280]){await page.setViewportSize({width,height:900});await layout('hunt '+width);await page.screenshot({path:`${output}/hunt-${width}.png`,fullPage:true});}
 const failedImages=await page.locator('.campaign-cover img').evaluateAll(images=>images.filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src));assert.deepEqual(failedImages,[]);
 await page.setViewportSize({width:390,height:844});
 await page.locator('.campaign-card').first().locator('[data-campaign-action="intel"]').click();
 assert.equal(await page.locator('.campaign-enemy').count(),4);
 await page.locator('.campaign-enemy summary').first().click();
 assert.equal(await page.locator('.campaign-enemy').first().locator('.campaign-drop').count(),5);
 await page.locator('[data-tab="boss"]').click();
 assert((await page.locator('.campaign-record').textContent()).includes('2 / 3'));
 assert((await page.locator('.campaign-boss-plan').textContent()).includes('야간 순찰 총력전'));
 assert.equal(await page.locator('.campaign-drop.legendary').count(),2);
 assert((await page.locator('.campaign-intel-sheet').textContent()).includes('각각 0.75%'));
 assert.equal(await page.getByRole('button',{name:/보스 도전/}).count(),0);
 await layout('boss intel');await page.screenshot({path:`${output}/boss-390.png`,fullPage:true});
 await page.evaluate(()=>{const p=S.sites[0].progress;p.boss_victories=3;p.boss_attempts=4;Campaign.refresh()});
 assert((await page.locator('.campaign-record').textContent()).includes('3 / 4'),'open boss records refresh');
 await page.locator('[data-tab="rewards"]').click();
 assert.equal(await page.locator('.campaign-drops .campaign-drop').count(),3);
 assert((await page.locator('.campaign-intel-body').textContent()).includes('선택 비율'));
 await page.locator('[data-campaign-action="mission"]').last().click();
 assert.equal(await page.locator('.campaign-party-sheet').count(),1);
 assert(await page.locator('[data-campaign-action="launch"]').isDisabled());
 for(const family of ['slime','mandrake','imp']){const m=monsters.find(m=>m.family===family);await page.locator(`[data-campaign-action="pick"][data-id="${m.id}"]`).click();}
 const selectionStable=await page.evaluate(()=>{
  const button=document.querySelector('[data-campaign-action="pick"]'),sheet=button.closest('.sheet');
  button.focus();const scroll=sheet.scrollTop;button.click();button.click();
  return document.activeElement===button&&sheet.scrollTop===scroll;
 });assert(selectionStable,'party selection preserves focused row and scroll');
 assert((await page.locator('.campaign-launch>span').textContent()).includes('3/4'));
 assert((await page.locator('.campaign-assessment').textContent()).includes('현재 HP'));
 await page.locator('.campaign-party-sheet [data-campaign-action="intel"]').click();
 await page.locator('.campaign-intel-sheet [data-campaign-action="mission"]').click();
 assert((await page.locator('.campaign-launch>span').textContent()).includes('3/4'),'intel round trip preserves selected party');
 await layout('party');await page.screenshot({path:`${output}/party-390.png`,fullPage:true});
 await page.locator('[data-campaign-action="launch"]').click();await page.waitForSelector('.battle-report-sheet');
 assert.equal(calls.filter(c=>c==='deploy').length,1);
 await page.evaluate(()=>{closeModal(true);Campaign.openMission('mountain_village')});
 assert.equal(await page.locator('.exp-active-party-sheet').count(),1);
 assert.equal(await page.locator('[data-campaign-active-intel]').count(),1);
 assert.equal(await page.locator('.exp-active-party-sheet [data-action="recall"]').count(),1);
 assert(await page.evaluate(()=>{
  const e=S.expeditions.find(e=>e.active),m=S.monsters.find(m=>m.id===e.monster_id),level=m.level;
  m.level=S.evolutionDefs.find(x=>x.from_form_id===m.form_id).required_level;
  const guided=Campaign.guide().includes('전직 준비 완료');m.level=level;return guided;
 }),'deployed employees are guided out of evolution caps');
 await page.evaluate(()=>{const e=S.expeditions.find(e=>e.active);e.battle_state.partyHp={[e.monster_id]:0};Campaign.refresh()});
 assert((await page.locator('[data-campaign-active-intel]').textContent()).includes('전투불능 직원'));
 await page.locator('[data-exp-action="drops"]').click();assert.equal(await page.locator('.campaign-intel-sheet').count(),1);
 await page.evaluate(()=>{closeModal(true);Campaign.openMission('hero_kingdom')});
 assert.equal(await page.locator('.campaign-intel-sheet').count(),1);assert.equal(await page.locator('[data-campaign-action="launch"]').count(),0);
 await page.evaluate(()=>{closeModal(true);screen='hunt';render()});
 // A background refresh must neither reset focus nor reconstruct unchanged cards.
 const stable=await page.evaluate(()=>{const el=document.querySelector('.campaign-card button');el.focus();Campaign.refresh();return document.activeElement===el});assert(stable,'stable UI during unchanged polling');
 await page.evaluate(()=>{
  const e=S.expeditions[0];e.battle_state={active:true,enemy:'산골 청년',enemyHp:55,enemyMaxHp:55,partyHp:{[e.monster_id]:100},partyMaxHp:{[e.monster_id]:150}};
  e.phase='조우';e.event_state={type:'encounter',text:'산골 청년 조우',t:new Date().toISOString()};e.battle_log=[{type:'encounter',enemy:'산골 청년',t:new Date().toISOString()}];
  watchModal(e.id);
 });
 assert.equal(await page.locator('#liveEnemySprite .campaign-foe').count(),1);
 const normalSprite=await page.locator('#liveEnemySprite .campaign-foe').getAttribute('style');
 await page.evaluate(()=>{const e=S.expeditions[0];e.battle_state.enemy='자경단장 베르크';e.battle_state.boss=true;e.event_state.text='자경단장 베르크 조우';e.battle_log[0].enemy='자경단장 베르크';e.battle_log[0].boss=true;syncWatchPanel()});
 assert(!(await page.locator('#liveEnemyActor').getAttribute('class')).includes('hidden-contact'));
 const bossSprite=await page.locator('#liveEnemySprite .campaign-foe').getAttribute('style');
 assert.notEqual(normalSprite,bossSprite,'live encounter changes to its own atlas sprite');
 await page.evaluate(()=>{S.expeditions[0].pending_loot={'베르크의 퇴근 종':1};syncWatchPanel()});
 assert.equal(await page.locator('#liveRareFind .legendary').count(),1,'rare drop is visible outside collapsed battle log');
 await page.evaluate(()=>{S.expeditions[0].pending_loot={};syncWatchPanel()});
 assert.equal(await page.locator('#liveRareFind .legendary').count(),0,'collected gear clears from live pending banner');
 await page.waitForFunction(()=>!document.querySelector('#toast').classList.contains('show'));
 await page.screenshot({path:`${output}/battle-art-390.png`,fullPage:true});
 await page.evaluate(async()=>{
  S.expeditions=[];S.expeditionMembers=[];
  const m=S.monsters[0];
  S.equipment=[{monster_id:m.id,item_id:'나무 몽둥이',slot:'weapon',enhance_level:10}];
  sb.rpc=async name=>({error:null,data:name==='game_equipment_inventory'?[{item_id:'청년회 돌팔매',qty:1,enhance_level:0},{item_id:'베르크의 퇴근 종',qty:1,enhance_level:3}]:[]});
  await gearPickerModal(m.id,'weapon');
 });
 assert.equal(await page.locator('.gear-choice .campaign-compare').count(),2);
 assert((await page.locator('.gear-choice[data-item="청년회 돌팔매"] .campaign-compare').textContent()).includes('공격 -11'));
 assert((await page.locator('.gear-choice[data-item="베르크의 퇴근 종"] .campaign-compare').textContent()).includes('공격 +4'));
 assert.equal(await page.locator('.gear-choice.legendary').count(),1);
 await layout('equipment comparison');await page.screenshot({path:`${output}/equipment-390.png`,fullPage:true});
 await page.evaluate(()=>collectionResultModal('mountain_village',{durationSeconds:1800,xp:{},loot:{'나무 조각':14,'베르크의 퇴근 종':1}}));
 assert.equal(await page.locator('.campaign-receipt-row.legendary').count(),1);
 assert((await page.locator('.campaign-receipt').textContent()).includes('창고 보관 완료'));
 await layout('loot receipt');await page.screenshot({path:`${output}/loot-390.png`,fullPage:true});
 const log=await page.evaluate(()=>battleLogHtml({battle_log:[{type:'battle-end',result:'win',enemy:'자경단장 베르크',drops:{'베르크의 퇴근 종':1},loot:1}]},S.monsters[0],S.sites[0]));
 assert(log.includes('베르크의 퇴근 종')&&log.includes('전설 장비 발견'));
 const recipe=state.recipes.find(r=>r.workshop_level===2),lockedRecipe=recipe.id;
 state.player.workshop_level=1;state.inventory=Object.entries(recipe.inputs).map(([item_id,qty])=>({item_id,qty:qty*2}));
 await install();await page.evaluate(()=>{closeModal(true);screen='home';render()});
 await page.locator('.facility-row.workshop').click();
 assert(await page.locator(`[data-econ-action="craft-setup"][data-id="${lockedRecipe}"]`).isDisabled());
 assert((await page.locator('.campaign-recipe-lock').first().textContent()).includes('제작소 Lv.2'));
 state.player.workshop_level=2;await install();await page.evaluate(()=>closeModal(true));await page.locator('.facility-row.workshop').click();
 await page.locator(`[data-econ-action="craft-setup"][data-id="${lockedRecipe}"]`).click();
 assert.equal(await page.locator('#econQtySlider').getAttribute('max'),'2');
 const expansion=await page.evaluate(()=>{
  closeModal(true);S.storageCapacity=40;S.player.storage_level=1;S.player.gold=5000;
  S.inventory=S.itemDefs.slice(0,32).map(d=>({item_id:d.id,qty:1}));
  S.expeditions=[{id:'capacity-fixture',active:false,site_id:S.sites[0].id,pending_loot:Object.fromEntries(S.itemDefs.slice(32,45).map(d=>[d.id,1]))}];
  const guide=Campaign.guide();warehouseModal();return guide;
 });
 assert(expansion.includes('새 전리품을 위한 창고 확장'));
 assert.equal(await page.locator('.warehouse-popup-sheet [data-action="upgrade"][data-id="storage"]').count(),1);
 await layout('warehouse expansion');await page.screenshot({path:`${output}/warehouse-390.png`,fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS campaign UI: chapter order, guide, 4 viewports, loot sources, boss history, party assessment, deploy, active-party handoff, locked chapters, stable polling');
}finally{await browser.close();}
