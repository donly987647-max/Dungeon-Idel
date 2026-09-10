import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {uiFixture,catalog} from './idle-ui-fixture.mjs';
import {root} from './database.mjs';
const output=root+'tools/simulation/results/idle-ui';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.QA_BROWSER_CHANNEL==='chromium'?{}:{channel:process.env.QA_BROWSER_CHANNEL||'chrome'})});
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));
let state=uiFixture();
await page.route('https://cdn.jsdelivr.net/npm/@supabase/**',route=>route.fulfill({contentType:'application/javascript',body:`window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:window.__qaSession||null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({})},rpc:async()=>({data:[],error:null})})};`}));
await page.route('https://xtvhisddjtfnsumprgpm.supabase.co/**',async route=>{
 const body=route.request().postDataJSON()||{};calls.push(body);
 if(body.action==='plan-evolution'){const m=state.monsters.find(m=>m.id===body.monsterId),e=state.evolutionDefs.find(e=>e.id===body.evolutionId);m.evolution_plan[e.from_form_id]=e.id;}
 if(body.action==='idle-policy')Object.assign(state.player,body.settings);
 if(body.action==='defense-command'){if(body.command==='stage'){state.defense.stage=body.stage;state.defense.boss_auto=false;}else state.defense.boss_auto=body.command==='boss-auto';}
 if(body.action==='defense-upgrade'){const bases={traps:120,gas:180,slow:240,arcane:300};state.player.gold-=Math.ceil(bases[body.kind]*1.28**state.defense[body.kind]);state.defense[body.kind]++;}
 if(body.action==='craft'){const r=state.recipes.find(r=>r.id===body.recipeId);state.craftJobs.push({id:'new-job',output_item:r.output_item,output_qty:body.quantity,status:'queued',started_at:new Date().toISOString(),finish_at:new Date(Date.now()+r.craft_seconds*body.quantity*1000).toISOString()});}
 await route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,state})});
});
const install=()=>page.evaluate(x=>{S=x;window.__qaSession={access_token:'synthetic-only'};session=window.__qaSession;document.querySelector('#authGate').classList.add('hidden');document.querySelector('#app').classList.remove('hidden');render()},state);
const close=()=>page.evaluate(()=>closeModal(true));
async function layout(label){assert.deepEqual(await page.evaluate(()=>{const out=[];if(document.documentElement.scrollWidth>innerWidth+2)out.push('page overflow');const sheet=document.querySelector('#modal:not(.hidden) .sheet');if(sheet&&sheet.scrollWidth>sheet.clientWidth+2)out.push('sheet overflow');return out}),[],label);}
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS',name);}
try{
 await page.goto(process.env.QA_BASE_URL||'http://127.0.0.1:8125',{waitUntil:'networkidle'});await install();
 if(process.env.QA_POLL_INTERVAL_MS)await page.evaluate(ms=>setInterval(()=>window.__frontendPollNow?.(),ms),Number(process.env.QA_POLL_INTERVAL_MS));
 await test('headquarters NEW appears beside facility titles and in a visible notice rail',async()=>{
  assert.equal(await page.locator('.office-notices').count(),1);assert.equal(await page.locator('[data-campaign-guide]').count(),1);
  assert((await page.locator('.facility-row.recruit .office-new-badge').textContent()).includes('NEW'));
  await page.evaluate(()=>{for(let i=0;i<5;i++){Campaign.refresh();OfficeUI.refresh();}});assert.equal(await page.locator('.office-notices').count(),1);assert.equal(await page.locator('.office-idle-summary').count(),1);
  for(const width of [360,390,768,1280]){await page.setViewportSize({width,height:900});await layout('HQ '+width);assert(await page.evaluate(()=>new Set([...document.querySelectorAll('.bottom-nav button')].map(e=>Math.round(e.getBoundingClientRect().top))).size===1),'navigation remains one row');await page.screenshot({path:`${output}/hq-${width}.png`,fullPage:true});}
 });
 await test('workshop opens on queues, catalog filters intersect, and equipment crafts use selected quantity',async()=>{
  await page.locator('.facility-row.workshop').click();assert.equal(await page.locator('.idle-job').count(),1);assert(await page.locator('.idle-catalog').isHidden());assert.equal(await page.locator('.idle-item').count(),0);
  await page.locator('[data-idle-econ="catalog"]').click();assert.equal(await page.locator('.idle-item').count(),24);
  await page.getByLabel('종류 필터',{exact:true}).selectOption('equipment');await page.getByLabel('챕터 필터',{exact:true}).selectOption('mountain_village');await page.getByLabel('등급 필터',{exact:true}).selectOption('희귀');await page.getByLabel('부위 필터',{exact:true}).selectOption('weapon');assert.equal(await page.locator('.idle-item').count(),2);
  await page.getByLabel('아이템 검색',{exact:true}).fill('침투');assert.equal(await page.locator('.idle-item').count(),1);
  const stable=await page.evaluate(()=>{const input=document.querySelector('[data-idle-filter="text"]');input.focus();OfficeUI.refresh();return document.activeElement===input&&input.value==='침투';});assert(stable);
  for(const width of [360,390,768,1280]){await page.setViewportSize({width,height:900});await layout('craft '+width);await page.screenshot({path:`${output}/craft-${width}.png`,fullPage:true});}
  await page.locator('.idle-item [data-idle-econ="setup"]').click();await page.locator('#idleQuantity').fill('2');await page.locator('[data-idle-econ="confirm"]').click();await page.waitForSelector('[data-idle-job="new-job"]');assert.equal(calls.find(c=>c.action==='craft').quantity,2);assert(await page.locator('.idle-catalog').isHidden());await close();
 });
 await test('shop opens with current sales only and excludes equipment and catalysts from selling',async()=>{
  await page.locator('.facility-row.shop').click();assert.equal(await page.locator('.idle-item').count(),0);assert(await page.locator('.idle-catalog').isHidden());await page.locator('[data-idle-econ="catalog"]').click();
  await page.getByLabel('종류 필터',{exact:true}).selectOption('equipment');assert.equal(await page.locator('.idle-item').count(),0);
  await page.getByLabel('종류 필터',{exact:true}).selectOption('material');assert((await page.locator('.idle-item').count())>0);
  const catalyst=catalog.items.find(x=>x.acquisition?.catalyst);await page.getByLabel('아이템 검색',{exact:true}).fill(catalyst.id);assert.equal(await page.locator('.idle-item').count(),0);await close();
 });
 await test('service ranks, both reserved evolution routes and automatic policy are interactive',async()=>{
  await page.evaluate(()=>employeeModal(S.monsters[0].id));assert((await page.locator('.office-service').textContent()).includes('500 / 800'));assert.equal(await page.locator('.office-route').count(),2);
  const chosen=await page.locator('.office-route').last().getAttribute('data-evolution');await page.locator('.office-route').last().click();await page.waitForFunction(id=>document.querySelector(`.office-route[data-evolution="${id}"]`)?.getAttribute('aria-pressed')==='true',chosen);
  state.monsters[0].growth_grade='A';state.monsters[0].service_points=810;await page.evaluate(()=>window.__frontendPollNow());await page.waitForFunction(()=>document.querySelector('.office-service')?.textContent.includes('810 / 2,000'));assert((await page.locator('.office-service').textContent()).includes('810 / 2,000'),'open promotion progress refreshes');
  await close();await page.locator('[data-idle-action="policy"]').click();await page.locator('[data-idle-policy="auto_advance"]').uncheck();await page.waitForFunction(()=>S.player.auto_advance===false);await close();
 });
 await test('defense tab, live movement, boss failure, stage switch and upgrade affordance stay current',async()=>{
  await page.locator('[data-screen="defense"]').click();assert.equal(await page.locator('.defense-hero').count(),3);assert.equal(await page.locator('.defense-team button').count(),9);
  // Keep the server fixture timestamp stable while its background polls continue.
  // Only the client animation clock advances, so a poll cannot reset our test timestamp.
  const moves=await page.evaluate(async()=>{
   const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))),realNow=Date.now,at=Date.parse(S.defense.wave.at);
   const left=()=>parseFloat(document.querySelector('.defense-hero').style.left);
   try{Date.now=()=>at;await frame();const before=left();Date.now=()=>at+1000;await window.__frontendPollNow?.();await frame();return left()>before+.5;}finally{Date.now=realNow;}
  });assert(moves,'hero position interpolates between server actions');
  await page.locator('[data-defense-action="boss"]').click();await page.waitForFunction(()=>S.defense.boss_auto);assert.equal(await page.locator('.defense-hero').count(),3,'same-wave rerender retains heroes');
  state.defense.boss_auto=false;state.defense.last_event={text:'보스 돌파 · 연속 도전 중단, 직전 단계 반복'};
  await install();await page.evaluate(()=>{screen='defense';render()});assert.equal(await page.locator('[data-defense-action="boss"]').textContent(),'보스 연속 도전');
  await page.getByLabel('던전방어 단계',{exact:true}).selectOption('1');await page.waitForFunction(()=>S.defense.stage===1);
  await page.locator('[data-defense-action="upgrade"][data-kind="traps"]').click();await page.waitForFunction(()=>S.defense.traps===2);assert((await page.locator('.defense-upgrades article').first().textContent()).includes('Lv.2'));
  state.player.gold=0;await page.evaluate(()=>window.__frontendPollNow());await page.waitForFunction(()=>document.querySelector('[data-defense-action="upgrade"][data-kind="traps"]')?.disabled);assert(await page.locator('[data-defense-action="upgrade"][data-kind="traps"]').isDisabled());
  for(const width of [360,390,768,1280]){await page.setViewportSize({width,height:900});await page.evaluate(()=>{document.activeElement?.blur();document.querySelector('#view').scrollTo({top:0,left:0,behavior:'instant'});});await page.waitForFunction(()=>document.querySelector('#view').scrollTop<1);await layout('defense '+width);await page.screenshot({path:`${output}/defense-${width}.png`,fullPage:true});}
  assert((await page.locator('.defense-rewards').textContent()).includes('경험치는 지급하지 않습니다'));
 });
 await test('all sprite stages load and server events cause attack, hit and healing animations',async()=>{
  await page.evaluate(()=>Promise.all(['base','tier1','tier2'].map(name=>new Promise((resolve,reject)=>{const i=new Image();i.onload=resolve;i.onerror=()=>reject(Error(name+' missing'));i.src=`assets/art-v016/monsters-${name}.png`}))));
  const ids=state.monsters.slice(0,4).map(m=>m.id),expedition={id:'test-battle',site_id:state.sites[0].id,monster_id:ids[0],active:true,idle_actions:1,phase:'전투',battle_state:{active:true,enemy:state.sites[0].enemy_names[0],enemyHp:80,enemyMaxHp:160,partyHp:Object.fromEntries(ids.map(id=>[id,100])),partyMaxHp:Object.fromEntries(ids.map(id=>[id,200]))},battle_log:[{type:'battle-turn',side:'party',damage:12,skills:[{monsterId:ids[3],effect:'heal'}]}],event_state:{type:'battle-turn',text:'전투 중'},pending_loot:{}};
  state.expeditions=[expedition];state.expeditionMembers=ids.map((id,i)=>({expedition_id:expedition.id,monster_id:id,position:i+1}));
  await page.evaluate(()=>window.__frontendPollNow());await page.waitForFunction(()=>S.expeditions[0]?.id==='test-battle');
  await page.evaluate(()=>{closeModal(true);watchModal('test-battle')});
  assert((await page.evaluate(()=>['.office-strike','.office-heal','.office-hit'].every(selector=>document.querySelector(selector)))),'server party event animates attack, healing and enemy hit');
  expedition.idle_actions++;expedition.battle_log=[{type:'battle-turn',side:'enemy',targetId:expedition.monster_id,damage:12}];
  await page.evaluate(()=>window.__frontendPollNow());await page.waitForFunction(()=>S.expeditions[0]?.idle_actions===2);assert((await page.locator('#livePartyCluster .office-hit').count())>0);
  await page.setViewportSize({width:390,height:844});await layout('battle');await page.screenshot({path:`${output}/battle-390.png`,fullPage:true});
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.office-monster>i').first().evaluate(e=>getComputedStyle(e).animationName),'none');
 });
 assert.deepEqual(errors,[]);writeFileSync(output+'/checks.json',JSON.stringify({passed,errors,calls:calls.map(c=>c.action)},null,2));console.log('IDLE_UI_CHECKS',passed);
}catch(e){console.error(e.message,e.stack);await page.screenshot({path:output+'/failure.png',fullPage:true});process.exitCode=1;}finally{await browser.close()}
