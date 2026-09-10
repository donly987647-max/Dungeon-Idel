create or replace function public.game_sync_candidate_species_name()
returns trigger
language plpgsql
set search_path = 'public'
as $function$
begin
  new.name := case new.family
    when 'slime' then '슬라임'
    when 'goblin' then '고블린'
    when 'troll' then '트롤'
    when 'mandrake' then '만드라고라'
    when 'pixie' then '픽시'
    when 'imp' then '임프'
    when 'wisp' then '위습'
    when 'golem' then '골렘'
    when 'mimic' then '미믹'
    else coalesce(nullif(new.family,''),'몬스터')
  end;
  return new;
end
$function$;

revoke execute on function public.game_sync_candidate_species_name() from public, anon, authenticated;

drop trigger if exists game_sync_candidate_species_name on public.game_candidates;
create trigger game_sync_candidate_species_name
before insert or update of family, name on public.game_candidates
for each row execute function public.game_sync_candidate_species_name();

create or replace function public.game_sync_monster_form_name()
returns trigger
language plpgsql
set search_path = 'public'
as $function$
declare
  v_form_name text;
begin
  if coalesce(new.form_id,'') <> '' and new.form_id <> new.family then
    select e.target_name
      into v_form_name
      from public.game_evolution_defs e
     where e.base_family = new.family
       and e.target_form_id = new.form_id
     order by e.tier desc, e.id
     limit 1;
  end if;

  new.name := coalesce(v_form_name, case new.family
    when 'slime' then '슬라임'
    when 'goblin' then '고블린'
    when 'troll' then '트롤'
    when 'mandrake' then '만드라고라'
    when 'pixie' then '픽시'
    when 'imp' then '임프'
    when 'wisp' then '위습'
    when 'golem' then '골렘'
    when 'mimic' then '미믹'
    else coalesce(nullif(new.family,''),'몬스터')
  end);
  return new;
end
$function$;

revoke execute on function public.game_sync_monster_form_name() from public, anon, authenticated;

drop trigger if exists game_sync_monster_form_name on public.game_monsters;
create trigger game_sync_monster_form_name
before insert or update of family, form_id, name on public.game_monsters
for each row execute function public.game_sync_monster_form_name();

update public.game_candidates
set name = name;

update public.game_monsters
set name = name
where released_at is null;
