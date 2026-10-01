-- V2 migration: run AFTER 01–05. Safe to repeat; does not delete existing content.
begin;
alter table announcements drop constraint if exists announcements_placement_check;
alter table announcements add constraint announcements_placement_check check(placement in ('banner','modal','pinned','global'));
alter table announcements add column if not exists version integer not null default 1 check(version>0);
alter table announcements add column if not exists created_by uuid references auth.users(id);
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check check(type in ('system','application','appeal','service','emergency','news','city','important'));
create table if not exists user_activity(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,title text not null,description text default '',kind text not null,link text,created_at timestamptz not null default now());
create index if not exists activity_owner_date on user_activity(user_id,created_at desc);
alter table user_activity enable row level security;
grant select on user_activity to authenticated;
drop policy if exists activity_owner on user_activity;
create policy activity_owner on user_activity for select to authenticated using(user_id=auth.uid() and is_active_user());
create table if not exists account_verifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,kind text not null check(kind in ('phone','identity','address')),verified boolean not null default false,verified_by uuid references auth.users(id),created_at timestamptz default now(),updated_at timestamptz default now(),unique(user_id,kind));
alter table account_verifications enable row level security;
grant select,insert,update,delete on account_verifications to authenticated;
drop policy if exists verification_owner on account_verifications;
create policy verification_owner on account_verifications for select to authenticated using((user_id=auth.uid() and is_active_user()) or is_admin());
drop policy if exists verification_admin on account_verifications;
create policy verification_admin on account_verifications for all to authenticated using(is_admin()) with check(is_admin());
create table if not exists application_public_tokens(id uuid primary key default gen_random_uuid(),application_id uuid unique not null references applications(id) on delete cascade,token text unique not null default replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),created_at timestamptz default now());
alter table application_public_tokens enable row level security;
-- No table grants: the token is a bearer capability, accessible only through narrow RPCs.
create or replace function get_application_public_token(p_id uuid) returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare t text;begin
 if not is_active_user() or not exists(select 1 from applications where id=p_id and user_id=auth.uid() and status<>'draft' and deleted_at is null) then raise exception 'Заява недоступна';end if;
 insert into application_public_tokens(application_id) values(p_id) on conflict(application_id) do nothing;
 select token into t from application_public_tokens where application_id=p_id;return t;end;$$;
create or replace function public_application_status(p_token text) returns table(number text,type text,status text,created_at timestamptz,updated_at timestamptz) language sql stable security definer set search_path=public,pg_temp as $$
 select a.number,s.title,a.status,a.created_at,a.updated_at from application_public_tokens t join applications a on a.id=t.application_id join services s on s.id=a.service_id where length(p_token)=64 and t.token=p_token and a.deleted_at is null and a.status<>'draft';$$;
create or replace function revoke_application_public_token(p_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$begin
 if not is_active_user() or not exists(select 1 from applications where id=p_id and user_id=auth.uid()) then raise exception 'Заява недоступна';end if;
 delete from application_public_tokens where application_id=p_id;end;$$;
revoke all on function get_application_public_token(uuid),revoke_application_public_token(uuid) from public,anon;
grant execute on function get_application_public_token(uuid),revoke_application_public_token(uuid) to authenticated;
revoke all on function public_application_status(text) from public;
grant execute on function public_application_status(text) to anon,authenticated;
create table if not exists content_revisions(id uuid primary key default gen_random_uuid(),entity_type text not null,entity_id uuid not null,version integer not null,changed_by uuid references auth.users(id),created_at timestamptz not null default now(),snapshot jsonb not null,changed_fields text[] not null default '{}',unique(entity_type,entity_id,version));
create index if not exists revision_entity_version on content_revisions(entity_type,entity_id,version desc);
create or replace function can_manage_revision(t text,rid uuid) returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$begin
 if is_admin() then return true;end if;
 if t in ('news','documents','events') then return has_role(array['editor']);end if;
 if t='services' then return has_role(array['department_admin']) and exists(select 1 from services where id=rid and in_department(department_id));end if;
 return false;end;$$;
alter table content_revisions enable row level security;
grant select on content_revisions to authenticated;
drop policy if exists revisions_staff on content_revisions;
create policy revisions_staff on content_revisions for select to authenticated using(can_manage_revision(entity_type,entity_id));
create or replace function capture_revision() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare s jsonb; o jsonb; v integer; fields text[];begin
 s=to_jsonb(new);o=case when TG_OP='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
 if (s-'updated_at')=(o-'updated_at') then return new;end if;
 if TG_OP='UPDATE' and not exists(select 1 from content_revisions where entity_type=TG_TABLE_NAME and entity_id=new.id) then
 insert into content_revisions(entity_type,entity_id,version,changed_by,snapshot,changed_fields) values(TG_TABLE_NAME,new.id,1,null,o,array['initial']);end if;
 select coalesce(max(version),0)+1 into v from content_revisions where entity_type=TG_TABLE_NAME and entity_id=new.id;
 select array_agg(key order by key) into fields from jsonb_each(s) where key not in ('updated_at','created_at','id') and value is distinct from o->key;
 insert into content_revisions(entity_type,entity_id,version,changed_by,snapshot,changed_fields) values(TG_TABLE_NAME,new.id,v,auth.uid(),s,coalesce(fields,'{}'));return new;end;$$;
do $$declare t text;begin foreach t in array array['services','news','documents','events','faqs','announcements'] loop
 execute format('drop trigger if exists v2_revision on %I',t);
 execute format('create trigger v2_revision after insert or update on %I for each row execute function capture_revision()',t);
 execute format('insert into content_revisions(entity_type,entity_id,version,snapshot,changed_fields) select %L,id,1,to_jsonb(r),array[''initial''] from %I r where not exists(select 1 from content_revisions where entity_type=%L and entity_id=r.id)',t,t,t);
 end loop;end;$$;
create or replace function restore_content_revision(p_revision uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r content_revisions; assignments text; affected integer;begin
 select * into r from content_revisions where id=p_revision;
 if r.id is null or r.entity_type not in ('services','news','documents','events','faqs','announcements') or not can_manage_revision(r.entity_type,r.entity_id) then raise exception 'Немає прав для відновлення';end if;
 if r.entity_type='services' and not is_admin() and not exists(select 1 from services where id=r.entity_id and department_id::text=r.snapshot->>'department_id') then raise exception 'Не можна змінювати департамент';end if;
 select string_agg(format('%I=x.%I',column_name,column_name),',') into assignments from information_schema.columns where table_schema='public' and table_name=r.entity_type and column_name not in ('id','created_at','updated_at','created_by');
 execute format('update %I target set %s from jsonb_populate_record(null::%I,$1) x where target.id=$2',r.entity_type,assignments,r.entity_type) using r.snapshot,r.entity_id;
 get diagnostics affected=row_count;
 if affected=0 then raise exception 'Запис видалено; відновлення недоступне';end if;
 insert into audit_logs(actor_id,action,entity,entity_id,metadata) values(auth.uid(),'RESTORE',r.entity_type,r.entity_id,jsonb_build_object('revision',r.version));end;$$;
revoke all on function restore_content_revision(uuid) from public,anon;
grant execute on function restore_content_revision(uuid) to authenticated;
create or replace function set_notification_read(p_id uuid default null,p_read boolean default true) returns void language plpgsql security definer set search_path=public,pg_temp as $$begin
 if not is_active_user() then raise exception 'Потрібна авторизація';end if;
 update notifications set read_at=case when p_read then now() else null end where user_id=auth.uid() and (p_id is null or id=p_id);end;$$;
revoke all on function set_notification_read(uuid,boolean) from public,anon;
grant execute on function set_notification_read(uuid,boolean) to authenticated;
create or replace function record_user_activity() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid; title_text text; descr text default ''; href text;begin
 if TG_TABLE_NAME='applications' then
 uid=new.user_id;href='/account/applications/'||new.id;
 if TG_OP='INSERT' or old.status is not distinct from new.status then return new;end if;
 title_text=case when new.status='submitted' then 'Подано заявку' when new.status='completed' then 'Заяву завершено' else 'Змінено статус заяви' end;descr=coalesce(new.number,'')||' · '||status_label(new.status);
 elsif TG_TABLE_NAME='appeals' then
 uid=new.user_id;href='/account/appeals/'||new.id;
 if TG_OP='INSERT' then title_text='Створено звернення';elsif old.status is distinct from new.status or old.response is distinct from new.response then title_text='Звернення оновлено';else return new;end if;descr=coalesce(new.number,'')||' · '||status_label(new.status);
 elsif TG_TABLE_NAME='application_messages' then
 if new.internal then return new;end if;select user_id into uid from applications where id=new.application_id;
 href='/account/applications/'||new.application_id;title_text=case when uid=new.user_id then 'Надіслано повідомлення' else 'Оператор залишив повідомлення' end;
 elsif TG_TABLE_NAME='profiles' then
 if TG_OP='INSERT' then return new;end if;
 if (to_jsonb(new)-'updated_at')=(to_jsonb(old)-'updated_at') then return new;end if;
 uid=new.user_id;href='/account/profile';title_text='Змінено профіль';
 elsif TG_TABLE_NAME='user_documents' then uid=new.user_id;href='/account/documents';title_text='Додано документ';descr=new.name;
 elsif TG_TABLE_NAME='notifications' then uid=new.user_id;href='/account/notifications';if new.type in ('application','appeal') then return new;end if;title_text=new.title;descr=new.message;
 end if;
 if uid is not null and title_text is not null then insert into user_activity(user_id,title,description,kind,link) values(uid,title_text,descr,TG_TABLE_NAME,href);end if;return new;end;$$;
do $$declare t text;begin foreach t in array array['applications','appeals','profiles','application_messages','user_documents','notifications'] loop
 execute format('drop trigger if exists v2_activity on %I',t);
 execute format('create trigger v2_activity after insert or update on %I for each row execute function record_user_activity()',t);
 end loop;end;$$;
-- INSERT-only tables should log once, not when touched or marked read.
drop trigger v2_activity on notifications;
create trigger v2_activity after insert on notifications for each row execute function record_user_activity();
drop trigger v2_activity on user_documents;
create trigger v2_activity after insert on user_documents for each row execute function record_user_activity();
drop trigger v2_activity on application_messages;
create trigger v2_activity after insert on application_messages for each row execute function record_user_activity();
-- Backfill known status changes without exposing internal notes.
insert into user_activity(id,user_id,title,description,kind,link,created_at)
 select h.id,a.user_id,'Статус заяви',coalesce(a.number,'')||' · '||status_label(h.new_status),'applications','/account/applications/'||a.id,h.created_at from application_status_history h join applications a on a.id=h.application_id on conflict(id) do nothing;
insert into user_activity(id,user_id,title,description,kind,link,created_at)
 select h.id,a.user_id,'Статус звернення',coalesce(a.number,'')||' · '||status_label(h.new_status),'appeals','/account/appeals/'||a.id,h.created_at from appeal_status_history h join appeals a on a.id=h.appeal_id on conflict(id) do nothing;
insert into site_settings(key,value) values('display', '{"title":"Черкаси Цифрові","blocks":["city","announcements","events","news","services"],"interval":15,"theme":"dark","qr_url":"","fullscreen_friendly":true}') on conflict(key) do nothing;
grant all on user_activity,account_verifications,application_public_tokens,content_revisions to service_role;
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

create or replace function public.track_status() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
 begin
 if TG_OP='INSERT' or new.status<>old.status then
 if TG_TABLE_NAME='applications' then
 insert into application_status_history(application_id,actor_id,old_status,new_status) values(new.id,auth.uid(),case when TG_OP='UPDATE' then old.status end,new.status);
 insert into notifications(user_id,type,title,message,link) values(new.user_id,'application','Статус заяви змінено',coalesce(new.number,'Чернетка')||': '||public.status_label(new.status),'/account/applications/'||new.id);
 else
 insert into appeal_status_history(appeal_id,actor_id,old_status,new_status,note) values(new.id,auth.uid(),case when TG_OP='UPDATE' then old.status end,new.status,new.response);
 insert into notifications(user_id,type,title,message,link) values(new.user_id,'appeal','Статус звернення змінено',new.number||': '||public.status_label(new.status),'/account/appeals/'||new.id);
 end if;end if;return new;end;
$$;

drop trigger if exists verification_touch on account_verifications;
create trigger verification_touch before update on account_verifications for each row execute function touch_row();
drop trigger if exists verification_audit on account_verifications;
create trigger verification_audit after insert or update or delete on account_verifications for each row execute function audit_change();
alter table announcements alter column created_by set default auth.uid();
commit;
