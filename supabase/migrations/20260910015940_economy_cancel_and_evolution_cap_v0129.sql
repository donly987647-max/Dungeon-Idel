alter table public.game_craft_jobs add column if not exists materials_spent jsonb not null default '{}'::jsonb;
alter table public.game_craft_jobs add column if not exists cancelled_at timestamptz;
alter table public.game_sell_jobs add column if not exists cancelled_at timestamptz;

alter table public.game_craft_jobs drop constraint if exists game_craft_jobs_status_check;
alter table public.game_craft_jobs add constraint game_craft_jobs_status_check check (status in ('running','queued','ready','done','cancelled'));
alter table public.game_sell_jobs drop constraint if exists game_sell_jobs_status_check;
alter table public.game_sell_jobs add constraint game_sell_jobs_status_check check (status in ('running','queued','ready','done','cancelled'));

update public.game_craft_jobs j
set materials_spent=coalesce((select jsonb_object_agg(k.key,to_jsonb((k.value::bigint*greatest(1,j.batch_qty))::bigint)) from public.game_recipes r cross join lateral jsonb_each_text(r.inputs) k where r.id=j.recipe_id),'{}'::jsonb)
where coalesce(j.materials_spent,'{}'::jsonb)='{}'::jsonb and j.status in ('running','queued','ready');

create or replace function public.game_start_craft(p_player uuid,p_recipe text,p_qty integer)
returns uuid language plpgsql set search_path to 'public' as $$
declare r record;kv record;have bigint;queued_count int;queue_cap int;job_id uuid;scheduled_start timestamptz;scheduled_finish timestamptz;spend jsonb:='{}'::jsonb;
begin
 perform public.game_process_economy();if coalesce(p_qty,0)<1 then raise exception 'quantity_invalid';end if;
 select * into r from public.game_recipes where id=p_recipe;if r.id is null then raise exception 'recipe_missing';end if;
 select greatest(5,coalesce(workshop_level,1)+4) into queue_cap from public.game_players where device_id=p_player;
 select count(*) into queued_count from public.game_craft_jobs where player_id=p_player and status in ('running','queued');if queued_count>=queue_cap then raise exception 'craft_queue_full';end if;
 select coalesce(jsonb_object_agg(k.key,to_jsonb((k.value::bigint*p_qty::bigint)::bigint)),'{}'::jsonb) into spend from jsonb_each_text(r.inputs) k;
 for kv in select key,value from jsonb_each_text(spend) loop select coalesce(qty,0) into have from public.game_inventory where player_id=p_player and item_id=kv.key;if coalesce(have,0)<kv.value::bigint then raise exception 'material_short';end if;end loop;
 for kv in select key,value from jsonb_each_text(spend) loop update public.game_inventory set qty=qty-kv.value::bigint where player_id=p_player and item_id=kv.key;delete from public.game_inventory where player_id=p_player and item_id=kv.key and qty<=0;end loop;
 select greatest(now(),coalesce(max(finish_at),now())) into scheduled_start from public.game_craft_jobs where player_id=p_player and status in ('running','queued');scheduled_finish:=scheduled_start+make_interval(secs=>r.craft_seconds*p_qty);
 insert into public.game_craft_jobs(player_id,recipe_id,output_item,output_qty,batch_qty,started_at,finish_at,status,materials_spent) values(p_player,r.id,r.output_item,r.output_qty*p_qty,p_qty,scheduled_start,scheduled_finish,case when scheduled_start<=now() then 'running' else 'queued' end,spend) returning id into job_id;return job_id;
end $$;

create or replace function public.game_reflow_craft_queue(p_player uuid)
returns integer language plpgsql set search_path to 'public' as $$
declare j record;cursor_at timestamptz:=now();duration interval;has_running boolean:=false;moved integer:=0;
begin
 perform public.game_process_economy();
 for j in select id,status,started_at,finish_at from public.game_craft_jobs where player_id=p_player and status in ('running','queued') order by started_at,id for update loop
  duration:=greatest(interval '1 second',j.finish_at-j.started_at);
  if not has_running and j.status='running' and j.started_at<=now() and j.finish_at>now() then has_running:=true;cursor_at:=j.finish_at;
  else update public.game_craft_jobs set started_at=cursor_at,finish_at=cursor_at+duration,status=case when not has_running and cursor_at<=now() then 'running' else 'queued' end where id=j.id;if not has_running and cursor_at<=now() then has_running:=true;end if;cursor_at:=cursor_at+duration;moved:=moved+1;end if;
 end loop;return moved;
end $$;

create or replace function public.game_reflow_sell_queue(p_player uuid)
returns integer language plpgsql set search_path to 'public' as $$
declare j record;cursor_at timestamptz:=now();duration interval;has_running boolean:=false;moved integer:=0;
begin
 perform public.game_process_economy();
 for j in select id,status,started_at,finish_at from public.game_sell_jobs where player_id=p_player and status in ('running','queued') order by started_at,id for update loop
  duration:=greatest(interval '1 second',j.finish_at-j.started_at);
  if not has_running and j.status='running' and j.started_at<=now() and j.finish_at>now() then has_running:=true;cursor_at:=j.finish_at;
  else update public.game_sell_jobs set started_at=cursor_at,finish_at=cursor_at+duration,status=case when not has_running and cursor_at<=now() then 'running' else 'queued' end where id=j.id;if not has_running and cursor_at<=now() then has_running:=true;end if;cursor_at:=cursor_at+duration;moved:=moved+1;end if;
 end loop;return moved;
end $$;

create or replace function public.game_cancel_craft(p_job uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare uid uuid:=auth.uid();j public.game_craft_jobs%rowtype;kv record;spent jsonb;shifted int:=0;
begin
 if uid is null then raise exception 'unauthorized';end if;perform public.game_process_economy();select * into j from public.game_craft_jobs where id=p_job and player_id=uid for update;if j.id is null then raise exception 'job_missing';end if;if j.status not in ('running','queued') then raise exception 'job_not_cancelable';end if;
 spent:=coalesce(j.materials_spent,'{}'::jsonb);if spent='{}'::jsonb then select coalesce(jsonb_object_agg(k.key,to_jsonb((k.value::bigint*greatest(1,j.batch_qty))::bigint)),'{}'::jsonb) into spent from public.game_recipes r cross join lateral jsonb_each_text(r.inputs) k where r.id=j.recipe_id;end if;
 for kv in select key,value from jsonb_each_text(spent) loop insert into public.game_inventory(player_id,item_id,qty) values(uid,kv.key,kv.value::bigint) on conflict(player_id,item_id) do update set qty=public.game_inventory.qty+excluded.qty;end loop;
 update public.game_craft_jobs set status='cancelled',cancelled_at=now(),completed_at=now() where id=j.id;shifted:=public.game_reflow_craft_queue(uid);return jsonb_build_object('type','craft','itemId',j.output_item,'quantity',j.batch_qty,'refunded',spent,'shiftedJobs',shifted);
end $$;

create or replace function public.game_cancel_sell(p_job uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare uid uuid:=auth.uid();j public.game_sell_jobs%rowtype;shifted int:=0;
begin
 if uid is null then raise exception 'unauthorized';end if;perform public.game_process_economy();select * into j from public.game_sell_jobs where id=p_job and player_id=uid for update;if j.id is null then raise exception 'job_missing';end if;if j.status not in ('running','queued') then raise exception 'job_not_cancelable';end if;
 insert into public.game_inventory(player_id,item_id,qty) values(uid,j.item_id,greatest(1,j.quantity)) on conflict(player_id,item_id) do update set qty=public.game_inventory.qty+excluded.qty;
 update public.game_sell_jobs set status='cancelled',cancelled_at=now(),completed_at=now() where id=j.id;shifted:=public.game_reflow_sell_queue(uid);return jsonb_build_object('type','sell','itemId',j.item_id,'quantity',j.quantity,'shiftedJobs',shifted);
end $$;

revoke all on function public.game_reflow_craft_queue(uuid) from public,anon,authenticated;
revoke all on function public.game_reflow_sell_queue(uuid) from public,anon,authenticated;
revoke all on function public.game_cancel_craft(uuid) from public,anon;
revoke all on function public.game_cancel_sell(uuid) from public,anon;
grant execute on function public.game_cancel_craft(uuid) to authenticated;
grant execute on function public.game_cancel_sell(uuid) to authenticated;

create or replace function public.game_apply_xp(p_monster uuid,p_amount integer)
returns void language plpgsql set search_path to 'public' as $$
declare lv int;x int;needed int;cap_level int;fam text;form text;exp_id uuid;cur_pending bigint;requested_xp int;remaining_xp int;applied_xp int:=0;step_xp int;
begin
 requested_xp:=greatest(0,coalesce(p_amount,0));select level,xp,family,form_id into lv,x,fam,form from public.game_monsters where id=p_monster for update;if lv is null then return;end if;
 select min(required_level) into cap_level from public.game_evolution_defs where base_family=fam and from_form_id=form;cap_level:=coalesce(cap_level,60);
 if lv>=cap_level then update public.game_monsters set xp=0 where id=p_monster;return;end if;
 remaining_xp:=requested_xp;
 while remaining_xp>0 and lv<cap_level loop needed:=greatest(1,lv*100);if x>=needed then x:=x-needed;lv:=lv+1;continue;end if;step_xp:=least(remaining_xp,needed-x);x:=x+step_xp;remaining_xp:=remaining_xp-step_xp;applied_xp:=applied_xp+step_xp;if x>=needed then x:=x-needed;lv:=lv+1;end if;end loop;
 if lv>=cap_level then lv:=cap_level;x:=0;end if;update public.game_monsters set level=lv,xp=x where id=p_monster;
 if applied_xp>0 then select ge.id into exp_id from public.game_expedition_members em join public.game_expeditions ge on ge.id=em.expedition_id where em.monster_id=p_monster and ge.active=true order by ge.started_at desc limit 1;if exp_id is not null then select coalesce((pending_xp->>p_monster::text)::bigint,0) into cur_pending from public.game_expeditions where id=exp_id for update;update public.game_expeditions set pending_xp=jsonb_set(coalesce(pending_xp,'{}'::jsonb),array[p_monster::text],to_jsonb(cur_pending+applied_xp),true),updated_at=now() where id=exp_id;end if;end if;
end $$;