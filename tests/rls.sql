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
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
select test_assert((select count(*)=1 from athletes),'athlete reads only self');
select test_assert((select count(*)=1 from wellness_responses),'athlete reads only own wellness');
select test_assert((select count(*)=1 from pain_records),'athlete reads only own pain');
select test_assert((select count(*)=1 from sessions),'athlete reads only assigned sessions');
select test_assert((select count(*)=1 from training_load_records),'load view respects caller RLS');
select test_assert((select count(*)=0 from wellness_responses where athlete_id='40000000-0000-4000-8000-000000000002'),'direct other-athlete ID query returns no rows');
do $$begin begin insert into pain_records(athlete_id,date,body_part,severity) values('40000000-0000-4000-8000-000000000002','2026-11-03','forged',1);raise exception 'FAILED other athlete write';exception when insufficient_privilege then raise notice 'PASS: other athlete insert denied';end;end$$;
update athlete_sessions set status='attended',rpe=4,minutes=70;
select test_assert((select total_load=280 from daily_training_load),'own RPE write recalculates daily load');
update user_profiles set role='administrator' where id=auth.uid();
select test_assert(public.my_role()='athlete','self role escalation denied');
do $$begin begin update athlete_sessions set session_id='50000000-0000-4000-8000-000000000002';raise exception 'FAILED assignment tampering';exception when raise_exception then if sqlerrm='FAILED assignment tampering' then raise;end if;raise notice 'PASS: assignment identity immutable';end;end$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select test_assert((select count(*)=1 from athletes),'coach reads assigned team only');
select test_assert((select count(*)=1 from wellness_responses),'coach wellness limited to team');
select test_assert((select count(*)=1 from pain_records),'coach sees assigned team everyday pain');
select test_assert((select count(*)=0 from medical_notes),'coach cannot read medical notes');
update wellness_responses set weight=99;
select test_assert((select weight=99 from wellness_responses),'coach can proxy assigned team wellness');
update wellness_responses set weight=70;
do $$begin begin insert into sessions(team_id,code,date,start_time,end_time,type,duration) values('30000000-0000-4000-8000-000000000002','FORGED','2026-11-03','09:00','10:00','Field',60);raise exception 'FAILED coach foreign team write';exception when insufficient_privilege then raise notice 'PASS: coach foreign-team session denied';end;end$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
select test_assert((select count(*)=1 from wellness_responses),'medical sees permitted athlete only');
select test_assert((select count(*)=1 from pain_records),'medical sees permitted pain only');
insert into medical_notes(athlete_id,note) values('40000000-0000-4000-8000-000000000001','Fictional treatment');
select test_assert((select count(*)=1 from medical_notes),'medical can create permitted care note');
do $$begin begin insert into medical_notes(athlete_id,note) values('40000000-0000-4000-8000-000000000002','forged');raise exception 'FAILED medical foreign athlete write';exception when insufficient_privilege then raise notice 'PASS: unpermitted medical write denied';end;end$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select test_assert((select count(*)=2 from athletes),'administrator sees own organization only');
select test_assert((select count(*)=2 from pain_records),'administrator reads own organization pain');
update wellness_responses set weight=71;
select test_assert((select count(*)=2 from wellness_responses where weight=71),'administrator can edit own organization data');
select test_assert((select count(*)>0 from audit_logs where actor_id=auth.uid()),'writes produce audit history');
select test_assert((select count(*)=0 from athletes where organization_id='20000000-0000-4000-8000-000000000002'),'administrator cannot cross organizations');
-- Atomic RPC and multi-session aggregation tests under caller RLS.
do $$declare s2 uuid;s3 uuid;begin
s2=public.create_session(jsonb_build_object('team_id','30000000-0000-4000-8000-000000000001','code','TR003','date','2026-11-03','start_time','15:00','end_time','15:50','type','Gym','duration',50,'athlete_ids',jsonb_build_array('40000000-0000-4000-8000-000000000001')));
s3=public.create_session(jsonb_build_object('team_id','30000000-0000-4000-8000-000000000001','code','TR004','date','2026-11-03','start_time','17:00','end_time','17:30','type','Field','duration',30,'athlete_ids',jsonb_build_array('40000000-0000-4000-8000-000000000001')));
update public.athlete_sessions set status='attended',rpe=7 where session_id=s2;
update public.athlete_sessions set status='attended',rpe=5 where session_id=s3;
perform public.test_assert((select total_load=780 from public.daily_training_load where athlete_id='40000000-0000-4000-8000-000000000001'),'three SQL sessions aggregate to 780 AU');
perform public.edit_session(jsonb_build_object('id',s2,'team_id','30000000-0000-4000-8000-000000000001','code','EDITED','date','2026-11-03','start_time','15:00','end_time','15:55','type','Gym','duration',55,'athlete_ids',jsonb_build_array('40000000-0000-4000-8000-000000000001')));
perform public.test_assert((select minutes=50 from public.athlete_sessions where session_id=s2),'session edits preserve submitted athlete minutes');
begin perform public.edit_session(jsonb_build_object('id',s2,'team_id','30000000-0000-4000-8000-000000000001','code','EDITED','date','2026-11-03','start_time','15:00','end_time','15:55','type','Gym','duration',55,'athlete_ids','[]'::jsonb));raise exception 'FAILED roster protection';exception when raise_exception then if sqlerrm='FAILED roster protection' then raise;end if;raise notice 'PASS: submitted athlete cannot be removed from session';end;
begin perform public.save_wellness('{"athlete_id":"40000000-0000-4000-8000-000000000001","date":"2026-11-03","sleep_hours":8,"sleep_quality":4,"fatigue":2,"soreness":2,"stress":2,"appetite":4,"weight":99,"comment":"test","pain":[{"body_part":"knee","severity":15}]}'::jsonb);raise exception 'FAILED invalid pain';exception when check_violation then raise notice 'PASS: invalid pain rejected';end;
perform public.test_assert((select weight=71 from public.wellness_responses where athlete_id='40000000-0000-4000-8000-000000000001'),'wellness and pain writes roll back atomically');
begin update public.athletes set user_id='10000000-0000-4000-8000-000000000006' where id='40000000-0000-4000-8000-000000000001';raise exception 'FAILED cross org account link';exception when raise_exception then if sqlerrm='FAILED cross org account link' then raise;end if;raise notice 'PASS: cross-organization account link denied';end;
end$$;
reset role;
set local role anon;
do $$begin begin perform * from athletes;raise exception 'FAILED anonymous read';exception when insufficient_privilege then raise notice 'PASS: anonymous read denied';end;end$$;
rollback;
