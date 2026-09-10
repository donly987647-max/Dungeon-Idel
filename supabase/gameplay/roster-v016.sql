create or replace function public.game_sync_candidate_species_name()
returns trigger language plpgsql set search_path=public as $$
begin new.name:=coalesce(game_species_template(new.family)->>'name',new.name);return new;end $$;
create or replace function public.game_sync_monster_form_name()
returns trigger language plpgsql set search_path=public as $$
declare form_name text;form_skill text;
begin
 select target_name,skill_id into form_name,form_skill from game_evolution_defs where target_form_id=new.form_id limit 1;
 new.name:=coalesce(form_name,game_species_template(new.family)->>'name',new.name);
 new.skill_id:=coalesce(form_skill,game_species_template(new.family)->>'skill',new.skill_id);
 return new;
end $$;
update public.game_monsters set name=name; -- name/skill trigger maps every current form without resetting stats
update public.game_candidates set name=name;
