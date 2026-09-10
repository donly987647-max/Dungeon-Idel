import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createDatabase,root} from './database.mjs';
export {root};
export const catalog=JSON.parse(readFileSync(root+'content/campaign-v016.json'));
export async function idleDatabase(){
 const db=await createDatabase();
 for(const f of readdirSync(root+'supabase/migrations').filter(f=>f.includes('_v015_')||f.endsWith('_v016_idle_company.sql')).sort())await db.exec(readFileSync(root+'supabase/migrations/'+f,'utf8'));
 await db.exec('set check_function_bodies=on');
 return db;
}
export async function newCompany(db,{hires=[]}={}){
 const player=randomUUID();await db.query('insert into auth.users(id) values($1)',[player]);await db.query('select game_initialize_company($1)',[player]);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[player]);
 for(const family of hires){const c=(await db.query('select id from game_candidates where player_id=$1 and family=$2',[player,family])).rows[0];await db.query('select game_hire_candidate($1,$2)',[player,c.id]);}
 return player;
}
export async function newExpedition(db,player){
 const ids=(await db.query('select id from game_monsters where player_id=$1 order by created_at,id',[player])).rows.map(m=>m.id),e=randomUUID();
 await db.query("insert into game_expeditions(id,player_id,site_id,monster_id,last_tick_at) values($1,$2,'mountain_village',$3,now())",[e,player,ids[0]]);
 for(const [i,id] of ids.entries())await db.query('insert into game_expedition_members(expedition_id,player_id,monster_id,position) values($1,$2,$3,$4)',[e,player,id,i+1]);
 return {player,e,ids};
}
