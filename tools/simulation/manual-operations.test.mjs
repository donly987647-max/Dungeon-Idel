import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createDatabase,root} from './database.mjs';
const db=await createDatabase(),one=async(q,v=[])=>(await db.query(q,v)).rows[0];
try{
 for(const key of ['_v015_','_v016_idle_company','_v0161_'])for(const f of readdirSync(root+'supabase/migrations').filter(f=>f.includes(key)).sort())await db.exec(readFileSync(root+'supabase/migrations/'+f,'utf8'));
 await db.exec('set check_function_bodies=on');
 const p=randomUUID(),q=randomUUID();
 for(const id of [p,q]){await db.query('insert into auth.users(id) values($1)',[id]);await db.query('select game_initialize_company($1)',[id]);}
 await db.query("insert into game_accounts(user_id,username) values($1,'초기화검증')",[p]);
 assert.equal((await one("select count(*) n from information_schema.columns where table_name='game_players' and column_name in ('idle_automation','auto_reinvest','auto_equip','auto_advance')")).n,0);
 assert.equal((await one("select to_regprocedure('game_set_idle_policy(uuid,jsonb)') f")).f,null);
 await db.query('update game_players set gold=100000 where device_id=$1',[p]);
 await db.query("insert into game_inventory(player_id,item_id,qty) select $1,id,100 from game_item_defs where kind<>'equipment' or id=(select min(id) from game_item_defs where kind='equipment')",[p]);
 const m=await one('select id from game_monsters where player_id=$1',[p]),e=randomUUID();
 await db.query("insert into game_expeditions(id,player_id,monster_id,site_id) values($1,$2,$3,'mountain_village')",[e,p,m.id]);
 await db.query('insert into game_expedition_members(expedition_id,player_id,monster_id,position) values($1,$2,$3,1)',[e,p,m.id]);
 for(let i=0;i<25;i++)await db.query('select game_process_expedition_action($1)',[e]);
 assert.equal((await one('select count(*) n from game_monster_equipment where player_id=$1',[p])).n,0);
 assert.equal((await one('select count(*) n from game_craft_jobs where player_id=$1',[p])).n,0);
 assert.equal((await one('select count(*) n from game_sell_jobs where player_id=$1',[p])).n,0);
 assert.deepEqual(await one('select gold,workshop_level,storage_level from game_players where device_id=$1',[p]),{gold:100000,workshop_level:1,storage_level:1});
 console.log('PASS active combat does not create craft/sale orders, equip gear or spend facility gold');
 // Exercise the wrapper decision after a boss win, independently of combat odds.
 await db.exec('begin');
 await db.exec(`create or replace function game_process_expedition_action_core(p_expedition uuid) returns jsonb language sql as $$select '{"type":"battle-end","boss":true,"result":"win"}'::jsonb$$`);
 await db.query('select game_process_expedition_action($1)',[e]);
 assert.equal((await one('select site_id from game_expeditions where id=$1',[e])).site_id,'mountain_village');
 await db.exec('rollback');
 const recipe=await one('select id,output_item from game_recipes where workshop_level=1 and sale_gold>0 limit 1');
 await db.query('select game_start_craft($1,$2,1)',[p,recipe.id]);
 await db.query("select game_finish_idle_jobs($1,now()+interval '1 day')",[p]);
 assert.equal((await one("select count(*) n from game_craft_jobs where player_id=$1 and status='done'",[p])).n,1,'manual craft completes');
 console.log('PASS boss victory stays in selected chapter; explicitly ordered work still completes');
 await db.query("insert into game_enhanced_inventory(player_id,item_id,enhance_level,qty) select $1,min(id),3,1 from game_item_defs where kind='equipment'",[p]);
 await db.query('select game_defense_snapshot($1)',[p]);
 await db.exec(readFileSync(root+'tools/reset-all-game-progress.sql','utf8'));
 assert.equal((await one('select count(*) n from auth.users')).n,2);
 assert.equal((await one('select count(*) n from game_accounts')).n,1);
 assert.equal((await one('select count(*) n from game_players')).n,2);
 assert.equal((await one('select count(*) n from game_monsters where level=1 and xp=0')).n,2);
 assert.equal((await one('select count(*) n from game_candidates')).n,6);
 assert.equal((await one('select count(*) n from game_players where gold=0 and fame=0 and storage_level=1 and workshop_level=1')).n,2);
 for(const table of ['game_inventory','game_enhanced_inventory','game_expeditions','game_expedition_members','game_monster_equipment','game_stage_progress','game_craft_jobs','game_sell_jobs','game_defense'])assert.equal((await one(`select count(*) n from ${table}`)).n,0,table);
 console.log('PASS all progress resets to one starter and three candidates; login identities preserved; no orphan enhanced items');
}catch(e){console.error(e.message);process.exitCode=1}finally{await db.close()}
