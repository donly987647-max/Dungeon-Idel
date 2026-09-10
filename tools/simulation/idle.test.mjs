import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createDatabase,root} from './database.mjs';
const db=await createDatabase(),catalog=JSON.parse(readFileSync(root+'content/campaign-v016.json'));
const rows=async(q,v=[])=>(await db.query(q,v)).rows,one=async(q,v=[])=>(await rows(q,v))[0];
let passed=0;const test=async(n,f)=>{await f();passed++;console.log('PASS',n)};
async function company(){const player=randomUUID();await db.query('insert into auth.users(id) values($1)',[player]);await db.query('select game_initialize_company($1)',[player]);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[player]);return player}
async function deploy(player,families=['slime']){const ids=(await rows('select id from game_monsters where player_id=$1 and family=any($2::text[]) order by family',[player,families])).map(x=>x.id),e=randomUUID();await db.query('insert into game_expeditions(id,player_id,site_id,monster_id,last_tick_at) values($1,$2,\'mountain_village\',$3,now()-interval \'1 hour\')',[e,player,ids[0]]);for(const [i,id] of ids.entries())await db.query('insert into game_expedition_members(expedition_id,player_id,monster_id,position) values($1,$2,$3,$4)',[e,player,id,i+1]);return {player,e,ids}}
async function action(f){const a=(await one('select game_process_expedition_action($1) a',[f.e])).a;await db.query("update game_expeditions set last_tick_at=last_tick_at+interval '2 seconds' where id=$1",[f.e]);return a}
async function stock(p,id,qty){await db.query('insert into game_inventory(player_id,item_id,qty) values($1,$2,$3) on conflict(player_id,item_id) do update set qty=excluded.qty',[p,id,qty])}
try{
 for(const f of readdirSync(root+'supabase/migrations').filter(f=>f.includes('_v015_')).sort())await db.exec(readFileSync(root+'supabase/migrations/'+f,'utf8'));
 const veteran=await company();await db.query('update game_players set gold=8765 where device_id=$1',[veteran]);
 for(const f of readdirSync(root+'supabase/migrations').filter(f=>f.endsWith('_v016_idle_company.sql')))await db.exec(readFileSync(root+'supabase/migrations/'+f,'utf8'));
 await db.exec('set check_function_bodies=on;select setseed(.421)');
 await test('new companies start at zero; existing money/staff survive and all office skills are assigned',async()=>{
  const p=await company();assert.equal((await one('select gold from game_players where device_id=$1',[p])).gold,0);assert.equal((await one('select gold from game_players where device_id=$1',[veteran])).gold,8765);
  const m=await one('select * from game_monsters where player_id=$1',[p]);assert.equal(m.name,'먹물 슬라임');assert.equal(m.skill_id,'office_slime_base');
  assert.equal((await one('select count(*) n from game_candidates where player_id=$1',[p])).n,3);
 });
 await test('all chapters have exactly 1 normal / 2 rare / 2 epic / 1 legendary per slot with exclusive acquisition',async()=>{
  for(const s of catalog.sites)for(const slot of ['weapon','armor','accessory']){
   const items=catalog.items.filter(d=>d.acquisition?.version===16&&d.acquisition.site===s.id&&d.slot===slot);
   for(const [rarity,n] of [['일반',1],['희귀',2],['영웅',2],['전설',1]])assert.equal(items.filter(d=>d.rarity===rarity).length,n);
   for(const d of items){const drops=s.loot.filter(l=>l.id===d.id),recipe=catalog.recipes.find(r=>r.output_item===d.id);
    if(d.rarity==='희귀'||d.rarity==='영웅'){assert.equal(drops.length,0);assert(recipe);assert.equal(recipe.sale_gold,0);assert(Object.keys(recipe.inputs).some(id=>catalog.items.find(x=>x.id===id)?.acquisition?.catalyst));}
    else if(d.rarity==='전설'){assert.equal(drops.length,1);assert.equal(drops[0].enemy,s.boss_name);assert.equal(drops[0].chance,.001);}
    else{assert.equal(drops.length,4);assert(drops.every(l=>s.enemy_names.includes(l.enemy)));}
   }
  }
  assert.equal(catalog.items.filter(x=>x.acquisition?.version===16&&x.kind==='equipment').length,90);
 });
 await test('all 60 equipment recipes consume correct inputs, take rarity-scaled time, auto-deliver exactly once, never sell',async()=>{
  const p=await company();await db.query('update game_players set workshop_level=5 where device_id=$1',[p]);
  for(const r of catalog.recipes.filter(r=>r.id.startsWith('gear_'))){
   for(const [id,n] of Object.entries(r.inputs))await stock(p,id,n*2);
   const j=(await one('select game_start_craft($1,$2,2) id',[p,r.id])).id;
   const job=await one('select *,extract(epoch from finish_at-started_at) duration from game_craft_jobs where id=$1',[j]);assert.equal(Number(job.duration),r.craft_seconds*2);
   assert.equal(Number((await one('select coalesce(sum(qty),0) n from game_inventory where player_id=$1 and item_id=any($2::text[])',[p,Object.keys(r.inputs)])).n),0);
   await db.query("update game_craft_jobs set finish_at=now()-interval '1 second' where id=$1",[j]);await db.exec('select game_process_economy();select game_process_economy()');
   assert.equal((await one('select qty from game_inventory where player_id=$1 and item_id=$2',[p,r.output_item])).qty,2);
   await assert.rejects(db.query('select game_start_sell($1,$2,1)',[p,r.output_item]),/not_sellable/);
  }
 });
 await test('individual KO revives on 12th action and manual redispatch preserves recovery',async()=>{
  const p=await company(),f=await deploy(p);await db.query('update game_monsters set field_hp=0,recovery_actions=12 where id=$1',[f.ids[0]]);await db.query('update game_expeditions set regroup_remaining=15 where id=$1',[f.e]);
  for(let i=0;i<11;i++)await action(f);assert.equal((await one('select field_hp from game_monsters where id=$1',[f.ids[0]])).field_hp,0);
  assert((await action(f)).revived.length===1);assert((await one('select field_hp from game_monsters where id=$1',[f.ids[0]])).field_hp>0);
  await db.query('update game_monsters set field_hp=0,recovery_actions=8 where id=$1',[f.ids[0]]);await db.query('update game_expeditions set active=false where id=$1',[f.e]);
  const fresh=await deploy(p);await action(fresh);const m=await one('select field_hp,recovery_actions from game_monsters where id=$1',[f.ids[0]]);assert.equal(m.field_hp,0);assert.equal(m.recovery_actions,7);
 });
 await test('real battle wipe keeps expedition active, removes XP penalty and restarts after 15 actions',async()=>{
  const p=await company(),f=await deploy(p),id=f.ids[0];await db.query('update game_monsters set field_hp=1,xp=60,evade_base=0,spd_base=1 where id=$1',[id]);
  await db.query('update game_expeditions set battle_state=$2::jsonb where id=$1',[f.e,JSON.stringify({active:true,enemy:'산골 청년',enemyHp:1e6,enemyMaxHp:1e6,enemyAtk:1e6,enemyDef:1,enemySpd:1e6,enemyCrit:0,enemyEvade:0,turn:'enemy',round:1,partyHp:{[id]:1},partyMaxHp:{[id]:1000},attackCounts:{}})]);
  const e=await action(f);assert.equal(e.result,'loss');assert.equal((await one('select active,regroup_remaining from game_expeditions where id=$1',[f.e])).regroup_remaining,15);assert.equal((await one('select xp from game_monsters where id=$1',[id])).xp,60);
  for(let i=0;i<15;i++)await action(f);const state=await one('select * from game_expeditions where id=$1',[f.e]);assert(state.active);assert.equal(state.regroup_remaining,0);assert.equal(state.phase,'자동 재출정');assert((await one('select field_hp from game_monsters where id=$1',[id])).field_hp>0);
 });
 await test('tenure promotes without rerolling and selected evolution applies while dispatched',async()=>{
  const p=await company(),f=await deploy(p),id=f.ids[0];await db.query("update game_monsters set growth_grade='C',service_points=199,level=20 where id=$1",[id]);
  await db.query('select game_plan_evolution($1,$2,$3)',[p,id,'slime_holy']);await db.query('select game_apply_service($1)',[f.e]);await db.query('select game_auto_evolve($1)',[f.e]);
  const m=await one('select * from game_monsters where id=$1',[id]);assert.equal(m.growth_grade,'B');assert.equal(m.form_id,'holy_slime');assert.equal(m.level,20);assert(m.skill_id.startsWith('office_'));
  const other=await company();await assert.rejects(db.query('select game_plan_evolution($1,$2,$3)',[other,id,'slime_dark']),/evolution_invalid/);
 });
 await test('boss encounter has a 100-encounter ceiling after unlock, no forced boss before unlock',async()=>{
  const p=await company(),f=await deploy(p);await db.query('insert into game_stage_progress(player_id,site_id,boss_misses) values($1,\'mountain_village\',99) on conflict(player_id,site_id) do update set boss_misses=99',[p]);
  assert.equal((await one('select game_boss_roll_for_site($1,\'mountain_village\',0) b',[p])).b,false);
  await db.query('update game_stage_progress set normal_battles=500 where player_id=$1',[p]);assert.equal((await one('select game_boss_roll_for_site($1,\'mountain_village\',0) b',[p])).b,true);
 });
 await test('auto economy yields gold from 0, protects rare inputs and gear, and respects manual queues',async()=>{
  const p=await company(),r=catalog.recipes.find(r=>r.id==='campaign_mountain_village_1'),c=catalog.items.find(x=>x.acquisition?.catalyst),g=catalog.items.find(x=>x.acquisition?.version===16&&x.rarity==='희귀'&&x.kind==='equipment');
  for(const [id,n] of Object.entries(r.inputs))await stock(p,id,12+n*3);await stock(p,c.id,100);await stock(p,g.id,5);
  const t=new Date('2026-08-01T00:00:00Z');await db.query('select game_run_idle_economy($1,$2)',[p,t]);
  const j=await one("select * from game_craft_jobs where player_id=$1 and status='running'",[p]);assert(j);
  const done=new Date(new Date(j.finish_at).getTime()+30000);await db.query('select game_run_idle_economy($1,$2)',[p,done]);
  const sale=await one("select * from game_sell_jobs where player_id=$1 and status='running'",[p]);assert(sale);
  await db.query('select game_run_idle_economy($1,$2)',[p,new Date(new Date(sale.finish_at).getTime()+30000)]);
  const manual=await company();for(const [id,n] of Object.entries(r.inputs))await stock(manual,id,50+n);const manualJob=(await one('select game_start_craft($1,$2,1) id',[manual,r.id])).id;await db.query('select game_run_idle_economy($1,now())',[manual]);assert.equal((await one("select count(*) n from game_craft_jobs where player_id=$1 and status in ('running','queued')",[manual])).n,1);assert.equal((await one('select id from game_craft_jobs where player_id=$1',[manual])).id,manualJob);
  assert((await one('select gold from game_players where device_id=$1',[p])).gold>0);assert.equal((await one('select qty from game_inventory where player_id=$1 and item_id=$2',[p,c.id])).qty,100);assert.equal((await one('select qty from game_inventory where player_id=$1 and item_id=$2',[p,g.id])).qty,5);
 });
 await test('automatic equipment replacement preserves the removed enhancement and rejects weaker replacements',async()=>{
  const p=await company(),f=await deploy(p),id=f.ids[0],old=catalog.items.find(x=>x.acquisition?.version===16&&x.acquisition.site==='mountain_village'&&x.rarity==='일반'&&x.slot==='weapon'),fresh=catalog.items.find(x=>x.acquisition?.version===16&&x.acquisition.site==='hero_kingdom'&&x.rarity==='일반'&&x.slot==='weapon');
  await stock(p,old.id,1);await db.query('select game_equip_item($1,$2,$3)',[p,id,old.id]);await db.query('update game_monster_equipment set enhance_level=3 where monster_id=$1',[id]);await stock(p,fresh.id,1);await db.query('select game_auto_equip($1)',[f.e]);
  assert.equal((await one("select item_id from game_monster_equipment where monster_id=$1 and slot='weapon'",[id])).item_id,fresh.id);assert.equal((await one('select qty from game_enhanced_inventory where player_id=$1 and item_id=$2 and enhance_level=3',[p,old.id])).qty,1);
  await stock(p,old.id,1);await db.query('select game_auto_equip($1)',[f.e]);assert.equal((await one("select item_id from game_monster_equipment where monster_id=$1 and slot='weapon'",[id])).item_id,fresh.id);
 });
 await test('players cannot call clock-advancing RPCs to accelerate idle growth',async()=>{
  for(const sig of ['game_process_expedition_action(uuid)','game_process_expedition_action_core(uuid)','game_process_expeditions()','game_tick_all()'])for(const role of ['anon','authenticated'])assert.equal((await one(`select has_function_privilege($1,$2,'execute') p`,[role,sig])).p,false);
 });
 mkdirSync(root+'tools/simulation/results',{recursive:true});writeFileSync(root+'tools/simulation/results/idle-checks.json',JSON.stringify({passed,at:new Date().toISOString()},null,2));console.log('IDLE_CHECKS',passed);
}catch(e){console.error(e.message,e.where||'',e.detail||'');process.exitCode=1;}finally{await db.close()}
