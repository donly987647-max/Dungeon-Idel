create or replace function public.game_process_economy()
returns integer
language plpgsql
set search_path to 'public'
as $$
declare j record; n integer:=0;
begin
  for j in
    select * from public.game_craft_jobs
    where status in ('running','queued','ready') and finish_at<=now()
    order by finish_at
    for update skip locked
  loop
    if j.status <> 'done' then
      insert into public.game_inventory(player_id,item_id,qty)
      values(j.player_id,j.output_item,j.output_qty)
      on conflict(player_id,item_id) do update
        set qty=public.game_inventory.qty+excluded.qty;
      update public.game_craft_jobs
        set status='done',completed_at=coalesce(completed_at,now())
        where id=j.id;
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
    if j.status <> 'done' then
      update public.game_players set gold=gold+j.sale_gold,updated_at=now() where device_id=j.player_id;
      update public.game_sell_jobs set status='done',completed_at=coalesce(completed_at,now()) where id=j.id;
      n:=n+1;
    end if;
  end loop;
  update public.game_sell_jobs set status='running'
  where status='queued' and started_at<=now() and finish_at>now();
  return n;
end
$$;

drop function if exists public.game_claim_craft(uuid);
drop function if exists public.game_claim_sell(uuid);
