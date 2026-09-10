import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chapters,rules} from '../content/campaign-v015.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const baseline=JSON.parse(readFileSync(root+'docs/system-baseline-v0142.json','utf8'));
const items=new Map(baseline.items.map(x=>[x.id,{...x}]));
const recipes=[...baseline.recipes];
const sites=[];
function item(id,patch){
  const defaults={id,kind:'material',slot:null,rarity:'재료',hp:0,atk:0,def:0,spd:0,crit:0,evade:0,human_damage:0,sale_gold:0,sell_seconds:0,description:''};
  const previous=items.get(id)||defaults;
  items.set(id,{...previous,...patch});
}
chapters.forEach((c,index)=>{
  const chapter=index+1,loot=[];
  c.ground.forEach((id,i)=>{
    const price=2+index*3+i;
    item(id,{sale_gold:price,sell_seconds:Math.ceil(price*2.5),art_key:'ground-'+c.art+'-'+i,acquisition:{site:c.id,source:'scavenge'},description:`${c.name}의 바닥 수색에서만 발견됩니다. 가공하거나 상점에서 판매할 수 있습니다.`});
    loot.push({id,source:'scavenge',chance:rules.groundWeights[i],min:1,max:1});
  });
  const defineGear=(g,enemy,legendary=false)=>{
    item(g.id,{kind:'equipment',slot:g.slot,rarity:legendary?'전설':chapter<=2?'고급':chapter<=4?'희귀':'영웅',hp:0,atk:0,def:0,spd:0,crit:0,evade:0,human_damage:0,...g,sale_gold:0,sell_seconds:0,art_key:`${g.slot}-${c.art}-${legendary?'legendary':c.enemies.findIndex(e=>e.name===enemy)}`,acquisition:{site:c.id,source:'kill',enemy,bossExclusive:legendary}});
  };
  c.enemies.forEach((e,j)=>{
    e.materials.forEach((id,k)=>{
      const price=3+index*4+k*2;
      item(id,{sale_gold:price,sell_seconds:Math.ceil(price*2.5),art_key:`material-${c.art}-${j}-${k}`,acquisition:{site:c.id,source:'kill',enemy:e.name,boss:c.boss.name},description:`${e.name} 전용 전리품. ${c.boss.name}도 보유할 수 있습니다. 제작소에서 회사 상품으로 가공합니다.`});
      loot.push({id,source:'kill',enemy:e.name,chance:k===0?0.55:0.18,min:1,max:k===0?2:1});
    });
    for(const g of [e.equipment,c.extraGear[j]]){
      defineGear(g,e.name);
      loot.push({id:g.id,source:'kill',enemy:e.name,chance:rules.normalEquipmentChance/2,min:1,max:1});
    }
  });
  // Explicit boss rows are the union of this chapter's enemy drops. They never
  // include scavenge rows. One row per item means no accidental duplicate rolls.
  for(const row of loot.filter(x=>x.source==='kill')){
    const equipment=items.get(row.id).kind==='equipment';
    loot.push({...row,enemy:c.boss.name,chance:equipment?rules.bossEquipmentChance:row.chance*0.8,max:equipment?1:2});
  }
  c.legendary.forEach(g=>{
    defineGear(g,c.boss.name,true);
    loot.push({id:g.id,source:'kill',enemy:c.boss.name,chance:rules.bossLegendaryChance/c.legendary.length,min:1,max:1,pool:'legendary'});
  });
  loot.push({id:'강화석',source:'kill',enemy:'*',chance:0.07+index*0.015,min:1,max:1});
  loot.push({id:'강화석',source:'kill',enemy:c.boss.name,chance:0.55,min:1,max:2+Math.floor(index/2)});
  const profiles=Object.fromEntries([...c.enemies,c.boss].map(e=>[e.name,{
    role:e.role,hp:e.hp,atk:e.atk,def:e.def,spd:e.spd,crit:e.crit,evade:e.evade,
    skill:e.skill,counter:e.counter,art:e.art,
  }]));
  sites.push({id:c.id,name:c.name,description:c.description,unlock_order:chapter,recommended_power:c.power,battle_seconds:2,xp_per_kill:c.xp,gold_per_kill:0,enemy_names:c.enemies.map(e=>e.name),loot,boss_name:c.boss.name,boss_power:c.bossPower,
    chapter:{version:rules.contentVersion,subtitle:c.subtitle,objective:c.objective,level:c.level,bossGate:rules.bossUnlockBattles,bossChance:rules.bossEncounterChance,color:c.color,art:c.art,search:c.search,move:c.move,profiles,dropRules:rules}});
  // All 8 enemy materials are useful; each recipe consumes that enemy's two
  // materials plus one ground item. Existing recipes remain craftable.
  c.enemies.forEach((e,j)=>{
    const inputs={[c.ground[j%3]]:2,[e.materials[0]]:3,[e.materials[1]]:1};
    const rawValue=Object.entries(inputs).reduce((v,[id,q])=>v+items.get(id).sale_gold*q,0);
    const value=Math.round(rawValue*1.8);
    recipes.push({id:`campaign_${c.id}_${j+1}`,output_item:c.products[j],output_qty:1,inputs,sale_gold:value,craft_seconds:Math.ceil(value*(2.7-index*0.18)),sell_seconds:Math.ceil(value*(2.4-index*0.2)),workshop_level:Math.max(1,Math.ceil(chapter/2)),sort_order:100+chapter*10+j});
  });
});
item('강화석',{art_key:'enhancement-stone',acquisition:{source:'kill',enemy:'*'},description:'적 처치에서만 나오는 장비 강화 재료. 대장간에서 사용합니다.'});
const catalog={version:15,sites,items:[...items.values()],recipes};
const quote=v=>v===null?'null':typeof v==='number'?String(v):`'${(typeof v==='object'?JSON.stringify(v):String(v)).replaceAll("'","''")}'`;
function upsert(table,rows){
  return rows.map(row=>{
    const keys=Object.keys(row);
    return `insert into public.${table} (${keys.map(k=>`"${k}"`).join(',')}) values (${keys.map(k=>Array.isArray(row[k])&&k==='enemy_names'?`ARRAY[${row[k].map(quote).join(',')}]::text[]`:quote(row[k])).join(',')}) on conflict (id) do update set ${keys.filter(k=>k!=='id').map(k=>`"${k}"=excluded."${k}"`).join(',')};`;
  }).join('\n');
}
const sql=`-- Generated by node tools/build-campaign.mjs from content/campaign-v015.mjs.
-- Preserve all existing inventory references, recipes and player progression.
alter table public.game_hunt_sites add column if not exists chapter jsonb not null default '{}'::jsonb;
alter table public.game_item_defs add column if not exists acquisition jsonb not null default '{}'::jsonb;
alter table public.game_item_defs add column if not exists art_key text;
${upsert('game_item_defs',catalog.items)}
${upsert('game_hunt_sites',catalog.sites)}
${upsert('game_recipes',catalog.recipes)}
`;
const migration=readdirSync(root+'supabase/migrations').filter(x=>x.endsWith('_v015_campaign_content.sql'));
if(migration.length!==1)throw new Error('Create exactly one v015_campaign_content migration with the Supabase CLI first.');
writeFileSync(root+'supabase/migrations/'+migration[0],sql);
writeFileSync(root+'content/campaign-v015.json',JSON.stringify(catalog,null,2)+'\n');
console.log(`${sites.length} chapters, ${catalog.items.length} item definitions, ${recipes.length} recipes → ${migration[0]}`);
