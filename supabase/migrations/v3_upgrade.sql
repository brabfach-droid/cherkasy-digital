-- V3 incremental upgrade. Run after the existing V2 migration (08_v2.sql).
-- Preserves accounts, content, application data and Storage objects. Safe to repeat.
begin;
alter table public.applications add column if not exists priority text not null default 'normal' check(priority in ('low','normal','high','urgent'));
alter table public.applications add column if not exists deadline timestamptz;
alter table public.notifications add column if not exists category text;
alter table public.notifications add column if not exists metadata jsonb not null default '{}'::jsonb;
update notifications set category=type where category is null;
alter table public.announcements add column if not exists notify_center boolean not null default false;
create index if not exists application_deadline_v3 on applications(deadline) where deadline is not null;
create index if not exists notification_category_v3 on notifications(user_id,category,created_at desc);
create or replace function notification_category_default() returns trigger language plpgsql as $$begin new.category=coalesce(new.category,new.type);return new;end;$$;
drop trigger if exists v3_category on notifications;
create trigger v3_category before insert on notifications for each row execute function notification_category_default();
create table if not exists application_transfers(id uuid primary key default gen_random_uuid(),application_id uuid not null references applications(id) on delete cascade,old_department uuid references departments(id),new_department uuid not null references departments(id),actor_id uuid references auth.users(id),reason text not null check(length(trim(reason)) between 3 and 2000),created_at timestamptz not null default now());
create index if not exists transfer_app_v3 on application_transfers(application_id,created_at);
alter table application_transfers enable row level security;
grant select on application_transfers to authenticated;
drop policy if exists read on application_transfers;
create policy read on application_transfers for select to authenticated using(app_access(application_id));
create or replace function application_assignees(p_id uuid) returns table(user_id uuid,name text) language sql stable security definer set search_path=public,pg_temp as $$
 select distinct p.user_id,trim(p.first_name||' '||p.last_name) from applications a join staff_departments sd on sd.department_id=a.department_id join profiles p on p.user_id=sd.user_id join user_roles ur on ur.user_id=sd.user_id where a.id=p_id and can_app(a.department_id) and not p.blocked and ur.role_name in ('operator','department_admin','admin','super_admin');$$;
create or replace function application_service(p_id uuid) returns table(id uuid,title text,slug text) language sql stable security definer set search_path=public,pg_temp as $$ select s.id,s.title,s.slug from applications a join services s on s.id=a.service_id where a.id=p_id and app_access(a.id);$$;
create or replace function set_application_metadata(p_id uuid,p_priority text,p_deadline timestamptz) returns void language plpgsql security definer set search_path=public,pg_temp as $$declare a applications;begin
 select * into a from applications where id=p_id for update;
 if not found or not can_app(a.department_id,true) then raise exception 'Недостатньо прав';end if;
 update applications set priority=p_priority,deadline=p_deadline where id=p_id;
end;$$;
create or replace function transfer_application(p_id uuid,p_department uuid,p_reason text) returns void language plpgsql security definer set search_path=public,pg_temp as $$declare a applications;begin
 select * into a from applications where id=p_id for update;
 if not found or not can_app(a.department_id,true) or a.status in ('draft','completed','cancelled','rejected') then raise exception 'Заява недоступна для передачі';end if;
 if p_department=a.department_id or not exists(select 1 from departments where id=p_department and active) or length(trim(p_reason))<3 then raise exception 'Виберіть новий департамент та вкажіть причину';end if;
 insert into application_transfers(application_id,old_department,new_department,actor_id,reason) values(a.id,a.department_id,p_department,auth.uid(),p_reason);
 update applications set department_id=p_department,assignee_id=null where id=a.id;
 insert into application_status_history(application_id,actor_id,old_status,new_status,note) values(a.id,auth.uid(),a.status,a.status,'Передано до іншого департаменту: '||p_reason);
 insert into notifications(user_id,type,title,message,link) values(a.user_id,'application','Заяву передано',p_reason,'/account/applications/'||a.id);
end;$$;
-- Ordinary residents cannot bypass metadata RPC authorization through REST.
create or replace function guard_v3_application() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$begin
 if auth.uid() is not null and (new.priority is distinct from old.priority or new.deadline is distinct from old.deadline or new.department_id is distinct from old.department_id) and not can_app(old.department_id,true) then raise exception 'Недостатньо прав';end if;
 return new;end;$$;
drop trigger if exists v3_metadata_guard on applications;
create trigger v3_metadata_guard before update on applications for each row execute function guard_v3_application();
create table if not exists appeal_public_tokens(id uuid primary key default gen_random_uuid(),appeal_id uuid not null unique references appeals(id) on delete cascade,token text unique not null default replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),created_at timestamptz not null default now());
alter table appeal_public_tokens enable row level security;
revoke all on appeal_public_tokens from public,anon,authenticated;
create or replace function get_appeal_public_token(p_id uuid) returns text language plpgsql security definer set search_path=public,pg_temp as $$declare t text;begin
 if not is_active_user() or not exists(select 1 from appeals where id=p_id and deleted_at is null and (user_id=auth.uid() or is_admin())) then raise exception 'Звернення недоступне';end if;
 insert into appeal_public_tokens(appeal_id) values(p_id) on conflict(appeal_id) do nothing;
 select token into t from appeal_public_tokens where appeal_id=p_id;return t;end;$$;
create or replace function revoke_appeal_public_token(p_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$begin
 if not is_active_user() or not exists(select 1 from appeals where id=p_id and (user_id=auth.uid() or is_admin())) then raise exception 'Звернення недоступне';end if;
 delete from appeal_public_tokens where appeal_id=p_id;end;$$;
create or replace function public_appeal_status(p_token text) returns table(number text,type text,status text,created_at timestamptz,updated_at timestamptz) language sql stable security definer set search_path=public,pg_temp as $$ select a.number,'Звернення мешканця'::text,a.status,a.created_at,a.updated_at from appeals a join appeal_public_tokens t on t.appeal_id=a.id where length(p_token)=64 and t.token=p_token and a.deleted_at is null;$$;
create or replace function get_application_public_token(p_id uuid) returns text language plpgsql security definer set search_path=public,pg_temp as $$declare t text;begin
 if not is_active_user() or not exists(select 1 from applications where id=p_id and status<>'draft' and deleted_at is null and (user_id=auth.uid() or is_admin())) then raise exception 'Заява недоступна';end if;
 insert into application_public_tokens(application_id) values(p_id) on conflict(application_id) do nothing;
 select token into t from application_public_tokens where application_id=p_id;return t;end;$$;
create or replace function revoke_application_public_token(p_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$begin
 if not is_active_user() or not exists(select 1 from applications where id=p_id and (user_id=auth.uid() or is_admin())) then raise exception 'Заява недоступна';end if;
 delete from application_public_tokens where application_id=p_id;end;$$;
create table if not exists application_document_links(id uuid primary key default gen_random_uuid(),application_id uuid not null references applications(id) on delete cascade,document_id uuid not null references user_documents(id),user_id uuid not null references auth.users(id),field_key text not null,created_at timestamptz not null default now(),unique(application_id,document_id,field_key));
create index if not exists document_link_doc_v3 on application_document_links(document_id);
create index if not exists document_link_app_v3 on application_document_links(application_id);
alter table application_document_links enable row level security;
grant select,delete on application_document_links to authenticated;
drop policy if exists read on application_document_links;
create policy read on application_document_links for select to authenticated using(app_access(application_id));
drop policy if exists unlink on application_document_links;
create policy unlink on application_document_links for delete to authenticated using(is_active_user() and user_id=auth.uid() and exists(select 1 from applications a where a.id=application_id and a.user_id=auth.uid() and a.status='draft'));
create or replace function v3_check_field(p_application uuid,p_field text,p_mime text,p_extra int default 1) returns void language plpgsql security definer set search_path=public,pg_temp as $$declare a applications;f jsonb;n int;max_files int;begin
 select * into a from applications where id=p_application for update;
 select value into f from jsonb_array_elements(a.form_snapshot) where value->>'key'=p_field;
 if f is null or f->>'type' not in ('file','image','pdf') then raise exception 'Невідоме поле документа';end if;
 if p_mime is null or p_mime not in ('application/pdf','image/jpeg','image/png','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document') or (f->>'type'='pdf' and p_mime<>'application/pdf') or (f->>'type'='image' and p_mime not in ('image/jpeg','image/png','image/webp')) then raise exception 'Неприпустимий тип файлу';end if;
 max_files=case when coalesce((f->'validation'->>'multiple')::boolean,false) then least(20,greatest(1,coalesce((f->'validation'->>'maxFiles')::int,10))) else 1 end;
 select (select count(*) from application_files where application_id=p_application and field_key=p_field)+(select count(*) from application_document_links where application_id=p_application and field_key=p_field) into n;
 if n+p_extra>max_files then raise exception 'Перевищено кількість файлів';end if;
end;$$;
create or replace function link_application_document(p_application uuid,p_document uuid,p_field text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$declare a applications;d user_documents;rid uuid;begin
 select * into a from applications where id=p_application for update;
 select * into d from user_documents where id=p_document;
 if not is_active_user() or a.user_id is distinct from auth.uid() or a.status<>'draft' or d.user_id is distinct from auth.uid() then raise exception 'Документ недоступний';end if;
 if not exists(select 1 from storage.objects where bucket_id='service-documents' and name=d.path) then raise exception 'Файл не знайдено';end if;
 if exists(select 1 from application_document_links where application_id=a.id and document_id=d.id and field_key=p_field) then select id into rid from application_document_links where application_id=a.id and document_id=d.id and field_key=p_field;return rid;end if;
 perform v3_check_field(a.id,p_field,d.mime_type);
 insert into application_document_links(application_id,document_id,user_id,field_key) values(a.id,d.id,auth.uid(),p_field) returning id into rid;return rid;end;$$;
create or replace function application_linked_documents(p_id uuid) returns table(id uuid,field_key text,name text,path text,mime_type text,size_bytes bigint) language sql stable security definer set search_path=public,pg_temp as $$ select l.id,l.field_key,d.name,d.path,d.mime_type,d.size_bytes from application_document_links l join user_documents d on d.id=l.document_id where l.application_id=p_id and app_access(p_id);$$;
create or replace function guard_v3_document() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$begin
 if exists(select 1 from application_document_links where document_id=old.id) then raise exception 'Документ використовується у заяві';end if;
 if TG_OP='DELETE' then return old;else return new;end if;end;$$;
drop trigger if exists v3_document_guard on user_documents;
create trigger v3_document_guard before update or delete on user_documents for each row execute function guard_v3_document();
-- Preserve the original access rules, then extend only scoped reads for linked documents.
do $$begin if to_regprocedure('public.file_access_v2(text,text,boolean)') is null then alter function public.file_access(text,text,boolean) rename to file_access_v2;end if;end;$$;
create or replace function file_access(b text,p text,w boolean default false) returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$begin
 if w and b='application-files' and exists(select 1 from application_files af join application_messages m on af.id=any(m.file_ids) where af.path=p) then return false;end if;
 if b='service-documents' and left(p,9)='personal/' then
 if w and exists(select 1 from user_documents d join application_document_links l on l.document_id=d.id where d.path=p) then return false;end if;
 if not w and exists(select 1 from user_documents d join application_document_links l on l.document_id=d.id where d.path=p and app_access(l.application_id)) then return true;end if;
 end if;
 return file_access_v2(b,p,w);end;$$;
revoke all on function file_access_v2(text,text,boolean) from public,anon,authenticated;
-- Policies reference function OIDs; explicitly recreate them after the rename.
drop policy if exists portal_read on storage.objects;
create policy portal_read on storage.objects for select to anon,authenticated using(file_access(bucket_id,name,false));
drop policy if exists portal_insert on storage.objects;
create policy portal_insert on storage.objects for insert to authenticated with check(file_access(bucket_id,name,true));
drop policy if exists portal_delete on storage.objects;
create policy portal_delete on storage.objects for delete to authenticated using(file_access(bucket_id,name,true));
alter table application_messages add column if not exists file_ids uuid[] not null default '{}';
create or replace function guard_v3_message() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$begin
 if cardinality(new.file_ids)>10 or (new.internal and cardinality(new.file_ids)>0) or exists(select 1 from unnest(new.file_ids) f where not exists(select 1 from application_files af where af.id=f and af.application_id=new.application_id and af.user_id=new.user_id)) then raise exception 'Неприпустиме вкладення';end if;
 return new;end;$$;
drop trigger if exists v3_message_guard on application_messages;
create trigger v3_message_guard before insert or update on application_messages for each row execute function guard_v3_message();
-- Owners can attach a reply while the application is being processed.
drop policy if exists insert on application_files;
create policy insert on application_files for insert to authenticated with check(is_active_user() and user_id=auth.uid() and exists(select 1 from applications a where a.id=application_id and ((a.user_id=auth.uid() and a.status not in ('completed','cancelled','rejected')) or can_app(a.department_id,true))));
-- Keep original application/appeal access checks in Storage; broaden reply uploads only.
create or replace function v3_reply_upload(b text,p text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$ select b='application-files' and is_active_user() and split_part(p,'/',1)=auth.uid()::text and exists(select 1 from applications a where a.id::text=split_part(p,'/',2) and a.user_id=auth.uid() and a.status not in ('completed','cancelled','rejected'));$$;
drop policy if exists portal_insert on storage.objects;
create policy portal_insert on storage.objects for insert to authenticated with check(file_access(bucket_id,name,true) or v3_reply_upload(bucket_id,name));
create or replace function guard_v3_file() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$begin
 if new.field_key is not null then perform v3_check_field(new.application_id,new.field_key,new.mime_type);end if;return new;end;$$;
drop trigger if exists v3_file_guard on application_files;
create trigger v3_file_guard before insert on application_files for each row execute function guard_v3_file();
create table if not exists announcement_notification_deliveries(announcement_id uuid references announcements(id) on delete cascade,version integer not null,user_id uuid references auth.users(id) on delete cascade,primary key(announcement_id,version,user_id));
alter table announcement_notification_deliveries enable row level security;
revoke all on announcement_notification_deliveries from public,anon,authenticated;
create or replace function sync_announcement_notifications() returns void language plpgsql security definer set search_path=public,pg_temp as $$declare a announcements;begin
 if not is_active_user() then return;end if;
 for a in select * from announcements where notify_center and active and (start_at is null or start_at<=now()) and (end_at is null or end_at>now()) loop
 insert into announcement_notification_deliveries values(a.id,a.version,auth.uid()) on conflict do nothing;
 if found then insert into notifications(user_id,type,category,title,message,link,metadata) values(auth.uid(),'important','important',a.title,a.message,case when a.button_url like '/%' and a.button_url not like '//%' then a.button_url else '/now' end,jsonb_build_object('announcement_id',a.id,'version',a.version));end if;
 end loop;end;$$;
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
 if not exists(select 1 from application_files where application_id=a.id and field_key=k) and not exists(select 1 from application_document_links where application_id=a.id and field_key=k) then raise exception 'Додайте файл: %',f->>'label';end if;
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

revoke all on function v3_check_field(uuid,text,text,int) from public,anon,authenticated;
revoke all on function application_assignees(uuid),application_service(uuid),set_application_metadata(uuid,text,timestamptz),transfer_application(uuid,uuid,text),link_application_document(uuid,uuid,text),application_linked_documents(uuid),get_appeal_public_token(uuid),revoke_appeal_public_token(uuid),sync_announcement_notifications() from public,anon;
grant execute on function application_assignees(uuid),application_service(uuid),set_application_metadata(uuid,text,timestamptz),transfer_application(uuid,uuid,text),link_application_document(uuid,uuid,text),application_linked_documents(uuid),get_appeal_public_token(uuid),revoke_appeal_public_token(uuid),sync_announcement_notifications() to authenticated;
grant execute on function public_appeal_status(text) to anon,authenticated;
create or replace function staff_directory() returns table(user_id uuid,name text) language sql stable security definer set search_path=public,pg_temp as $$select distinct p.user_id,trim(p.first_name||' '||p.last_name) from profiles p join staff_departments sd on sd.user_id=p.user_id where not p.blocked and can_app(sd.department_id);$$;
create or replace function document_usage(p_id uuid) returns table(id uuid,number text) language sql stable security definer set search_path=public,pg_temp as $$select a.id,a.number from user_documents d join application_document_links l on l.document_id=d.id join applications a on a.id=l.application_id where d.id=p_id and d.user_id=auth.uid() and is_active_user();$$;
revoke all on function staff_directory(),document_usage(uuid) from public,anon;
grant execute on function staff_directory(),document_usage(uuid) to authenticated;
create or replace function restore_content_revision(p_revision uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r content_revisions; assignments text; affected integer;begin
 select * into r from content_revisions where id=p_revision;
 if r.id is null or r.entity_type not in ('services','news','documents','events','faqs','announcements') or not can_manage_revision(r.entity_type,r.entity_id) then raise exception 'Немає прав для відновлення';end if;
 if r.entity_type='services' and not is_admin() and not exists(select 1 from services where id=r.entity_id and department_id::text=r.snapshot->>'department_id') then raise exception 'Не можна змінювати департамент';end if;
 select string_agg(format('%I=x.%I',column_name,column_name),',') into assignments from information_schema.columns where table_schema='public' and table_name=r.entity_type and column_name not in ('id','created_at','updated_at','created_by') and r.snapshot ? column_name;
 execute format('update %I target set %s from jsonb_populate_record(null::%I,$1) x where target.id=$2',r.entity_type,assignments,r.entity_type) using r.snapshot,r.entity_id;
 get diagnostics affected=row_count;
 if affected=0 then raise exception 'Запис видалено; відновлення недоступне';end if;
 insert into audit_logs(actor_id,action,entity,entity_id,metadata) values(auth.uid(),'RESTORE',r.entity_type,r.entity_id,jsonb_build_object('revision',r.version));end;$$;

commit;
