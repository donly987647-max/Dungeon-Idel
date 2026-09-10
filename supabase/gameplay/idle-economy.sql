create or replace function public.game_storage_capacity(p_player uuid)
returns integer language sql stable set search_path=public as $$
 select case storage_level when 1 then 160 when 2 then 240 when 3 then 360 when 4 then 520 else 750 end from game_players where device_id=p_player
$$;
create or replace function public.game_finish_idle_jobs(p_player uuid,p_at timestamptz)
returns integer language plpgsql set search_path=public as $$
declare j record; n integer:=0;
begin
 for j in select * from game_craft_jobs where player_id=p_player and status in ('running','queued','ready') and finish_at<=p_at order by finish_at for update loop
  if game_inventory_accepts(p_player,j.output_item) then
   insert into game_inventory(player_id,item_id,qty) values(p_player,j.output_item,j.output_qty) on conflict(player_id,item_id) do update set qty=game_inventory.qty+excluded.qty;
   update game_craft_jobs set status='done',completed_at=finish_at where id=j.id;n:=n+1;
  else update game_craft_jobs set status='ready',completed_at=finish_at where id=j.id;end if;
 end loop;
 for j in select * from game_sell_jobs where player_id=p_player and status in ('running','queued','ready') and finish_at<=p_at order by finish_at for update loop
  update game_players set gold=gold+j.sale_gold,idle_receipt=jsonb_set(idle_receipt,'{gold}',to_jsonb(coalesce((idle_receipt->>'gold')::bigint,0)+j.sale_gold),true) where device_id=p_player;
  update game_sell_jobs set status='done',completed_at=finish_at where id=j.id;n:=n+1;
 end loop;
 update game_craft_jobs set status='running' where player_id=p_player and status='queued' and started_at<=p_at and finish_at>p_at;
 update game_sell_jobs set status='running' where player_id=p_player and status='queued' and started_at<=p_at and finish_at>p_at;
 return n;
end $$;
create or replace function public.game_process_economy()
returns integer language plpgsql set search_path=public as $$
declare p record;n integer:=0;
begin
 perform pg_advisory_xact_lock(hashtextextended('game_tick_all',0));
 for p in select distinct player_id from (select player_id from game_craft_jobs where status in ('running','queued','ready') union select player_id from game_sell_jobs where status in ('running','queued','ready')) q loop n:=n+game_finish_idle_jobs(p.player_id,now());end loop;
 return n;
end $$;
create or replace function public.game_run_idle_economy(p_player uuid,p_at timestamptz)
returns integer language plpgsql set search_path=public as $$
declare p game_players%rowtype;r record;kv record;units integer;available bigint;start_at timestamptz;stock record;n integer:=0;needed integer;target integer;facility text;cost bigint;level_now integer;used integer;
begin
 select * into p from game_players where device_id=p_player for update;
 if p.idle_last_at is not null and p_at<p.idle_last_at+interval '30 seconds' then return 0;end if;
 update game_players set idle_last_at=p_at where device_id=p_player;
 n:=game_finish_idle_jobs(p_player,p_at);
 if not p.idle_automation then return n;end if;
 -- Automatically reinvest only where content or warehouse space requires it.
 select coalesce(max(s.unlock_order),1) into target from game_hunt_sites s where s.unlock_order=1 or exists(select 1 from game_stage_progress g join game_hunt_sites prev on prev.id=g.site_id where g.player_id=p_player and g.boss_cleared and prev.unlock_order=s.unlock_order-1);
 select count(*) into used from game_inventory where player_id=p_player and qty>0;
 if p.auto_reinvest then
  foreach facility in array array['workshop','storage'] loop
   level_now:=case facility when 'workshop' then p.workshop_level else p.storage_level end;
   needed:=case facility when 'workshop' then ceil(target/2.0)::integer else case when used>=game_storage_capacity(p_player)-12 then least(5,p.storage_level+1) else p.storage_level end end;
   cost:=(case facility when 'workshop' then 1600 else 1200 end)*power(3::numeric,level_now-1);
   if level_now<needed and p.gold>=cost then perform game_upgrade_facility(p_player,facility,level_now);select * into p from game_players where device_id=p_player;end if;
  end loop;
 end if;
 begin perform game_collect_loot(p_player,null);exception when raise_exception then if sqlerrm<>'storage_full' then raise;end if;end;
 -- Finished company goods only. Equipment and catalysts never enter auto sales.
 if not exists(select 1 from game_sell_jobs where player_id=p_player and status in ('running','queued')) then
  select i.item_id,i.qty,recipe.sale_gold,recipe.sell_seconds into stock from game_inventory i join game_recipes recipe on recipe.output_item=i.item_id where i.player_id=p_player and i.qty>0 and recipe.sale_gold>0 order by recipe.sort_order desc limit 1;
  if found then
   units:=least(10,stock.qty);update game_inventory set qty=qty-units where player_id=p_player and item_id=stock.item_id;
   insert into game_sell_jobs(player_id,item_id,sale_gold,quantity,started_at,finish_at,status) values(p_player,stock.item_id,stock.sale_gold*units,units,p_at,p_at+make_interval(secs=>stock.sell_seconds*units),'running');
  else
   select i.item_id,i.qty,d.sale_gold,d.sell_seconds into stock from game_inventory i join game_item_defs d on d.id=i.item_id where i.player_id=p_player and i.qty>60 and d.kind='material' and d.sale_gold>0 and not coalesce((d.acquisition->>'catalyst')::boolean,false) order by i.qty desc,i.item_id limit 1;
   if found then units:=least(20,stock.qty-60);update game_inventory set qty=qty-units where player_id=p_player and item_id=stock.item_id;
    insert into game_sell_jobs(player_id,item_id,sale_gold,quantity,started_at,finish_at,status) values(p_player,stock.item_id,stock.sale_gold*units,units,p_at,p_at+make_interval(secs=>stock.sell_seconds*units),'running');end if;
  end if;
 end if;
 if not exists(select 1 from game_craft_jobs where player_id=p_player and status in ('running','queued')) then
  for r in select * from game_recipes where sale_gold>0 and workshop_level<=p.workshop_level order by sale_gold::numeric/greatest(1,craft_seconds) desc,sort_order loop
   units:=5;
   for kv in select key,value::integer amount from jsonb_each_text(r.inputs) loop
    select coalesce(max(qty),0) into available from game_inventory where player_id=p_player and item_id=kv.key;
    units:=least(units,greatest(0,floor((available-12)::numeric/kv.amount)::integer));
   end loop;
   if units<1 then continue;end if;
   for kv in select key,value::integer amount from jsonb_each_text(r.inputs) loop update game_inventory set qty=qty-kv.amount*units where player_id=p_player and item_id=kv.key;end loop;
   insert into game_craft_jobs(player_id,recipe_id,output_item,output_qty,batch_qty,started_at,finish_at,status,materials_spent)
   values(p_player,r.id,r.output_item,r.output_qty*units,units,p_at,p_at+make_interval(secs=>r.craft_seconds*units),'running',(select jsonb_object_agg(key,to_jsonb(value::integer*units)) from jsonb_each_text(r.inputs)));
   exit;
  end loop;
 end if;
 delete from game_inventory where player_id=p_player and qty<=0;
 return n;
end $$;
-- Auto-completion is now the common rule, including older connected clients.
create or replace function public.game_enable_manual_economy_claim()
returns boolean language plpgsql security definer set search_path=public as $$
begin if auth.uid() is null then raise exception 'unauthorized';end if;return true;end $$;
-- Actual sale duration must agree with the catalog; equipment recipes cannot sell.
create or replace function public.game_start_sell(p_player uuid,p_item text,p_qty integer)
returns uuid language plpgsql set search_path=public as $$
declare r record;d record;have bigint;job_id uuid;unit_price integer;unit_seconds integer;scheduled_start timestamptz;capacity integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('game_tick_all',0));perform game_process_economy();
 if coalesce(p_qty,0)<1 then raise exception 'quantity_invalid';end if;
 select * into d from game_item_defs where id=p_item;
 if d.kind='equipment' then raise exception 'not_sellable';end if;
 select * into r from game_recipes where output_item=p_item and sale_gold>0 order by sort_order limit 1;
 if r.id is not null then unit_price:=r.sale_gold;unit_seconds:=greatest(1,r.sell_seconds);
 elsif d.kind='material' and d.sale_gold>0 then unit_price:=d.sale_gold;unit_seconds:=greatest(1,d.sell_seconds);
 else raise exception 'not_sellable';end if;
 select shop_level+4 into capacity from game_players where device_id=p_player;
 if (select count(*) from game_sell_jobs where player_id=p_player and status in ('running','queued'))>=capacity then raise exception 'sell_queue_full';end if;
 select qty into have from game_inventory where player_id=p_player and item_id=p_item for update;
 if coalesce(have,0)<p_qty then raise exception 'item_missing';end if;
 update game_inventory set qty=qty-p_qty where player_id=p_player and item_id=p_item;delete from game_inventory where player_id=p_player and qty<=0;
 select greatest(now(),coalesce(max(finish_at),now())) into scheduled_start from game_sell_jobs where player_id=p_player and status in ('running','queued');
 insert into game_sell_jobs(player_id,item_id,sale_gold,quantity,started_at,finish_at,status) values(p_player,p_item,unit_price*p_qty,p_qty,scheduled_start,scheduled_start+make_interval(secs=>unit_seconds*p_qty),case when scheduled_start<=now() then 'running' else 'queued' end) returning id into job_id;
 return job_id;
end $$;
revoke all on function public.game_finish_idle_jobs(uuid,timestamptz),public.game_run_idle_economy(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.game_finish_idle_jobs(uuid,timestamptz),public.game_run_idle_economy(uuid,timestamptz) to service_role;
