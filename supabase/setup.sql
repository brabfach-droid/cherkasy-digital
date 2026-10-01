-- INITIAL INSTALL ONLY. Existing V2: migrations/v3_upgrade.sql
-- 01: Структура. Запускайте перед 02–05.
create extension if not exists pgcrypto;
create sequence if not exists public.application_number_seq;
create sequence if not exists public.appeal_number_seq;
create table if not exists public.departments (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), name text not null, slug text unique not null, description text default '', email text, phone text, active boolean default true);
create table if not exists public.profiles (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), user_id uuid unique not null references auth.users(id) on delete cascade, email text, first_name text default '', last_name text default '', middle_name text default '', phone text, birth_date date, avatar_path text, blocked boolean not null default false);
create table if not exists public.roles (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), name text unique not null check(name in ('super_admin','admin','department_admin','operator','editor','appeals_operator','viewer')), label text not null);
create table if not exists public.user_roles (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), user_id uuid not null references auth.users(id) on delete cascade, role_name text not null references roles(name), unique(user_id,role_name));
create table if not exists public.staff_departments (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), user_id uuid not null references auth.users(id) on delete cascade, department_id uuid not null references departments(id) on delete cascade, unique(user_id,department_id));
create table if not exists public.service_categories (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), name text not null, slug text unique not null, description text default '', icon text default 'Building2', sort_order int default 0);
create table if not exists public.appeal_categories (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), name text not null, slug text unique not null, description text default '', department_id uuid references departments(id));
create table if not exists public.news_categories (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), name text not null, slug text unique not null, description text default '');
create table if not exists public.document_categories (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), name text not null, slug text unique not null, description text default '');
create table if not exists public.services (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), title text not null, slug text unique not null, summary text default '', content text default '', category_id uuid references service_categories(id), department_id uuid references departments(id), format text not null default 'online' check(format in ('online','offline','hybrid')), audience text[] default array['residents'], duration text default '', cost text default 'Безкоштовно', eligibility text default '', requirements text default '', steps text default '', result text default '', legal_basis text default '', contacts text default '', faq jsonb default '[]', available boolean default true, featured boolean default false, status text not null default 'draft' check(status in ('draft','published','scheduled','archived')), published_at timestamptz default now(), deleted_at timestamptz, is_demo boolean default false);
create table if not exists public.service_forms (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), service_id uuid not null unique references services(id) on delete cascade, title text not null default 'Заява', version int not null default 1, active boolean default true);
create table if not exists public.service_form_fields (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), form_id uuid not null references service_forms(id) on delete cascade, key text not null check(key ~ '^[a-zA-Z][a-zA-Z0-9_]*$'), type text not null check(type in ('text','textarea','email','phone','number','date','select','multiselect','radio','checkbox','address','file','image','pdf','confirmation','heading','information')), label text not null, placeholder text default '', required boolean default false, help_text text default '', validation jsonb default '{}', options jsonb default '[]', sort_order int default 0, unique(form_id,key));
create table if not exists public.applications (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), user_id uuid not null references auth.users(id), service_id uuid not null references services(id), department_id uuid references departments(id), number text unique, status text not null default 'draft' check(status in ('draft','submitted','received','in_review','needs_more_info','approved','rejected','completed','cancelled')), assignee_id uuid references auth.users(id), data jsonb not null default '{}', form_snapshot jsonb not null default '[]', submitted_at timestamptz, deleted_at timestamptz);
create table if not exists public.application_answers (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), application_id uuid not null references applications(id) on delete cascade, field_key text not null, value jsonb, unique(application_id,field_key));
create table if not exists public.application_files (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), application_id uuid not null references applications(id) on delete cascade, user_id uuid not null references auth.users(id), field_key text, name text not null, path text not null unique, mime_type text, size_bytes bigint check(size_bytes between 0 and 10485760));
create table if not exists public.application_status_history (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), application_id uuid not null references applications(id) on delete cascade, actor_id uuid references auth.users(id), old_status text, new_status text not null, note text default '');
create table if not exists public.application_messages (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), application_id uuid not null references applications(id) on delete cascade, user_id uuid not null references auth.users(id), message text not null check(length(message) between 1 and 10000), internal boolean not null default false);
create table if not exists public.appeals (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), user_id uuid not null references auth.users(id), category_id uuid references appeal_categories(id), department_id uuid references departments(id), number text unique, title text not null, location text default '', message text not null, status text not null default 'new' check(status in ('new','received','forwarded','in_progress','completed','rejected')), assignee_id uuid references auth.users(id), response text default '', deleted_at timestamptz);
create table if not exists public.appeal_files (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), appeal_id uuid not null references appeals(id) on delete cascade, user_id uuid not null references auth.users(id), name text not null, path text unique not null, mime_type text, size_bytes bigint check(size_bytes between 0 and 10485760));
create table if not exists public.appeal_status_history (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), appeal_id uuid not null references appeals(id) on delete cascade, actor_id uuid references auth.users(id), old_status text, new_status text not null, note text default '');
create table if not exists public.news (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), title text not null, slug text unique not null, summary text default '', content text default '', category_id uuid references news_categories(id), cover_path text, gallery jsonb default '[]', author text default '', featured boolean default false, status text not null default 'draft' check(status in ('draft','published','scheduled','archived')), published_at timestamptz default now(), deleted_at timestamptz, is_demo boolean default false);
create table if not exists public.announcements (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), type text default 'info', title text not null, message text not null, start_at timestamptz default now(), end_at timestamptz, priority int default 0, dismissible boolean default true, placement text default 'banner' check(placement in ('banner','modal','pinned')), button_text text, button_url text, active boolean default true);
create table if not exists public.documents (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), title text not null, slug text unique not null, document_number text, date date, category_id uuid references document_categories(id), description text default '', file_path text, filename text, tags text[] default '{}', status text not null default 'draft' check(status in ('draft','published','scheduled','archived')), published_at timestamptz default now(), deleted_at timestamptz, is_demo boolean default false);
create table if not exists public.events (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), title text not null, slug text unique not null, summary text default '', content text default '', starts_at timestamptz, location text default '', cover_path text, category text default '', organizer text default '', registration_url text, status text not null default 'draft' check(status in ('draft','published','scheduled','archived')), published_at timestamptz default now(), deleted_at timestamptz, is_demo boolean default false);
create table if not exists public.notifications (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), user_id uuid not null references auth.users(id) on delete cascade, type text not null default 'system' check(type in ('system','application','service','emergency','news')), title text not null, message text default '', link text, read_at timestamptz);
create table if not exists public.saved_services (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), user_id uuid not null references auth.users(id) on delete cascade, service_id uuid not null references services(id) on delete cascade, unique(user_id,service_id));
create table if not exists public.user_addresses (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), user_id uuid not null references auth.users(id) on delete cascade, name text not null, city text default 'Черкаси', street text not null, building text not null, apartment text, note text);
create table if not exists public.user_documents (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), user_id uuid not null references auth.users(id) on delete cascade, name text not null, path text not null unique, mime_type text, size_bytes bigint check(size_bytes between 0 and 10485760));
create table if not exists public.faqs (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), question text not null, answer text not null, category text default 'Загальне', sort_order int default 0, published boolean default true, is_demo boolean default false);
create table if not exists public.site_settings (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), key text not null unique, value jsonb not null);
create table if not exists public.city_status (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), type text not null, title text not null, status text default '', severity text default 'info' check(severity in ('normal','info','warning','danger','critical')), description text default '', started_at timestamptz default now(), ended_at timestamptz, is_active boolean default true, source_label text default 'Введено диспетчером');
create table if not exists public.audit_logs (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), actor_id uuid references auth.users(id), action text not null, entity text not null, entity_id uuid, metadata jsonb default '{}');
create table if not exists public.account_deletion_requests (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), user_id uuid not null references auth.users(id), status text not null default 'pending' check(status in ('pending','processing','completed','rejected')), note text default '');
create table if not exists public.api_cache (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), key text unique not null, payload jsonb not null default '{}', refreshed_at timestamptz, lease_until timestamptz, last_error text);
create index if not exists departments_created_idx on public.departments(created_at);
create index if not exists profiles_created_idx on public.profiles(created_at);
create index if not exists roles_created_idx on public.roles(created_at);
create index if not exists user_roles_created_idx on public.user_roles(created_at);
create index if not exists user_roles_user_id_idx on public.user_roles(user_id);
create index if not exists staff_departments_created_idx on public.staff_departments(created_at);
create index if not exists staff_departments_user_id_idx on public.staff_departments(user_id);
create index if not exists staff_departments_department_id_idx on public.staff_departments(department_id);
create index if not exists service_categories_created_idx on public.service_categories(created_at);
create index if not exists appeal_categories_created_idx on public.appeal_categories(created_at);
create index if not exists appeal_categories_department_id_idx on public.appeal_categories(department_id);
create index if not exists news_categories_created_idx on public.news_categories(created_at);
create index if not exists document_categories_created_idx on public.document_categories(created_at);
create index if not exists services_created_idx on public.services(created_at);
create index if not exists services_category_id_idx on public.services(category_id);
create index if not exists services_department_id_idx on public.services(department_id);
create index if not exists services_status_idx on public.services(status);
create index if not exists services_category_id_idx on public.services(category_id);
create index if not exists services_published_at_idx on public.services(published_at);
create index if not exists service_forms_created_idx on public.service_forms(created_at);
create index if not exists service_form_fields_created_idx on public.service_form_fields(created_at);
create index if not exists service_form_fields_form_id_idx on public.service_form_fields(form_id);
create index if not exists applications_created_idx on public.applications(created_at);
create index if not exists applications_user_id_idx on public.applications(user_id);
create index if not exists applications_service_id_idx on public.applications(service_id);
create index if not exists applications_department_id_idx on public.applications(department_id);
create index if not exists applications_assignee_id_idx on public.applications(assignee_id);
create index if not exists applications_status_idx on public.applications(status);
create index if not exists application_answers_created_idx on public.application_answers(created_at);
create index if not exists application_answers_application_id_idx on public.application_answers(application_id);
create index if not exists application_files_created_idx on public.application_files(created_at);
create index if not exists application_files_application_id_idx on public.application_files(application_id);
create index if not exists application_files_user_id_idx on public.application_files(user_id);
create index if not exists application_status_history_created_idx on public.application_status_history(created_at);
create index if not exists application_status_history_application_id_idx on public.application_status_history(application_id);
create index if not exists application_status_history_actor_id_idx on public.application_status_history(actor_id);
create index if not exists application_messages_created_idx on public.application_messages(created_at);
create index if not exists application_messages_application_id_idx on public.application_messages(application_id);
create index if not exists application_messages_user_id_idx on public.application_messages(user_id);
create index if not exists appeals_created_idx on public.appeals(created_at);
create index if not exists appeals_user_id_idx on public.appeals(user_id);
create index if not exists appeals_category_id_idx on public.appeals(category_id);
create index if not exists appeals_department_id_idx on public.appeals(department_id);
create index if not exists appeals_assignee_id_idx on public.appeals(assignee_id);
create index if not exists appeals_status_idx on public.appeals(status);
create index if not exists appeals_category_id_idx on public.appeals(category_id);
create index if not exists appeal_files_created_idx on public.appeal_files(created_at);
create index if not exists appeal_files_appeal_id_idx on public.appeal_files(appeal_id);
create index if not exists appeal_files_user_id_idx on public.appeal_files(user_id);
create index if not exists appeal_status_history_created_idx on public.appeal_status_history(created_at);
create index if not exists appeal_status_history_appeal_id_idx on public.appeal_status_history(appeal_id);
create index if not exists appeal_status_history_actor_id_idx on public.appeal_status_history(actor_id);
create index if not exists news_created_idx on public.news(created_at);
create index if not exists news_category_id_idx on public.news(category_id);
create index if not exists news_status_idx on public.news(status);
create index if not exists news_category_id_idx on public.news(category_id);
create index if not exists news_published_at_idx on public.news(published_at);
create index if not exists announcements_created_idx on public.announcements(created_at);
create index if not exists documents_created_idx on public.documents(created_at);
create index if not exists documents_category_id_idx on public.documents(category_id);
create index if not exists documents_status_idx on public.documents(status);
create index if not exists documents_category_id_idx on public.documents(category_id);
create index if not exists documents_published_at_idx on public.documents(published_at);
create index if not exists events_created_idx on public.events(created_at);
create index if not exists events_status_idx on public.events(status);
create index if not exists events_published_at_idx on public.events(published_at);
create index if not exists notifications_created_idx on public.notifications(created_at);
create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists saved_services_created_idx on public.saved_services(created_at);
create index if not exists saved_services_user_id_idx on public.saved_services(user_id);
create index if not exists saved_services_service_id_idx on public.saved_services(service_id);
create index if not exists user_addresses_created_idx on public.user_addresses(created_at);
create index if not exists user_addresses_user_id_idx on public.user_addresses(user_id);
create index if not exists user_documents_created_idx on public.user_documents(created_at);
create index if not exists user_documents_user_id_idx on public.user_documents(user_id);
create index if not exists faqs_created_idx on public.faqs(created_at);
create index if not exists site_settings_created_idx on public.site_settings(created_at);
create index if not exists city_status_created_idx on public.city_status(created_at);
create index if not exists city_status_status_idx on public.city_status(status);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at);
create index if not exists audit_logs_actor_id_idx on public.audit_logs(actor_id);
create index if not exists account_deletion_requests_created_idx on public.account_deletion_requests(created_at);
create index if not exists account_deletion_requests_user_id_idx on public.account_deletion_requests(user_id);
create index if not exists account_deletion_requests_status_idx on public.account_deletion_requests(status);
create index if not exists api_cache_created_idx on public.api_cache(created_at);


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


-- 03: Row Level Security. No private table has anonymous reads.
alter table public.departments enable row level security;
grant select,insert,update,delete on public.departments to authenticated;
grant select on public.departments to anon;
alter table public.profiles enable row level security;
grant select,insert,update,delete on public.profiles to authenticated;
grant select on public.profiles to anon;
alter table public.roles enable row level security;
grant select,insert,update,delete on public.roles to authenticated;
grant select on public.roles to anon;
alter table public.user_roles enable row level security;
grant select,insert,update,delete on public.user_roles to authenticated;
grant select on public.user_roles to anon;
alter table public.staff_departments enable row level security;
grant select,insert,update,delete on public.staff_departments to authenticated;
grant select on public.staff_departments to anon;
alter table public.service_categories enable row level security;
grant select,insert,update,delete on public.service_categories to authenticated;
grant select on public.service_categories to anon;
alter table public.appeal_categories enable row level security;
grant select,insert,update,delete on public.appeal_categories to authenticated;
grant select on public.appeal_categories to anon;
alter table public.news_categories enable row level security;
grant select,insert,update,delete on public.news_categories to authenticated;
grant select on public.news_categories to anon;
alter table public.document_categories enable row level security;
grant select,insert,update,delete on public.document_categories to authenticated;
grant select on public.document_categories to anon;
alter table public.services enable row level security;
grant select,insert,update,delete on public.services to authenticated;
grant select on public.services to anon;
alter table public.service_forms enable row level security;
grant select,insert,update,delete on public.service_forms to authenticated;
grant select on public.service_forms to anon;
alter table public.service_form_fields enable row level security;
grant select,insert,update,delete on public.service_form_fields to authenticated;
grant select on public.service_form_fields to anon;
alter table public.applications enable row level security;
grant select,insert,update,delete on public.applications to authenticated;
grant select on public.applications to anon;
alter table public.application_answers enable row level security;
grant select,insert,update,delete on public.application_answers to authenticated;
grant select on public.application_answers to anon;
alter table public.application_files enable row level security;
grant select,insert,update,delete on public.application_files to authenticated;
grant select on public.application_files to anon;
alter table public.application_status_history enable row level security;
grant select,insert,update,delete on public.application_status_history to authenticated;
grant select on public.application_status_history to anon;
alter table public.application_messages enable row level security;
grant select,insert,update,delete on public.application_messages to authenticated;
grant select on public.application_messages to anon;
alter table public.appeals enable row level security;
grant select,insert,update,delete on public.appeals to authenticated;
grant select on public.appeals to anon;
alter table public.appeal_files enable row level security;
grant select,insert,update,delete on public.appeal_files to authenticated;
grant select on public.appeal_files to anon;
alter table public.appeal_status_history enable row level security;
grant select,insert,update,delete on public.appeal_status_history to authenticated;
grant select on public.appeal_status_history to anon;
alter table public.news enable row level security;
grant select,insert,update,delete on public.news to authenticated;
grant select on public.news to anon;
alter table public.announcements enable row level security;
grant select,insert,update,delete on public.announcements to authenticated;
grant select on public.announcements to anon;
alter table public.documents enable row level security;
grant select,insert,update,delete on public.documents to authenticated;
grant select on public.documents to anon;
alter table public.events enable row level security;
grant select,insert,update,delete on public.events to authenticated;
grant select on public.events to anon;
alter table public.notifications enable row level security;
grant select,insert,update,delete on public.notifications to authenticated;
grant select on public.notifications to anon;
alter table public.saved_services enable row level security;
grant select,insert,update,delete on public.saved_services to authenticated;
grant select on public.saved_services to anon;
alter table public.user_addresses enable row level security;
grant select,insert,update,delete on public.user_addresses to authenticated;
grant select on public.user_addresses to anon;
alter table public.user_documents enable row level security;
grant select,insert,update,delete on public.user_documents to authenticated;
grant select on public.user_documents to anon;
alter table public.faqs enable row level security;
grant select,insert,update,delete on public.faqs to authenticated;
grant select on public.faqs to anon;
alter table public.site_settings enable row level security;
grant select,insert,update,delete on public.site_settings to authenticated;
grant select on public.site_settings to anon;
alter table public.city_status enable row level security;
grant select,insert,update,delete on public.city_status to authenticated;
grant select on public.city_status to anon;
alter table public.audit_logs enable row level security;
grant select,insert,update,delete on public.audit_logs to authenticated;
grant select on public.audit_logs to anon;
alter table public.account_deletion_requests enable row level security;
grant select,insert,update,delete on public.account_deletion_requests to authenticated;
grant select on public.account_deletion_requests to anon;
alter table public.api_cache enable row level security;
grant select,insert,update,delete on public.api_cache to authenticated;
grant select on public.api_cache to anon;
grant usage on schema public to anon,authenticated;
drop policy if exists public_read on public.service_categories;
create policy public_read on public.service_categories for select to anon,authenticated using (true);
drop policy if exists admin_write on public.service_categories;
create policy admin_write on public.service_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists public_read on public.news_categories;
create policy public_read on public.news_categories for select to anon,authenticated using (true);
drop policy if exists admin_write on public.news_categories;
create policy admin_write on public.news_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists public_read on public.document_categories;
create policy public_read on public.document_categories for select to anon,authenticated using (true);
drop policy if exists admin_write on public.document_categories;
create policy admin_write on public.document_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists public_read on public.appeal_categories;
create policy public_read on public.appeal_categories for select to anon,authenticated using (true);
drop policy if exists admin_write on public.appeal_categories;
create policy admin_write on public.appeal_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists public_read on public.departments;
create policy public_read on public.departments for select to anon,authenticated using (true);
drop policy if exists admin_write on public.departments;
create policy admin_write on public.departments for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists read on public.news;
create policy read on public.news for select to anon,authenticated using (public.content_visible(status,published_at,deleted_at) or public.has_role(array['super_admin','admin','editor']));
drop policy if exists edit on public.news;
create policy edit on public.news for all to authenticated using (public.has_role(array['super_admin','admin','editor'])) with check (public.has_role(array['super_admin','admin','editor']));
drop policy if exists read on public.documents;
create policy read on public.documents for select to anon,authenticated using (public.content_visible(status,published_at,deleted_at) or public.has_role(array['super_admin','admin','editor']));
drop policy if exists edit on public.documents;
create policy edit on public.documents for all to authenticated using (public.has_role(array['super_admin','admin','editor'])) with check (public.has_role(array['super_admin','admin','editor']));
drop policy if exists read on public.events;
create policy read on public.events for select to anon,authenticated using (public.content_visible(status,published_at,deleted_at) or public.has_role(array['super_admin','admin','editor']));
drop policy if exists edit on public.events;
create policy edit on public.events for all to authenticated using (public.has_role(array['super_admin','admin','editor'])) with check (public.has_role(array['super_admin','admin','editor']));
drop policy if exists read on public.services;
create policy read on public.services for select to anon,authenticated using (public.content_visible(status,published_at,deleted_at) or public.is_admin() or (public.has_role(array['department_admin']) and public.in_department(department_id)) or (public.is_active_user() and exists(select 1 from applications a where a.service_id=services.id and public.app_access(a.id))));
drop policy if exists edit on public.services;
create policy edit on public.services for all to authenticated using (public.is_admin() or (public.has_role(array['department_admin']) and public.in_department(department_id))) with check (public.is_admin() or (public.has_role(array['department_admin']) and public.in_department(department_id)));
drop policy if exists read on public.service_forms;
create policy read on public.service_forms for select to anon,authenticated using (exists(select 1 from services s where s.id=service_id and (public.content_visible(s.status,s.published_at,s.deleted_at) or (public.is_admin() or (public.has_role(array['department_admin']) and public.in_department(s.department_id))))));
drop policy if exists edit on public.service_forms;
create policy edit on public.service_forms for all to authenticated using (exists(select 1 from services s where s.id=service_id and (public.is_admin() or (public.has_role(array['department_admin']) and public.in_department(s.department_id))))) with check (exists(select 1 from services s where s.id=service_id and (public.is_admin() or (public.has_role(array['department_admin']) and public.in_department(s.department_id)))));
drop policy if exists read on public.service_form_fields;
create policy read on public.service_form_fields for select to anon,authenticated using (exists(select 1 from service_forms f join services s on s.id=f.service_id where f.id=form_id and (public.content_visible(s.status,s.published_at,s.deleted_at) or (public.is_admin() or (public.has_role(array['department_admin']) and public.in_department(s.department_id))))));
drop policy if exists edit on public.service_form_fields;
create policy edit on public.service_form_fields for all to authenticated using (exists(select 1 from service_forms f join services s on s.id=f.service_id where f.id=form_id and (public.is_admin() or (public.has_role(array['department_admin']) and public.in_department(s.department_id))))) with check (exists(select 1 from service_forms f join services s on s.id=f.service_id where f.id=form_id and (public.is_admin() or (public.has_role(array['department_admin']) and public.in_department(s.department_id)))));
drop policy if exists read on public.profiles;
create policy read on public.profiles for select to authenticated using (public.is_active_user() and (user_id=auth.uid() or public.is_admin() or exists(select 1 from applications a where a.user_id=profiles.user_id and public.can_app(a.department_id)) or exists(select 1 from appeals a where a.user_id=profiles.user_id and public.can_appeal(a.department_id)) or exists(select 1 from staff_departments sd where sd.user_id=profiles.user_id and public.in_department(sd.department_id))));
drop policy if exists owner_update on public.profiles;
create policy owner_update on public.profiles for update to authenticated using (public.is_active_user() and user_id=auth.uid()) with check (public.is_active_user() and user_id=auth.uid());
drop policy if exists read on public.roles;
create policy read on public.roles for select to authenticated using (public.is_active_user());
drop policy if exists read on public.user_roles;
create policy read on public.user_roles for select to authenticated using (public.is_active_user() and (user_id=auth.uid() or public.is_admin()));
drop policy if exists read on public.staff_departments;
create policy read on public.staff_departments for select to authenticated using (public.is_active_user() and (user_id=auth.uid() or public.is_admin() or public.in_department(department_id)));
drop policy if exists owner on public.saved_services;
create policy owner on public.saved_services for all to authenticated using (public.is_active_user() and user_id=auth.uid()) with check (public.is_active_user() and user_id=auth.uid());
drop policy if exists owner on public.user_addresses;
create policy owner on public.user_addresses for all to authenticated using (public.is_active_user() and user_id=auth.uid()) with check (public.is_active_user() and user_id=auth.uid());
drop policy if exists owner on public.user_documents;
create policy owner on public.user_documents for all to authenticated using (public.is_active_user() and user_id=auth.uid()) with check (public.is_active_user() and user_id=auth.uid());
drop policy if exists read on public.applications;
create policy read on public.applications for select to authenticated using (public.is_active_user() and (user_id=auth.uid() or public.can_app(department_id)));
drop policy if exists read on public.appeals;
create policy read on public.appeals for select to authenticated using (public.is_active_user() and (user_id=auth.uid() or public.can_appeal(department_id)));
drop policy if exists read on public.application_answers;
create policy read on public.application_answers for select to authenticated using (public.app_access(application_id));
drop policy if exists read on public.application_status_history;
create policy read on public.application_status_history for select to authenticated using (public.app_access(application_id));
drop policy if exists read on public.application_files;
create policy read on public.application_files for select to authenticated using (public.app_access(application_id));
drop policy if exists read on public.application_messages;
create policy read on public.application_messages for select to authenticated using (public.app_access(application_id) and (not internal or exists(select 1 from applications a where a.id=application_id and public.can_app(a.department_id))));
drop policy if exists insert on public.application_messages;
create policy insert on public.application_messages for insert to authenticated with check (public.is_active_user() and user_id=auth.uid() and exists(select 1 from applications a where a.id=application_id and a.status<>'draft' and ((a.user_id=auth.uid() and not internal) or public.can_app(a.department_id,true))));
drop policy if exists insert on public.application_files;
create policy insert on public.application_files for insert to authenticated with check (public.is_active_user() and user_id=auth.uid() and exists(select 1 from applications a where a.id=application_id and ((a.user_id=auth.uid() and a.status in ('draft','needs_more_info')) or public.can_app(a.department_id,true))));
drop policy if exists delete on public.application_files;
create policy delete on public.application_files for delete to authenticated using (public.is_active_user() and user_id=auth.uid() and exists(select 1 from applications a where a.id=application_id and a.user_id=auth.uid() and a.status in ('draft','needs_more_info')));
drop policy if exists read on public.appeal_files;
create policy read on public.appeal_files for select to authenticated using (public.appeal_access(appeal_id));
drop policy if exists read on public.appeal_status_history;
create policy read on public.appeal_status_history for select to authenticated using (public.appeal_access(appeal_id));
drop policy if exists insert on public.appeal_files;
create policy insert on public.appeal_files for insert to authenticated with check (public.is_active_user() and user_id=auth.uid() and exists(select 1 from appeals a where a.id=appeal_id and a.user_id=auth.uid() and a.status='new'));
drop policy if exists read on public.notifications;
create policy read on public.notifications for select to authenticated using (public.is_active_user() and user_id=auth.uid());
drop policy if exists read on public.faqs;
create policy read on public.faqs for select to anon,authenticated using ((published) or public.is_admin());
drop policy if exists admin_write on public.faqs;
create policy admin_write on public.faqs for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists read on public.site_settings;
create policy read on public.site_settings for select to anon,authenticated using ((true) or public.is_admin());
drop policy if exists admin_write on public.site_settings;
create policy admin_write on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists read on public.announcements;
create policy read on public.announcements for select to anon,authenticated using ((active and start_at<=now() and (end_at is null or end_at>now())) or public.is_admin());
drop policy if exists admin_write on public.announcements;
create policy admin_write on public.announcements for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists read on public.city_status;
create policy read on public.city_status for select to anon,authenticated using ((is_active and (ended_at is null or ended_at>now())) or public.is_admin());
drop policy if exists admin_write on public.city_status;
create policy admin_write on public.city_status for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists read on public.audit_logs;
create policy read on public.audit_logs for select to authenticated using (public.is_admin());
drop policy if exists read on public.account_deletion_requests;
create policy read on public.account_deletion_requests for select to authenticated using (public.is_active_user() and (user_id=auth.uid() or public.is_admin()));
drop policy if exists insert on public.account_deletion_requests;
create policy insert on public.account_deletion_requests for insert to authenticated with check (public.is_active_user() and user_id=auth.uid() and status='pending');
drop policy if exists admin_update on public.account_deletion_requests;
create policy admin_update on public.account_deletion_requests for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists read on public.api_cache;
create policy read on public.api_cache for select to anon,authenticated using (key='alerts');

-- Metadata cannot point to a different user's object or another parent.
create or replace function public.guard_file_metadata() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
 declare bucket text; expected text;begin
 if TG_TABLE_NAME='application_files' then bucket='application-files';expected=new.user_id::text||'/'||new.application_id::text||'/';
 elsif TG_TABLE_NAME='appeal_files' then bucket='appeal-files';expected=new.user_id::text||'/'||new.appeal_id::text||'/';
 else bucket='service-documents';expected='personal/'||new.user_id::text||'/';end if;
 if left(new.path,length(expected))<>expected or not exists(select 1 from storage.objects where bucket_id=bucket and name=new.path) then raise exception 'Некоректний файл';end if;
 return new;end;$$;


-- 04: Public media only. Personal documents, avatars, PDFs and applications stay private.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('avatars','avatars',false,5242880,array['image/jpeg','image/png','image/webp']),
('service-documents','service-documents',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
('application-files','application-files',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
('appeal-files','appeal-files',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
('news','news',true,10485760,array['image/jpeg','image/png','image/webp']),
('documents','documents',false,10485760,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
('events','events',true,10485760,array['image/jpeg','image/png','image/webp']),
('site-assets','site-assets',true,5242880,array['image/jpeg','image/png','image/webp','image/x-icon','image/vnd.microsoft.icon'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create or replace function public.file_access(b text,p text,w boolean default false) returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
 declare parts text[]; parent_id uuid;begin
 parts=string_to_array(p,'/');
 if b='site-assets' then return not w or public.is_admin();end if;
 if b in ('news','events') then return not w or public.has_role(array['super_admin','admin','editor']);end if;
 if b='avatars' then return public.is_active_user() and parts[1]=auth.uid()::text;end if;
 if b='service-documents' and parts[1]='personal' then return public.is_active_user() and parts[2]=auth.uid()::text;end if;
 if b in ('application-files','appeal-files') then
 if parts[2] !~ '^[0-9a-fA-F-]{36}$' then return false;end if;parent_id=parts[2]::uuid;
 if b='application-files' then
 if not w then return public.app_access(parent_id);end if;
 return public.is_active_user() and parts[1]=auth.uid()::text and exists(select 1 from applications a where a.id=parent_id and ((a.user_id=auth.uid() and a.status in ('draft','needs_more_info')) or public.can_app(a.department_id,true)));
 else
 if not w then return public.appeal_access(parent_id);end if;
 return public.is_active_user() and parts[1]=auth.uid()::text and exists(select 1 from appeals a where a.id=parent_id and a.user_id=auth.uid() and a.status='new');end if;
 end if;
 if b='documents' then
 if public.has_role(array['super_admin','admin','editor']) then return true;end if;
 return not w and exists(select 1 from documents d where d.file_path=p and public.content_visible(d.status,d.published_at,d.deleted_at));end if;
 if b='service-documents' then
 return exists(select 1 from services s where s.id::text=parts[1] and ((not w and public.content_visible(s.status,s.published_at,s.deleted_at)) or public.is_admin() or (public.has_role(array['department_admin']) and public.in_department(s.department_id))));end if;
 return false;
 exception when invalid_text_representation then return false;
 end;$$;
drop policy if exists portal_read on storage.objects;
create policy portal_read on storage.objects for select to anon,authenticated using(public.file_access(bucket_id,name,false));
drop policy if exists portal_insert on storage.objects;
create policy portal_insert on storage.objects for insert to authenticated with check(public.file_access(bucket_id,name,true));
drop policy if exists portal_delete on storage.objects;
create policy portal_delete on storage.objects for delete to authenticated using(public.file_access(bucket_id,name,true));
-- No overwrite/update policy: uploads always use a unique name.
drop trigger if exists guard_application_file on application_files;
create trigger guard_application_file before insert or update on application_files for each row execute function public.guard_file_metadata();
drop trigger if exists guard_appeal_file on appeal_files;
create trigger guard_appeal_file before insert or update on appeal_files for each row execute function public.guard_file_metadata();
drop trigger if exists guard_user_document on user_documents;
create trigger guard_user_document before insert or update on user_documents for each row execute function public.guard_file_metadata();


-- 05: DEMO seed. Idempotent: existing content is never overwritten.
insert into public.roles (name,label,id) values('super_admin','Головний адміністратор','6801dea8-85f0-5119-b6c0-8687bdf6071e') on conflict do nothing;
insert into public.roles (name,label,id) values('admin','Адміністратор','b12fbf20-dc0f-53eb-bc90-2415267f98ce') on conflict do nothing;
insert into public.roles (name,label,id) values('department_admin','Керівник департаменту','36af912b-cfdd-52e4-928f-c9a0d5a52d91') on conflict do nothing;
insert into public.roles (name,label,id) values('operator','Оператор заяв','289c0baf-fe29-530a-8207-b0e7e7d1441f') on conflict do nothing;
insert into public.roles (name,label,id) values('editor','Редактор','07de426c-f974-576c-8ac6-ebc7af246b0d') on conflict do nothing;
insert into public.roles (name,label,id) values('appeals_operator','Оператор звернень','1c42319a-49a0-5265-8a0f-5f04eb80c83e') on conflict do nothing;
insert into public.roles (name,label,id) values('viewer','Перегляд','4c1fe602-9c3e-5590-a986-9832af76b754') on conflict do nothing;
insert into public.departments (name,slug,description,id) values('Демонстраційний департамент','demo-department','ДЕМО. Замініть на реальний орган перед запуском.','fe2acb2d-f6c8-5f8f-be60-c6c7ef12ca6d') on conflict do nothing;
insert into public.service_categories (id,name,slug,description,sort_order) values('3f12c4a2-385c-5f00-9a30-948edcb63d4e','Освіта','education','Послуги та інформація для мешканців',0) on conflict do nothing;
insert into public.service_categories (id,name,slug,description,sort_order) values('2e01d3a3-7188-5b90-a36a-d50054293d0a','Житло та ЖКГ','housing','Послуги та інформація для мешканців',1) on conflict do nothing;
insert into public.service_categories (id,name,slug,description,sort_order) values('f10053db-78a4-592b-9f7e-5ffe8ca211f4','Соціальна підтримка','social','Послуги та інформація для мешканців',2) on conflict do nothing;
insert into public.service_categories (id,name,slug,description,sort_order) values('f301408f-6dc6-58cd-a23c-dc81fa030d31','Транспорт','transport','Послуги та інформація для мешканців',3) on conflict do nothing;
insert into public.service_categories (id,name,slug,description,sort_order) values('0840bb4d-e997-504f-929d-952e20df62cc','Документи','documents','Послуги та інформація для мешканців',4) on conflict do nothing;
insert into public.service_categories (id,name,slug,description,sort_order) values('062e862e-d937-51f2-9297-177d6e0c6f33','Бізнес','business','Послуги та інформація для мешканців',5) on conflict do nothing;
insert into public.service_categories (id,name,slug,description,sort_order) values('39c20512-9ed3-561b-85f7-e3ae50a8e8f1','Благоустрій','improvement','Послуги та інформація для мешканців',6) on conflict do nothing;
insert into public.service_categories (id,name,slug,description,sort_order) values('ec1e4339-56dc-5b7a-adca-6e94c7785323','Культура','culture','Послуги та інформація для мешканців',7) on conflict do nothing;
insert into public.service_categories (id,name,slug,description,sort_order) values('72f953c4-0740-59de-a8a9-b3c853f3c2a0','Спорт','sport','Послуги та інформація для мешканців',8) on conflict do nothing;
insert into public.service_categories (id,name,slug,description,sort_order) values('cc6d952c-f121-5b94-8954-a16ef7b5f499','Сім’я та діти','family','Послуги та інформація для мешканців',9) on conflict do nothing;
insert into public.appeal_categories (name,slug,department_id,id) values('Дороги','roads','fe2acb2d-f6c8-5f8f-be60-c6c7ef12ca6d','5d589fb3-63da-5017-993e-194c35b0d474') on conflict do nothing;
insert into public.appeal_categories (name,slug,department_id,id) values('Освітлення','light','fe2acb2d-f6c8-5f8f-be60-c6c7ef12ca6d','d4c9d0b1-e738-5437-9eaf-492438d3ee95') on conflict do nothing;
insert into public.appeal_categories (name,slug,department_id,id) values('Сміття','waste','fe2acb2d-f6c8-5f8f-be60-c6c7ef12ca6d','513a1e4b-752d-5fd9-acda-46f10c19cf25') on conflict do nothing;
insert into public.appeal_categories (name,slug,department_id,id) values('Вода','water','fe2acb2d-f6c8-5f8f-be60-c6c7ef12ca6d','e591c992-3dc6-5dad-8f80-372537c57170') on conflict do nothing;
insert into public.appeal_categories (name,slug,department_id,id) values('Транспорт','transport','fe2acb2d-f6c8-5f8f-be60-c6c7ef12ca6d','984f8d07-f041-5a3e-b2e7-463095ebc024') on conflict do nothing;
insert into public.appeal_categories (name,slug,department_id,id) values('Дерева','trees','fe2acb2d-f6c8-5f8f-be60-c6c7ef12ca6d','a178afb8-99fb-5ff9-a9aa-b966c7766b87') on conflict do nothing;
insert into public.appeal_categories (name,slug,department_id,id) values('Благоустрій','improvement','fe2acb2d-f6c8-5f8f-be60-c6c7ef12ca6d','fcc791ad-1735-5a19-9080-8077f80d17aa') on conflict do nothing;
insert into public.appeal_categories (name,slug,department_id,id) values('Інше','other','fe2acb2d-f6c8-5f8f-be60-c6c7ef12ca6d','c827d9d4-e8a2-523d-bb73-59566601348e') on conflict do nothing;
insert into public.news_categories (name,slug,id) values('Портал','portal','89e2cac5-4229-5ab9-873c-2bdf3c92183d') on conflict do nothing;
insert into public.document_categories (name,slug,id) values('Інше','other','1b04a611-7019-58fe-825d-6f75fbdf3edd') on conflict do nothing;
insert into public.document_categories (name,slug,id) values('Рішення','decisions','8e823bc6-3edb-56c0-ad89-d9a74c53f2ef') on conflict do nothing;
insert into public.document_categories (name,slug,id) values('Розпорядження','orders','ac25960d-3bf1-525e-8e01-e5377accdcda') on conflict do nothing;
insert into public.document_categories (name,slug,id) values('Накази','instructions','6469719b-3e56-53cc-82a6-f433b8631ca7') on conflict do nothing;
insert into public.document_categories (name,slug,id) values('Протоколи','protocols','76dc7bc2-8ec6-5dec-88be-16b4f1cf7c19') on conflict do nothing;
insert into public.document_categories (name,slug,id) values('Програми','programs','0de83a55-ac5a-5d7d-a445-5f8ed6510cd3') on conflict do nothing;
insert into public.document_categories (name,slug,id) values('Звіти','reports','b59f875c-49f5-5a97-9f63-426ed2bf2618') on conflict do nothing;
insert into public.services (title,slug,category_id,department_id,summary,content,format,status,published_at,featured,is_demo,available,audience,duration,cost,eligibility,requirements,steps,result,legal_basis,contacts,id) values('Демо: запит консультації','demo-consultation','0840bb4d-e997-504f-929d-952e20df62cc','fe2acb2d-f6c8-5f8f-be60-c6c7ef12ca6d','Залиште запит і перевірте, як працює електронна заява.','**Демонстраційна послуга.** Подана заява не є офіційним зверненням до органу влади.','online','published','2026-01-01T00:00:00Z',true,true,true,array['residents']::text[],'Демонстраційний термін','Безкоштовно','Зареєстровані користувачі порталу','За потреби додайте тестовий PDF без персональних даних.','1. Увійдіть
2. Заповніть форму
3. Перевірте й надішліть','Тестове повідомлення у кабінеті','Не встановлено. ДЕМО.','Контакти не налаштовані','54df2fbd-959f-50f7-b9ac-819ba7fe5a13') on conflict do nothing;
insert into public.services (title,slug,category_id,department_id,summary,content,format,status,published_at,featured,is_demo,available,audience,duration,cost,eligibility,requirements,steps,result,legal_basis,contacts,id) values('Демо: звернення щодо благоустрою','demo-improvement','39c20512-9ed3-561b-85f7-e3ae50a8e8f1','fe2acb2d-f6c8-5f8f-be60-c6c7ef12ca6d','Опишіть питання щодо громадського простору.','**Демонстраційна послуга.** Подана заява не є офіційним зверненням до органу влади.','online','published','2026-01-01T00:00:00Z',true,true,true,array['residents']::text[],'Демонстраційний термін','Безкоштовно','Зареєстровані користувачі порталу','За потреби додайте тестовий PDF без персональних даних.','1. Увійдіть
2. Заповніть форму
3. Перевірте й надішліть','Тестове повідомлення у кабінеті','Не встановлено. ДЕМО.','Контакти не налаштовані','5024afda-123d-5e15-860e-fe90357d055f') on conflict do nothing;
insert into public.services (title,slug,category_id,department_id,summary,content,format,status,published_at,featured,is_demo,available,audience,duration,cost,eligibility,requirements,steps,result,legal_basis,contacts,id) values('Демо: інформація для родин','demo-family','cc6d952c-f121-5b94-8954-a16ef7b5f499','fe2acb2d-f6c8-5f8f-be60-c6c7ef12ca6d','Тестова послуга для перевірки форм і вкладень.','**Демонстраційна послуга.** Подана заява не є офіційним зверненням до органу влади.','online','published','2026-01-01T00:00:00Z',true,true,true,array['residents']::text[],'Демонстраційний термін','Безкоштовно','Зареєстровані користувачі порталу','За потреби додайте тестовий PDF без персональних даних.','1. Увійдіть
2. Заповніть форму
3. Перевірте й надішліть','Тестове повідомлення у кабінеті','Не встановлено. ДЕМО.','Контакти не налаштовані','3f00d16e-8047-54b3-806f-c7b2d443f57e') on conflict do nothing;
insert into public.service_forms (service_id,title,id) values('54df2fbd-959f-50f7-b9ac-819ba7fe5a13','Електронна заява','f02a2eb4-ca31-5d6d-ab7d-547c25030a0e') on conflict do nothing;
insert into public.service_forms (service_id,title,id) values('5024afda-123d-5e15-860e-fe90357d055f','Електронна заява','add76e93-3c7d-5f41-ac2a-5caa94c03a8d') on conflict do nothing;
insert into public.service_forms (service_id,title,id) values('3f00d16e-8047-54b3-806f-c7b2d443f57e','Електронна заява','3101f9b5-fa82-5946-9cf1-e8258f3b16cc') on conflict do nothing;
insert into public.service_form_fields (form_id,key,type,label,required,options,validation,sort_order,id) values('f02a2eb4-ca31-5d6d-ab7d-547c25030a0e','name','text','Ваше ім’я',true,'[]'::jsonb,'{}'::jsonb,0,'dbaf2ae6-e19d-5755-b346-75892a42f4fa') on conflict do nothing;
insert into public.service_form_fields (form_id,key,type,label,required,options,validation,sort_order,id) values('f02a2eb4-ca31-5d6d-ab7d-547c25030a0e','email','email','Email для зв’язку',true,'[]'::jsonb,'{}'::jsonb,1,'64c933cc-517d-5e65-9018-ce806fe5482c') on conflict do nothing;
insert into public.service_form_fields (form_id,key,type,label,required,options,validation,sort_order,id) values('f02a2eb4-ca31-5d6d-ab7d-547c25030a0e','subject','select','Тема запиту',true,'["Консультація", "Інше"]'::jsonb,'{}'::jsonb,2,'2a90c528-00d3-54a8-8b55-c85ae4ac4bf3') on conflict do nothing;
insert into public.service_form_fields (form_id,key,type,label,required,options,validation,sort_order,id) values('f02a2eb4-ca31-5d6d-ab7d-547c25030a0e','description','textarea','Опишіть питання',true,'[]'::jsonb,'{"minLength": 10, "maxLength": 5000}'::jsonb,3,'93f1b55b-42d0-5dee-a750-a41b29c33f08') on conflict do nothing;
insert into public.service_form_fields (form_id,key,type,label,required,options,validation,sort_order,id) values('f02a2eb4-ca31-5d6d-ab7d-547c25030a0e','attachment','pdf','Тестовий PDF',false,'[]'::jsonb,'{}'::jsonb,4,'f4bc8f21-b0fc-5aa4-bd3e-a67ef2709cd1') on conflict do nothing;
insert into public.service_form_fields (form_id,key,type,label,required,options,validation,sort_order,id) values('f02a2eb4-ca31-5d6d-ab7d-547c25030a0e','consent','confirmation','Підтверджую, що це демонстраційна заява',true,'[]'::jsonb,'{}'::jsonb,5,'5efa637c-300c-51f5-b11c-a6833fb6dd37') on conflict do nothing;
insert into public.service_form_fields (form_id,key,type,label,required,options,validation,sort_order,id) values('add76e93-3c7d-5f41-ac2a-5caa94c03a8d','name','text','Ваше ім’я',true,'[]'::jsonb,'{}'::jsonb,0,'508ae6bf-4c51-5605-acd8-013de4d575bb') on conflict do nothing;
insert into public.service_form_fields (form_id,key,type,label,required,options,validation,sort_order,id) values('add76e93-3c7d-5f41-ac2a-5caa94c03a8d','email','email','Email для зв’язку',true,'[]'::jsonb,'{}'::jsonb,1,'63d322e4-3c77-57b7-94b9-560de1265fa1') on conflict do nothing;
insert into public.service_form_fields (form_id,key,type,label,required,options,validation,sort_order,id) values('add76e93-3c7d-5f41-ac2a-5caa94c03a8d','subject','select','Тема запиту',true,'["Консультація", "Інше"]'::jsonb,'{}'::jsonb,2,'517d4f62-f014-54be-92ce-f94d77447c08') on conflict do nothing;
insert into public.service_form_fields (form_id,key,type,label,required,options,validation,sort_order,id) values('add76e93-3c7d-5f41-ac2a-5caa94c03a8d','description','textarea','Опишіть питання',true,'[]'::jsonb,'{"minLength": 10, "maxLength": 5000}'::jsonb,3,'ada87e9a-8580-553c-8d1f-dc3065a3d637') on conflict do nothing;
insert into public.service_form_fields (form_id,key,type,label,required,options,validation,sort_order,id) values('add76e93-3c7d-5f41-ac2a-5caa94c03a8d','attachment','pdf','Тестовий PDF',false,'[]'::jsonb,'{}'::jsonb,4,'48a1dc83-c264-5844-b339-10f009ed6dbe') on conflict do nothing;
insert into public.service_form_fields (form_id,key,type,label,required,options,validation,sort_order,id) values('add76e93-3c7d-5f41-ac2a-5caa94c03a8d','consent','confirmation','Підтверджую, що це демонстраційна заява',true,'[]'::jsonb,'{}'::jsonb,5,'ada53598-48d9-5516-82c7-343809c64cb1') on conflict do nothing;
insert into public.service_form_fields (form_id,key,type,label,required,options,validation,sort_order,id) values('3101f9b5-fa82-5946-9cf1-e8258f3b16cc','name','text','Ваше ім’я',true,'[]'::jsonb,'{}'::jsonb,0,'21a385f5-7c0e-5548-adb6-df44ba8c0df1') on conflict do nothing;
insert into public.service_form_fields (form_id,key,type,label,required,options,validation,sort_order,id) values('3101f9b5-fa82-5946-9cf1-e8258f3b16cc','email','email','Email для зв’язку',true,'[]'::jsonb,'{}'::jsonb,1,'0ff15f27-354a-5efe-96a5-cc5bf9e7bf6f') on conflict do nothing;
insert into public.service_form_fields (form_id,key,type,label,required,options,validation,sort_order,id) values('3101f9b5-fa82-5946-9cf1-e8258f3b16cc','subject','select','Тема запиту',true,'["Консультація", "Інше"]'::jsonb,'{}'::jsonb,2,'65fb4faa-5c83-5853-a62d-f76f841308d1') on conflict do nothing;
insert into public.service_form_fields (form_id,key,type,label,required,options,validation,sort_order,id) values('3101f9b5-fa82-5946-9cf1-e8258f3b16cc','description','textarea','Опишіть питання',true,'[]'::jsonb,'{"minLength": 10, "maxLength": 5000}'::jsonb,3,'d13e7361-1c9c-5105-bbfb-a6a58ec8dc37') on conflict do nothing;
insert into public.service_form_fields (form_id,key,type,label,required,options,validation,sort_order,id) values('3101f9b5-fa82-5946-9cf1-e8258f3b16cc','attachment','pdf','Тестовий PDF',false,'[]'::jsonb,'{}'::jsonb,4,'3965c56c-370f-5d9f-8ce9-f5d0dd3a7f7c') on conflict do nothing;
insert into public.service_form_fields (form_id,key,type,label,required,options,validation,sort_order,id) values('3101f9b5-fa82-5946-9cf1-e8258f3b16cc','consent','confirmation','Підтверджую, що це демонстраційна заява',true,'[]'::jsonb,'{}'::jsonb,5,'69f47035-7795-5a94-b538-37a4def8f0e0') on conflict do nothing;
insert into public.news (title,slug,summary,content,category_id,status,published_at,featured,is_demo,author,id) values('Демо: ваші міські сервіси в одному місці','demo-portal','Огляд можливостей порталу для мешканців.','## Демонстраційна публікація
Цей матеріал показує роботу редактора. **Він не є міською новиною.**','89e2cac5-4229-5ab9-873c-2bdf3c92183d','published','2026-09-01T09:00:00Z',true,true,'Демо-редакція','870df716-2f3d-57c1-adb7-3e94173c75f5') on conflict do nothing;
insert into public.news (title,slug,summary,content,category_id,status,published_at,featured,is_demo,author,id) values('Демо: як подати першу заяву','demo-application','Від заповнення форми до відповіді у кабінеті.','## Демонстраційна публікація
Цей матеріал показує роботу редактора. **Він не є міською новиною.**','89e2cac5-4229-5ab9-873c-2bdf3c92183d','published','2026-09-01T09:00:00Z',false,true,'Демо-редакція','6c227896-be09-5f25-9be2-40bace217161') on conflict do nothing;
insert into public.news (title,slug,summary,content,category_id,status,published_at,featured,is_demo,author,id) values('Демо: новий простір для взаємодії','demo-community','Знайомство з сервісом звернень.','## Демонстраційна публікація
Цей матеріал показує роботу редактора. **Він не є міською новиною.**','89e2cac5-4229-5ab9-873c-2bdf3c92183d','published','2026-09-01T09:00:00Z',false,true,'Демо-редакція','edb73877-bcbe-5478-a7cb-3af287c63643') on conflict do nothing;
insert into public.documents (title,slug,document_number,date,category_id,description,status,published_at,is_demo,id) values('Демо: інформаційний документ порталу','demo-guide','ДЕМО','2026-09-01','1b04a611-7019-58fe-825d-6f75fbdf3edd','Демонстраційний документ. Адміністратор має завантажити PDF.','published','2026-01-01T00:00:00Z',true,'ba1fb2de-67c1-5465-999a-e0212eefdc17') on conflict do nothing;
insert into public.events (title,slug,summary,content,starts_at,location,organizer,category,status,published_at,is_demo,id) values('Демо: знайомство з міськими сервісами','demo-event','Тестова подія в календарі.','ДЕМО. Захід не є реальною міською подією.','2026-10-20T12:00:00Z','Місце не налаштовано','Не налаштовано','Зустріч','published','2026-01-01T00:00:00Z',true,'c5b46005-7d12-574b-a567-d91dbee39591') on conflict do nothing;
insert into public.faqs (question,answer,category,published,is_demo,id) values('Як подати заяву?','Увійдіть, виберіть послугу, заповніть форму, перевірте дані та підтвердьте надсилання.','Портал',true,true,'1b5da824-4e53-58c6-b0ff-28e490c551e8') on conflict do nothing;
insert into public.faqs (question,answer,category,published,is_demo,id) values('Де побачити відповідь?','У кабінеті відкрийте «Мої заяви» й виберіть потрібну заяву.','Портал',true,true,'18894006-52ee-5286-af3a-a94c7503e0bb') on conflict do nothing;
insert into public.faqs (question,answer,category,published,is_demo,id) values('Чи є це офіційним порталом?','Поточний проєкт — демонстраційна платформа. Офіційні органи й правові тексти налаштовує власник.','Портал',true,true,'9caf37ea-29a8-5191-bc8b-b13101aae1e8') on conflict do nothing;
insert into public.site_settings (key,value,id) values('name','"Черкаси Цифрові"'::jsonb,'28b470e1-83b2-585c-a285-c796d1fcdfc8') on conflict do nothing;
insert into public.site_settings (key,value,id) values('short_name','"Цифрові"'::jsonb,'992793b9-8c2f-567d-8573-b967f6ddff06') on conflict do nothing;
insert into public.site_settings (key,value,id) values('description','"Міські послуги, документи та сервіси в одному місці"'::jsonb,'42872711-3970-5255-81d7-b6e10be04e96') on conflict do nothing;
insert into public.site_settings (key,value,id) values('hero_title','"Черкаси — місто онлайн"'::jsonb,'08bd320f-9705-566c-8aa0-ffe919474b73') on conflict do nothing;
insert into public.site_settings (key,value,id) values('hero_description','"Менше черг. Більше часу для життя. Усе важливе для вашого міста — поруч."'::jsonb,'64a06144-40dc-5dac-a8dd-d93caa0806e1') on conflict do nothing;
insert into public.site_settings (key,value,id) values('primary_color','"#087F72"'::jsonb,'b511fe66-56a5-5994-8f7d-c4fc86344d31') on conflict do nothing;
insert into public.site_settings (key,value,id) values('accent_color','"#13B8A6"'::jsonb,'c1bae008-7fc2-5616-b935-1fdbb4473c7c') on conflict do nothing;
insert into public.site_settings (key,value,id) values('contact_email','""'::jsonb,'9c5e3f42-8f55-55d3-bd99-0e8b57480a94') on conflict do nothing;
insert into public.site_settings (key,value,id) values('footer_text','"Демонстраційний міський портал. Не є офіційним ресурсом міської ради."'::jsonb,'b51b88d4-4b2a-513c-a874-72f9d62e0178') on conflict do nothing;
insert into public.site_settings (key,value,id) values('social_links','[]'::jsonb,'d3aa602c-928d-5be4-9b81-96d8785e4205') on conflict do nothing;
insert into public.site_settings (key,value,id) values('logo_path','""'::jsonb,'729d909f-fe1f-5b7a-9488-25be7393822c') on conflict do nothing;
insert into public.site_settings (key,value,id) values('favicon_path','""'::jsonb,'31f32619-e109-5ee1-9760-af85534dab7c') on conflict do nothing;
insert into public.site_settings (key,value,id) values('maintenance_notice','""'::jsonb,'ac1abd84-e641-503c-b9e3-aba154051251') on conflict do nothing;
insert into public.site_settings (key,value,id) values('privacy_text','"Правовий текст не налаштовано. Перед прийманням реальних персональних даних власник має опублікувати затверджену політику."'::jsonb,'ee29f719-8e97-510b-9bb1-2a35e09e3698') on conflict do nothing;
insert into public.site_settings (key,value,id) values('terms_text','"Умови використання не налаштовано."'::jsonb,'8b8c5ece-993d-53f5-bee0-22dfaf76e262') on conflict do nothing;
insert into public.site_settings (key,value,id) values('homepage_blocks','[{"key": "popular", "enabled": true, "sort_order": 0}, {"key": "categories", "enabled": true, "sort_order": 1}, {"key": "now", "enabled": true, "sort_order": 2}, {"key": "announcements", "enabled": true, "sort_order": 3}, {"key": "news", "enabled": true, "sort_order": 4}, {"key": "events", "enabled": true, "sort_order": 5}, {"key": "documents", "enabled": true, "sort_order": 6}, {"key": "help", "enabled": true, "sort_order": 7}]'::jsonb,'5145bc30-eeea-55ad-aba6-c5c1b218fb93') on conflict do nothing;


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
