begin;
-- A shared athlete membership must not expose another team's session responses.
drop policy entry_read on public.athlete_sessions;
create policy entry_read on public.athlete_sessions for select to authenticated using(
 public.owns_athlete(athlete_id)
 or exists(select 1 from public.athletes a where a.id=athlete_id and public.admin_org(a.organization_id))
 or (public.my_role()='coach' and exists(select 1 from public.sessions s where s.id=session_id and public.coaches_team(s.team_id)))
 or (public.my_role()='medical' and public.can_read_medical(athlete_id))
);
drop policy gps_read on public.gps_records;
create policy gps_read on public.gps_records for select to authenticated using(
 public.owns_athlete(athlete_id)
 or exists(select 1 from public.athletes a where a.id=athlete_id and public.admin_org(a.organization_id))
 or (public.my_role()='coach' and exists(select 1 from public.sessions s where s.id=session_id and public.coaches_team(s.team_id)))
);
-- Authenticated clients can call PostgREST directly, so also enforce configured scales at DB boundary.
create function public.validate_wellness_scales() returns trigger language plpgsql security definer set search_path=public as $$
declare config jsonb;metric text;value integer;lo integer;hi integer;
begin
 select o.settings into config from public.athletes a join public.organizations o on o.id=a.organization_id where a.id=new.athlete_id;
 foreach metric in array array['sleep_quality','fatigue','soreness','stress','appetite'] loop
  lo=coalesce((config->'scales'->metric->>'min')::integer,1);
  hi=coalesce((config->'scales'->metric->>'max')::integer,5);
  value=(to_jsonb(new)->>metric)::integer;
  if value<lo or value>hi then raise check_violation using message=metric||' outside configured scale';end if;
 end loop;
 new.updated_at=now();return new;
end$$;
create trigger wellness_configured_scales before insert or update on public.wellness_responses for each row execute function public.validate_wellness_scales();
revoke execute on function public.validate_wellness_scales() from public;
create function public.validate_staff_scope() returns trigger language plpgsql security definer set search_path=public as $$declare r public.app_role;begin
select role into r from public.user_profiles where id=new.user_id;
if r not in ('coach','medical') or r is null or (r='coach' and new.team_id is null) then raise check_violation using message='Invalid staff permission scope';end if;
return new;end$$;
create trigger staff_scope before insert or update on public.staff_permissions for each row execute function public.validate_staff_scope();
revoke execute on function public.validate_staff_scope() from public;
commit;
