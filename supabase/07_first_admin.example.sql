-- Register and confirm your own account first. Replace YOUR_EMAIL, then run in SQL Editor.
-- This is an administrative SQL operation, never executed from the browser.
insert into public.user_roles(user_id,role_name)
select id,'super_admin' from auth.users where lower(email)=lower('YOUR_EMAIL')
on conflict(user_id,role_name) do nothing;
-- Check the result:
select p.email,r.role_name from public.profiles p join public.user_roles r on r.user_id=p.user_id
where lower(p.email)=lower('YOUR_EMAIL');
