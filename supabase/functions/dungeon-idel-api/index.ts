import { createClient } from '@supabase/supabase-js'

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,authorization,apikey,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'}
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})
const url=Deno.env.get('SUPABASE_URL')!
const secrets=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}')
const secretKey=secrets.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db=createClient(url,secretKey,{auth:{persistSession:false,autoRefreshToken:false}})
const normUser=(v:string)=>v.trim().normalize('NFC')
const validUsername=(v:string)=>/^[가-힣]{2,12}$/u.test(v)
const validPin=(v:string)=>/^\d{4}$/.test(v)
const authPassword=(pin:string)=>`Hero!${pin}#Corp2026`
const authEmail=()=>`player-${crypto.randomUUID()}@players.dungeon-idel.game`
const facilityCost=(facility:string,lv:number)=>{const base:{[k:string]:number}={quarters:900,tavern:1800,storage:1200,workshop:1600,shop:1500};return Math.floor((base[facility]||999999)*Math.pow(3,Math.max(0,lv-1)))}
const storageCapacity=(lv:number)=>lv<=1?40:lv===2?80:lv===3?140:lv===4?220:350+Math.max(0,lv-5)*150
const quartersCapacity=(lv:number)=>3+Math.max(0,lv-1)*2
const queueCapacity=(lv:number)=>Math.max(5,Number(lv||1)+4)

async function getAuthUser(req:Request){const h=req.headers.get('authorization')||'';const token=h.toLowerCase().startsWith('bearer ')?h.slice(7).trim():'';if(!token)return null;const {data,error}=await db.auth.getUser(token);if(error||!data.user)return null;return data.user}
async function ensurePlayer(player:string){const {data:existing,error}=await db.from('game_players').select('device_id').eq('device_id',player).maybeSingle();if(error)throw error;if(existing)return;const {error:pe}=await db.from('game_players').insert({device_id:player,device_secret_hash:null});if(pe)throw pe;const {error:me}=await db.from('game_monsters').insert({player_id:player,name:'보글',family:'slime',form_id:'slime',evolution_tier:0,level:1,xp:0,talent:88,trait:'질긴 가죽',power_base:48,hp_base:145,atk_base:15,def_base:11,spd_base:9,crit_base:0.04,evade_base:0.03,personality:'침착',growth_grade:'B'});if(me)throw me}

async function state(player:string){
  await ensurePlayer(player);await db.rpc('game_tick_all')
  const [p,a,m,c,e,s,i,q,d,em,sp,r,cj,sj,ev,sk]=await Promise.all([
    db.from('game_players').select('*').eq('device_id',player).single(),
    db.from('game_accounts').select('username,created_at,last_login_at').eq('user_id',player).maybeSingle(),
    db.from('game_monsters').select('*').eq('player_id',player).order('created_at'),
    db.from('game_candidates').select('*').eq('player_id',player).order('created_at'),
    db.from('game_expeditions').select('*').eq('player_id',player).order('started_at',{ascending:false}),
    db.from('game_hunt_sites').select('*').order('unlock_order'),
    db.from('game_inventory').select('*').eq('player_id',player).order('item_id'),
    db.from('game_monster_equipment').select('*').eq('player_id',player).order('equipped_at'),
    db.from('game_item_defs').select('*').order('id'),
    db.from('game_expedition_members').select('*').eq('player_id',player).order('position'),
    db.from('game_stage_progress').select('*').eq('player_id',player),
    db.from('game_recipes').select('*').order('sort_order'),
    db.from('game_craft_jobs').select('*').eq('player_id',player).order('started_at',{ascending:false}).limit(30),
    db.from('game_sell_jobs').select('*').eq('player_id',player).order('started_at',{ascending:false}).limit(30),
    db.from('game_evolution_defs').select('*').order('tier').order('target_name'),
    db.from('game_skill_defs').select('*').order('name')
  ])
  const all=[p,a,m,c,e,s,i,q,d,em,sp,r,cj,sj,ev,sk],err=all.find(x=>x.error)?.error;if(err)throw err
  const prog=new Map((sp.data||[]).map((x:any)=>[x.site_id,x]))
  const sites=(s.data||[]).map((x:any,idx:number)=>{const prev=idx>0?(s.data||[])[idx-1]:null;const unlocked=idx===0||!!prog.get(prev?.id)?.boss_cleared;return {...x,unlocked,progress:prog.get(x.id)||{normal_wins:0,boss_ready:false,boss_cleared:false,boss_attempts:0}}})
  const pl:any=p.data
  return {account:a.data||null,player:pl,monsters:m.data||[],candidates:(c.data||[]).map((x:any)=>({...x,hire_cost:0})),expeditions:e.data||[],sites,inventory:i.data||[],equipment:q.data||[],itemDefs:d.data||[],expeditionMembers:em.data||[],stageProgress:sp.data||[],recipes:r.data||[],craftJobs:cj.data||[],sellJobs:sj.data||[],evolutionDefs:ev.data||[],skillDefs:sk.data||[],facilityCosts:{quarters:facilityCost('quarters',pl.quarters_level||1),tavern:facilityCost('tavern',pl.tavern_level||1),storage:facilityCost('storage',pl.storage_level||1),workshop:facilityCost('workshop',pl.workshop_level||1),shop:facilityCost('shop',pl.shop_level||1)},storageCapacity:storageCapacity(pl.storage_level||1),quartersCapacity:quartersCapacity(pl.quarters_level||1),craftCapacity:queueCapacity(pl.workshop_level||1),shopCapacity:queueCapacity(pl.shop_level||1),serverNow:new Date().toISOString()}
}

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});if(req.method!=='POST')return json({error:'method'},405)
 try{
  const body=await req.json().catch(()=>({}));const action=String(body.action||'state')
  if(action==='register'){
   const username=normUser(String(body.username||'')),pin=String(body.password||'');if(!validUsername(username))return json({error:'username_format'},400);if(!validPin(pin))return json({error:'password_format'},400)
   const {data:taken,error:te}=await db.from('game_accounts').select('user_id').eq('username_norm',username).maybeSingle();if(te)throw te;if(taken)return json({error:'username_taken'},409)
   const email=authEmail(),password=authPassword(pin);const {data:created,error:ce}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{username}});if(ce||!created.user)throw ce||new Error('auth_create_failed')
   const uid=created.user.id;const {error:ae}=await db.from('game_accounts').insert({user_id:uid,username});if(ae){await db.auth.admin.deleteUser(uid);throw ae}await ensurePlayer(uid)
   const {data:login,error:le}=await db.auth.signInWithPassword({email,password});if(le||!login.session)throw le||new Error('auth_login_failed');return json({ok:true,username,session:login.session})
  }
  if(action==='login'){
   const username=normUser(String(body.username||'')),pin=String(body.password||'');if(!validUsername(username)||!validPin(pin))return json({error:'invalid_credentials'},401)
   const {data:account,error:ae}=await db.from('game_accounts').select('user_id').eq('username_norm',username).maybeSingle();if(ae)throw ae;if(!account)return json({error:'invalid_credentials'},401)
   const {data:authUser,error:ue}=await db.auth.admin.getUserById(account.user_id);if(ue||!authUser.user?.email)return json({error:'invalid_credentials'},401)
   const {data:login,error:le}=await db.auth.signInWithPassword({email:authUser.user.email,password:authPassword(pin)});if(le||!login.session)return json({error:'invalid_credentials'},401)
   await db.from('game_accounts').update({last_login_at:new Date().toISOString()}).eq('user_id',account.user_id);return json({ok:true,username,session:login.session})
  }
  const user=await getAuthUser(req);if(!user)return json({error:'unauthorized'},401);const player=user.id;await ensurePlayer(player);await db.from('game_accounts').update({last_login_at:new Date().toISOString()}).eq('user_id',player)
  if(action==='state')return json({ok:true,state:await state(player)})
  if(action==='deploy'){
   const siteId=String(body.siteId||''),idsRaw=Array.isArray(body.monsterIds)?body.monsterIds:[body.monsterId],monsterIds=[...new Set(idsRaw.map((x:any)=>String(x||'')).filter(Boolean))];if(monsterIds.length<1||monsterIds.length>4)return json({error:'party_size'},400)
   const [{data:site},{data:mons},{data:activeExps}]=await Promise.all([db.from('game_hunt_sites').select('*').eq('id',siteId).maybeSingle(),db.from('game_monsters').select('*').eq('player_id',player).in('id',monsterIds),db.from('game_expeditions').select('id').eq('player_id',player).eq('active',true)])
   if(!site||!mons||mons.length!==monsterIds.length)return json({error:'invalid_target'},400)
   if(site.unlock_order>1){const {data:prev}=await db.from('game_hunt_sites').select('id').eq('unlock_order',site.unlock_order-1).maybeSingle();const {data:pr}=prev?await db.from('game_stage_progress').select('boss_cleared').eq('player_id',player).eq('site_id',prev.id).maybeSingle():{data:null} as any;if(!pr?.boss_cleared)return json({error:'locked'},400)}
   if((activeExps||[]).length){const expIds=(activeExps||[]).map((x:any)=>x.id);const {data:busy}=await db.from('game_expedition_members').select('monster_id').in('expedition_id',expIds).in('monster_id',monsterIds);if((busy||[]).length)return json({error:'monster_busy'},400)}
   const {data:exp,error:ie}=await db.from('game_expeditions').insert({player_id:player,monster_id:monsterIds[0],site_id:siteId,active:true,phase:'탐색',event_state:{type:'deploy',text:`${monsterIds.length}인 박멸조 현장 진입`,t:new Date().toISOString()}}).select('id').single();if(ie||!exp)throw ie||new Error('expedition_create')
   const {error:me}=await db.from('game_expedition_members').insert(monsterIds.map((id:string,i:number)=>({expedition_id:exp.id,player_id:player,monster_id:id,position:i+1})));if(me){await db.from('game_expeditions').delete().eq('id',exp.id);throw me}return json({ok:true,state:await state(player)})
  }
  if(action==='recall'){const id=String(body.expeditionId||'');const {error}=await db.from('game_expeditions').update({active:false,phase:'복귀',updated_at:new Date().toISOString()}).eq('id',id).eq('player_id',player);if(error)throw error;return json({ok:true,state:await state(player)})}
  if(action==='collect'){const id=body.expeditionId?String(body.expeditionId):null;const {data,error}=await db.rpc('game_collect_loot',{p_player:player,p_expedition:id});if(error){if(String(error.message||'').includes('storage_full'))return json({error:'storage_full'},400);throw error}return json({ok:true,collected:data||{},state:await state(player)})}
  if(action==='craft'){const qty=Math.max(1,Math.floor(Number(body.quantity||1)));const {error}=await db.rpc('game_start_craft',{p_player:player,p_recipe:String(body.recipeId||''),p_qty:qty});if(error){const msg=String(error.message||'');for(const code of ['recipe_missing','craft_queue_full','material_short','quantity_invalid'])if(msg.includes(code))return json({error:code},400);throw error}return json({ok:true,state:await state(player)})}
  if(action==='sell'){const qty=Math.max(1,Math.floor(Number(body.quantity||1)));const {error}=await db.rpc('game_start_sell',{p_player:player,p_item:String(body.itemId||''),p_qty:qty});if(error){const msg=String(error.message||'');for(const code of ['not_sellable','sell_queue_full','item_missing','quantity_invalid'])if(msg.includes(code))return json({error:code},400);throw error}return json({ok:true,state:await state(player)})}
  if(action==='equip'){const monsterId=String(body.monsterId||''),itemId=String(body.itemId||'');const {error}=await db.rpc('game_equip_item',{p_player:player,p_monster:monsterId,p_item:itemId});if(error){const msg=String(error.message||'');if(msg.includes('not_equipment'))return json({error:'not_equipment'},400);if(msg.includes('item_missing'))return json({error:'item_missing'},400);if(msg.includes('monster_missing'))return json({error:'invalid_target'},400);throw error}return json({ok:true,state:await state(player)})}
  if(action==='unequip'){const monsterId=String(body.monsterId||''),slot=String(body.slot||'');const {error}=await db.rpc('game_unequip_item',{p_player:player,p_monster:monsterId,p_slot:slot});if(error)throw error;return json({ok:true,state:await state(player)})}
  if(action==='evolve'){
   const monsterId=String(body.monsterId||''),evolutionId=String(body.evolutionId||'');const {data,error}=await db.rpc('game_evolve_monster',{p_player:player,p_monster:monsterId,p_evolution:evolutionId});if(error){const msg=String(error.message||'');for(const code of ['monster_missing','monster_busy','evolution_invalid','evolution_level'])if(msg.includes(code))return json({error:code},400);throw error}return json({ok:true,evolution:data||{},state:await state(player)})
  }
  if(action==='hire'){
   const id=String(body.candidateId||'');const {data,error}=await db.rpc('game_hire_candidate',{p_player:player,p_candidate:id});if(error){const msg=String(error.message||'');for(const code of ['candidate_missing','quarters_full','player_missing'])if(msg.includes(code))return json({error:code},400);throw error}return json({ok:true,hire:data||{},state:await state(player)})
  }
  if(action==='candidate-lock'){
   const id=String(body.candidateId||''),locked=body.locked===true;const {data,error}=await db.rpc('game_set_candidate_lock',{p_player:player,p_candidate:id,p_locked:locked});if(error){const msg=String(error.message||'');for(const code of ['candidate_missing','player_missing'])if(msg.includes(code))return json({error:code},400);throw error}return json({ok:true,locked:!!data,state:await state(player)})
  }
  if(action==='reject'){await db.from('game_candidates').delete().eq('id',String(body.candidateId||'')).eq('player_id',player);return json({ok:true,state:await state(player)})}
  if(action==='upgrade'){
   const facility=String(body.facility||''),field:{[k:string]:string}={quarters:'quarters_level',tavern:'tavern_level',storage:'storage_level',workshop:'workshop_level',shop:'shop_level'},key=field[facility];if(!key)return json({error:'facility'},400)
   const {data:p,error:pe}=await db.from('game_players').select('*').eq('device_id',player).single();if(pe)throw pe;const lv=Number(p[key]||1),max=facility==='quarters'?8:5;if(lv>=max)return json({error:'max_level'},400);const cost=facilityCost(facility,lv);if(p.gold<cost)return json({error:'gold_short'},400)
   const {error}=await db.from('game_players').update({gold:p.gold-cost,[key]:lv+1,updated_at:new Date().toISOString()}).eq('device_id',player);if(error)throw error;return json({ok:true,state:await state(player)})
  }
  return json({error:'unknown_action'},400)
 }catch(e){console.error(e);return json({error:'server_error',detail:String((e as Error)?.message||e)},500)}
})
