import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const base=process.env.QA_BASE_URL||'http://127.0.0.1:8123';
const output='artifacts/runtime-v0142';await fs.mkdir(output,{recursive:true});
const clone=x=>JSON.parse(JSON.stringify(x));
const stamp=new Date().toISOString();
const mons=['slime','golem','mandrake','goblin'].map((family,i)=>({id:`00000000-0000-4000-8000-00000000000${i+1}`,name:['슬라임','골렘','만드라고라','고블린'][i],family,form_id:family,evolution_tier:0,level:1,xp:0,talent:88,trait:'질긴 가죽',personality:'침착',growth_grade:'B',power_base:48,hp_base:145,atk_base:15,def_base:11,spd_base:9,crit_base:.04,evade_base:.03,kills:0}));
const site={id:'mountain_village',name:'산골 마을',unlocked:true,unlock_order:1,recommended_power:45,boss_power:90,boss_name:'자경단장 베르크',enemy_names:['산골 청년'],battle_seconds:2,xp_per_kill:18,loot:[{id:'강화석',source:'kill',enemy:'산골 청년',chance:.1,min:1,max:1}],progress:{normal_wins:12,boss_ready:false,boss_cleared:false}};
let state={account:{username:'검증전용'},player:{device_id:'10000000-0000-4000-8000-000000000001',gold:680,fame:0,quarters_level:2,tavern_level:1,storage_level:1,workshop_level:1,shop_level:1,next_candidate_at:new Date(Date.now()+14400000).toISOString()},monsters:mons,candidates:[],expeditions:[],expeditionMembers:[],sites:[site],inventory:[],equipment:[],itemDefs:[{id:'강화석',kind:'material'}],recipes:[],craftJobs:[],sellJobs:[],stageProgress:[{site_id:site.id,...site.progress}],evolutionDefs:[],skillDefs:[],storageCapacity:40,quartersCapacity:5,craftCapacity:5,shopCapacity:5,facilityCosts:{quarters:900,tavern:1800,storage:1200,workshop:1600,shop:1500}};
let seq=0,rpcCalls=[],failRestart=false,apiCalls=[];
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.exposeFunction('__qaRpc',async(name,args)=>{
 if(name!=='game_restart_expedition')return {data:null,error:null};
 rpcCalls.push({name,args:clone(args)});await new Promise(r=>setTimeout(r,100));
 if(failRestart)return {data:null,error:{message:'monster_busy'}};
 const old=state.expeditions.find(e=>e.id===args.p_expedition);assert(old?.active);
 old.active=false;const fresh=makeExp(old.site_id,args.p_monsters);state.expeditions.unshift(fresh);
 const members=args.p_monsters.map((id,i)=>({expedition_id:fresh.id,monster_id:id,player_id:state.player.device_id,position:i+1}));state.expeditionMembers.push(...members);
 return {data:{expeditionId:fresh.id,previousExpeditionId:old.id,expedition:clone(fresh),members},error:null};
});
await page.route('**/supabase.min.js',route=>route.fulfill({contentType:'application/javascript',body:`window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:window.__qaSession||null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},rpc:(name,args)=>window.__qaRpc(name,args)})};`}));
await page.route('**/*.supabase.co/**',async route=>{
 const body=route.request().postDataJSON()||{};apiCalls.push(body.action);
 if(body.action==='deploy'){const e=makeExp(body.siteId,body.monsterIds);state.expeditions.unshift(e);state.expeditionMembers.push(...body.monsterIds.map((id,i)=>({expedition_id:e.id,monster_id:id,player_id:state.player.device_id,position:i+1})));}
 await route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,state:clone(state)})});
});
function makeExp(siteId,ids){return {id:`20000000-0000-4000-8000-${String(++seq).padStart(12,'0')}`,player_id:state.player.device_id,monster_id:ids[0],site_id:siteId,active:true,phase:'탐색',started_at:stamp,updated_at:stamp,last_tick_at:stamp,pending_loot:{},pending_xp:{},kills:0,battle_count:0,exploration_count:0,battle_state:{},battle_log:[],event_state:{type:'deploy',text:'탐험 시작',t:stamp}}}
async function installState(){await page.evaluate(x=>{S=x;window.__qaSession={access_token:'synthetic-test-only'};session=window.__qaSession;document.querySelector('#authGate').classList.add('hidden');document.querySelector('#app').classList.remove('hidden');render()},clone(state));}
async function layout(label){
 const problems=await page.evaluate(()=>{const out=[],width=innerWidth;if(document.documentElement.scrollWidth>width+2)out.push(`document overflow ${document.documentElement.scrollWidth}/${width}`);const sheet=document.querySelector('#modal:not(.hidden) .sheet');if(sheet&&sheet.scrollWidth>sheet.clientWidth+3)out.push(`sheet overflow ${sheet.scrollWidth}/${sheet.clientWidth}`);const nodes=[...document.querySelectorAll('.battle-party-unit small,.battle-party-unit em')].filter(e=>e.getBoundingClientRect().width);for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i].getBoundingClientRect(),b=nodes[j].getBoundingClientRect();if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2)out.push(`overlap: ${nodes[i].textContent} / ${nodes[j].textContent}`)}return out});assert.deepEqual(problems,[],label);
}
try{
 await page.goto(base,{waitUntil:'networkidle'});await installState();
 assert.equal(await page.locator('.facility-row').count(),6,'all HQ facilities render with no status rail');
 assert.equal(await page.locator('.facility-row.forge').count(),1,'forge visible');
 await page.locator('[data-screen="hunt"]').click();await page.locator('.mission-card').click();
 await page.locator(`[data-action="toggle-party"][data-id="${mons[0].id}"]`).click();
 await page.locator('[data-action="deploy-party"]').click();await page.waitForSelector('.battle-report-sheet');
 assert.equal(apiCalls.filter(a=>a==='deploy').length,1,'one deploy request');
 assert.equal(await page.evaluate(()=>watchingExpeditionId),state.expeditions[0].id,'launch enters matching battle');
 await page.evaluate(id=>{closeModal(true);missionModal(id)},site.id);
 assert.equal(await page.locator('.exp-active-party-sheet').count(),1);
 assert.equal(await page.locator('[data-action="toggle-party"]').count(),0,'live party cannot be supplemented');
 assert.equal(await page.locator('.exp-active-party-sheet .exp-party-slot').count(),4);
 assert.equal(await page.locator('.exp-active-party-sheet .exp-party-slot.empty').count(),3);
 await page.locator('[data-exp-action="edit"]').click();
 assert(await page.locator('.exp-redeploy-confirm').isDisabled(),'unchanged party cannot heal by resubmitting');
 await page.locator(`[data-exp-action="toggle"][data-id="${mons[1].id}"]`).click();
 failRestart=true;await page.locator('.exp-redeploy-confirm').click();await page.waitForFunction(()=>!busy);
 assert(state.expeditions[0].active,'failed reconfiguration keeps original expedition');
 assert.equal(await page.locator('.exp-reconfigure-sheet').count(),1,'failed request keeps editor');
 failRestart=false;await page.locator('.exp-redeploy-confirm').click();await page.waitForSelector('.battle-report-sheet');
 assert.equal(rpcCalls.length,2,'atomic RPC, not recall then deploy');
 assert.equal(apiCalls.filter(a=>a==='recall').length,0);
 assert.equal(state.expeditions.filter(e=>e.active).length,1);
 assert.equal(state.expeditionMembers.filter(m=>m.expedition_id===state.expeditions[0].id).length,2);
 let exp=state.expeditions[0];exp.battle_state={active:false,partyHp:{[mons[0].id]:40,[mons[1].id]:0},partyMaxHp:{[mons[0].id]:161,[mons[1].id]:161},skills:[{name:'지난 스킬',owner:'슬라임'}]};
 exp.event_state={type:'move',text:'탐색 중',t:stamp};exp.battle_log=[{type:'explore',phase:'이동',event:'탐색 중',t:stamp,recovery:{heal:0,kind:'none'}}];
 await installState();await page.evaluate(id=>watchModal(id),exp.id);
 assert.equal(await page.locator('#liveMonsterHpText').textContent(),'HP 40 / 322');
 assert((await page.locator('#liveMonsterHp').evaluate(e=>parseFloat(e.style.width)))<20,'exploration does not display full HP');
 assert.equal(await page.locator('.battle-party-unit.dead').count(),1,'fallen unit remains fallen');
 assert.equal(await page.locator('#liveSkillProc').textContent(),'','stale skills not repeated');
 exp.battle_state.partyHp[mons[0].id]=100;exp.battle_log[0].recovery={kind:'well',heal:60};
 await installState();await page.evaluate(()=>syncWatchPanel());
 assert.equal(await page.locator('#liveEncounterType').textContent(),'우물 발견');
 assert.equal(await page.locator('#liveDamageFloat').textContent(),'HP +60');
 exp.battle_log[0].recovery={kind:'none',heal:0};await installState();await page.evaluate(()=>syncWatchPanel());
 assert.equal(await page.locator('#liveDamageFloat').textContent(),'체력 유지','recovery effect is not replayed');
 for(const width of [360,390,430,768,1024]){
   await page.setViewportSize({width,height:844});await page.evaluate(()=>{closeModal(true);screen='home';render()});await layout(`HQ ${width}`);
   if(width===360)await page.screenshot({path:`${output}/home-360.png`,fullPage:true});
   await page.evaluate(id=>missionModal(id),site.id);await layout(`active party ${width}`);
   if(width===360)await page.screenshot({path:`${output}/party-360.png`,fullPage:true});
   await page.locator('[data-exp-action="edit"]').click();await layout(`editor ${width}`);
   if(width===360)await page.screenshot({path:`${output}/editor-360.png`,fullPage:true});
   await page.evaluate(id=>watchModal(id),exp.id);await layout(`battle ${width}`);
   if(width===360)await page.screenshot({path:`${output}/battle-360.png`,fullPage:true});
 }
 exp.active=false;exp.phase='전멸 · 복귀';exp.battle_state.partyHp[mons[0].id]=0;exp.battle_state.result='loss';exp.event_state={type:'battle_end',result:'loss',t:stamp};exp.battle_log=[{type:'battle-end',result:'loss',enemy:'용사',t:stamp}];
 await installState();await page.evaluate(()=>syncWatchPanel());
 assert.equal(await page.locator('.battle-report-actions .retreat').textContent(),'파티 편성 · 다시 출정');
 await page.locator('.battle-report-actions .retreat').click();assert.equal(await page.locator('.party-select-list').count(),1,'wipe can return to party selection');
 assert.deepEqual(errors,[],'no browser runtime exceptions');
 const report={passed:true,widths:[360,390,430,768,1024],fixtureOnly:true,liveAccountDataUsed:false,checks:['HQ rendering without removed status rail','forge existence','one-request launch to battle','four slots and locked active-party selection','failed restart retains original','successful atomic restart opens battle','persistent exploration HP','no revive or stale skill replay','visible recovery and recovery clearing','mobile/tablet overflow and battle-label overlap','wipe restart action'],errors};
 await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log('EXPEDITION_RUNTIME_OK',JSON.stringify(report));
}catch(err){await page.screenshot({path:`${output}/failure.png`,fullPage:true});await fs.writeFile(`${output}/failure.json`,JSON.stringify({error:String(err),errors,html:await page.locator('#modal').innerHTML(),state:await page.evaluate(()=>S)},null,2));throw err}finally{await browser.close()}
