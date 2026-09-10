import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createDatabase,root} from './database.mjs';
const catalog=JSON.parse(readFileSync(root+'content/campaign-v015.json','utf8'));
const db=await createDatabase();
const one=async(q,v=[])=>(await db.query(q,v)).rows[0];
let passed=0;
const test=async(name,fn)=>{await fn();passed++;console.log('PASS',name)};
async function player(level=1){
 const id=randomUUID();await db.query('insert into auth.users(id) values($1)',[id]);
 await db.query('insert into game_players(device_id,workshop_level,manual_economy_claim) values($1,$2,true)',[id,level]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);return id;
}
async function stock(p,item,qty){await db.query('insert into game_inventory(player_id,item_id,qty) values($1,$2,$3) on conflict(player_id,item_id) do update set qty=excluded.qty',[p,item,qty]);}
async function mature(table,id){await db.query(`update ${table} set started_at=now()-interval '2 hour',finish_at=now()-interval '1 second' where id=$1`,[id]);await db.exec('select game_process_economy()');}
try{
 for(const f of readdirSync(root+'supabase/migrations').filter(x=>x.includes('_v015_')).sort())await db.exec(readFileSync(root+'supabase/migrations/'+f,'utf8'));
 await test('every recipe completes a real batch craft → claim → sale → gold claim exactly once',async()=>{
  const p=await player(5);let gold=680;
  for(const r of catalog.recipes){
   for(const [id,n] of Object.entries(r.inputs))await stock(p,id,n*3);
   const craft=(await one('select game_start_craft($1,$2,3) id',[p,r.id])).id;
   const job=await one('select * from game_craft_jobs where id=$1',[craft]);
   assert.equal((new Date(job.finish_at)-new Date(job.started_at))/1000,r.craft_seconds*3);
   await assert.rejects(()=>db.query('select game_claim_craft($1)',[craft]),/job_not_ready/);
   await mature('game_craft_jobs',craft);
   const claim=(await one('select game_claim_craft($1) receipt',[craft])).receipt;
   assert.equal(claim.quantity,3*r.output_qty);
   await assert.rejects(()=>db.query('select game_claim_craft($1)',[craft]),/job_already_claimed/);
   const sell=(await one('select game_start_sell($1,$2,$3) id',[p,r.output_item,claim.quantity])).id;
   const sj=await one('select * from game_sell_jobs where id=$1',[sell]);
   assert.equal((new Date(sj.finish_at)-new Date(sj.started_at))/1000,Math.ceil(r.craft_seconds/1.2)*claim.quantity);
   await mature('game_sell_jobs',sell);const sale=(await one('select game_claim_sell($1) receipt',[sell])).receipt;
   gold+=r.sale_gold*claim.quantity;assert.equal(sale.gold,r.sale_gold*claim.quantity);
   await assert.rejects(()=>db.query('select game_claim_sell($1)',[sell]),/job_already_claimed/);
   assert.equal((await one('select gold from game_players where device_id=$1',[p])).gold,gold);
  }
 });
 await test('workshop level gates reject crafting without consuming ingredients',async()=>{
  const p=await player(),r=catalog.recipes.find(r=>r.workshop_level===2);
  for(const [id,n] of Object.entries(r.inputs))await stock(p,id,n);
  await assert.rejects(()=>db.query('select game_start_craft($1,$2,1)',[p,r.id]),/workshop_level/);
  for(const [id,n] of Object.entries(r.inputs))assert.equal((await one('select qty from game_inventory where player_id=$1 and item_id=$2',[p,id])).qty,n);
 });
 await test('facility upgrades charge once, reject stale levels, and preserve gold on failure',async()=>{
  const p=await player();await db.query('update game_players set gold=2000 where device_id=$1',[p]);
  assert.deepEqual((await one("select game_upgrade_facility($1,'storage',1) receipt",[p])).receipt,{facility:'storage',level:2,cost:1200});
  await assert.rejects(()=>db.query("select game_upgrade_facility($1,'storage',1)",[p]),/facility_changed/);
  await assert.rejects(()=>db.query("select game_upgrade_facility($1,'workshop',1)",[p]),/gold_short/);
  assert.equal((await one('select gold from game_players where device_id=$1',[p])).gold,800);
  assert.equal((await one('select game_storage_capacity($1) capacity',[p])).capacity,80);
  assert.equal((await one("select has_function_privilege('authenticated','game_upgrade_facility(uuid,text,integer)','EXECUTE') allowed")).allowed,false);
 });
 await test('full storage retains crafted output until there is space and never blocks world economy',async()=>{
  const p=await player(),r=catalog.recipes[0];for(const [id,n] of Object.entries(r.inputs))await stock(p,id,n);
  const id=(await one('select game_start_craft($1,$2,1) id',[p,r.id])).id;
  for(const item of catalog.items.slice(0,40))await stock(p,item.id,1);
  await mature('game_craft_jobs',id);
  await assert.rejects(()=>db.query('select game_claim_craft($1)',[id]),/storage_full/);
  assert.equal((await one('select status from game_craft_jobs where id=$1',[id])).status,'ready');
  await db.query('update game_players set manual_economy_claim=false where device_id=$1',[p]);
  await db.exec('select game_process_economy()');
  assert.equal((await one('select status from game_craft_jobs where id=$1',[id])).status,'ready');
  await db.query('delete from game_inventory where player_id=$1 and item_id=$2',[p,catalog.items[0].id]);
  await db.exec('select game_process_economy()');
  assert.equal((await one('select status from game_craft_jobs where id=$1',[id])).status,'done');
  assert.equal((await one('select qty from game_inventory where player_id=$1 and item_id=$2',[p,r.output_item])).qty,r.output_qty);
 });
 await test('another player cannot claim a finished craft or sale',async()=>{
  const owner=await player(),r=catalog.recipes[0];for(const [id,n] of Object.entries(r.inputs))await stock(owner,id,n);
  const id=(await one('select game_start_craft($1,$2,1) id',[owner,r.id])).id;await mature('game_craft_jobs',id);
  const stranger=await player();await assert.rejects(()=>db.query('select game_claim_craft($1)',[id]),/job_missing/);
  assert.equal((await one('select status from game_craft_jobs where id=$1',[id])).status,'ready');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
  await db.query('select game_claim_craft($1)',[id]);
  const sell=(await one('select game_start_sell($1,$2,1) id',[owner,r.output_item])).id;await mature('game_sell_jobs',sell);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[stranger]);
  await assert.rejects(()=>db.query('select game_claim_sell($1)',[sell]),/job_missing/);
  assert.equal((await one('select status from game_sell_jobs where id=$1',[sell])).status,'ready');
 });
 await test('a full warehouse retains uncollected gear and permits collection after expansion',async()=>{
  const p=await player();await db.query('select game_initialize_company($1)',[p]);
  const m=randomUUID(),e=randomUUID();
  await db.query("insert into game_monsters(id,player_id,name,family) values($1,$2,'합성 슬라임','slime')",[m,p]);
  for(const item of catalog.items.slice(0,40))await stock(p,item.id,1);
  const gear=catalog.items.find(x=>x.rarity==='전설'&&!catalog.items.slice(0,40).includes(x)).id;
  await db.query("insert into game_expeditions(id,player_id,site_id,monster_id,pending_loot) values($1,$2,'mountain_village',$3,$4::jsonb)",[e,p,m,JSON.stringify({[gear]:1})]);
  await assert.rejects(()=>db.query('select game_collect_loot($1,$2)',[p,e]),/storage_full/);
  assert.deepEqual((await one('select pending_loot from game_expeditions where id=$1',[e])).pending_loot,{[gear]:1});
  await db.query('update game_players set gold=2000 where device_id=$1',[p]);await db.query("select game_upgrade_facility($1,'storage',1)",[p]);
  assert.deepEqual((await one('select game_collect_loot($1,$2) receipt',[p,e])).receipt,{[gear]:1});
 });
 mkdirSync(root+'tools/simulation/results',{recursive:true});
 writeFileSync(root+'tools/simulation/results/economy.json',JSON.stringify({passed,recipes:catalog.recipes.length,generatedAt:new Date().toISOString(),notes:'Real SQL and synthetic users. Job deadlines moved into the past to advance time. Includes exact batch amounts, timing, double claims, ownership, capacity and upgrade guards.'},null,2)+'\n');
 console.log(`${passed} economy checks passed across ${catalog.recipes.length} recipes.`);
}finally{await db.close();}
