import { createClient } from '@supabase/supabase-js'

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'content-type,authorization,apikey,x-client-info',
  'Access-Control-Allow-Methods':'POST,OPTIONS'
}
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

async function getAuthUser(req:Request){
  const h=req.headers.get('authorization')||''
  const token=h.toLowerCase().startsWith('bearer ')?h.slice(7).trim():''
  if(!token)return null
  const {data,error}=await db.auth.getUser(token)
  if(error||!data.user)return null
  return data.user
}
async function ensurePlayer(player:string){
  const {data:existing,error}=await db.from('game_players').select('device_id').eq('device_id',player).maybeSingle()
  if(error)throw error
  if(existing)return
  const {error:pe}=await db.from('game_players').insert({device_id:player,device_secret_hash:null})
  if(pe)throw pe
  const {error:me}=await db.from('game_monsters').insert({player_id:player,name:'보글',family:'slime',level:1,xp:0,talent:88,trait:'질긴 가죽',power_base:48})
  if(me)throw me
}
async function state(player:string){
  await ensurePlayer(player)
  await db.rpc('game_tick_all')
  const [p,a,m,c,e,s,i]=await Promise.all([
    db.from('game_players').select('*').eq('device_id',player).single(),
    db.from('game_accounts').select('username,created_at,last_login_at').eq('user_id',player).maybeSingle(),
    db.from('game_monsters').select('*').eq('player_id',player).order('created_at'),
    db.from('game_candidates').select('*').eq('player_id',player).order('created_at'),
    db.from('game_expeditions').select('*').eq('player_id',player).order('started_at',{ascending:false}),
    db.from('game_hunt_sites').select('*').order('unlock_order'),
    db.from('game_inventory').select('*').eq('player_id',player).order('item_id')
  ])
  const err=[p,a,m,c,e,s,i].find(x=>x.error)?.error
  if(err)throw err
  const maxLevel=Math.max(1,...(m.data||[]).map((x:any)=>x.level||1))
  return {account:a.data||null,player:p.data,monsters:m.data||[],candidates:c.data||[],expeditions:e.data||[],sites:(s.data||[]).map((x:any)=>({...x,unlocked:x.unlock_order===1||(x.unlock_order===2&&maxLevel>=5)||(x.unlock_order===3&&maxLevel>=10)})),inventory:i.data||[],serverNow:new Date().toISOString()}
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{headers:cors})
  if(req.method!=='POST')return json({error:'method'},405)
  try{
    const body=await req.json().catch(()=>({}))
    const action=String(body.action||'state')
    if(action==='register'){
      const username=normUser(String(body.username||'')),pin=String(body.password||'')
      if(!validUsername(username))return json({error:'username_format'},400)
      if(!validPin(pin))return json({error:'password_format'},400)
      const usernameNorm=normUser(username)
      const {data:taken,error:te}=await db.from('game_accounts').select('user_id').eq('username_norm',usernameNorm).maybeSingle()
      if(te)throw te
      if(taken)return json({error:'username_taken'},409)
      const email=authEmail(),password=authPassword(pin)
      const {data:created,error:ce}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{username}})
      if(ce||!created.user)throw ce||new Error('auth_create_failed')
      const uid=created.user.id
      const {error:ae}=await db.from('game_accounts').insert({user_id:uid,username})
      if(ae){await db.auth.admin.deleteUser(uid);throw ae}
      await ensurePlayer(uid)
      const {data:login,error:le}=await db.auth.signInWithPassword({email,password})
      if(le||!login.session)throw le||new Error('auth_login_failed')
      return json({ok:true,username,session:login.session})
    }
    if(action==='login'){
      const username=normUser(String(body.username||'')),pin=String(body.password||'')
      if(!validUsername(username)||!validPin(pin))return json({error:'invalid_credentials'},401)
      const {data:account,error:ae}=await db.from('game_accounts').select('user_id').eq('username_norm',username).maybeSingle()
      if(ae)throw ae
      if(!account)return json({error:'invalid_credentials'},401)
      const {data:authUser,error:ue}=await db.auth.admin.getUserById(account.user_id)
      if(ue||!authUser.user?.email)return json({error:'invalid_credentials'},401)
      const {data:login,error:le}=await db.auth.signInWithPassword({email:authUser.user.email,password:authPassword(pin)})
      if(le||!login.session)return json({error:'invalid_credentials'},401)
      await db.from('game_accounts').update({last_login_at:new Date().toISOString()}).eq('user_id',account.user_id)
      return json({ok:true,username,session:login.session})
    }
    const user=await getAuthUser(req)
    if(!user)return json({error:'unauthorized'},401)
    const player=user.id
    await ensurePlayer(player)
    await db.from('game_accounts').update({last_login_at:new Date().toISOString()}).eq('user_id',player)
    if(action==='state')return json({ok:true,state:await state(player)})
    if(action==='deploy'){
      const monsterId=String(body.monsterId||''),siteId=String(body.siteId||'')
      const [{data:mon},{data:site}]=await Promise.all([db.from('game_monsters').select('id,level').eq('id',monsterId).eq('player_id',player).maybeSingle(),db.from('game_hunt_sites').select('*').eq('id',siteId).maybeSingle()])
      if(!mon||!site)return json({error:'invalid_target'},400)
      const unlocked=site.unlock_order===1||(site.unlock_order===2&&mon.level>=5)||(site.unlock_order===3&&mon.level>=10)
      if(!unlocked)return json({error:'locked'},400)
      await db.from('game_expeditions').update({active:false,updated_at:new Date().toISOString()}).eq('player_id',player).eq('monster_id',monsterId).eq('active',true)
      const {error}=await db.from('game_expeditions').insert({player_id:player,monster_id:monsterId,site_id:siteId,active:true});if(error)throw error
      return json({ok:true,state:await state(player)})
    }
    if(action==='recall'){const id=String(body.expeditionId||'');const {error}=await db.from('game_expeditions').update({active:false,updated_at:new Date().toISOString()}).eq('id',id).eq('player_id',player);if(error)throw error;return json({ok:true,state:await state(player)})}
    if(action==='collect'){const id=body.expeditionId?String(body.expeditionId):null;const {data,error}=await db.rpc('game_collect_loot',{p_player:player,p_expedition:id});if(error)throw error;return json({ok:true,collected:data||{},state:await state(player)})}
    if(action==='hire'){
      const id=String(body.candidateId||'')
      const [{data:p},{data:c},{count}]=await Promise.all([db.from('game_players').select('*').eq('device_id',player).single(),db.from('game_candidates').select('*').eq('id',id).eq('player_id',player).maybeSingle(),db.from('game_monsters').select('id',{count:'exact',head:true}).eq('player_id',player)])
      if(!c)return json({error:'candidate_missing'},400)
      const cap=1+(Math.max(1,p.quarters_level)-1)*2;if((count||0)>=cap)return json({error:'quarters_full'},400)
      const cost=90+Math.floor(c.talent*1.7);if(p.gold<cost)return json({error:'gold_short'},400)
      const {error:ue}=await db.from('game_players').update({gold:p.gold-cost,updated_at:new Date().toISOString()}).eq('device_id',player);if(ue)throw ue
      const {error:mi}=await db.from('game_monsters').insert({player_id:player,name:c.name,family:c.family,talent:c.talent,trait:c.trait,power_base:c.power_base});if(mi)throw mi
      await db.from('game_candidates').delete().eq('id',id).eq('player_id',player)
      return json({ok:true,state:await state(player)})
    }
    if(action==='reject'){await db.from('game_candidates').delete().eq('id',String(body.candidateId||'')).eq('player_id',player);return json({ok:true,state:await state(player)})}
    if(action==='upgrade'){
      const facility=String(body.facility||'');const {data:p,error:pe}=await db.from('game_players').select('*').eq('device_id',player).single();if(pe)throw pe
      if(facility==='quarters'){const lv=p.quarters_level||1,cost=Math.floor(220*Math.pow(1.8,lv-1));if(p.gold<cost)return json({error:'gold_short'},400);const {error}=await db.from('game_players').update({gold:p.gold-cost,quarters_level:lv+1,updated_at:new Date().toISOString()}).eq('device_id',player);if(error)throw error}
      else if(facility==='tavern'){const lv=p.tavern_level||1,cost=Math.floor(260*Math.pow(1.85,lv-1));if(p.gold<cost)return json({error:'gold_short'},400);const {error}=await db.from('game_players').update({gold:p.gold-cost,tavern_level:lv+1,updated_at:new Date().toISOString()}).eq('device_id',player);if(error)throw error}
      else return json({error:'facility'},400)
      return json({ok:true,state:await state(player)})
    }
    return json({error:'unknown_action'},400)
  }catch(e){console.error(e);return json({error:'server_error',detail:String((e as Error)?.message||e)},500)}
})