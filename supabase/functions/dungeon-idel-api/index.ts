import { createClient } from '@supabase/supabase-js'

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,authorization,apikey,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'}
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})
const url=Deno.env.get('SUPABASE_URL')!
const secrets=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}')
const secretKey=secrets.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db=createClient(url,secretKey,{auth:{persistSession:false,autoRefreshToken:false}})
// Keep player login sessions out of the shared service-role database client.
const signIn=(email:string,password:string)=>createClient(url,secretKey,{auth:{persistSession:false,autoRefreshToken:false}}).auth.signInWithPassword({email,password})
const normUser=(v:string)=>v.trim().normalize('NFC')
const validUsername=(v:string)=>/^[가-힣]{2,12}$/u.test(v)
const validPin=(v:string)=>/^\d{4}$/.test(v)
const authPassword=(pin:string)=>`Hero!${pin}#Corp2026`
const authEmail=()=>`player-${crypto.randomUUID()}@players.dungeon-idel.game`
const facilityCost=(facility:string,lv:number)=>{const base:{[k:string]:number}={quarters:900,tavern:1800,storage:1200,workshop:1600,shop:1500};return Math.floor((base[facility]||999999)*Math.pow(3,Math.max(0,lv-1)))}
const storageCapacity=(lv:number)=>lv<=1?160:lv===2?240:lv===3?360:lv===4?520:750
const quartersCapacity=(lv:number)=>3+Math.max(0,lv-1)*2
const queueCapacity=(lv:number)=>Math.max(5,Number(lv||1)+4)
const capacities=(pl:any)=>({facilityCosts:{quarters:facilityCost('quarters',pl.quarters_level||1),tavern:facilityCost('tavern',pl.tavern_level||1),storage:facilityCost('storage',pl.storage_level||1),workshop:facilityCost('workshop',pl.workshop_level||1),shop:facilityCost('shop',pl.shop_level||1)},storageCapacity:storageCapacity(pl.storage_level||1),quartersCapacity:quartersCapacity(pl.quarters_level||1),craftCapacity:queueCapacity(pl.workshop_level||1),shopCapacity:queueCapacity(pl.shop_level||1)})

async function getAuthUser(req:Request){const h=req.headers.get('authorization')||'';const token=h.toLowerCase().startsWith('bearer ')?h.slice(7).trim():'';if(!token)return null;const {data,error}=await db.auth.getUser(token);if(error||!data.user)return null;return data.user}
async function ensurePlayer(player:string){const {error}=await db.rpc('game_initialize_company',{p_player:player});if(error)throw error}

async function snapshot(player:string,includeStatic:boolean){
 const {data,error}=await db.rpc('game_client_state',{p_player:player,p_static:includeStatic});if(error)throw error
 if(includeStatic){const progress=new Map((data.stageProgress||[]).map((row:any)=>[row.site_id,row]));data.sites=(data.sites||[]).map((site:any,index:number,all:any[])=>({...site,unlocked:index===0||!!(progress.get(all[index-1]?.id) as any)?.boss_cleared,progress:progress.get(site.id)||{normal_wins:0,boss_ready:false,boss_cleared:false,boss_attempts:0}}))}
 data.candidates=(data.candidates||[]).map((candidate:any)=>({...candidate,hire_cost:0}));
 return {...data,...capacities(data.player)}
}
const state=(player:string)=>snapshot(player,true)
const stateLite=(player:string)=>snapshot(player,false)

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});if(req.method!=='POST')return json({error:'method'},405)
 try{
  const body=await req.json().catch(()=>({}));const action=String(body.action||'state')
  if(action==='register'){
   const username=normUser(String(body.username||'')),pin=String(body.password||'');if(!validUsername(username))return json({error:'username_format'},400);if(!validPin(pin))return json({error:'password_format'},400)
   const {data:taken,error:te}=await db.from('game_accounts').select('user_id').eq('username_norm',username).maybeSingle();if(te)throw te;if(taken)return json({error:'username_taken'},409)
   const email=authEmail(),password=authPassword(pin);const {data:created,error:ce}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{username}});if(ce||!created.user)throw ce||new Error('auth_create_failed')
   const uid=created.user.id;const {error:ae}=await db.from('game_accounts').insert({user_id:uid,username});if(ae){await db.auth.admin.deleteUser(uid);throw ae}await ensurePlayer(uid)
   const {data:login,error:le}=await signIn(email,password);if(le||!login.session)throw le||new Error('auth_login_failed');return json({ok:true,username,session:login.session})
  }
  if(action==='login'){
   const username=normUser(String(body.username||'')),pin=String(body.password||'');if(!validUsername(username)||!validPin(pin))return json({error:'invalid_credentials'},401)
   const {data:account,error:ae}=await db.from('game_accounts').select('user_id').eq('username_norm',username).maybeSingle();if(ae)throw ae;if(!account)return json({error:'invalid_credentials'},401)
   const {data:authUser,error:ue}=await db.auth.admin.getUserById(account.user_id);if(ue||!authUser.user?.email)return json({error:'invalid_credentials'},401)
   const {data:login,error:le}=await signIn(authUser.user.email,authPassword(pin));if(le||!login.session)return json({error:'invalid_credentials'},401)
   await db.from('game_accounts').update({last_login_at:new Date().toISOString()}).eq('user_id',account.user_id);return json({ok:true,username,session:login.session})
  }
  const user=await getAuthUser(req);if(!user)return json({error:'unauthorized'},401);const player=user.id
  if(action!=='state-lite')await ensurePlayer(player)
  const lite=body.stateMode==='lite',actionState=()=>lite?stateLite(player):state(player)
  if(action==='plan-evolution'||action==='defense-command'||action==='defense-upgrade'){
   const rpc=action==='plan-evolution'?'game_plan_evolution':action==='defense-command'?'game_defense_command':'game_defense_upgrade';
   const args=action==='plan-evolution'?{p_player:player,p_monster:String(body.monsterId||''),p_evolution:String(body.evolutionId||'')}:action==='defense-command'?{p_player:player,p_action:String(body.command||''),p_stage:body.stage==null?null:Number(body.stage)}:{p_player:player,p_kind:String(body.kind||''),p_expected:Number(body.expectedLevel)};
   const {data,error}=await db.rpc(rpc,args);if(error){for(const code of ['gold_short','facility_changed','max_level','locked','evolution_invalid','invalid_action','invalid_settings','facility'])if(error.message.includes(code))return json({error:code},400);throw error}
   return json({ok:true,result:data,stateMode:lite?'lite':'full',state:await actionState()})
  }
  if(action==='state')return json({ok:true,state:await state(player)})
  if(action==='state-lite')return json({ok:true,state:await stateLite(player)})
  if(action==='deploy'){
   const siteId=String(body.siteId||''),idsRaw=Array.isArray(body.monsterIds)?body.monsterIds:[body.monsterId],monsterIds=[...new Set<string>(idsRaw.map((x:any)=>String(x||'')).filter(Boolean))];if(monsterIds.length<1||monsterIds.length>4)return json({error:'party_size'},400)
   const [{data:site},{data:mons},{data:activeExps}]=await Promise.all([db.from('game_hunt_sites').select('*').eq('id',siteId).maybeSingle(),db.from('game_monsters').select('*').eq('player_id',player).is('released_at',null).in('id',monsterIds),db.from('game_expeditions').select('id').eq('player_id',player).eq('active',true)])
   if(!site||!mons||mons.length!==monsterIds.length)return json({error:'invalid_target'},400)
   if(site.unlock_order>1){const {data:prev}=await db.from('game_hunt_sites').select('id').eq('unlock_order',site.unlock_order-1).maybeSingle();const {data:pr}=prev?await db.from('game_stage_progress').select('boss_cleared').eq('player_id',player).eq('site_id',prev.id).maybeSingle():{data:null} as any;if(!pr?.boss_cleared)return json({error:'locked'},400)}
   if((activeExps||[]).length){const expIds=(activeExps||[]).map((x:any)=>x.id);const {data:busy}=await db.from('game_expedition_members').select('monster_id').in('expedition_id',expIds).in('monster_id',monsterIds);if((busy||[]).length)return json({error:'monster_busy'},400)}
   const {data:exp,error:ie}=await db.from('game_expeditions').insert({player_id:player,monster_id:monsterIds[0],site_id:siteId,active:true,phase:'탐색',event_state:{type:'deploy',text:`${monsterIds.length}인 박멸조 현장 진입`,t:new Date().toISOString()}}).select('id').single();if(ie||!exp)throw ie||new Error('expedition_create')
   const {error:me}=await db.from('game_expedition_members').insert(monsterIds.map((id:string,i:number)=>({expedition_id:exp.id,player_id:player,monster_id:id,position:i+1})));if(me){await db.from('game_expeditions').delete().eq('id',exp.id);throw me}return json({ok:true,stateMode:lite?'lite':'full',state:await actionState()})
  }
  if(action==='recall'){const id=String(body.expeditionId||'');const {error}=await db.from('game_expeditions').update({active:false,phase:'복귀',updated_at:new Date().toISOString()}).eq('id',id).eq('player_id',player);if(error)throw error;return json({ok:true,stateMode:lite?'lite':'full',state:await actionState()})}
  if(action==='collect'){const id=body.expeditionId?String(body.expeditionId):null;const {data,error}=await db.rpc('game_collect_loot',{p_player:player,p_expedition:id});if(error){if(String(error.message||'').includes('storage_full'))return json({error:'storage_full'},400);throw error}return json({ok:true,collected:data||{},stateMode:lite?'lite':'full',state:await actionState()})}
  if(action==='craft'){const qty=Math.max(1,Math.floor(Number(body.quantity||1)));const {error}=await db.rpc('game_start_craft',{p_player:player,p_recipe:String(body.recipeId||''),p_qty:qty});if(error){const msg=String(error.message||'');for(const code of ['recipe_missing','craft_queue_full','material_short','quantity_invalid','workshop_level'])if(msg.includes(code))return json({error:code},400);throw error}return json({ok:true,stateMode:lite?'lite':'full',state:await actionState()})}
  if(action==='sell'){const qty=Math.max(1,Math.floor(Number(body.quantity||1)));const {error}=await db.rpc('game_start_sell',{p_player:player,p_item:String(body.itemId||''),p_qty:qty});if(error){const msg=String(error.message||'');for(const code of ['not_sellable','sell_queue_full','item_missing','quantity_invalid'])if(msg.includes(code))return json({error:code},400);throw error}return json({ok:true,stateMode:lite?'lite':'full',state:await actionState()})}
  if(action==='equip'){const monsterId=String(body.monsterId||''),itemId=String(body.itemId||'');const {error}=await db.rpc('game_equip_item',{p_player:player,p_monster:monsterId,p_item:itemId});if(error){const msg=String(error.message||'');if(msg.includes('not_equipment'))return json({error:'not_equipment'},400);if(msg.includes('item_missing'))return json({error:'item_missing'},400);if(msg.includes('monster_missing'))return json({error:'invalid_target'},400);throw error}return json({ok:true,stateMode:lite?'lite':'full',state:await actionState()})}
  if(action==='unequip'){const monsterId=String(body.monsterId||''),slot=String(body.slot||'');const {error}=await db.rpc('game_unequip_item',{p_player:player,p_monster:monsterId,p_slot:slot});if(error)throw error;return json({ok:true,stateMode:lite?'lite':'full',state:await actionState()})}
  if(action==='evolve'){
   const monsterId=String(body.monsterId||''),evolutionId=String(body.evolutionId||'');const {data,error}=await db.rpc('game_evolve_monster',{p_player:player,p_monster:monsterId,p_evolution:evolutionId});if(error){const msg=String(error.message||'');for(const code of ['monster_missing','monster_busy','evolution_invalid','evolution_level'])if(msg.includes(code))return json({error:code},400);throw error}return json({ok:true,evolution:data||{},stateMode:lite?'lite':'full',state:await actionState()})
  }
  if(action==='hire'){
   const id=String(body.candidateId||'');const {data,error}=await db.rpc('game_hire_candidate',{p_player:player,p_candidate:id});if(error){const msg=String(error.message||'');for(const code of ['candidate_missing','quarters_full','player_missing'])if(msg.includes(code))return json({error:code},400);throw error}return json({ok:true,hire:data||{},stateMode:lite?'lite':'full',state:await actionState()})
  }
  if(action==='candidate-lock'){
   const id=String(body.candidateId||''),locked=body.locked===true;const {data,error}=await db.rpc('game_set_candidate_lock',{p_player:player,p_candidate:id,p_locked:locked});if(error){const msg=String(error.message||'');for(const code of ['candidate_missing','player_missing'])if(msg.includes(code))return json({error:code},400);throw error}return json({ok:true,locked:!!data,stateMode:lite?'lite':'full',state:await actionState()})
  }
  if(action==='reject'){await db.from('game_candidates').delete().eq('id',String(body.candidateId||'')).eq('player_id',player);return json({ok:true,stateMode:lite?'lite':'full',state:await actionState()})}
  if(action==='release'){
   const id=String(body.monsterId||'');const {data,error}=await db.rpc('game_release_monster',{p_player:player,p_monster:id});if(error){const msg=String(error.message||'');for(const code of ['monster_missing','monster_busy','player_missing'])if(msg.includes(code))return json({error:code},400);throw error}return json({ok:true,release:data||{},stateMode:lite?'lite':'full',state:await actionState()})
  }
  if(action==='upgrade'){
   const facility=String(body.facility||'');
   const {error}=await db.rpc('game_upgrade_facility',{p_player:player,p_facility:facility,p_expected_level:body.expectedLevel==null?null:Number(body.expectedLevel)});
   if(error){const msg=String(error.message||'');for(const code of ['facility_changed','facility','max_level','gold_short','player_missing'])if(msg.includes(code))return json({error:code},400);throw error}
   return json({ok:true,stateMode:lite?'lite':'full',state:await actionState()})
  }
  return json({error:'unknown_action'},400)
 }catch(e){console.error(e);return json({error:'server_error',detail:String((e as Error)?.message||e)},500)}
})
