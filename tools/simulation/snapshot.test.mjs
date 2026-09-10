import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createDatabase,root} from './database.mjs';
const db=await createDatabase(),one=async(q,v=[])=>(await db.query(q,v)).rows[0];
try{
 for(const key of ['_v015_','_v016_idle_company','_v0161_','_v017_'])for(const f of readdirSync(root+'supabase/migrations').filter(f=>f.includes(key)).sort())await db.exec(readFileSync(root+'supabase/migrations/'+f,'utf8'));
 await db.exec('set check_function_bodies=on');
 const p=randomUUID(),q=randomUUID();for(const id of [p,q]){await db.query('insert into auth.users(id) values($1)',[id]);await db.query('select game_initialize_company($1)',[id]);}
 const full=(await one('select game_client_state($1,true) s',[p])).s,lite=(await one('select game_client_state($1,false) s',[p])).s;
 assert.equal(full.itemDefs.length,206);assert(full.recipes.length);assert.equal(full.sites.length,5);assert.equal(full.player.device_id,p);assert.equal(lite.itemDefs,undefined);
 for(const key of ['monsters','candidates','inventory','equipment','expeditionMembers','stageProgress','craftJobs','sellJobs','expeditions']){assert.deepEqual(full[key],lite[key],key);assert(full[key].every(x=>x.player_id===p),key+' ownership');}
 assert(!JSON.stringify(full).includes(q));assert(full.defense);assert.equal(lite.player.gold,0);
 for(const role of ['anon','authenticated'])assert.equal((await one("select has_function_privilege($1,'game_client_state(uuid,boolean)','EXECUTE') allowed",[role])).allowed,false);
 assert.equal((await one("select has_function_privilege('service_role','game_client_state(uuid,boolean)','EXECUTE') allowed")).allowed,true);
 await db.exec('set role authenticated');await assert.rejects(db.query('select game_client_state($1,true)',[q]),/permission denied/);await db.exec('reset role');
 console.log('PASS full/lite snapshot, player isolation, default state, browser RPC denial');
}finally{await db.close()}
