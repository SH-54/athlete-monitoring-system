begin;
-- The entire batch is one transaction. SECURITY INVOKER preserves caller RLS.
-- The role gate also blocks athletes who may update their own individual records.
create function public.bulk_import_records(import_kind text, rows jsonb, overwrite_existing boolean default false)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare item jsonb;a uuid;sid uuid;existing_status public.attendance_status;changed uuid;saved integer=0;skipped integer=0;actor_role public.app_role;
begin
actor_role=public.my_role();
if actor_role is null or actor_role not in ('administrator','coach') then raise exception 'Bulk import requires staff role' using errcode='42501';end if;
if import_kind is null or rows is null or import_kind not in ('rpe','wellness') or jsonb_typeof(rows)<>'array' then raise exception 'Invalid batch';end if;
if jsonb_array_length(rows) not between 1 and 500 then raise exception 'Batch must contain 1 to 500 rows';end if;
if import_kind='wellness' and actor_role<>'administrator' then raise exception 'Wellness proxy import requires administrator' using errcode='42501';end if;
if exists(select 1 from jsonb_array_elements(rows) r group by r->>'athlete_id',case when import_kind='rpe' then r->>'session_id' else r->>'date' end having count(*)>1) then raise exception 'Duplicate batch rows';end if;
for item in select * from jsonb_array_elements(rows) loop
 a=(item->>'athlete_id')::uuid;
 if import_kind='rpe' then
  sid=(item->>'session_id')::uuid;
  if not exists(select 1 from public.sessions s where s.id=sid and s.team_id=(item->>'team_id')::uuid and s.date=(item->>'date')::date and public.coaches_team(s.team_id)) then raise exception 'Session or staff permission unavailable' using errcode='42501';end if;
  if not public.valid_assignment(a,sid) then raise exception 'Athlete is not a valid session assignment';end if;
  select status into existing_status from public.athlete_sessions where athlete_id=a and session_id=sid for update;
  if not found then raise exception 'Assigned athlete response unavailable' using errcode='42501';end if;
  -- Direct RPC callers must satisfy the same validation as the HTTP endpoint.
  if (item->>'status') is null or (item->>'status') not in ('attended','rehabilitation','rest','absent','not_participating') or (item->>'minutes') is null then raise exception 'Invalid attendance';end if;
  if (item->>'status') in ('rest','absent','not_participating') and ((item->>'minutes')::integer<>0 or item->>'rpe' is not null) then raise exception 'Non-participation requires zero minutes and no RPE';end if;
  if (item->>'minutes')::integer not between 0 and 600 or (item->>'rpe')::numeric not between 0 and 10 then raise exception 'RPE or minutes out of range';end if;
  if existing_status<>'pending' and not coalesce(overwrite_existing,false) then skipped=skipped+1;continue;end if;
  update public.athlete_sessions set status=(item->>'status')::public.attendance_status,minutes=(item->>'minutes')::integer,rpe=(item->>'rpe')::numeric where athlete_id=a and session_id=sid;
  if not found then raise exception 'Response update denied' using errcode='42501';end if;
  saved=saved+1;
 else
  if not public.can_write_athlete(a) then raise exception 'Athlete permission denied' using errcode='42501';end if;
  changed=null;
  insert into public.wellness_responses(athlete_id,date,sleep_hours,sleep_quality,fatigue,soreness,stress,appetite,weight,comment)
  values(a,(item->>'date')::date,(item->>'sleep_hours')::numeric,(item->>'sleep_quality')::int,(item->>'fatigue')::int,(item->>'soreness')::int,(item->>'stress')::int,(item->>'appetite')::int,(item->>'weight')::numeric,coalesce(item->>'comment',''))
  on conflict(athlete_id,date) do update set sleep_hours=excluded.sleep_hours,sleep_quality=excluded.sleep_quality,fatigue=excluded.fatigue,soreness=excluded.soreness,stress=excluded.stress,appetite=excluded.appetite,weight=excluded.weight,comment=excluded.comment,updated_at=now() where coalesce(overwrite_existing,false) returning id into changed;
  -- Medical pain records are deliberately not replaced by a daily wellness import.
  if changed is null then skipped=skipped+1;else saved=saved+1;end if;
 end if;
end loop;
return jsonb_build_object('saved',saved,'skipped',skipped);
end$$;
revoke execute on function public.bulk_import_records(text,jsonb,boolean) from public,anon;
grant execute on function public.bulk_import_records(text,jsonb,boolean) to authenticated;
commit;
