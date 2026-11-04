begin;
create function public.edit_session(payload jsonb) returns uuid language plpgsql security invoker set search_path=public as $$declare sid uuid=(payload->>'id')::uuid;a text;begin
-- Lock protects submitted responses while changing the roster.
perform 1 from public.sessions where id=sid for update;
if not found then raise exception 'Session unavailable';end if;
perform 1 from public.athlete_sessions where session_id=sid for update;
if exists(select 1 from public.athlete_sessions e where e.session_id=sid and e.status<>'pending' and not (payload->'athlete_ids' ? e.athlete_id::text)) then raise exception 'Cannot remove an athlete with a submitted response';end if;
update public.sessions set code=payload->>'code',date=(payload->>'date')::date,type=payload->>'type',start_time=(payload->>'start_time')::time,end_time=(payload->>'end_time')::time,duration=(payload->>'duration')::int where id=sid and team_id=(payload->>'team_id')::uuid;
if not found then raise exception 'Session update denied';end if;
delete from public.athlete_sessions where session_id=sid and status='pending' and not (payload->'athlete_ids' ? athlete_id::text);
for a in select jsonb_array_elements_text(payload->'athlete_ids') loop insert into public.athlete_sessions(athlete_id,session_id,minutes) values(a::uuid,sid,(payload->>'duration')::int) on conflict(athlete_id,session_id) do update set minutes=case when athlete_sessions.status='pending' then excluded.minutes else athlete_sessions.minutes end;end loop;
return sid;end$$;
revoke execute on function public.edit_session(jsonb) from public;
grant execute on function public.edit_session(jsonb) to authenticated;
commit;
