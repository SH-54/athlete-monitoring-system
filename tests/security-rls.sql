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
-- Athlete A belongs to two teams; coach is permitted First only.
insert into public.team_memberships values('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002');
insert into public.athlete_sessions(athlete_id,session_id,minutes,status,rpe) values('40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002',50,'attended',8);
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select test_assert((select count(*)=1 from public.athlete_sessions),'coach cannot read shared athlete response in another team session');
select test_assert((select count(*)=1 from public.training_load_records),'load view cannot leak other-team response');
update public.athlete_sessions set rpe=10 where session_id='50000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
select test_assert((select rpe=8 from public.athlete_sessions where session_id='50000000-0000-4000-8000-000000000002'),'coach cannot change shared athlete response outside assigned team');
select test_assert((select count(*)=2 from public.athlete_sessions),'athlete still sees own sessions in both teams');
do $$begin begin update public.wellness_responses set fatigue=6 where athlete_id='40000000-0000-4000-8000-000000000001';raise exception 'FAILED configured scale bypass';exception when check_violation then raise notice 'PASS: direct DB writes honor configured wellness scale';end;end$$;
select test_assert((select fatigue=2 from public.wellness_responses),'invalid scale write rolled back');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$begin begin insert into public.staff_permissions(user_id,athlete_id) values('10000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002');raise exception 'FAILED coach individual permission';exception when check_violation then raise notice 'PASS: coach individual-only scope rejected';end;end$$;
rollback;
