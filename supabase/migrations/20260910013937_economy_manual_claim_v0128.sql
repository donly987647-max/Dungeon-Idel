create or replace function public.game_process_economy()
returns integer
language plpgsql
set search_path to 'public'
as $$
declare j record; n integer:=0;
begin
  for j in
    select * from public.game_craft_jobs
    where status in ('running','queued') and finish_at<=now()
    order by finish_at
    for update skip locked
  loop
    update public.game_craft_jobs
      set status='ready', completed_at=coalesce(completed_at,finish_at)
      where id=j.id;
    n:=n+1;
  end loop;

  update public.game_craft_jobs
    set status='running'
    where status='queued' and started_at<=now() and finish_at>now();

  for j in
    select * from public.game_sell_jobs
    where status in ('running','queued') and finish_at<=now()
    order by finish_at
    for update skip locked
  loop
    update public.game_sell_jobs
      set status='ready', completed_at=coalesce(completed_at,finish_at)
      where id=j.id;
    n:=n+1;
  end loop;

  update public.game_sell_jobs
    set status='running'
    where status='queued' and started_at<=now() and finish_at>now();

  return n;
end
$$;

create or replace function public.game_claim_craft(p_player uuid,p_job uuid)
returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare j record;
begin
  perform public.game_process_economy();
  select * into j from public.game_craft_jobs where id=p_job and player_id=p_player for update;
  if j.id is null then raise exception 'job_missing'; end if;
  if j.status='done' then raise exception 'job_already_claimed'; end if;
  if j.status<>'ready' then raise exception 'job_not_ready'; end if;
  insert into public.game_inventory(player_id,item_id,qty)
  values(j.player_id,j.output_item,j.output_qty)
  on conflict(player_id,item_id) do update set qty=public.game_inventory.qty+excluded.qty;
  update public.game_craft_jobs set status='done' where id=j.id;
  return jsonb_build_object('jobId',j.id,'itemId',j.output_item,'quantity',j.output_qty);
end
$$;

create or replace function public.game_claim_sell(p_player uuid,p_job uuid)
returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare j record;
begin
  perform public.game_process_economy();
  select * into j from public.game_sell_jobs where id=p_job and player_id=p_player for update;
  if j.id is null then raise exception 'job_missing'; end if;
  if j.status='done' then raise exception 'job_already_claimed'; end if;
  if j.status<>'ready' then raise exception 'job_not_ready'; end if;
  update public.game_players set gold=gold+j.sale_gold,updated_at=now() where device_id=j.player_id;
  update public.game_sell_jobs set status='done' where id=j.id;
  return jsonb_build_object('jobId',j.id,'itemId',j.item_id,'quantity',j.quantity,'gold',j.sale_gold);
end
$$;

revoke execute on function public.game_claim_craft(uuid,uuid) from public,anon,authenticated;
revoke execute on function public.game_claim_sell(uuid,uuid) from public,anon,authenticated;
grant execute on function public.game_claim_craft(uuid,uuid) to service_role;
grant execute on function public.game_claim_sell(uuid,uuid) to service_role;
