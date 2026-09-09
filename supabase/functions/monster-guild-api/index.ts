import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'content-type,x-device-id,x-device-secret,apikey,authorization',
  'Access-Control-Allow-Methods':'POST,OPTIONS'
}
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})
const url=Deno.env.get('SUPABASE_URL')!
const secrets=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}')
const secretKey=secrets.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db=createClient(url,secretKey,{auth:{persistSession:false,autoRefreshToken:false}})

async function sha256(s:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function auth(req:Request){
  const id=req.headers.get('x-device-id')||''; const sec=req.headers.get('x-device-secret')||'';
  if(!id||!sec)return null;
  const {data}=await db.from('game_players').select('device_id,device_secret_hash').eq('device_id',id).maybeSingle();
  if(!data)return null; const h=await sha256(sec); return h===data.device_secret_hash?id:null;
}
async function state(player:string){
  await db.rpc('game_tick_all');
  const [p,m,c,e,s,i]=await Promise.all([
    db.from('game_players').select('*').eq('device_id',player).single(),
    db.from('game_monsters').select('*').eq('player_id',player).order('created_at'),
    db.from('game_candidates').select('*').eq('player_id',player).order('created_at'),
    db.from('game_expeditions').select('*').eq('player_id',player).order('started_at',{ascending:false}),
    db.from('game_hunt_sites').select('*').order('unlock_order'),
    db.from('game_inventory').select('*').eq('player_id',player).order('item_id')
  ]);
  const err=[p,m,c,e,s,i].find(x=>x.error)?.error; if(err)throw err;
  const maxLevel=Math.max(1,...(m.data||[]).map((x:any)=>x.level||1));
  return {player:p.data,monsters:m.data||[],candidates:c.data||[],expeditions:e.data||[],sites:(s.data||[]).map((x:any)=>({...x,unlocked:x.unlock_order===1||(x.unlock_order===2&&maxLevel>=5)||(x.unlock_order===3&&maxLevel>=10)})),inventory:i.data||[],serverNow:new Date().toISOString()}
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{headers:cors});
  if(req.method!=='POST')return json({error:'method'},405);
  try{
    const body=await req.json().catch(()=>({})); const action=String(body.action||'state');
    if(action==='bootstrap'){
      const deviceId=String(body.deviceId||''); const deviceSecret=String(body.deviceSecret||'');
      if(!/^[0-9a-f-]{36}$/i.test(deviceId)||deviceSecret.length<24)return json({error:'invalid_device'},400);
      const hash=await sha256(deviceSecret);
      const {data:existing}=await db.from('game_players').select('device_id,device_secret_hash').eq('device_id',deviceId).maybeSingle();
      if(existing&&existing.device_secret_hash!==hash)return json({error:'device_mismatch'},403);
      if(!existing){
        const {error:pe}=await db.from('game_players').insert({device_id:deviceId,device_secret_hash:hash}); if(pe)throw pe;
        const {error:me}=await db.from('game_monsters').insert({player_id:deviceId,name:'보글',family:'slime',level:1,xp:0,talent:88,trait:'질긴 가죽',power_base:48}); if(me)throw me;
      }
      return json({ok:true,state:await state(deviceId)});
    }
    const player=await auth(req); if(!player)return json({error:'unauthorized'},401);
    if(action==='state')return json({ok:true,state:await state(player)});
    if(action==='deploy'){
      const monsterId=String(body.monsterId||''),siteId=String(body.siteId||'');
      const [{data:mon},{data:site}]=await Promise.all([db.from('game_monsters').select('id,level').eq('id',monsterId).eq('player_id',player).maybeSingle(),db.from('game_hunt_sites').select('*').eq('id',siteId).maybeSingle()]);
      if(!mon||!site)return json({error:'invalid_target'},400);
      const unlocked=site.unlock_order===1||(site.unlock_order===2&&mon.level>=5)||(site.unlock_order===3&&mon.level>=10); if(!unlocked)return json({error:'locked'},400);
      await db.from('game_expeditions').update({active:false,updated_at:new Date().toISOString()}).eq('player_id',player).eq('monster_id',monsterId).eq('active',true);
      const {error}=await db.from('game_expeditions').insert({player_id:player,monster_id:monsterId,site_id:siteId,active:true}); if(error)throw error;
      return json({ok:true,state:await state(player)});
    }
    if(action==='recall'){
      const id=String(body.expeditionId||''); const {error}=await db.from('game_expeditions').update({active:false,updated_at:new Date().toISOString()}).eq('id',id).eq('player_id',player); if(error)throw error;
      return json({ok:true,state:await state(player)});
    }
    if(action==='collect'){
      const id=body.expeditionId?String(body.expeditionId):null; const {data,error}=await db.rpc('game_collect_loot',{p_player:player,p_expedition:id}); if(error)throw error;
      return json({ok:true,collected:data||{},state:await state(player)});
    }
    if(action==='hire'){
      const id=String(body.candidateId||'');
      const [{data:p},{data:c},{count}]=await Promise.all([db.from('game_players').select('*').eq('device_id',player).single(),db.from('game_candidates').select('*').eq('id',id).eq('player_id',player).maybeSingle(),db.from('game_monsters').select('id',{count:'exact',head:true}).eq('player_id',player)]);
      if(!c)return json({error:'candidate_missing'},400); const cap=1+(Math.max(1,p.quarters_level)-1)*2; if((count||0)>=cap)return json({error:'quarters_full'},400);
      const cost=90+Math.floor(c.talent*1.7); if(p.gold<cost)return json({error:'gold_short'},400);
      const {error:ue}=await db.from('game_players').update({gold:p.gold-cost,updated_at:new Date().toISOString()}).eq('device_id',player); if(ue)throw ue;
      const {error:mi}=await db.from('game_monsters').insert({player_id:player,name:c.name,family:c.family,talent:c.talent,trait:c.trait,power_base:c.power_base}); if(mi)throw mi;
      await db.from('game_candidates').delete().eq('id',id).eq('player_id',player);
      return json({ok:true,state:await state(player)});
    }
    if(action==='reject'){
      await db.from('game_candidates').delete().eq('id',String(body.candidateId||'')).eq('player_id',player); return json({ok:true,state:await state(player)});
    }
    if(action==='upgrade'){
      const facility=String(body.facility||''); const {data:p}=await db.from('game_players').select('*').eq('device_id',player).single();
      if(facility==='quarters'){
        const lv=p.quarters_level||1,cost=Math.floor(220*Math.pow(1.8,lv-1)); if(p.gold<cost)return json({error:'gold_short'},400);
        await db.from('game_players').update({gold:p.gold-cost,quarters_level:lv+1,updated_at:new Date().toISOString()}).eq('device_id',player);
      } else if(facility==='tavern'){
        const lv=p.tavern_level||1,cost=Math.floor(260*Math.pow(1.85,lv-1)); if(p.gold<cost)return json({error:'gold_short'},400);
        await db.from('game_players').update({gold:p.gold-cost,tavern_level:lv+1,updated_at:new Date().toISOString()}).eq('device_id',player);
      } else return json({error:'facility'},400);
      return json({ok:true,state:await state(player)});
    }
    return json({error:'unknown_action'},400);
  }catch(e){console.error(e);return json({error:'server_error',detail:String((e as Error)?.message||e)},500)}
})
