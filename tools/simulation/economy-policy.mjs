// An explicit synthetic player's policy, using real inventory, jobs and money.
// Only the job clock is advanced; statuses and rewards are computed by SQL.
export function economyPolicy(db,player,catalog){
 const rows=async(q,v=[])=>(await db.query(q,v)).rows;
 const one=async(q,v=[])=>(await rows(q,v))[0];
 const totals={goldEarned:0,crafted:0,sold:0,rawSold:0,upgrades:[],blockedCollections:0};
 const inventory=async()=>new Map((await rows('select item_id,qty from game_inventory where player_id=$1',[player])).map(r=>[r.item_id,r.qty]));
 const count=async table=>(await one(`select count(*) n from ${table} where player_id=$1 and status in ('running','queued')`,[player])).n;
 async function manage(seconds,chapter){
  for(const table of ['game_craft_jobs','game_sell_jobs'])await db.query(`update ${table} set started_at=started_at-make_interval(secs=>$2),finish_at=finish_at-make_interval(secs=>$2) where player_id=$1 and status in ('running','queued')`,[player,seconds]);
  await db.exec('select game_process_economy()');
  for(const job of await rows("select id from game_sell_jobs where player_id=$1 and status='ready'",[player]))totals.goldEarned+=(await one('select game_claim_sell($1) receipt',[job.id])).receipt.gold;
  let p=await one('select * from game_players where device_id=$1',[player]),inv=await inventory();
  const pending=await rows("select distinct l.key item from game_expeditions e cross join lateral jsonb_each_text(e.pending_loot) l where e.player_id=$1 and l.value::bigint>0",[player]);
  const needed=inv.size+pending.filter(x=>!inv.has(x.item)).length;
  const capacity=(await one('select game_storage_capacity($1) n',[player])).n;
  for(const [facility,wanted] of [['quarters',2],['storage',needed>capacity||inv.size>=capacity-6?Math.min(5,p.storage_level+1):p.storage_level],['workshop',Math.ceil(chapter/2)]]){
   const level=p[facility+'_level'],base={quarters:900,storage:1200,workshop:1600}[facility];
   if(level<wanted&&p.gold>=base*3**(level-1)){
    const upgrade=(await one('select game_upgrade_facility($1,$2,$3) receipt',[player,facility,level])).receipt;
    totals.upgrades.push({...upgrade,chapter});p=await one('select * from game_players where device_id=$1',[player]);
   }
  }
  try{await db.query('select game_collect_loot($1)',[player])}catch(e){if(!e.message.includes('storage_full'))throw e;totals.blockedCollections++;}
  // Move existing sale products out of storage before claiming new products.
  async function sellProducts(){
   const stock=await inventory();
   for(const r of catalog.recipes){
    const qty=stock.get(r.output_item)||0;
    if(qty&&await count('game_sell_jobs')<p.shop_level+4){await db.query('select game_start_sell($1,$2,$3)',[player,r.output_item,qty]);totals.sold+=qty;}
   }
  }
  await sellProducts();
  for(const j of await rows("select id from game_craft_jobs where player_id=$1 and status='ready'",[player])){
   try{totals.crafted+=(await one('select game_claim_craft($1) receipt',[j.id])).receipt.quantity}catch(e){if(!e.message.includes('storage_full'))throw e;}
  }
  await sellProducts();
  // Manufacture the best available recipe, using only collected ingredients.
  const recipes=[...catalog.recipes].filter(r=>r.workshop_level<=p.workshop_level).sort((a,b)=>b.sale_gold-a.sale_gold);
  for(const r of recipes){
   if(await count('game_craft_jobs')>=p.workshop_level+4)break;
   const stock=await inventory(),qty=Math.min(10,...Object.entries(r.inputs).map(([id,n])=>Math.floor((stock.get(id)||0)/n)));
   if(qty>0)await db.query('select game_start_craft($1,$2,$3)',[player,r.id,qty]);
  }
  inv=await inventory();
  if(inv.size>=34&&await count('game_sell_jobs')<p.shop_level+4){
   const candidates=catalog.items.filter(i=>i.kind==='material'&&i.sale_gold>0&&inv.has(i.id)).sort((a,b)=>inv.get(b.id)-inv.get(a.id));
   if(candidates[0]){const item=candidates[0];totals.rawSold+=inv.get(item.id);await db.query('select game_start_sell($1,$2,$3)',[player,item.id,inv.get(item.id)]);}
  }
  return {...totals,gold:p.gold,workshop:p.workshop_level,storage:p.storage_level,inventoryTypes:(await inventory()).size};
 }
 return {manage,totals};
}
