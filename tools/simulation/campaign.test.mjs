import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createDatabase,root,baseline} from './database.mjs';
import {roster} from '../../content/roster-v015.mjs';

const db=await createDatabase();
let passed=0;
const test=async(name,fn)=>{await fn();passed++;console.log('PASS',name);};
const rows=async(sql,values=[])=>(await db.query(sql,values)).rows;
const one=async(sql,values=[])=>(await rows(sql,values))[0];
const catalog=JSON.parse(readFileSync(root+'content/campaign-v015.json','utf8'));

async function fixture(site='mountain_village',level=10){
  const player=randomUUID(),expedition=randomUUID(),monsters=[randomUUID(),randomUUID(),randomUUID()];
  await db.query('insert into auth.users(id) values($1)',[player]);
  await db.query('insert into game_players(device_id) values($1)',[player]);
  for(const [i,family] of ['slime','goblin','troll'].entries()){
    const t=roster.find(x=>x.family===family);
    await db.query('insert into game_monsters(id,player_id,name,family,form_id,level,talent,xp,hp_base,atk_base,def_base,spd_base,crit_base,evade_base,growth_grade) values($1,$2,$3,$3,$3,$4,88,50,$5,$6,$7,$8,$9,$10,\'B\')',[monsters[i],player,family,level,t.hp,t.atk,t.def,t.spd,t.crit,t.evade]);
  }
  await db.query('insert into game_expeditions(id,player_id,site_id,monster_id) values($1,$2,$3,$4)',[expedition,player,site,monsters[0]]);
  for(const [i,monster] of monsters.entries())await db.query('insert into game_expedition_members(expedition_id,player_id,monster_id,position) values($1,$2,$3,$4)',[expedition,player,monster,i+1]);
  await db.query('insert into game_stage_progress(player_id,site_id) values($1,$2)',[player,site]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[player]);
  return {player,expedition,monsters,site};
}
async function state(f){return one('select * from game_expeditions where id=$1',[f.expedition]);}
async function progress(f){return one('select * from game_stage_progress where player_id=$1 and site_id=$2',[f.player,f.site]);}
async function action(f){return (await one('select game_process_expedition_action($1) event',[f.expedition])).event;}
async function setBattle(f,patch){await db.query('update game_expeditions set battle_state=battle_state||$2::jsonb where id=$1',[f.expedition,JSON.stringify(patch)]);}
async function ready(f){await db.query('update game_stage_progress set normal_wins=1000,normal_battles=1000,boss_ready=true where player_id=$1 and site_id=$2',[f.player,f.site]);}
async function encounterBoss(f){
  for(let i=0;i<5000;i++){
    const event=await action(f);
    if(event.type==='encounter'&&event.boss)return event;
    // Skip ordinary fights in this fixture only. Production battle SQL and its
    // boss probability remain unchanged; this does not contribute to unlocks.
    if(event.type==='encounter')await setBattle(f,{active:false});
  }
  throw new Error('No boss in 5000 actions');
}

try{
  // Preserve an actual pre-upgrade shape to test the migration, not just empty tables.
  const veteran=await fixture();
  await db.query("update game_stage_progress set boss_cleared=true,boss_cleared_at='2026-08-01T00:00:00Z',normal_wins=730,boss_attempts=2 where player_id=$1",[veteran.player]);
  for(const file of readdirSync(root+'supabase/migrations').filter(x=>x.includes('_v015_')).sort())await db.exec(readFileSync(root+'supabase/migrations/'+file,'utf8'));
  await db.exec('set check_function_bodies=on; select setseed(0.421);');

  await test('requested 5-chapter order / 106 items / 26 recipes; existing inventory IDs survive',async()=>{
    assert.deepEqual((await rows('select name from game_hunt_sites order by unlock_order')).map(x=>x.name),['산골 마을','변두리 소국','작은 왕국','거대한 성','용사 왕국']);
    assert.equal((await one('select count(*) n from game_item_defs')).n,106);
    assert.equal((await one('select count(*) n from game_recipes')).n,26);
    const ids=new Set((await rows('select id from game_item_defs')).map(x=>x.id));
    for(const item of baseline.items)assert(ids.has(item.id),item.id);
  });
  await test('legacy clear date, attempts and accumulated wins survive migration',async()=>{
    const p=await progress(veteran);
    assert.equal(p.normal_wins,730);assert.equal(p.boss_attempts,2);assert.equal(p.boss_victories,1);
    assert.equal(new Date(p.first_boss_cleared_at).toISOString(),'2026-08-01T00:00:00.000Z');
    assert.equal(p.boss_ready,true);
  });
  await test('every ground item is ground-only; enemy materials are exclusive; bosses inherit their chapter only',async()=>{
    const allDrops=catalog.sites.flatMap(s=>s.loot.map(l=>({...l,site:s.id})));
    for(const site of catalog.sites){
      const ground=site.loot.filter(x=>x.source==='scavenge');
      assert.equal(ground.length,3);
      for(const item of ground)assert(allDrops.filter(x=>x.id===item.id).every(x=>x.source==='scavenge'));
      const boss=new Set(site.loot.filter(x=>x.enemy===site.boss_name).map(x=>x.id));
      for(const enemy of site.enemy_names){
        const drops=site.loot.filter(x=>x.enemy===enemy);
        assert.equal(drops.length,4);
        for(const drop of drops){
          assert(boss.has(drop.id),`${site.id}/${enemy}/${drop.id} missing from boss`);
          assert(allDrops.filter(x=>x.id===drop.id).every(x=>x.site===site.id&&[enemy,site.boss_name].includes(x.enemy)));
        }
        const gearDrops=drops.filter(x=>catalog.items.find(i=>i.id===x.id).kind==='equipment');
        assert.equal(gearDrops.length,2);
        assert(gearDrops.every(x=>x.chance===0.002));
      }
      const legendary=catalog.items.filter(x=>x.acquisition?.site===site.id&&x.rarity==='전설');
      assert.equal(legendary.length,2);
      for(const item of legendary)assert(allDrops.filter(x=>x.id===item.id).every(x=>x.enemy===site.boss_name));
    }
  });
  await test('all recipe inputs exist; all new materials have a manufacturing use; no negative margins',async()=>{
    const items=new Map(catalog.items.map(x=>[x.id,x]));
    const inputs=new Set(catalog.recipes.flatMap(r=>Object.keys(r.inputs)));
    for(const item of catalog.items)if(item.kind==='material'&&item.id!=='강화석')assert(inputs.has(item.id),item.id);
    for(const recipe of catalog.recipes){
      let cost=0;
      for(const [id,qty] of Object.entries(recipe.inputs)){assert(items.has(id),id);assert(qty>0);cost+=items.get(id).sale_gold*qty;}
      // Existing recipes are included: repricing must not quietly make them a loss.
      assert(recipe.sale_gold>=cost,`${recipe.id}: ${cost} → ${recipe.sale_gold}`);
    }
  });
  await test('ground probability follows 45/35/20 weights in 30,000 actual SQL rolls',async()=>{
    const counts=await rows(`with rolls as materialized(select game_roll_ground_item($1::jsonb)->>'id' item from generate_series(1,30000)) select item,count(*) n from rolls group by item`,[JSON.stringify(catalog.sites[0].loot)]);
    for(const [i,item] of catalog.sites[0].loot.filter(x=>x.source==='scavenge').entries()){
      const n=counts.find(x=>x.item===item.id)?.n||0;
      assert(Math.abs(n/30000-[0.45,0.35,0.20][i])<0.015,JSON.stringify(counts));
    }
  });
  await test('boss legendary marginal odds and one-item limit in 60,000 SQL kills',async()=>{
    const site=catalog.sites[0];
    const counts=await rows(`with rolls as materialized(select game_roll_campaign_drops($1::jsonb,$2,0) drops from generate_series(1,60000)) select d.key,count(*) n from rolls cross join lateral jsonb_each(drops) d group by d.key`,[JSON.stringify(site.loot),site.boss_name]);
    for(const item of catalog.items.filter(x=>x.acquisition?.site===site.id&&x.rarity==='전설')){
      const n=counts.find(x=>x.key===item.id)?.n||0;
      assert(n>330&&n<570,`${item.id}: ${n}/60000`);
    }
    const legendIds=catalog.items.filter(x=>x.rarity==='전설').map(x=>x.id);
    const overlap=await one(`with rolls as materialized(select game_roll_campaign_drops($1::jsonb,$2,0.2) drops from generate_series(1,12000)) select count(*) n from rolls where (select count(*) from jsonb_object_keys(drops) k where k=any($3::text[]))>1`,[JSON.stringify(site.loot),site.boss_name,legendIds]);
    assert.equal(overlap.n,0);
  });
  await test('ordinary enemy rolls never produce ground or boss-only items',async()=>{
    for(const site of catalog.sites)for(const enemy of site.enemy_names){
      const allowed=new Set(site.loot.filter(x=>x.source==='kill'&&[enemy,'*'].includes(x.enemy)).map(x=>x.id));
      const actual=await rows(`with rolls as materialized(select game_roll_campaign_drops($1::jsonb,$2,0.2) drops from generate_series(1,1000)) select distinct key from rolls cross join lateral jsonb_each(drops)`,[JSON.stringify(site.loot),enemy]);
      for(const row of actual)assert(allowed.has(row.key),`${enemy} dropped ${row.key}`);
    }
  });
  await test('boss odds are zero before unlock and 1.5% per encounter after unlock',async()=>{
    const locked=await one('select count(*) filter(where game_boss_encounter_roll(false,0.015)) n from generate_series(1,10000)');assert.equal(locked.n,0);
    const unlocked=await one('select count(*) filter(where game_boss_encounter_roll(true,0.015)) n from generate_series(1,100000)');assert(unlocked.n>1300&&unlocked.n<1700,JSON.stringify(unlocked));
    assert.equal((await one("select to_regprocedure('game_request_boss(uuid)') request")).request,null);
  });
  await test('full material cargo preserves rare equipment and reports only actual awards',async()=>{
    const f=await fixture(),site=catalog.sites[0],material=site.loot.find(x=>x.source==='scavenge').id;
    const legend=catalog.items.find(x=>x.rarity==='전설'&&x.acquisition.site===site.id).id;
    await db.query('update game_expeditions set pending_loot=$2::jsonb where id=$1',[f.expedition,JSON.stringify({[material]:3000})]);
    const award=(await one('select game_award_campaign_drops($1,$2::jsonb) receipt',[f.expedition,JSON.stringify({[material]:5,[legend]:1})])).receipt;
    assert.deepEqual(award,{[legend]:1});
    assert.deepEqual((await state(f)).pending_loot,{[material]:3000,[legend]:1});
    const collected=(await one('select game_collect_loot($1,$2) receipt',[f.player,f.expedition])).receipt;
    assert.equal(collected[legend],1);assert.deepEqual((await state(f)).pending_loot,{});
    const empty=(await one('select game_collect_loot($1,$2) receipt',[f.player,f.expedition])).receipt;
    assert.deepEqual(empty,{},'collection cannot duplicate rare gear');
    const privilege=await one("select has_function_privilege('authenticated','game_add_pending_loot(uuid,text,integer)','EXECUTE') allowed");
    assert.equal(privilege.allowed,false);
    await db.query('update game_expeditions set pending_loot=$2::jsonb where id=$1',[f.expedition,JSON.stringify({[material]:3000})]);
    let cappedFind=false;
    for(let i=0;i<1000;i++){
      const event=await action(f);
      if(event.type==='encounter')await setBattle(f,{active:false});
      if(event.type==='explore'){
        assert.equal(event.loot||0,0);assert.deepEqual(event.drops||{},{});
        if(event.event.includes('적재 한도')){cappedFind=true;break;}
      }
    }
    assert(cappedFind,'full-cargo ground discovery is reported accurately');
  });
  await test('500 completed normal battles unlock bosses; a random encounter uses the actual boss profile',async()=>{
    const f=await fixture();
    await db.query('update game_stage_progress set normal_battles=499,normal_wins=499 where player_id=$1',[f.player]);
    let encounter;
    for(let i=0;i<60;i++){encounter=await action(f);if(encounter.type==='encounter')break;}
    assert.equal(encounter.type,'encounter');assert.equal(encounter.boss,false);
    await setBattle(f,{enemyHp:1,enemyEvade:0,turn:'party'});await action(f);
    assert.equal((await progress(f)).normal_battles,500);assert.equal((await progress(f)).boss_ready,true);
    encounter=await encounterBoss(f);
    assert.equal(encounter.boss,true);assert.equal(encounter.enemy,catalog.sites[0].boss_name);
    const s=await state(f);assert.equal(s.battle_state.enemyMaxHp,480);assert.equal(s.battle_state.enemySkill.name,'야간 순찰 총력전');
    assert.equal((await progress(f)).boss_attempts,1);
  });
  await test('boss victory keeps encounters unlocked and records clears; dead allies receive no XP',async()=>{
    const f=await fixture();await ready(f);await encounterBoss(f);
    const s=await state(f),hp=s.battle_state.partyHp;hp[f.monsters[0]]=0;
    const deadBefore=await one('select xp,kills from game_monsters where id=$1',[f.monsters[0]]);
    await setBattle(f,{enemyHp:1,enemyEvade:0,turn:'party',partyHp:hp});
    const result=await action(f);assert.equal(result.result,'win');assert.equal(typeof result.drops,'object');
    const p=await progress(f);assert.equal(p.boss_victories,1);assert.equal(p.boss_attempts,1);assert.equal(p.normal_wins,1000);assert.equal(p.normal_battles,1000);assert.equal(p.boss_ready,true);assert.equal(p.boss_history[0].result,'win');assert(p.first_boss_cleared_at);
    assert.deepEqual(await one('select xp,kills from game_monsters where id=$1',[f.monsters[0]]),deadBefore);
    assert.equal((await state(f)).battle_state.partyHp[f.monsters[0]],0);
    assert.equal((await encounterBoss(f)).boss,true);
  });
  await test('enemy healing skill fires on its specified turn and is included in combat log',async()=>{
    const f=await fixture('grand_castle',39);await ready(f);await encounterBoss(f);
    const s=await state(f),max=s.battle_state.enemyMaxHp;
    await setBattle(f,{enemyHp:max-200,turn:'enemy',round:3,enemyAtk:1});
    const event=await action(f),after=await state(f);
    assert.equal(event.enemySkill,'성주의 비상 동원령');assert.equal(event.enemyHealing,Math.round(max*0.05));
    assert.equal(after.battle_state.enemyHp,max-200+Math.round(max*0.05));
    assert(after.event_state.text.includes('성주의 비상 동원령'));
  });
  await test('boss defeat preserves qualification and records loss without double counting attempts',async()=>{
    const f=await fixture();await ready(f);await encounterBoss(f);
    const hp=Object.fromEntries(f.monsters.map((m,i)=>[m,i===0?1:0]));
    await setBattle(f,{partyHp:hp,enemyAtk:10000,turn:'enemy'});
    let event;
    for(let i=0;i<20;i++){await setBattle(f,{turn:'enemy'});event=await action(f);if(event.result==='loss')break;}
    assert.equal(event.result,'loss');
    const p=await progress(f);assert.equal(p.normal_wins,1000);assert.equal(p.boss_ready,true);assert.equal(p.boss_attempts,1);assert.equal(p.boss_last_result,'loss');assert.equal(p.boss_history[0].result,'loss');
    assert.equal((await state(f)).active,false);
  });
  await test('the 500th normal loss counts as completed combat; merely encountering a foe does not',async()=>{
    const f=await fixture();
    await db.query('update game_stage_progress set normal_battles=499 where player_id=$1',[f.player]);
    let event;
    for(let i=0;i<60;i++){event=await action(f);if(event.type==='encounter')break;}
    assert.equal(event.boss,false);assert.equal((await progress(f)).normal_battles,499);
    await setBattle(f,{partyHp:Object.fromEntries(f.monsters.map((m,i)=>[m,i===0?1:0])),enemyAtk:10000,turn:'enemy'});
    for(let i=0;i<20;i++){await setBattle(f,{turn:'enemy'});event=await action(f);if(event.result==='loss')break;}
    assert.equal(event.result,'loss');
    const p=await progress(f);assert.equal(p.normal_battles,500);assert.equal(p.normal_wins,0);assert.equal(p.boss_ready,true);
  });
  await test('internal mutating loot functions are not exposed to player roles',async()=>{
    const permissions=await one(`select has_function_privilege('anon','game_award_campaign_drops(uuid,jsonb)','execute') anon,has_function_privilege('authenticated','game_award_campaign_drops(uuid,jsonb)','execute') player`);
    assert.deepEqual(permissions,{anon:false,player:false});
  });
  await test('company bootstrap is atomic and idempotent with immediate support choices',async()=>{
    const player=randomUUID();
    await db.query('insert into auth.users(id) values($1)',[player]);
    await db.query('select game_initialize_company($1)',[player]);
    await db.query('select game_initialize_company($1)',[player]);
    assert.equal((await one('select count(*) n from game_monsters where player_id=$1',[player])).n,1);
    assert.deepEqual((await rows('select family from game_candidates where player_id=$1 order by family',[player])).map(x=>x.family),['golem','imp','mandrake']);
    assert.equal((await one('select gold from game_players where device_id=$1',[player])).gold,680);
    await db.query('delete from game_candidates where player_id=$1',[player]);
    await db.query('select game_initialize_company($1)',[player]);
    assert.equal((await one('select count(*) n from game_candidates where player_id=$1',[player])).n,0);
    const interruptedPlayer=randomUUID();
    await db.query('insert into auth.users(id) values($1)',[interruptedPlayer]);
    await db.exec("alter table game_candidates add constraint simulation_candidate_failure check (family<>'imp') not valid");
    await assert.rejects(db.query('select game_initialize_company($1)',[interruptedPlayer]),/simulation_candidate_failure/);
    assert.equal((await one('select count(*) n from game_players where device_id=$1',[interruptedPlayer])).n,0);
    assert.equal((await one('select count(*) n from game_monsters where player_id=$1',[interruptedPlayer])).n,0);
    await db.exec('alter table game_candidates drop constraint simulation_candidate_failure');
  });
  await test('candidate refresh reaches all 9 species and guarantees support roles without replacing locks',async()=>{
    const player=randomUUID();await db.query('insert into auth.users(id) values($1)',[player]);await db.query('select game_initialize_company($1)',[player]);
    const seen=new Set();
    for(let i=0;i<40;i++){
      await db.query("update game_players set next_candidate_at=now()-interval '1 second' where device_id=$1",[player]);
      await db.query('select game_spawn_candidates()');
      const candidates=await rows('select * from game_candidates where player_id=$1',[player]);
      assert.equal(candidates.length,4);
      assert(candidates.some(c=>['mandrake','pixie'].includes(c.family)));
      assert(candidates.some(c=>['golem','mimic'].includes(c.family)));
      candidates.forEach(c=>seen.add(c.family));
    }
    assert.equal(seen.size,9);
    const locked=await one('select * from game_candidates where player_id=$1 limit 1',[player]);
    await db.query('update game_candidates set is_locked=true where id=$1',[locked.id]);
    await db.query("update game_players set next_candidate_at=now()-interval '1 second' where device_id=$1",[player]);await db.query('select game_spawn_candidates()');
    assert.equal((await one('select is_locked from game_candidates where id=$1',[locked.id])).is_locked,true);
  });
  await test('hired stats and personality match candidate preview for every species',async()=>{
    for(const template of roster){
      const player=randomUUID(),candidate=randomUUID();
      await db.query('insert into auth.users(id) values($1)',[player]);await db.query('insert into game_players(device_id) values($1)',[player]);
      await db.query(`insert into game_candidates(id,player_id,name,family,talent,trait,power_base,personality,growth_grade,hp_base,atk_base,def_base,spd_base,crit_base,evade_base)
        values($1,$2,$3,$3,90,'재빠름',60,'침착','A',201,31,19,16,0.08,0.07)`,[candidate,player,template.family]);
      const hired=(await one('select game_hire_candidate($1,$2) result',[player,candidate])).result;
      const m=await one('select * from game_monsters where id=$1',[hired.monsterId]);
      assert.equal(m.hp_base,201);assert.equal(m.atk_base,31);assert.equal(m.def_base,19);assert.equal(m.spd_base,16);assert.equal(m.personality,'침착');assert.equal(m.growth_grade,'A');assert.equal(m.skill_id,template.skill);
    }
  });
  console.log(`${passed} campaign checks passed. Balance and browser acceptance are separate gates.`);
}catch(error){console.error('FAIL',error.message);console.error(error.stack);process.exitCode=1;}
finally{await db.close();}
