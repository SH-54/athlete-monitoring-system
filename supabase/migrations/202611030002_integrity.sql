begin;
create function public.guard_org_links() returns trigger language plpgsql security definer set search_path=public as $$begin
if tg_op='UPDATE' and new.organization_id<>old.organization_id then raise exception 'Organization identity is immutable';end if;
if tg_table_name='athletes' then
 if new.user_id is not null then
 if not exists(select 1 from public.user_profiles where id=new.user_id and organization_id=new.organization_id and role='athlete') then raise exception 'Athlete account must belong to the same organization and athlete role';end if;
 end if;
end if;
if tg_table_name='user_profiles' then
 if new.role<>'athlete' and exists(select 1 from public.athletes where user_id=new.id) then raise exception 'Unlink athlete account before changing role';end if;
end if;
return new;end$$;
create trigger athlete_org_link before insert or update on public.athletes for each row execute function public.guard_org_links();
create trigger profile_org_link before insert or update on public.user_profiles for each row execute function public.guard_org_links();
create function public.guard_session_team() returns trigger language plpgsql set search_path=public as $$begin if new.team_id<>old.team_id then raise exception 'Session team is immutable; create a new session';end if;return new;end$$;
create trigger session_team_identity before update on public.sessions for each row execute function public.guard_session_team();
create function public.save_athlete(payload jsonb) returns uuid language plpgsql security invoker set search_path=public as $$declare aid uuid;tid uuid=(payload->>'team_id')::uuid;begin
if payload->>'id' is null then insert into public.athletes(organization_id,user_id,name,number,position) values(public.my_org(),nullif(payload->>'user_id','')::uuid,payload->>'name',(payload->>'number')::int,payload->>'position') returning id into aid;
else aid=(payload->>'id')::uuid;update public.athletes set user_id=nullif(payload->>'user_id','')::uuid,name=payload->>'name',number=(payload->>'number')::int,position=payload->>'position' where id=aid;end if;
insert into public.team_memberships(athlete_id,team_id) values(aid,tid) on conflict do nothing;return aid;end$$;
revoke execute on function public.guard_org_links(),public.guard_session_team(),public.save_athlete(jsonb) from public;
grant execute on function public.save_athlete(jsonb) to authenticated;
commit;
