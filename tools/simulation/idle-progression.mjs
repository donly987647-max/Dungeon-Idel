// Continuous, zero-gold bootstrap. All combat, time, injury, promotion,
// evolution, loot, automatic gear and economy use the production SQL.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {idleDatabase,newCompany,newExpedition,root} from './idle-db.mjs';
const db=await idleDatabase(),one=async(q,v=[])=>(await db.query(q,v)).rows[0];
const seeds=(process.env.IDLE_SEEDS||'.217,.641').split(',').map(Number),maxActions=Number(process.env.IDLE_ACTIONS||24000),reports=[];
try{
 await db.exec(`create function qa_idle_steps(p_exp uuid,p_n integer,p_active boolean) returns jsonb language plpgsql as $$
 declare i integer;r jsonb;e game_expeditions%rowtype;wins integer:=0;losses integer:=0;
 begin
  for i in 1..p_n loop
   r:=game_process_expedition_action(p_exp);
   update game_expeditions set last_tick_at=last_tick_at+interval '2 seconds' where id=p_exp returning * into e;
   if r->>'result'='loss' then losses:=losses+1;elsif r->>'result'='win' then wins:=wins+1;end if;
   if p_active then
    perform game_collect_loot(e.player_id,null);perform game_finish_idle_jobs(e.player_id,e.last_tick_at);
    if not coalesce((e.battle_state->>'active')::boolean,false) then perform game_auto_equip(p_exp);end if;
   end if;
  end loop;
  return jsonb_build_object('wins',wins,'losses',losses);
 end $$;`);
 for(const seed of seeds)for(const mode of ['idle','frequent']){
  await db.query('select setseed($1)',[seed]);
  const p=await newCompany(db,{hires:['mandrake','imp']}),f=await newExpedition(db,p);
  assert.equal((await one('select gold from game_players where device_id=$1',[p])).gold,0);
  let actions=0,wins=0,losses=0,checkpoints=[];
  for(;actions<maxActions;){
   const n=Math.min(500,maxActions-actions),r=(await one('select qa_idle_steps($1,$2,$3) r',[f.e,n,mode==='frequent'])).r;actions+=n;wins+=r.wins;losses+=r.losses;
   // PGlite has no autovacuum worker. Reclaim dead tuples without changing game state.
   await db.exec('vacuum');
   const cleared=Number((await one('select count(*) n from game_stage_progress where player_id=$1 and boss_cleared',[p])).n);
   if(cleared>checkpoints.length){checkpoints.push({chapter:cleared,actions});console.log(JSON.stringify({seed,mode,cleared,actions,wins,losses}));}
   if(actions%10000===0)console.log(JSON.stringify({seed,mode,actions,wins,losses,cleared}));
  }
  const player=await one('select gold,workshop_level,storage_level,idle_receipt from game_players where device_id=$1',[p]);
  const monsters=(await db.query('select family,level,xp,form_id,growth_grade,service_points from game_monsters where player_id=$1 order by family',[p])).rows;
  const equipment=(await db.query('select item_id,slot from game_monster_equipment where player_id=$1 order by item_id',[p])).rows;
  const report={seed,mode,actions,hours:actions/1800,wins,losses,checkpoints,player,monsters,equipment};reports.push(report);console.log(JSON.stringify(report));
  assert(checkpoints.length===5,`seed ${seed} ${mode} cleared only ${checkpoints.length}/5 chapters`);
  assert(monsters.every(m=>m.form_id!==m.family&&m.growth_grade==='S'));
 }
 for(const seed of seeds){const a=reports.find(r=>r.seed===seed&&r.mode==='idle'),b=reports.find(r=>r.seed===seed&&r.mode==='frequent');
  assert(Math.abs(a.wins-b.wins)/Math.max(1,b.wins)<.15,'frequent interactions must not create a large combat advantage');
  const ga=Number(a.player.idle_receipt.gold||0),gb=Number(b.player.idle_receipt.gold||0);assert(Math.abs(ga-gb)/Math.max(1,gb)<.15,'frequent collection/completion must not create a large gold advantage');
 }
}catch(e){console.error(e.message,e.where||'',e.detail||'');process.exitCode=1;}finally{
 mkdirSync(root+'tools/simulation/results',{recursive:true});
 const hash=p=>createHash('sha256').update(readFileSync(root+p)).digest('hex');
 writeFileSync(root+'tools/simulation/results/idle-progression'+(process.env.IDLE_REPORT_SUFFIX||'')+'.json',JSON.stringify({at:new Date().toISOString(),sources:{catalog:hash('content/campaign-v016.json'),runtime:hash('supabase/gameplay/idle-runtime.sql'),economy:hash('supabase/gameplay/idle-economy.sql')},notes:'Synthetic new companies start at 0G, hire two free supports, deploy once; no recalls, stat grants, gear grants, XP grants, forced wins or boss rolls. Server action clock advances 2 seconds. Frequent mode additionally collects and finishes jobs every action and equips between battles. This measures polling/collection attention, not all possible optimized party/recipe strategies. Equal fixed action budgets per seed.',reports},null,2));await db.close();
}
