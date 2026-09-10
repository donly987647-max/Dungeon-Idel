-- Candidate stats must survive hiring exactly as previewed. The legacy BEFORE
-- INSERT trigger overwrote three families' stats, grades and personalities.
drop trigger if exists trg_game_monster_detail_defaults on public.game_monsters;
alter table public.game_players add column if not exists starter_support_offered boolean not null default false;

create or replace function public.game_spawn_candidates()
returns integer language plpgsql set search_path=public as $$
declare p record; i int; r numeric; grade text; family text; template jsonb;
  personality text; trait text; talent int; multiplier numeric;
  made int:=0; locked_count int; new_count int;
begin
  for p in select * from public.game_players where next_candidate_at<=now() for update skip locked loop
    delete from public.game_candidates where player_id=p.device_id and not coalesce(is_locked,false);
    select count(*) into locked_count from public.game_candidates where player_id=p.device_id and coalesce(is_locked,false);
    new_count:=greatest(0,greatest(4,p.tavern_level+3)-locked_count);
    for i in 1..new_count loop
      r:=random();
      grade:=case when p.tavern_level<=1 then case when r<0.65 then 'C' when r<0.95 then 'B' else 'A' end
        when p.tavern_level=2 then case when r<0.45 then 'C' when r<0.85 then 'B' when r<0.99 then 'A' else 'S' end
        when p.tavern_level=3 then case when r<0.25 then 'C' when r<0.70 then 'B' when r<0.97 then 'A' else 'S' end
        when p.tavern_level=4 then case when r<0.10 then 'C' when r<0.50 then 'B' when r<0.93 then 'A' else 'S' end
        else case when r<0.35 then 'B' when r<0.85 then 'A' else 'S' end end;
      -- An unlocked batch always includes recovery, defense and damage choices.
      -- Player-locked candidates keep their original slots and data.
      family:=case i when 1 then (array['mandrake','pixie'])[1+floor(random()*2)::int]
        when 2 then (array['golem','mimic'])[1+floor(random()*2)::int]
        when 3 then (array['goblin','troll','imp','wisp'])[1+floor(random()*4)::int]
        else (array['slime','goblin','troll','mandrake','pixie','imp','wisp','golem','mimic'])[1+floor(random()*9)::int] end;
      template:=public.game_species_template(family);
      personality:=(array['침착','약탈광','광전사','겁쟁이','인간혐오','야행성'])[1+floor(random()*6)::int];
      trait:=(array['질긴 가죽','야성','재빠름','수집광','학습 본능'])[1+floor(random()*5)::int];
      talent:=least(100,greatest(0,p.tavern_level-1)+case grade when 'S' then 94+floor(random()*7)::int when 'A' then 88+floor(random()*10)::int when 'B' then 82+floor(random()*11)::int else 76+floor(random()*12)::int end);
      multiplier:=case grade when 'S' then 1.16 when 'A' then 1.10 when 'B' then 1.05 else 1 end;
      insert into public.game_candidates(player_id,name,family,talent,trait,power_base,personality,growth_grade,hp_base,atk_base,def_base,spd_base,crit_base,evade_base,is_locked)
      values(p.device_id,template->>'name',family,talent,trait,(template->>'power')::int,personality,grade,
        round((template->>'hp')::numeric*multiplier),round((template->>'atk')::numeric*multiplier),round((template->>'def')::numeric*multiplier),round((template->>'spd')::numeric*multiplier),(template->>'crit')::numeric,(template->>'evade')::numeric,false);
      made:=made+1;
    end loop;
    update public.game_players set next_candidate_at=now()+interval '4 hours',updated_at=now() where device_id=p.device_id;
  end loop;
  return made;
end $$;

-- Service-role-only bootstrap: one transaction prevents half-created companies.
-- Repeated login cannot farm starter employees or candidate refreshes.
create or replace function public.game_initialize_company(p_player uuid)
returns void language plpgsql set search_path=public as $$
declare created boolean:=false; offered boolean; template jsonb; family text;
begin
  insert into public.game_players(device_id,device_secret_hash) values(p_player,null) on conflict do nothing;
  created:=found;
  select starter_support_offered into offered from public.game_players where device_id=p_player for update;
  if created then
    insert into public.game_monsters(player_id,name,family,form_id,evolution_tier,level,xp,talent,trait,power_base,hp_base,atk_base,def_base,spd_base,crit_base,evade_base,personality,growth_grade)
    values(p_player,'슬라임','slime','slime',0,1,0,88,'질긴 가죽',48,145,15,11,9,0.04,0.03,'침착','B');
  end if;
  if not offered then
    -- Existing developed companies need no starter offer. A new or stalled
    -- company with no candidates can choose support immediately on login.
    if not exists(select 1 from public.game_candidates where player_id=p_player)
      and (select count(*) from public.game_monsters where player_id=p_player and released_at is null)<3 then
      foreach family in array array['mandrake','imp','golem'] loop
        template:=public.game_species_template(family);
        insert into public.game_candidates(player_id,name,family,talent,trait,power_base,personality,growth_grade,hp_base,atk_base,def_base,spd_base,crit_base,evade_base,is_locked)
        values(p_player,template->>'name',family,86,'학습 본능',(template->>'power')::int,'침착','B',
          (template->>'hp')::int,(template->>'atk')::int,(template->>'def')::int,(template->>'spd')::int,(template->>'crit')::numeric,(template->>'evade')::numeric,false);
      end loop;
      update public.game_players set next_candidate_at=now()+interval '4 hours' where device_id=p_player;
    end if;
    update public.game_players set starter_support_offered=true where device_id=p_player;
  end if;
end $$;
revoke all on function public.game_initialize_company(uuid) from public,anon,authenticated;
grant execute on function public.game_initialize_company(uuid) to service_role;
