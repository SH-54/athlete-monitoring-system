begin;
-- Coaches may record everyday wellness/pain for their assigned team; clinical notes stay restricted.
create function public.coaches_athlete(a uuid) returns boolean language sql stable security definer set search_path=public as $$select public.my_role()='coach' and exists(select 1 from public.team_memberships m where m.athlete_id=a and public.coaches_team(m.team_id))$$;
create or replace function public.can_write_athlete(a uuid) returns boolean language sql stable security definer set search_path=public as $$select public.owns_athlete(a) or public.coaches_athlete(a) or exists(select 1 from public.athletes where id=a and public.admin_org(organization_id))$$;
drop policy pain_read on public.pain_records;
create policy pain_read on public.pain_records for select to authenticated using(public.can_read_medical(athlete_id) or public.coaches_athlete(athlete_id));

create table public.invitations(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,
 email text not null check(length(email)<=254 and position('@' in email)>1),name text not null check(length(name) between 1 and 100),
 role public.app_role not null,team_id uuid references public.teams,athlete_id uuid references public.athletes,
 token_hash text not null unique,created_by uuid not null references auth.users,created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',accepted_by uuid references auth.users,accepted_at timestamptz,revoked_at timestamptz
);
alter table public.invitations enable row level security;
create policy invitations_admin_read on public.invitations for select to authenticated using(public.admin_org(organization_id));
-- Only functions can create/accept/revoke; invitation tokens are never stored as plaintext.
revoke all on public.invitations from anon,authenticated;
grant select on public.invitations to authenticated;
create trigger audit_row after insert or update or delete on public.invitations for each row execute function public.audit_change();

create function public.create_invitation(invite_email text,invite_name text,invite_role public.app_role,invite_team uuid default null,invite_athlete uuid default null) returns jsonb language plpgsql security definer set search_path=public as $$declare org uuid=public.my_org();token text;i uuid;begin
 if not public.admin_org(org) then raise insufficient_privilege;end if;
 if invite_email is null or length(btrim(invite_email))>254 or position('@' in invite_email)<2 or invite_name is null or length(btrim(invite_name)) not between 1 and 100 then raise check_violation using message='Invalid email or name';end if;
 if invite_team is not null and not exists(select 1 from public.teams where id=invite_team and organization_id=org) then raise insufficient_privilege;end if;
 if invite_athlete is not null and not exists(select 1 from public.athletes where id=invite_athlete and organization_id=org and user_id is null) then raise check_violation using message='Select an unlinked athlete in your organization';end if;
 if invite_role='athlete' and invite_athlete is null then raise check_violation using message='Athlete record required';end if;
 if invite_role='coach' and invite_team is null then raise check_violation using message='Coach team required';end if;
 if invite_role='medical' and invite_team is null and invite_athlete is null then raise check_violation using message='Medical scope required';end if;
 token=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into public.invitations(organization_id,email,name,role,team_id,athlete_id,token_hash,created_by) values(org,lower(btrim(invite_email)),btrim(invite_name),invite_role,invite_team,invite_athlete,encode(sha256(convert_to(token,'UTF8')),'hex'),auth.uid()) returning id into i;
 return jsonb_build_object('id',i,'token',token,'expires_in_days',7);
end$$;
create function public.revoke_invitation(invitation_id uuid) returns void language plpgsql security definer set search_path=public as $$begin
 update public.invitations set revoked_at=now() where id=invitation_id and public.admin_org(organization_id) and accepted_at is null;
 if not found then raise insufficient_privilege;end if;
end$$;
create function public.claim_invitation(raw_token text) returns void language plpgsql security definer set search_path=public as $$declare i public.invitations;u uuid=auth.uid();verified_email text;p public.user_profiles;begin
 if u is null then raise insufficient_privilege;end if;
 if raw_token is null or raw_token !~ '^[0-9a-f]{64}$' then raise check_violation using message='Invalid invitation';end if;
 select lower(email) into verified_email from auth.users where id=u and email_confirmed_at is not null;
 if verified_email is null then raise check_violation using message='Verify your email first';end if;
 select * into i from public.invitations where token_hash=encode(sha256(convert_to(raw_token,'UTF8')),'hex') for update;
 if not found or i.email<>verified_email or i.revoked_at is not null or i.expires_at<=now() then raise check_violation using message='Invitation unavailable';end if;
 if i.accepted_at is not null then if i.accepted_by=u then return;else raise check_violation using message='Invitation already accepted';end if;end if;
 select * into p from public.user_profiles where id=u;
 if found then raise check_violation using message='Account already belongs to an organization; contact your administrator';end if;
 insert into public.user_profiles(id,organization_id,role,name) values(u,i.organization_id,i.role,i.name);
 if i.role='athlete' then
  update public.athletes set user_id=u where id=i.athlete_id and organization_id=i.organization_id and user_id is null;
  if not found then raise check_violation using message='Athlete account already linked';end if;
 elsif i.role in ('coach','medical') then
  insert into public.staff_permissions(user_id,team_id,athlete_id) values(u,i.team_id,case when i.team_id is null then i.athlete_id else null end);
 end if;
 update public.invitations set accepted_at=now(),accepted_by=u where id=i.id;
end$$;
create function public.bootstrap_organization(org_name text,team_name text) returns uuid language plpgsql security definer set search_path=public as $$declare u uuid=auth.uid();org uuid;begin
 if u is null or not exists(select 1 from auth.users where id=u and email_confirmed_at is not null) then raise insufficient_privilege;end if;
 -- Lock the Auth row so concurrent first-time requests cannot create duplicate organizations.
 perform 1 from auth.users where id=u for update;
 if exists(select 1 from public.user_profiles where id=u) then raise check_violation using message='Account already configured';end if;
 if org_name is null or team_name is null or length(btrim(org_name)) not between 1 and 100 or length(btrim(team_name)) not between 1 and 100 then raise check_violation using message='Organization and team names required';end if;
 insert into public.organizations(name) values(btrim(org_name)) returning id into org;
 insert into public.user_profiles(id,organization_id,role,name) values(u,org,'administrator','Administrator');
 insert into public.teams(organization_id,name) values(org,btrim(team_name));return org;
end$$;
revoke execute on function public.coaches_athlete(uuid),public.create_invitation(text,text,public.app_role,uuid,uuid),public.revoke_invitation(uuid),public.claim_invitation(text),public.bootstrap_organization(text,text) from public,anon;
grant execute on function public.coaches_athlete(uuid),public.create_invitation(text,text,public.app_role,uuid,uuid),public.revoke_invitation(uuid),public.claim_invitation(text),public.bootstrap_organization(text,text) to authenticated;
create or replace function public.bulk_import_records(import_kind text, rows jsonb, overwrite_existing boolean default false)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare item jsonb;a uuid;sid uuid;existing_status public.attendance_status;changed uuid;saved integer=0;skipped integer=0;actor_role public.app_role;
begin
actor_role=public.my_role();
if actor_role is null or actor_role not in ('administrator','coach') then raise exception 'Bulk import requires staff role' using errcode='42501';end if;
if import_kind is null or rows is null or import_kind not in ('rpe','wellness') or jsonb_typeof(rows)<>'array' then raise exception 'Invalid batch';end if;
if jsonb_array_length(rows) not between 1 and 500 then raise exception 'Batch must contain 1 to 500 rows';end if;

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

commit;
