-- Functions are SECURITY DEFINER only where a narrowly scoped authorization check needs it.
create or replace function public.is_active_user() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from profiles where user_id=auth.uid() and not blocked);
$$;
create or replace function public.has_role(wanted text[]) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.is_active_user() and exists(select 1 from user_roles where user_id=auth.uid() and role_name=any(wanted));
$$;
create or replace function public.is_admin() returns boolean language sql stable as $$ select public.has_role(array['super_admin','admin']); $$;
create or replace function public.in_department(d uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.is_active_user() and exists(select 1 from staff_departments where user_id=auth.uid() and department_id=d);
$$;
create or replace function public.can_app(d uuid, write_access boolean default false) returns boolean language sql stable as $$
 select public.is_admin() or (public.in_department(d) and public.has_role(case when write_access then array['department_admin','operator'] else array['department_admin','operator','viewer'] end));
$$;
create or replace function public.can_appeal(d uuid, write_access boolean default false) returns boolean language sql stable as $$
 select public.is_admin() or (public.in_department(d) and public.has_role(case when write_access then array['department_admin','appeals_operator'] else array['department_admin','appeals_operator','viewer'] end));
$$;
create or replace function public.app_access(a uuid, write_access boolean default false) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.is_active_user() and exists(select 1 from applications where id=a and (user_id=auth.uid() or public.can_app(department_id,write_access)));
$$;
create or replace function public.appeal_access(a uuid, write_access boolean default false) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.is_active_user() and exists(select 1 from appeals where id=a and (user_id=auth.uid() or public.can_appeal(department_id,write_access)));
$$;
create or replace function public.content_visible(s text, at_time timestamptz, deleted timestamptz) returns boolean language sql stable as $$
 select deleted is null and s in ('published','scheduled') and at_time<=now();
$$;
create or replace function public.create_profile() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
 begin insert into profiles(user_id,email,first_name) values(new.id,new.email,coalesce(new.raw_user_meta_data->>'first_name',''));return new;end;
$$;
drop trigger if exists on_auth_signup on auth.users;
create trigger on_auth_signup after insert on auth.users for each row execute function public.create_profile();
create or replace function public.touch_row() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
create or replace function public.audit_change() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
 declare rid uuid; begin rid=case when TG_OP='DELETE' then old.id else new.id end;
 insert into audit_logs(actor_id,action,entity,entity_id,metadata) values(auth.uid(),TG_OP,TG_TABLE_NAME,rid,jsonb_build_object('operation',TG_OP));
 if TG_OP='DELETE' then return old;end if; return new; end;
$$;
-- Guard protected profile columns even when an owner calls REST directly.
create or replace function public.guard_profile() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
 begin
 if auth.uid() is not null and not public.has_role(array['super_admin','admin']) and (new.user_id<>old.user_id or new.blocked<>old.blocked or new.email is distinct from old.email or new.id<>old.id or new.created_at<>old.created_at) then raise exception 'Недозволена зміна профілю';end if;
 return new;end;
$$;
drop trigger if exists profile_guard on profiles;
create trigger profile_guard before update on profiles for each row execute function public.guard_profile();
create or replace function public.sync_profile_email() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
 begin update profiles set email=new.email where user_id=new.id;return new;end;
$$;
drop trigger if exists on_auth_email on auth.users;
create trigger on_auth_email after update of email on auth.users for each row execute function public.sync_profile_email();
-- All application writes use RPCs; direct UPDATE / INSERT are denied by RLS.
create or replace function public.save_draft(p_service uuid, p_data jsonb, p_id uuid default null) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
 declare a applications; s services; aid uuid; snap jsonb; begin
 if not public.is_active_user() then raise exception 'Потрібна авторизація';end if;
 select * into s from services where id=p_service and available and public.content_visible(status,published_at,deleted_at) and format<>'offline';
 if s.id is null then raise exception 'Послуга недоступна';end if;
 if jsonb_typeof(p_data)<>'object' then raise exception 'Некоректні дані';end if;
 select coalesce(jsonb_agg(to_jsonb(f) order by f.sort_order),'[]') into snap from service_form_fields f join service_forms sf on sf.id=f.form_id where sf.service_id=s.id and sf.active;
 if p_id is null then
 insert into applications(user_id,service_id,department_id,data,form_snapshot) values(auth.uid(),s.id,s.department_id,p_data,snap) returning id into aid;
 else
 select * into a from applications where id=p_id for update;
 if a.user_id is distinct from auth.uid() or a.status<>'draft' or a.service_id<>p_service then raise exception 'Чернетка недоступна';end if;
 update applications set data=p_data,form_snapshot=snap,department_id=s.department_id where id=p_id;aid=p_id;
 end if;return aid;end;
$$;
create or replace function public.submit_application(p_id uuid) returns text language plpgsql security definer set search_path=public,pg_temp as $$
 declare a applications; f jsonb; v jsonb; n text; k text; begin
 select * into a from applications where id=p_id for update;
 if not public.is_active_user() or a.user_id is distinct from auth.uid() or a.status<>'draft' then raise exception 'Заява недоступна';end if;
 if not exists(select 1 from services where id=a.service_id and format<>'offline' and available and public.content_visible(status,published_at,deleted_at)) then raise exception 'Послуга недоступна';end if;
 for f in select value from jsonb_array_elements(a.form_snapshot) loop
 k=f->>'key';v=a.data->k;
 if coalesce(f->'validation'->'showWhen'->>'field','')<>'' and (a.data->(f->'validation'->'showWhen'->>'field')) is distinct from f->'validation'->'showWhen'->'equals' then continue;end if;
 if (f->>'required')::boolean and f->>'type' not in ('heading','information') then
 if f->>'type' in ('file','image','pdf') then
 if not exists(select 1 from application_files where application_id=a.id and field_key=k) then raise exception 'Додайте файл: %',f->>'label';end if;
 elsif v is null or v='null'::jsonb or v='""'::jsonb or v='[]'::jsonb or (f->>'type' in ('checkbox','confirmation') and v<>'true'::jsonb) then raise exception 'Заповніть поле: %',f->>'label';end if;
 end if;
 if v is not null and v not in ('null'::jsonb,'""'::jsonb) then
 if f->>'type'='phone' and (v#>>'{}') !~ '^\+?[0-9 ()-]{7,20}$' then raise exception 'Перевірте номер телефону';end if;
 if f->>'type'='address' and length(trim(v#>>'{}'))<8 then raise exception 'Вкажіть повну адресу';end if;
 if f->>'type'='date' and coalesce((f->'validation'->>'noFuture')::boolean,false) and (v#>>'{}')::date>current_date then raise exception 'Дата не може бути в майбутньому';end if;
 if f->>'type'='email' and (v#>>'{}') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Некоректний email';end if;
 if f->>'type' in ('select','radio') and not ((f->'options') @> jsonb_build_array(v#>>'{}')) then raise exception 'Невідома опція';end if;
 if f->>'type'='multiselect' and (jsonb_typeof(v)<>'array' or not ((f->'options') @> v)) then raise exception 'Невідомі опції';end if;
 if f->>'type'='number' then
 if (v#>>'{}') !~ '^-?[0-9]+(\.[0-9]+)?$' then raise exception 'Потрібне число';end if;
 if f->'validation' ? 'min' and (v#>>'{}')::numeric < (f->'validation'->>'min')::numeric then raise exception 'Число менше мінімуму';end if;
 if f->'validation' ? 'max' and (v#>>'{}')::numeric > (f->'validation'->>'max')::numeric then raise exception 'Число більше максимуму';end if;
 end if;
 if f->'validation' ? 'minLength' and length(v#>>'{}')<(f->'validation'->>'minLength')::int then raise exception 'Текст закороткий';end if;
 if f->'validation' ? 'maxLength' and length(v#>>'{}')>(f->'validation'->>'maxLength')::int then raise exception 'Текст задовгий';end if;
 if coalesce(f->'validation'->>'pattern','')<>'' and (v#>>'{}') !~ (f->'validation'->>'pattern') then raise exception 'Невірний формат';end if;
 end if;
 end loop;
 n='CK-'||to_char(now() at time zone 'Europe/Kyiv','YYYY')||'-'||lpad(nextval('application_number_seq')::text,6,'0');
 update applications set status='submitted',number=n,submitted_at=now() where id=a.id;
 insert into application_answers(application_id,field_key,value) select a.id,key,value from jsonb_each(a.data) on conflict(application_id,field_key) do update set value=excluded.value;
 return n;end;
$$;
create or replace function public.change_application(p_id uuid,p_status text,p_note text default '',p_assignee uuid default null) returns void language plpgsql security definer set search_path=public,pg_temp as $$
 declare a applications; allowed text[]; begin
 select * into a from applications where id=p_id for update;
 if not public.can_app(a.department_id,true) then raise exception 'Недостатньо прав';end if;
 allowed=case a.status when 'submitted' then array['received','cancelled'] when 'received' then array['in_review','needs_more_info','rejected','cancelled'] when 'in_review' then array['needs_more_info','approved','rejected','cancelled'] when 'needs_more_info' then array['in_review','rejected','cancelled'] when 'approved' then array['completed','cancelled'] else array[]::text[] end;
 if p_status<>a.status and not p_status=any(allowed) then raise exception 'Недопустимий перехід статусу';end if;
 if p_assignee is not null and not exists(select 1 from staff_departments sd join user_roles ur on ur.user_id=sd.user_id join profiles p on p.user_id=sd.user_id where sd.user_id=p_assignee and sd.department_id=a.department_id and not p.blocked and ur.role_name in ('department_admin','operator','admin','super_admin')) then raise exception 'Працівник не належить департаменту';end if;
 update applications set status=p_status,assignee_id=p_assignee where id=a.id;
 if length(trim(p_note))>0 then insert into application_messages(application_id,user_id,message) values(a.id,auth.uid(),p_note);end if;
 end;
$$;
create or replace function public.cancel_application(p_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
 begin if not public.is_active_user() then raise exception 'Потрібна авторизація';end if;
 update applications set status='cancelled' where id=p_id and user_id=auth.uid() and status in ('draft','submitted','received','needs_more_info');
 if not found then raise exception 'Не можна скасувати';end if;end;
$$;
create or replace function public.create_appeal(p_category uuid,p_title text,p_location text,p_message text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
 declare a uuid; d uuid;begin
 if not public.is_active_user() or length(trim(p_title))<3 or length(trim(p_message))<10 then raise exception 'Перевірте звернення';end if;
 select department_id into d from appeal_categories where id=p_category;if not found then raise exception 'Виберіть категорію';end if;
 insert into appeals(user_id,category_id,department_id,number,title,location,message) values(auth.uid(),p_category,d,'AP-'||to_char(now(),'YYYY')||'-'||lpad(nextval('appeal_number_seq')::text,6,'0'),p_title,p_location,p_message) returning id into a;return a;end;
$$;
create or replace function public.change_appeal(p_id uuid,p_status text,p_response text default '',p_assignee uuid default null,p_department uuid default null) returns void language plpgsql security definer set search_path=public,pg_temp as $$
 declare a appeals;begin select * into a from appeals where id=p_id for update;
 if not public.can_appeal(a.department_id,true) then raise exception 'Недостатньо прав';end if;
 if p_department is not null and not public.is_admin() and not public.has_role(array['department_admin']) then raise exception 'Недостатньо прав для передачі';end if;
 if p_assignee is not null and not exists(select 1 from staff_departments where user_id=p_assignee and department_id=coalesce(p_department,a.department_id)) then raise exception 'Невірний працівник';end if;
 update appeals set status=p_status,response=p_response,assignee_id=p_assignee,department_id=coalesce(p_department,a.department_id) where id=a.id;end;
$$;
create or replace function public.status_label(s text) returns text language sql immutable as $$
 select case s when 'draft' then 'Чернетка' when 'submitted' then 'Подано' when 'received' then 'Прийнято' when 'in_review' then 'На розгляді' when 'needs_more_info' then 'Потрібна інформація' when 'approved' then 'Схвалено' when 'rejected' then 'Відхилено' when 'completed' then 'Виконано' when 'cancelled' then 'Скасовано' when 'new' then 'Нове' when 'forwarded' then 'Передано' when 'in_progress' then 'У роботі' else s end;
$$;
create or replace function public.track_status() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
 begin
 if TG_OP='INSERT' or new.status<>old.status then
 if TG_TABLE_NAME='applications' then
 insert into application_status_history(application_id,actor_id,old_status,new_status) values(new.id,auth.uid(),case when TG_OP='UPDATE' then old.status end,new.status);
 insert into notifications(user_id,type,title,message,link) values(new.user_id,'application','Статус заяви змінено',coalesce(new.number,'Чернетка')||': '||public.status_label(new.status),'/account/applications/'||new.id);
 else
 insert into appeal_status_history(appeal_id,actor_id,old_status,new_status,note) values(new.id,auth.uid(),case when TG_OP='UPDATE' then old.status end,new.status,new.response);
 insert into notifications(user_id,type,title,message,link) values(new.user_id,'system','Статус звернення змінено',new.number||': '||public.status_label(new.status),'/account/appeals/'||new.id);
 end if;end if;return new;end;
$$;
create or replace function public.message_notification() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
 declare a applications;begin select * into a from applications where id=new.application_id;
 if new.user_id<>a.user_id and not new.internal then insert into notifications(user_id,type,title,message,link) values(a.user_id,'application','Нове повідомлення',left(new.message,200),'/account/applications/'||a.id);end if;return new;end;
$$;
create or replace function public.mark_notifications(p_id uuid default null) returns void language plpgsql security definer set search_path=public,pg_temp as $$
 begin if not public.is_active_user() then raise exception 'Потрібна авторизація';end if;update notifications set read_at=now() where user_id=auth.uid() and (p_id is null or id=p_id);end;
$$;
create or replace function public.set_staff(p_user uuid,p_roles text[],p_departments uuid[],p_blocked boolean default false) returns void language plpgsql security definer set search_path=public,pg_temp as $$
 begin
 if not public.has_role(array['super_admin']) then raise exception 'Лише головний адміністратор';end if;
 if p_user=auth.uid() then raise exception 'Не можна змінити власні права цим інструментом';end if;
 if not exists(select 1 from profiles where user_id=p_user) then raise exception 'Користувача не знайдено';end if;
 delete from user_roles where user_id=p_user; insert into user_roles(user_id,role_name) select p_user,unnest(p_roles);
 delete from staff_departments where user_id=p_user;insert into staff_departments(user_id,department_id) select p_user,unnest(p_departments);
 update profiles set blocked=p_blocked where user_id=p_user;end;
$$;
-- Restricted to service_role, shared across function instances. Clients cannot acquire the lease.
create or replace function public.acquire_alerts_lease() returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
 begin
 insert into api_cache(key) values('alerts') on conflict(key) do nothing;
 update api_cache set lease_until=now()+interval '20 seconds' where key='alerts' and (lease_until is null or lease_until<now()) and (refreshed_at is null or refreshed_at<now()-interval '15 seconds');
 return found;end;
$$;
revoke all on function public.acquire_alerts_lease() from public,anon,authenticated;
grant execute on function public.acquire_alerts_lease() to service_role;
drop trigger if exists touch on departments;
create trigger touch before update on departments for each row execute function public.touch_row();
drop trigger if exists touch on profiles;
create trigger touch before update on profiles for each row execute function public.touch_row();
drop trigger if exists touch on roles;
create trigger touch before update on roles for each row execute function public.touch_row();
drop trigger if exists touch on user_roles;
create trigger touch before update on user_roles for each row execute function public.touch_row();
drop trigger if exists touch on staff_departments;
create trigger touch before update on staff_departments for each row execute function public.touch_row();
drop trigger if exists touch on service_categories;
create trigger touch before update on service_categories for each row execute function public.touch_row();
drop trigger if exists touch on appeal_categories;
create trigger touch before update on appeal_categories for each row execute function public.touch_row();
drop trigger if exists touch on news_categories;
create trigger touch before update on news_categories for each row execute function public.touch_row();
drop trigger if exists touch on document_categories;
create trigger touch before update on document_categories for each row execute function public.touch_row();
drop trigger if exists touch on services;
create trigger touch before update on services for each row execute function public.touch_row();
drop trigger if exists touch on service_forms;
create trigger touch before update on service_forms for each row execute function public.touch_row();
drop trigger if exists touch on service_form_fields;
create trigger touch before update on service_form_fields for each row execute function public.touch_row();
drop trigger if exists touch on applications;
create trigger touch before update on applications for each row execute function public.touch_row();
drop trigger if exists touch on application_answers;
create trigger touch before update on application_answers for each row execute function public.touch_row();
drop trigger if exists touch on application_files;
create trigger touch before update on application_files for each row execute function public.touch_row();
drop trigger if exists touch on application_status_history;
create trigger touch before update on application_status_history for each row execute function public.touch_row();
drop trigger if exists touch on application_messages;
create trigger touch before update on application_messages for each row execute function public.touch_row();
drop trigger if exists touch on appeals;
create trigger touch before update on appeals for each row execute function public.touch_row();
drop trigger if exists touch on appeal_files;
create trigger touch before update on appeal_files for each row execute function public.touch_row();
drop trigger if exists touch on appeal_status_history;
create trigger touch before update on appeal_status_history for each row execute function public.touch_row();
drop trigger if exists touch on news;
create trigger touch before update on news for each row execute function public.touch_row();
drop trigger if exists touch on announcements;
create trigger touch before update on announcements for each row execute function public.touch_row();
drop trigger if exists touch on documents;
create trigger touch before update on documents for each row execute function public.touch_row();
drop trigger if exists touch on events;
create trigger touch before update on events for each row execute function public.touch_row();
drop trigger if exists touch on notifications;
create trigger touch before update on notifications for each row execute function public.touch_row();
drop trigger if exists touch on saved_services;
create trigger touch before update on saved_services for each row execute function public.touch_row();
drop trigger if exists touch on user_addresses;
create trigger touch before update on user_addresses for each row execute function public.touch_row();
drop trigger if exists touch on user_documents;
create trigger touch before update on user_documents for each row execute function public.touch_row();
drop trigger if exists touch on faqs;
create trigger touch before update on faqs for each row execute function public.touch_row();
drop trigger if exists touch on site_settings;
create trigger touch before update on site_settings for each row execute function public.touch_row();
drop trigger if exists touch on city_status;
create trigger touch before update on city_status for each row execute function public.touch_row();
drop trigger if exists touch on audit_logs;
create trigger touch before update on audit_logs for each row execute function public.touch_row();
drop trigger if exists touch on account_deletion_requests;
create trigger touch before update on account_deletion_requests for each row execute function public.touch_row();
drop trigger if exists touch on api_cache;
create trigger touch before update on api_cache for each row execute function public.touch_row();
drop trigger if exists audit on services;
create trigger audit after insert or update or delete on services for each row execute function public.audit_change();
drop trigger if exists audit on service_forms;
create trigger audit after insert or update or delete on service_forms for each row execute function public.audit_change();
drop trigger if exists audit on service_form_fields;
create trigger audit after insert or update or delete on service_form_fields for each row execute function public.audit_change();
drop trigger if exists audit on news;
create trigger audit after insert or update or delete on news for each row execute function public.audit_change();
drop trigger if exists audit on documents;
create trigger audit after insert or update or delete on documents for each row execute function public.audit_change();
drop trigger if exists audit on events;
create trigger audit after insert or update or delete on events for each row execute function public.audit_change();
drop trigger if exists audit on city_status;
create trigger audit after insert or update or delete on city_status for each row execute function public.audit_change();
drop trigger if exists audit on announcements;
create trigger audit after insert or update or delete on announcements for each row execute function public.audit_change();
drop trigger if exists audit on site_settings;
create trigger audit after insert or update or delete on site_settings for each row execute function public.audit_change();
drop trigger if exists audit on departments;
create trigger audit after insert or update or delete on departments for each row execute function public.audit_change();
drop trigger if exists audit on user_roles;
create trigger audit after insert or update or delete on user_roles for each row execute function public.audit_change();
drop trigger if exists audit on staff_departments;
create trigger audit after insert or update or delete on staff_departments for each row execute function public.audit_change();
drop trigger if exists audit on applications;
create trigger audit after insert or update or delete on applications for each row execute function public.audit_change();
drop trigger if exists audit on appeals;
create trigger audit after insert or update or delete on appeals for each row execute function public.audit_change();
drop trigger if exists audit on profiles;
create trigger audit after insert or update or delete on profiles for each row execute function public.audit_change();
drop trigger if exists status_track on applications;
create trigger status_track after insert or update on applications for each row execute function public.track_status();
drop trigger if exists status_track on appeals;
create trigger status_track after insert or update on appeals for each row execute function public.track_status();
drop trigger if exists notify_message on application_messages;
create trigger notify_message after insert on application_messages for each row execute function public.message_notification();
revoke all on function public.save_draft(uuid,jsonb,uuid) from public,anon;
grant execute on function public.save_draft(uuid,jsonb,uuid) to authenticated;
revoke all on function public.submit_application(uuid) from public,anon;
grant execute on function public.submit_application(uuid) to authenticated;
revoke all on function public.change_application(uuid,text,text,uuid) from public,anon;
grant execute on function public.change_application(uuid,text,text,uuid) to authenticated;
revoke all on function public.cancel_application(uuid) from public,anon;
grant execute on function public.cancel_application(uuid) to authenticated;
revoke all on function public.create_appeal(uuid,text,text,text) from public,anon;
grant execute on function public.create_appeal(uuid,text,text,text) to authenticated;
revoke all on function public.change_appeal(uuid,text,text,uuid,uuid) from public,anon;
grant execute on function public.change_appeal(uuid,text,text,uuid,uuid) to authenticated;
revoke all on function public.mark_notifications(uuid) from public,anon;
grant execute on function public.mark_notifications(uuid) to authenticated;
revoke all on function public.set_staff(uuid,text[],uuid[],boolean) from public,anon;
grant execute on function public.set_staff(uuid,text[],uuid[],boolean) to authenticated;
-- Atomic form replacement. Draft submissions retain an immutable field snapshot.
create or replace function public.replace_service_form(p_service uuid,p_fields jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
 declare s services; f uuid; field jsonb;begin
 select * into s from services where id=p_service;
 if s.id is null or not (public.is_admin() or (public.has_role(array['department_admin']) and public.in_department(s.department_id))) then raise exception 'Недостатньо прав';end if;
 if jsonb_typeof(p_fields)<>'array' or jsonb_array_length(p_fields)>100 then raise exception 'Некоректна форма';end if;
 insert into service_forms(service_id) values(p_service) on conflict(service_id) do update set version=service_forms.version+1 returning id into f;
 delete from service_form_fields where form_id=f;
 for field in select value from jsonb_array_elements(p_fields) loop
 if jsonb_typeof(coalesce(field->'options','[]'))<>'array' or jsonb_typeof(coalesce(field->'validation','{}'))<>'object' then raise exception 'Перевірте опції та правила';end if;
 if coalesce(field->'validation'->>'pattern','')<>'' then perform '' ~ (field->'validation'->>'pattern');end if;
 insert into service_form_fields(form_id,key,type,label,placeholder,required,help_text,options,validation,sort_order) values(f,field->>'key',field->>'type',field->>'label',coalesce(field->>'placeholder',''),coalesce((field->>'required')::boolean,false),coalesce(field->>'help_text',''),coalesce(field->'options','[]'),coalesce(field->'validation','{}'),coalesce((field->>'sort_order')::int,0));
 end loop;end;
$$;
revoke all on function public.replace_service_form(uuid,jsonb) from public,anon;
grant execute on function public.replace_service_form(uuid,jsonb) to authenticated;
grant all on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;
