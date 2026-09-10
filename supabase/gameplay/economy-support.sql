-- Consistent warehouse, workshop and facility economy. Internal functions are
-- called through the authenticated Edge API; manual claim RPCs retain auth.uid.
-- Use the existing global tick lock so manual claims and automatic completion
-- cannot spend or award the same inventory/currency concurrently.
create or replace function public.game_upgrade_facility(p_player uuid,p_facility text,p_expected_level integer default null)
returns jsonb language plpgsql set search_path=public as $$
declare p public.game_players%rowtype; field_name text; current_level integer; price bigint; maximum integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('game_tick_all',0));
  field_name:=case p_facility when 'quarters' then 'quarters_level' when 'tavern' then 'tavern_level' when 'storage' then 'storage_level' when 'workshop' then 'workshop_level' when 'shop' then 'shop_level' end;
  if field_name is null then raise exception 'facility'; end if;
  select * into p from public.game_players where device_id=p_player for update;
  if not found then raise exception 'player_missing'; end if;
  current_level:=(to_jsonb(p)->>field_name)::integer;
  if p_expected_level is not null and p_expected_level<>current_level then raise exception 'facility_changed'; end if;
  maximum:=case when p_facility='quarters' then 8 else 5 end;
  if current_level>=maximum then raise exception 'max_level'; end if;
  price:=(case p_facility when 'quarters' then 900 when 'tavern' then 1800 when 'storage' then 1200 when 'workshop' then 1600 when 'shop' then 1500 end)*power(3::numeric,greatest(0,current_level-1));
  if p.gold<price then raise exception 'gold_short'; end if;
  execute format('update public.game_players set gold=gold-$1,%I=$2,updated_at=now() where device_id=$3',field_name) using price,current_level+1,p_player;
  return jsonb_build_object('facility',p_facility,'level',current_level+1,'cost',price);
end $$;
revoke all on function public.game_upgrade_facility(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.game_upgrade_facility(uuid,text,integer) to service_role;
create or replace function public.game_storage_capacity(p_player uuid)
returns integer language sql stable set search_path=public as $$
  select case when storage_level<=1 then 40 when storage_level=2 then 80 when storage_level=3 then 140 when storage_level=4 then 220 else 350+greatest(0,storage_level-5)*150 end from game_players where device_id=p_player
$$;
create or replace function public.game_inventory_accepts(p_player uuid,p_item text)
returns boolean language sql stable set search_path=public as $$
  select exists(select 1 from game_inventory where player_id=p_player and item_id=p_item and qty>0)
    or (select count(*) from game_inventory where player_id=p_player and qty>0)<game_storage_capacity(p_player)
$$;
revoke all on function public.game_storage_capacity(uuid),public.game_inventory_accepts(uuid,text) from public,anon,authenticated;
grant execute on function public.game_storage_capacity(uuid),public.game_inventory_accepts(uuid,text) to service_role;
CREATE OR REPLACE FUNCTION public.game_start_craft(p_player uuid, p_recipe text, p_qty integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  r record;
  kv record;
  have bigint;
  queued_count int;
  queue_cap int;
  job_id uuid;
  scheduled_start timestamptz;
  scheduled_finish timestamptz;
  total_need bigint;
  spend jsonb:='{}'::jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('game_tick_all',0));
  perform public.game_process_economy();
  if coalesce(p_qty,0)<1 then raise exception 'quantity_invalid'; end if;
  select * into r from public.game_recipes where id=p_recipe;
  if r.id is null then raise exception 'recipe_missing'; end if;
  if not exists(select 1 from public.game_players where device_id=p_player and workshop_level>=r.workshop_level) then raise exception 'workshop_level'; end if;

  select greatest(5,coalesce(workshop_level,1)+4) into queue_cap
  from public.game_players where device_id=p_player;
  select count(*) into queued_count
  from public.game_craft_jobs where player_id=p_player and status in ('running','queued');
  if queued_count>=queue_cap then raise exception 'craft_queue_full'; end if;

  select coalesce(jsonb_object_agg(k.key,to_jsonb((k.value::bigint*p_qty::bigint)::bigint)),'{}'::jsonb)
  into spend from jsonb_each_text(r.inputs) k;

  for kv in select key,value from jsonb_each_text(spend) loop
    select coalesce(qty,0) into have from public.game_inventory where player_id=p_player and item_id=kv.key;
    if coalesce(have,0)<kv.value::bigint then raise exception 'material_short'; end if;
  end loop;

  for kv in select key,value from jsonb_each_text(spend) loop
    update public.game_inventory set qty=qty-kv.value::bigint where player_id=p_player and item_id=kv.key;
    delete from public.game_inventory where player_id=p_player and item_id=kv.key and qty<=0;
  end loop;

  select greatest(now(),coalesce(max(finish_at),now())) into scheduled_start
  from public.game_craft_jobs where player_id=p_player and status in ('running','queued');
  scheduled_finish:=scheduled_start+make_interval(secs=>r.craft_seconds*p_qty);

  insert into public.game_craft_jobs(player_id,recipe_id,output_item,output_qty,batch_qty,started_at,finish_at,status,materials_spent)
  values(p_player,r.id,r.output_item,r.output_qty*p_qty,p_qty,scheduled_start,scheduled_finish,
         case when scheduled_start<=now() then 'running' else 'queued' end,spend)
  returning id into job_id;
  return job_id;
end
$function$
;

CREATE OR REPLACE FUNCTION public.game_start_sell(p_player uuid, p_item text, p_qty integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare r record; d record; have bigint; queued_count int; queue_cap int; job_id uuid; unit_price int; unit_seconds int; scheduled_start timestamptz; scheduled_finish timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('game_tick_all',0));
 perform public.game_process_economy(); if coalesce(p_qty,0)<1 then raise exception 'quantity_invalid'; end if;
 select * into r from public.game_recipes where output_item=p_item order by sort_order limit 1; if r.id is not null then unit_price:=r.sale_gold;unit_seconds:=greatest(1,ceil(r.craft_seconds/1.2)::integer); else select * into d from public.game_item_defs where id=p_item and kind='material' and sale_gold>0 limit 1; if d.id is null then raise exception 'not_sellable';end if;unit_price:=d.sale_gold;unit_seconds:=greatest(1,d.sell_seconds);end if;
 select greatest(5,coalesce(shop_level,1)+4) into queue_cap from public.game_players where device_id=p_player; select count(*) into queued_count from public.game_sell_jobs where player_id=p_player and status in ('running','queued'); if queued_count>=queue_cap then raise exception 'sell_queue_full'; end if;
 select coalesce(qty,0) into have from public.game_inventory where player_id=p_player and item_id=p_item; if coalesce(have,0)<p_qty then raise exception 'item_missing'; end if; update public.game_inventory set qty=qty-p_qty where player_id=p_player and item_id=p_item; delete from public.game_inventory where player_id=p_player and item_id=p_item and qty<=0;
 select greatest(now(),coalesce(max(finish_at),now())) into scheduled_start from public.game_sell_jobs where player_id=p_player and status in ('running','queued'); scheduled_finish:=scheduled_start+make_interval(secs=>unit_seconds*p_qty);
 insert into public.game_sell_jobs(player_id,item_id,sale_gold,quantity,started_at,finish_at,status) values(p_player,p_item,unit_price*p_qty,p_qty,scheduled_start,scheduled_finish,case when scheduled_start<=now() then 'running' else 'queued' end) returning id into job_id; return job_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.game_claim_craft(p_job uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare j record; v_player uuid; manual_mode boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('game_tick_all',0));
  v_player:=auth.uid();
  if v_player is null then raise exception 'unauthorized'; end if;
  select manual_economy_claim into manual_mode from public.game_players where device_id=v_player;
  if coalesce(manual_mode,false)=false then raise exception 'manual_mode_disabled'; end if;
  perform public.game_process_economy();
  select * into j from public.game_craft_jobs where id=p_job and player_id=v_player for update;
  if j.id is null then raise exception 'job_missing'; end if;
  if j.status='done' then raise exception 'job_already_claimed'; end if;
  if j.status<>'ready' then raise exception 'job_not_ready'; end if;
  if not public.game_inventory_accepts(v_player,j.output_item) then raise exception 'storage_full'; end if;
  insert into public.game_inventory(player_id,item_id,qty)
  values(j.player_id,j.output_item,j.output_qty)
  on conflict(player_id,item_id) do update set qty=public.game_inventory.qty+excluded.qty;
  update public.game_craft_jobs set status='done' where id=j.id;
  return jsonb_build_object('jobId',j.id,'itemId',j.output_item,'quantity',j.output_qty);
end
$function$
;

CREATE OR REPLACE FUNCTION public.game_claim_sell(p_job uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare j record; v_player uuid; manual_mode boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('game_tick_all',0));
  v_player:=auth.uid();
  if v_player is null then raise exception 'unauthorized'; end if;
  select manual_economy_claim into manual_mode from public.game_players where device_id=v_player;
  if coalesce(manual_mode,false)=false then raise exception 'manual_mode_disabled'; end if;
  perform public.game_process_economy();
  select * into j from public.game_sell_jobs where id=p_job and player_id=v_player for update;
  if j.id is null then raise exception 'job_missing'; end if;
  if j.status='done' then raise exception 'job_already_claimed'; end if;
  if j.status<>'ready' then raise exception 'job_not_ready'; end if;
  update public.game_players set gold=gold+j.sale_gold,updated_at=now() where device_id=j.player_id;
  update public.game_sell_jobs set status='done' where id=j.id;
  return jsonb_build_object('jobId',j.id,'itemId',j.item_id,'quantity',j.quantity,'gold',j.sale_gold);
end
$function$
;

CREATE OR REPLACE FUNCTION public.game_process_economy()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare j record; n integer:=0; manual_mode boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('game_tick_all',0));
  for j in
    select * from public.game_craft_jobs
    where status in ('running','queued','ready') and finish_at<=now()
    order by finish_at
    for update skip locked
  loop
    select coalesce(manual_economy_claim,false) into manual_mode from public.game_players where device_id=j.player_id;
    if manual_mode or not public.game_inventory_accepts(j.player_id,j.output_item) then
      if j.status<>'ready' then
        update public.game_craft_jobs set status='ready',completed_at=coalesce(completed_at,finish_at) where id=j.id;
        n:=n+1;
      end if;
    else
      insert into public.game_inventory(player_id,item_id,qty)
      values(j.player_id,j.output_item,j.output_qty)
      on conflict(player_id,item_id) do update set qty=public.game_inventory.qty+excluded.qty;
      update public.game_craft_jobs set status='done',completed_at=coalesce(completed_at,now()) where id=j.id;
      n:=n+1;
    end if;
  end loop;

  update public.game_craft_jobs set status='running'
  where status='queued' and started_at<=now() and finish_at>now();

  for j in
    select * from public.game_sell_jobs
    where status in ('running','queued','ready') and finish_at<=now()
    order by finish_at
    for update skip locked
  loop
    select coalesce(manual_economy_claim,false) into manual_mode from public.game_players where device_id=j.player_id;
    if manual_mode then
      if j.status<>'ready' then
        update public.game_sell_jobs set status='ready',completed_at=coalesce(completed_at,finish_at) where id=j.id;
        n:=n+1;
      end if;
    else
      update public.game_players set gold=gold+j.sale_gold,updated_at=now() where device_id=j.player_id;
      update public.game_sell_jobs set status='done',completed_at=coalesce(completed_at,now()) where id=j.id;
      n:=n+1;
    end if;
  end loop;

  update public.game_sell_jobs set status='running'
  where status='queued' and started_at<=now() and finish_at>now();
  return n;
end
$function$
;

CREATE OR REPLACE FUNCTION public.game_collect_loot(p_player uuid, p_expedition uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  e record;
  kv record;
  total jsonb := '{}'::jsonb;
  cur bigint;
  q bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('game_tick_all',0));
  if exists(select 1 from public.game_expeditions where id=p_expedition and player_id<>p_player) then raise exception 'invalid_target'; end if;
  if (select count(*) from public.game_inventory where player_id=p_player and qty>0)+(select count(distinct l.key) from public.game_expeditions ge cross join lateral jsonb_each_text(ge.pending_loot) l where ge.player_id=p_player and (p_expedition is null or ge.id=p_expedition) and l.value::bigint>0 and not exists(select 1 from public.game_inventory i where i.player_id=p_player and i.item_id=l.key and i.qty>0))>public.game_storage_capacity(p_player) then raise exception 'storage_full'; end if;
  for e in
    select * from public.game_expeditions
    where player_id=p_player and (p_expedition is null or id=p_expedition)
    for update
  loop
    for kv in select key,value from jsonb_each_text(coalesce(e.pending_loot,'{}'::jsonb)) loop
      q:=kv.value::bigint;
      if q>0 then
        insert into public.game_inventory(player_id,item_id,qty)
        values(p_player,kv.key,q)
        on conflict(player_id,item_id) do update
          set qty=public.game_inventory.qty+excluded.qty;
        cur:=coalesce((total->>kv.key)::bigint,0);
        total:=jsonb_set(total,array[kv.key],to_jsonb(cur+q),true);
      end if;
    end loop;

    update public.game_expeditions
    set pending_loot='{}'::jsonb,
        pending_xp='{}'::jsonb,
        last_loot_collected_at=now(),
        updated_at=now()
    where id=e.id;
  end loop;
  return total;
end
$function$
;
