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
