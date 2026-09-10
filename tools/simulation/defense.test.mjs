import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {idleDatabase,newCompany,newExpedition,catalog,root} from './idle-db.mjs';
const db=await idleDatabase(),rows=async(q,v=[])=>(await db.query(q,v)).rows,one=async(q,v=[])=>(await rows(q,v))[0];
let passed=0;const test=async(n,f)=>{await f();passed++;console.log('PASS',n)};
async function fixture(){const p=await newCompany(db);await db.query('insert into game_defense(player_id) values($1)',[p]);return p;}
async function action(p){const w=(await one('select game_defense_action($1) w',[p])).w;await db.query("update game_defense set last_tick_at=last_tick_at+interval '2 seconds' where player_id=$1",[p]);return w;}
async function setWave(p,hero,{boss=false,stage=1}={}){await db.query('update game_defense set wave=$2::jsonb where player_id=$1',[p,JSON.stringify({active:true,boss,stage,site:'mountain_village',tick:0,heroes:[{id:1,name:boss?catalog.sites[0].boss_name:catalog.sites[0].enemy_names[0],hp:100,maxHp:100,position:0,...hero}]})]);}
try{
 await test('only stationed employees attack; no defense XP, injuries or equipment scaling',async()=>{
  const p=await fixture(),before=await one('select * from game_monsters where player_id=$1',[p]);await action(p);const w=await action(p);assert.equal(w.attacks.length,1);assert(w.attacks[0].damage>0);
  await db.query("update game_monsters set level=20,growth_grade='S',evolution_tier=2 where id=$1",[before.id]);const strong=await action(p);assert.equal(strong.attacks[0].damage,281);
  const after=await one('select xp,field_hp from game_monsters where id=$1',[before.id]);assert.equal(after.xp,before.xp);assert.equal(after.field_hp,before.field_hp);
  const f=await newExpedition(db,p);const absent=await action(p);assert.equal(absent.attacks.length,0);
  await db.query('update game_expeditions set active=false where id=$1',[f.e]);assert.equal((await action(p)).attacks.length,1);
 });
 await test('a throne escape fails the whole wave, pays nothing and disables boss auto',async()=>{
  const p=await fixture();await db.query('update game_defense set stage=4,highest_stage=4,boss_auto=true where player_id=$1',[p]);await setWave(p,{hp:1e9,maxHp:1e9,position:.99},{boss:true,stage:5});
  assert.equal((await action(p)).result,'loss');const d=await one('select * from game_defense where player_id=$1',[p]);assert.equal(d.stage,4);assert.equal(d.boss_auto,false);assert.equal(Number(d.losses),1);assert.deepEqual(d.reward_vault,{});
  assert.equal((await one('select count(*) n from game_inventory where player_id=$1',[p])).n,0);
  const next=await action(p);assert.equal(next.boss,false);assert.equal(next.stage,4);
 });
 await test('boss wins keep advancing; only unlocked previous stages can be selected',async()=>{
  const p=await fixture();await db.query("select game_defense_command($1,'boss-auto')",[p]);
  const first=await action(p);assert.equal(first.boss,true);assert.equal(first.stage,2);
  await setWave(p,{hp:1},{boss:true,stage:2});assert.equal((await action(p)).result,'win');const next=await action(p);assert.equal(next.stage,3);assert.equal(next.boss,true);
  await db.query("select game_defense_command($1,'stage',1)",[p]);const d=await one('select stage,highest_stage,boss_auto from game_defense where player_id=$1',[p]);assert.deepEqual(d,{stage:1,highest_stage:2,boss_auto:false});
  await assert.rejects(db.query("select game_defense_command($1,'stage',3)",[p]),/locked/);
 });
 await test('gold upgrades debit once, reject stale levels and materially change combat',async()=>{
  const p=await fixture();await assert.rejects(db.query("select game_defense_upgrade($1,'gas',0)",[p]),/gold_short/);await db.query('update game_players set gold=1000 where device_id=$1',[p]);
  for(const [kind,cost] of [['traps',120],['gas',180],['slow',240],['arcane',300]]){const result=(await one('select game_defense_upgrade($1,$2,0) r',[p,kind])).r;assert.equal(result.cost,cost);await assert.rejects(db.query('select game_defense_upgrade($1,$2,0)',[p,kind]),/facility_changed/);}
  assert.equal((await one('select gold from game_players where device_id=$1',[p])).gold,160);const second=(await one("select game_defense_upgrade($1,'traps',1) r",[p])).r;assert.equal(second.cost,154);assert.equal((await one('select gold from game_players where device_id=$1',[p])).gold,6);
  await setWave(p,{hp:1000,maxHp:1000,position:.24});const w=await action(p);assert(w.heroes[0].hp<960);assert(Math.abs(w.heroes[0].position-(.24+1/31))<1e-6);
 });
 await test('reward vault preserves full-warehouse drops and delivers exactly once',async()=>{
  const p=await fixture(),item=catalog.items[0].id;
  await db.query('insert into game_inventory(player_id,item_id,qty) select $1,id,1 from game_item_defs where id<>$2 limit 160',[p,item]);
  await db.query('update game_defense set reward_vault=$2::jsonb where player_id=$1',[p,JSON.stringify({[item]:2})]);await action(p);await action(p);assert.equal((await one('select reward_vault from game_defense where player_id=$1',[p])).reward_vault[item],2);
  await db.query('delete from game_inventory where player_id=$1 and item_id=(select item_id from game_inventory where player_id=$1 limit 1)',[p]);await action(p);await action(p);
  assert.equal((await one('select qty from game_inventory where player_id=$1 and item_id=$2',[p,item])).qty,2);assert.deepEqual((await one('select reward_vault from game_defense where player_id=$1',[p])).reward_vault,{});
 });
 await test('maximum legal staff and facilities can clear stage 50; early untrained defense meets a wall',async()=>{
  const beginner=await fixture();await db.query("select game_defense_command($1,'boss-auto')",[beginner]);
  let reachedFailure=false;for(let n=0;n<500;n++){const w=await action(beginner);if(w.result==='loss'){reachedFailure=true;break;}}assert(reachedFailure);
  const p=await fixture();await db.query('update game_players set quarters_level=5 where device_id=$1',[p]);
  await db.query("insert into game_monsters(player_id,name,family,level,growth_grade,evolution_tier,form_id,skill_id) select $1,'금고 골렘','golem',60,'S',2,'royal_golem','office_royal_golem' from generate_series(1,10)",[p]);
  await db.query("update game_monsters set level=60,growth_grade='S',evolution_tier=2 where player_id=$1",[p]);
  await db.query('update game_defense set stage=49,highest_stage=49,traps=25,gas=25,slow=25,arcane=25,boss_auto=true where player_id=$1',[p]);
  let win=false;for(let n=0;n<55;n++){const w=await action(p);if(w.result==='win'){win=true;break;}if(w.result==='loss')break;}assert(win,'50th boss can be killed with 11 final-tier S60 defenders and maximum upgrades');
  const d=await one('select stage,boss_auto from game_defense where player_id=$1',[p]);assert.equal(d.stage,50);assert.equal(d.boss_auto,false);
 });
 await test('defense drop probabilities are a quarter of expedition tables, with boss-only single legendary pool',async()=>{
  const site=catalog.sites[0],scaled=site.loot.map(x=>({...x,chance:x.chance*.25})),legendIds=catalog.items.filter(x=>x.rarity==='전설').map(x=>x.id);
  await db.exec('select setseed(.326)');
  const counts=await rows("with rolls as materialized(select game_roll_campaign_drops($1::jsonb,$2,0) drops from generate_series(1,80000)) select d.key,count(*) n from rolls cross join lateral jsonb_each(drops) d group by d.key",[JSON.stringify(scaled),site.boss_name]);
  for(const id of site.chapter.equipment.filter(id=>catalog.items.find(x=>x.id===id).rarity==='전설')){const n=Number(counts.find(x=>x.key===id)?.n||0);assert(n>=7&&n<=40,id+': '+n+'/80000');}
  const overlap=await one("with rolls as materialized(select game_roll_campaign_drops($1::jsonb,$2,0) drops from generate_series(1,10000)) select count(*) n from rolls where (select count(*) from jsonb_object_keys(drops) k where k=any($3::text[]))>1",[JSON.stringify(scaled),site.boss_name,legendIds]);assert.equal(Number(overlap.n),0);
  const normal=await rows("with rolls as materialized(select game_roll_campaign_drops($1::jsonb,$2,0) drops from generate_series(1,10000)) select distinct key from rolls cross join lateral jsonb_each(drops)",[JSON.stringify(scaled),site.enemy_names[0]]);assert(normal.every(r=>!legendIds.includes(r.key)));
 });
 await test('defense helpers and table cannot be used through player RPC to forge rewards',async()=>{
  for(const sig of ['game_defense_action(uuid)','game_defense_upgrade(uuid,text,integer)','game_defense_command(uuid,text,integer)','game_process_defense()'])for(const role of ['anon','authenticated'])assert.equal((await one('select has_function_privilege($1,$2,\'execute\') p',[role,sig])).p,false);
  assert.equal((await one("select has_table_privilege('authenticated','game_defense','update') p")).p,false);
 });
 mkdirSync(root+'tools/simulation/results',{recursive:true});writeFileSync(root+'tools/simulation/results/defense-checks.json',JSON.stringify({passed,at:new Date().toISOString()},null,2));console.log('DEFENSE_CHECKS',passed);
}catch(e){console.error(e.message,e.where||'',e.detail||'');process.exitCode=1;}finally{await db.close();}
