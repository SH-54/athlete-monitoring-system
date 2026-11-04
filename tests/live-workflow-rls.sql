begin;
create function public.test_assert(ok boolean,label text) returns void language plpgsql as $$begin if ok is not true then raise exception 'FAILED: %',label;end if;raise notice 'PASS: %',label;end$$;
grant execute on function public.test_assert(boolean,text) to authenticated,anon;
insert into auth.users(id) values('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002'),('10000000-0000-4000-8000-000000000003'),('10000000-0000-4000-8000-000000000004'),('10000000-0000-4000-8000-000000000005'),('10000000-0000-4000-8000-000000000006');
insert into organizations(id,name) values('20000000-0000-4000-8000-000000000001','Fictional A'),('20000000-0000-4000-8000-000000000002','Fictional B');
insert into user_profiles(id,organization_id,role,name) values
('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','administrator','Test Admin'),
('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','coach','Test Coach'),
('10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','medical','Test Medical'),
('10000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','athlete','Test Athlete A'),
('10000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000001','athlete','Test Athlete B'),
('10000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000002','administrator','Other Admin');
insert into teams(id,organization_id,name) values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','First'),('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Second'),('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002','Other');
insert into athletes(id,organization_id,user_id,name,number,position) values
('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','Test A',1,'GK'),
('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','Test B',2,'DF'),
('40000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002',null,'Other',3,'MF');
insert into team_memberships values('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001'),('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002'),('40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003');
insert into staff_permissions(user_id,team_id) values('10000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001');
insert into staff_permissions(user_id,athlete_id) values('10000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001');
insert into sessions(id,team_id,code,date,start_time,end_time,type,duration) values('50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','TR001','2026-11-03','09:00','10:10','Field',70),('50000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','TR002','2026-11-03','09:00','10:10','Field',70);
insert into athlete_sessions(athlete_id,session_id,minutes) values('40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',70),('40000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002',70);
insert into wellness_responses(athlete_id,date,sleep_hours,sleep_quality,fatigue,soreness,stress,appetite,weight) select id,'2026-11-03',8,4,2,2,2,4,70 from athletes;
insert into pain_records(athlete_id,date,body_part,severity) select id,'2026-11-03','Test knee',3 from athletes;

update auth.users set email='existing-'||id::text||'@example.test',email_confirmed_at=now();
insert into auth.users(id,email,email_confirmed_at) values
('10000000-0000-4000-8000-000000000007','player@example.test',null),
('10000000-0000-4000-8000-000000000008','wrong@example.test',now()),
('10000000-0000-4000-8000-000000000009','staff@example.test',now()),
('10000000-0000-4000-8000-000000000010','owner@example.test',now());
insert into public.athletes(id,organization_id,name,number,position) values('40000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','New Fictional Athlete',4,'FW');
insert into public.team_memberships values('40000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000001');
create temporary table invitation_test_tokens(key text primary key,token text,id uuid);
grant all on invitation_test_tokens to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select public.save_wellness('{"athlete_id":"40000000-0000-4000-8000-000000000001","date":"2026-11-04","sleep_hours":7,"sleep_quality":4,"fatigue":2,"soreness":2,"stress":2,"appetite":4,"weight":73,"comment":"proxy","pain":[{"body_part":"knee","severity":3}]}'::jsonb);
select test_assert((select weight=73 from wellness_responses where date='2026-11-04'),'coach saves morning wellness for athlete without device');
select test_assert((select count(*)=1 from pain_records where date='2026-11-04'),'coach saves daily pain report without clinical-note access');
do $$begin begin perform public.save_wellness('{"athlete_id":"40000000-0000-4000-8000-000000000002","date":"2026-11-04","sleep_hours":7,"sleep_quality":4,"fatigue":2,"soreness":2,"stress":2,"appetite":4,"weight":73,"pain":[]}'::jsonb);raise exception 'FAILED foreign proxy';exception when insufficient_privilege then raise notice 'PASS: coach cannot proxy outside assigned team';end;end$$;
do $$begin begin perform public.create_invitation('x@example.test','X','coach','30000000-0000-4000-8000-000000000001',null);raise exception 'FAILED coach invite';exception when insufficient_privilege then raise notice 'PASS: coach cannot issue invitations or assign roles';end;end$$;
select test_assert((select count(*)=0 from medical_notes),'clinical notes remain unavailable to coach');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$declare j jsonb;begin
j=public.create_invitation('player@example.test','New Player','athlete',null,'40000000-0000-4000-8000-000000000004');
insert into invitation_test_tokens values('athlete',j->>'token',(j->>'id')::uuid);
perform public.test_assert((select length(token_hash)=64 and token_hash<>(j->>'token') from public.invitations where id=(j->>'id')::uuid),'invitation stores only a token hash');
perform public.test_assert(exists(select 1 from audit_logs where actor_id=auth.uid() and table_name='invitations'),'invitation issue is audited');
end$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000008',true);
do $$begin begin perform public.claim_invitation((select token from invitation_test_tokens where key='athlete'));raise exception 'FAILED wrong email';exception when check_violation then raise notice 'PASS: wrong email cannot claim invitation';end;end$$;
select test_assert((select count(*)=0 from public.invitations),'unprovisioned user cannot enumerate invitations');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000007',true);
do $$begin begin perform public.claim_invitation((select token from invitation_test_tokens where key='athlete'));raise exception 'FAILED unverified email';exception when check_violation then raise notice 'PASS: unverified email cannot claim invitation';end;end$$;
reset role;
update auth.users set email_confirmed_at=now() where id='10000000-0000-4000-8000-000000000007';
set local role authenticated;
select public.claim_invitation((select token from invitation_test_tokens where key='athlete'));
select test_assert(public.my_role()='athlete','verified invite creates correct role');
select test_assert(public.owns_athlete('40000000-0000-4000-8000-000000000004'),'invite links only intended athlete');
select test_assert((select count(*)=1 from athletes),'invited athlete cannot read teammates');
select public.claim_invitation((select token from invitation_test_tokens where key='athlete'));
select test_assert((select count(*)=1 from user_profiles),'invitation repeat is idempotent for same user');
do $$begin begin perform public.bootstrap_organization('Illicit duplicate','Team');raise exception 'FAILED rebootstrap';exception when check_violation then raise notice 'PASS: existing user cannot bootstrap another organization';end;end$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$declare j jsonb;begin
j=public.create_invitation('staff@example.test','Staff','coach','30000000-0000-4000-8000-000000000001',null);
insert into invitation_test_tokens values('revoked',j->>'token',(j->>'id')::uuid);
perform public.revoke_invitation((j->>'id')::uuid);
j=public.create_invitation('staff@example.test','Staff','coach','30000000-0000-4000-8000-000000000001',null);
insert into invitation_test_tokens values('expired',j->>'token',(j->>'id')::uuid);
end$$;
reset role;
update public.invitations set expires_at=now()-interval '1 minute' where id=(select id from invitation_test_tokens where key='expired');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000009',true);
do $$begin begin perform public.claim_invitation((select token from invitation_test_tokens where key='revoked'));raise exception 'FAILED revoked invite';exception when check_violation then raise notice 'PASS: revoked invitation rejected';end;begin perform public.claim_invitation((select token from invitation_test_tokens where key='expired'));raise exception 'FAILED expired invite';exception when check_violation then raise notice 'PASS: expired invitation rejected';end;end$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$declare j jsonb;begin j=public.create_invitation('staff@example.test','Staff','coach','30000000-0000-4000-8000-000000000001',null);insert into invitation_test_tokens values('coach',j->>'token',(j->>'id')::uuid);end$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000009',true);
select public.claim_invitation((select token from invitation_test_tokens where key='coach'));
select test_assert(public.my_role()='coach' and public.coaches_team('30000000-0000-4000-8000-000000000001'),'coach invitation provisions assigned team');
select test_assert(not public.coaches_team('30000000-0000-4000-8000-000000000002'),'invited coach cannot access another team');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000010',true);
do $$declare org uuid;begin org=public.bootstrap_organization('New organization','First team');perform public.test_assert(public.my_role()='administrator' and public.my_org()=org,'verified first user can bootstrap own organization');perform public.test_assert((select count(*)=1 from public.teams),'new owner sees only own organization team');end$$;
rollback;
