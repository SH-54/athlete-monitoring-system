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
do $$begin begin perform public.bulk_import_records('rpe','[{"athlete_id":"40000000-0000-4000-8000-000000000001","session_id":"50000000-0000-4000-8000-000000000001","team_id":"30000000-0000-4000-8000-000000000001","date":"2026-11-03","status":"attended","minutes":70,"rpe":4}]',false);raise exception 'FAILED athlete bulk role gate';exception when insufficient_privilege then raise notice 'PASS: athlete cannot use staff bulk import, even for self';end;end$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$declare batch jsonb='[{"athlete_id":"40000000-0000-4000-8000-000000000001","session_id":"50000000-0000-4000-8000-000000000001","team_id":"30000000-0000-4000-8000-000000000001","date":"2026-11-03","status":"attended","minutes":70,"rpe":4}]';result jsonb;begin
result=public.bulk_import_records('rpe',batch,false);
perform public.test_assert(result->>'saved'='1','coach imports assigned team pending response');
result=public.bulk_import_records('rpe',jsonb_set(batch,'{0,rpe}','6'),false);
perform public.test_assert(result->>'skipped'='1' and (select rpe=4 from public.athlete_sessions where session_id='50000000-0000-4000-8000-000000000001'),'default import preserves existing submission');
result=public.bulk_import_records('rpe',jsonb_set(batch,'{0,rpe}','6'),true);
perform public.test_assert(result->>'saved'='1' and (select rpe=6 from public.athlete_sessions where session_id='50000000-0000-4000-8000-000000000001'),'explicit overwrite replaces existing submission');
result=public.bulk_import_records('rpe',jsonb_set(batch,'{0,rpe}','9'),null);
perform public.test_assert(result->>'skipped'='1' and (select rpe=6 from public.athlete_sessions where session_id='50000000-0000-4000-8000-000000000001'),'null overwrite cannot bypass preservation');
begin perform public.bulk_import_records('rpe',jsonb_set(batch,'{0,rpe}','5')||'[{"athlete_id":"40000000-0000-4000-8000-000000000002","session_id":"50000000-0000-4000-8000-000000000002","team_id":"30000000-0000-4000-8000-000000000002","date":"2026-11-03","status":"attended","minutes":70,"rpe":7}]'::jsonb,true);raise exception 'FAILED foreign team import';exception when insufficient_privilege then raise notice 'PASS: coach foreign-team import rejected';end;
perform public.test_assert((select rpe=6 from public.athlete_sessions where session_id='50000000-0000-4000-8000-000000000001'),'one unauthorized row rolls back entire batch');
result=public.bulk_import_records('wellness','[{"athlete_id":"40000000-0000-4000-8000-000000000001","date":"2026-11-03","sleep_hours":8,"sleep_quality":4,"fatigue":2,"soreness":2,"stress":2,"appetite":4,"weight":70}]',true);perform public.test_assert(result->>'saved'='1','coach can bulk-write assigned team wellness');
begin perform public.bulk_import_records('rpe',jsonb_set(batch,'{0,date}','"2026-11-04"'),true);raise exception 'FAILED mismatched session date';exception when insufficient_privilege then raise notice 'PASS: session date mismatch denied';end;
begin perform public.bulk_import_records('rpe',batch||batch,true);raise exception 'FAILED duplicate batch';exception when raise_exception then if sqlerrm='FAILED duplicate batch' then raise;end if;raise notice 'PASS: duplicate session rows rejected';end;
end$$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$declare result jsonb;wellness jsonb='[{"athlete_id":"40000000-0000-4000-8000-000000000001","date":"2026-11-03","sleep_hours":8,"sleep_quality":4,"fatigue":2,"soreness":2,"stress":2,"appetite":4,"weight":72}]';s2 uuid;s3 uuid;batch jsonb;begin
result=public.bulk_import_records('wellness',wellness,false);
perform public.test_assert(result->>'skipped'='1' and (select weight=70 from wellness_responses where athlete_id='40000000-0000-4000-8000-000000000001'),'wellness import preserves existing by default');
result=public.bulk_import_records('wellness',wellness,true);
perform public.test_assert(result->>'saved'='1' and (select weight=72 from wellness_responses where athlete_id='40000000-0000-4000-8000-000000000001'),'administrator can explicitly overwrite wellness');
perform public.test_assert((select count(*)=1 from pain_records where athlete_id='40000000-0000-4000-8000-000000000001'),'wellness import does not erase pain records');
s2=public.create_session(jsonb_build_object('team_id','30000000-0000-4000-8000-000000000001','code','BULK-2','date','2026-11-03','start_time','15:00','end_time','15:50','type','Gym','duration',50,'athlete_ids',jsonb_build_array('40000000-0000-4000-8000-000000000001')));
s3=public.create_session(jsonb_build_object('team_id','30000000-0000-4000-8000-000000000001','code','BULK-3','date','2026-11-03','start_time','17:00','end_time','17:30','type','Field','duration',30,'athlete_ids',jsonb_build_array('40000000-0000-4000-8000-000000000001')));
batch=jsonb_build_array(jsonb_build_object('athlete_id','40000000-0000-4000-8000-000000000001','session_id','50000000-0000-4000-8000-000000000001','team_id','30000000-0000-4000-8000-000000000001','date','2026-11-03','status','attended','minutes',70,'rpe',4),jsonb_build_object('athlete_id','40000000-0000-4000-8000-000000000001','session_id',s2,'team_id','30000000-0000-4000-8000-000000000001','date','2026-11-03','status','attended','minutes',50,'rpe',7),jsonb_build_object('athlete_id','40000000-0000-4000-8000-000000000001','session_id',s3,'team_id','30000000-0000-4000-8000-000000000001','date','2026-11-03','status','attended','minutes',30,'rpe',5));
result=public.bulk_import_records('rpe',batch,true);
perform public.test_assert(result->>'saved'='3','three sessions imported as three separate records');
perform public.test_assert((select total_load=780 from daily_training_load where athlete_id='40000000-0000-4000-8000-000000000001'),'bulk-imported three sessions calculate 780 AU');
begin perform public.bulk_import_records('rpe',jsonb_set(batch,'{1,rpe}','99'),true);raise exception 'FAILED invalid RPE batch';exception when raise_exception then if sqlerrm='FAILED invalid RPE batch' then raise;end if;raise notice 'PASS: invalid RPE rejected through direct RPC';end;
perform public.test_assert((select total_load=780 from daily_training_load where athlete_id='40000000-0000-4000-8000-000000000001'),'invalid numeric row rolls back complete batch');
end$$;
rollback;
