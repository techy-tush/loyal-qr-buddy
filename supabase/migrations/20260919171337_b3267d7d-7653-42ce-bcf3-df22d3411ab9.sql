insert into public.user_roles (user_id, role)
select u.id, 'SUPER_ADMIN'::platform_role
from auth.users u
where not exists (select 1 from public.user_roles r where r.role = 'SUPER_ADMIN')
order by u.created_at
limit 1
on conflict (user_id, role) do nothing;