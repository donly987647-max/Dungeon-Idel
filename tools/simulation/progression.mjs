// Continuous synthetic combat through the real SQL. No forced boss encounters,
// XP grants, free equipment, player telemetry, or direct HP edits.
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {createDatabase,root,baseline} from './database.mjs';
import {roster} from '../../content/roster-v015.mjs';
import {economyPolicy} from './economy-policy.mjs';
const catalog=JSON.parse(readFileSync(root+'content/campaign-v015.json','utf8'));
const db=await createDatabase();
const rows=async(sql,v=[])=>(await db.query(sql,v)).rows;
const one=async(sql,v=[])=>(await rows(sql,v))[0];
const player=randomUUID(),ids=[],reports=[];
const seed=Number(process.env.PROGRESSION_SEED||0.417);
const limit=Number(process.env.PROGRESSION_LIMIT||2500);
try{
  for(const f of readdirSync(root+'supabase/migrations').filter(x=>x.includes('_v015_')).sort())await db.exec(readFileSync(root+'supabase/migrations/'+f,'utf8'));
  await db.query('select setseed($1)',[seed]);
  await db.query('insert into auth.users(id) values($1)',[player]);
  await db.query('select game_initialize_company($1)',[player]);
  await db.query('update game_players set manual_economy_claim=true where device_id=$1',[player]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[player]);
  ids.push((await one("select id from game_monsters where player_id=$1 and family='slime'",[player])).id);
  for(const family of ['mandrake','imp']){
    const c=await one('select id from game_candidates where player_id=$1 and family=$2',[player,family]);
    ids.push((await one('select game_hire_candidate($1,$2) receipt',[player,c.id])).receipt.monsterId);
  }
  const economy=economyPolicy(db,player,catalog);
  let unmanagedActions=0;
  let expedition;
  async function recall(){
    if(expedition)await db.query('update game_expeditions set active=false where id=$1',[expedition]);
  }
  async function deploy(site){
    expedition=randomUUID();
    await db.query('insert into game_expeditions(id,player_id,site_id,monster_id) values($1,$2,$3,$4)',[expedition,player,site,ids[0]]);
    for(const [i,id] of ids.entries())await db.query('insert into game_expedition_members(expedition_id,player_id,monster_id,position) values($1,$2,$3,$4)',[expedition,player,id,i+1]);
  }
  async function evolve(){
    let count=0;
    for(const m of await rows('select * from game_monsters where player_id=$1',[player])){
      const role=roster.find(x=>x.family===m.family).role;
      const choices=baseline.evolutions.filter(x=>x.from_form_id===m.form_id&&x.required_level<=m.level);
      const score=x=>{const skill=baseline.skills.find(s=>s.id===x.skill_id);return role==='방어'?skill.damage_reduction:role==='회복'?skill.heal_ratio:x.atk_mult;};
      choices.sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id));
      if(choices[0]){await recall();await db.query('select game_evolve_monster($1,$2,$3)',[player,m.id,choices[0].id]);count++;}
    }
    return count;
  }
  for(const site of catalog.sites){
    await recall();await deploy(site.id);
    await db.query('insert into game_stage_progress(player_id,site_id) values($1,$2)',[player,site.id]);
    const report={site:site.id,normalWins:0,normalLosses:0,bossWins:0,bossLosses:0,actions:0,recalls:0,evolutions:0,firstBoss:null,gearDrops:0,legendaryDrops:0};
    const gear=new Set(catalog.items.filter(x=>x.kind==='equipment').map(x=>x.id));
    const legends=new Set(catalog.items.filter(x=>x.rarity==='전설').map(x=>x.id));
    for(let tick=0;tick<limit*30;tick++){
      const event=(await one('select game_process_expedition_action($1) event',[expedition])).event;
      report.actions++;unmanagedActions++;
      if(event.type==='encounter'&&event.boss&&!report.firstBoss){
        const p=await one('select normal_battles from game_stage_progress where player_id=$1 and site_id=$2',[player,site.id]);
        report.firstBoss={normalBattles:p.normal_battles,actions:report.actions,levels:(await rows('select level from game_monsters where id=any($1::uuid[]) order by family',[ids])).map(x=>x.level)};
      }
      for(const [item,qty] of Object.entries(event.drops||{})){if(gear.has(item))report.gearDrops+=qty;if(legends.has(item))report.legendaryDrops+=qty;}
      if(event.type!=='battle-end')continue;
      report[event.boss?(event.result==='win'?'bossWins':'bossLosses'):(event.result==='win'?'normalWins':'normalLosses')]++;
      const battles=report.normalWins+report.normalLosses;
      if(report.bossWins||battles&&battles%50===0){
        report.economy=await economy.manage(unmanagedActions*2,catalog.sites.indexOf(site)+1);unmanagedActions=0;
        if(ids.length<4&&(await one('select quarters_level from game_players where device_id=$1',[player])).quarters_level>1){
          const c=await one("select id from game_candidates where player_id=$1 and family='golem'",[player]);
          if(c){await recall();ids.push((await one('select game_hire_candidate($1,$2) receipt',[player,c.id])).receipt.monsterId);await deploy(site.id);report.recalls++;}
        }
      }
      if(report.bossWins)break;
      if(battles>=limit)break;
      const deaths=Object.values(event.partyHp||{}).some(h=>h<=0);
      const evolutions=await evolve();report.evolutions+=evolutions;
      // An attentive player recalls after a casualty or when an evolution is
      // ready. Fresh dispatch uses the same insertion path as the Edge API.
      if(deaths||evolutions){await recall();await deploy(site.id);report.recalls++;}
      if(battles&&battles%100===0){
        console.log(JSON.stringify({progress:site.id,battles,actions:report.actions,recalls:report.recalls}));
      }
    }
    report.levels=(await rows('select family,level,form_id from game_monsters where player_id=$1 order by family',[player]));
    report.combatMinutes=Number((report.actions*2/60).toFixed(1));
    reports.push(report);console.log(JSON.stringify(report));
    if(!report.bossWins)break;
  }
  mkdirSync(root+'tools/simulation/results',{recursive:true});
  const hash=p=>createHash('sha256').update(readFileSync(root+p)).digest('hex');
  writeFileSync(root+'tools/simulation/results/progression.json',JSON.stringify({seed,generatedAt:new Date().toISOString(),sources:{catalog:hash('content/campaign-v015.json'),runtime:hash('supabase/gameplay/game_process_expedition_action.sql'),economy:hash('supabase/gameplay/economy-support.sql')},notes:'Actual company bootstrap, free healer/imp hires, initial slime, and later quarters upgrade/golem hire paid from sales. No gear or enhancements equipped. Actual carry HP, random encounters, recovery, XP, evolution, collecting, crafting, selling, claims, warehouse capacity and facility payments. Management every 50 normal battles. Job deadlines shift by 2 seconds per action to advance the clock; rewards and statuses use real SQL. No user input delay or offline scheduler simulation.',reports},null,2)+'\n');
}catch(e){console.error(e);process.exitCode=1;}
finally{await db.close();}
