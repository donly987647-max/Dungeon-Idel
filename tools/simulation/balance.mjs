// Actual PostgreSQL combat, synthetic parties, reproducible RNG. This report is
// an initial tuning probe; it is not a substitute for full economy/progression QA.
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import vm from 'node:vm';
import {createDatabase,root,baseline} from './database.mjs';
import {roster} from '../../content/roster-v015.mjs';
const catalog=JSON.parse(readFileSync(root+'content/campaign-v015.json','utf8'));
const db=await createDatabase();
const sampleSize=Number(process.env.BALANCE_SAMPLES||30);
const q=async(sql,values=[])=>(await db.query(sql,values)).rows;
const reports=[];
// Evaluate the actual UI stat calculator and planner, with inert DOM hooks.
// Comparing only copied equations would miss drift between UI and combat SQL.
const ui={window:{},document:{addEventListener(){},querySelector(){return null}},requestAnimationFrame(){},S:{equipment:[]},
  equippedFor:id=>ui.S.equipment.filter(e=>e.monster_id===id),
  itemDef:id=>catalog.items.find(i=>i.id===id),
  growthMul:m=>({S:1.21,A:1.13,B:1.06}[m.growth_grade]||1),kstHour:()=>12};
vm.createContext(ui);
vm.runInContext(readFileSync(root+'scripts/forge-v0132.js','utf8'),ui);
vm.runInContext(readFileSync(root+'scripts/campaign-math.js','utf8'),ui);
try{
  for(const f of readdirSync(root+'supabase/migrations').filter(x=>x.includes('_v015_')).sort())await db.exec(readFileSync(root+'supabase/migrations/'+f,'utf8'));
  for(const [chapter,site] of catalog.sites.entries()){
    const target=[6,14,26,39,55][chapter];
    const families=chapter<2?['golem','mandrake','imp']:['golem','mandrake','imp','goblin'];
    for(const mode of ['early','prepared']){
      const level=mode==='early'?Math.max(1,target-8):target;
      await db.exec('begin');
      const player=randomUUID(),expedition=randomUUID(),monsterIds=[];
      await db.query('insert into auth.users(id) values($1)',[player]);
      await db.query('insert into game_players(device_id) values($1)',[player]);
      for(const family of families){
        const t=roster.find(x=>x.family===family),id=randomUUID();monsterIds.push(id);
        await db.query(`insert into game_monsters(id,player_id,name,family,form_id,level,talent,growth_grade,trait,personality,hp_base,atk_base,def_base,spd_base,crit_base,evade_base,skill_id)
          values($1,$2,$3,$3,$3,$4,86,'B','학습 본능','침착',$5,$6,$7,$8,$9,$10,$11)`,[id,player,family,level,t.hp,t.atk,t.def,t.spd,t.crit,t.evade,t.skill]);
        // Choose the defense/healing branch for specialists; exact production
        // evolution function applies all stats, skills and form transitions.
        let form=family;
        for(let tier=1;tier<=2;tier++){
          const paths=baseline.evolutions.filter(x=>x.from_form_id===form&&x.required_level<=level);
          if(!paths.length)break;
          const path=paths.sort((a,b)=>{
            const sk=x=>baseline.skills.find(s=>s.id===x.skill_id);
            const score=x=>t.role==='방어'?(sk(x)?.damage_reduction||0):t.role==='회복'?(sk(x)?.heal_ratio||0):x.atk_mult;
            return score(b)-score(a)||a.id.localeCompare(b.id);
          })[0];
          await db.query('select game_evolve_monster($1,$2,$3)',[player,id,path.id]);form=path.target_form_id;
        }
        // Prepared parties have one suitable previous-chapter equipment piece
        // each, +3. No legendary assumptions or perfect full equipment sets.
        if(mode==='prepared'&&chapter>0){
          const prior=catalog.sites[chapter-1].id;
          const pool=catalog.items.filter(x=>x.kind==='equipment'&&x.rarity!=='전설'&&x.acquisition?.site===prior);
          const score=x=>t.role==='방어'?x.def*4+x.hp/5:t.role==='회복'?x.hp/4+x.spd*4+x.def:x.atk*4+x.crit*100;
          const gear=pool.sort((a,b)=>score(b)-score(a))[0];
          await db.query('insert into game_monster_equipment(player_id,monster_id,slot,item_id,enhance_level) values($1,$2,$3,$4,3)',[player,id,gear.slot,gear.id]);
        }
      }
      await db.query('insert into game_expeditions(id,player_id,site_id,monster_id) values($1,$2,$3,$4)',[expedition,player,site.id,monsterIds[0]]);
      for(const [i,id] of monsterIds.entries())await db.query('insert into game_expedition_members(expedition_id,player_id,monster_id,position) values($1,$2,$3,$4)',[expedition,player,id,i+1]);
      await db.query('insert into game_stage_progress(player_id,site_id,normal_wins,normal_battles,boss_ready) values($1,$2,1000,1000,true)',[player,site.id]);
      await db.query("select set_config('request.jwt.claim.sub',$1,true)",[player]);
      let foundBoss=false;
      for(let tick=0;tick<5000;tick++){
        const event=(await q('select game_process_expedition_action($1) event',[expedition]))[0].event;
        if(event.type==='encounter'&&event.boss){foundBoss=true;break;}
        if(event.type==='encounter')await db.query("update game_expeditions set battle_state=battle_state||'{\"active\":false}'::jsonb where id=$1",[expedition]);
      }
      if(!foundBoss)throw new Error('No random boss encounter for '+site.id);
      ui.S.equipment=await q('select * from game_monster_equipment where player_id=$1',[player]);
      const estimateParty=(await q('select * from game_monsters where player_id=$1',[player])).map(m=>{
        const stats=ui.window.forgeStats(m);
        return {stats,hp:stats.hp,skill:baseline.skills.find(s=>s.id===m.skill_id)};
      });
      const estimate=ui.window.CampaignMath.assess(estimateParty,site.chapter.profiles[site.boss_name]);
      let wins=0,totalTurns=0,totalSurvivors=0,stalled=0;
      for(let trial=0;trial<sampleSize;trial++){
        await db.exec('savepoint trial');
        await db.query('select setseed($1)',[(trial+1)/(sampleSize+1)]);
        await db.query("update game_expeditions set battle_state=jsonb_set(battle_state,'{turn}',to_jsonb(case when random()<(battle_state->>'initiativeChance')::numeric then 'party'::text else 'enemy'::text end)) where id=$1",[expedition]);
        for(let tick=0;tick<160;tick++){
          const event=(await q('select game_process_expedition_action($1) event',[expedition]))[0].event;
          if(event.type==='battle-end'){
            if(event.result==='win')wins++;
            totalTurns+=event.round;
            totalSurvivors+=Object.values(event.partyHp).filter(h=>h>0).length;
            break;
          }
          if(tick===159)stalled++;
        }
        await db.exec('rollback to savepoint trial; release savepoint trial;');
      }
      const result={site:site.id,boss:site.boss_name,mode,level,families,samples:sampleSize,winRate:wins/sampleSize,estimate:{key:estimate.key,margin:estimate.margin,rounds:estimate.rounds},meanRounds:totalTurns/sampleSize,meanSurvivors:totalSurvivors/sampleSize,stalled};
      if(stalled||estimate.key==='good'&&result.winRate<.8)throw new Error('Planner calibration failed: '+JSON.stringify(result));
      reports.push(result);console.log(JSON.stringify(result));
      await db.exec('rollback');
    }
  }
  mkdirSync(root+'tools/simulation/results',{recursive:true});
  const hash=file=>createHash('sha256').update(readFileSync(root+file)).digest('hex');
  writeFileSync(root+'tools/simulation/results/boss-initial.json',JSON.stringify({generatedAt:new Date().toISOString(),sources:{catalog:hash('content/campaign-v015.json'),runtime:hash('supabase/gameplay/game_process_expedition_action.sql'),roster:hash('content/roster-v015.mjs'),uiStats:hash('scripts/forge-v0132.js'),uiAssessment:hash('scripts/campaign-math.js')},notes:'Synthetic full-health parties. Early=target−8, no gear. Prepared=target, one previous-chapter nonlegendary +3 piece per monster. Best matching evolution path. Does not model progression or economy.',reports},null,2)+'\n');
}catch(e){console.error(e.message);console.error(e.stack);process.exitCode=1;}
finally{await db.close();}
