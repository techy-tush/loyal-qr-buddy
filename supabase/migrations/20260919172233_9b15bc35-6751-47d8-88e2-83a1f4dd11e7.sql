create or replace function public.security_table_report()
returns table (
  table_name text,
  rls_enabled boolean,
  policy_count integer,
  has_business_id boolean,
  anon_privs text,
  authenticated_privs text
)
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Platform administrators only';
  end if;

  return query
  select c.relname::text,
         c.relrowsecurity,
         (select count(*)::int from pg_policy p where p.polrelid = c.oid),
         exists (
           select 1 from pg_attribute a
           where a.attrelid = c.oid and a.attname = 'business_id' and a.attnum > 0 and not a.attisdropped
         ),
         coalesce((
           select string_agg(distinct g.privilege_type, ', ' order by g.privilege_type)
           from information_schema.role_table_grants g
           where g.table_schema = 'public' and g.table_name = c.relname and g.grantee = 'anon'
         ), '')::text,
         coalesce((
           select string_agg(distinct g.privilege_type, ', ' order by g.privilege_type)
           from information_schema.role_table_grants g
           where g.table_schema = 'public' and g.table_name = c.relname and g.grantee = 'authenticated'
         ), '')::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname;
end;
$$;

create or replace function public.security_policy_report()
returns table (
  table_name text,
  policy_name text,
  command text,
  roles text,
  using_expression text,
  check_expression text
)
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Platform administrators only';
  end if;

  return query
  select p.tablename::text,
         p.policyname::text,
         p.cmd::text,
         array_to_string(p.roles, ', ')::text,
         coalesce(p.qual, '')::text,
         coalesce(p.with_check, '')::text
  from pg_policies p
  where p.schemaname = 'public'
  order by p.tablename, p.policyname;
end;
$$;

revoke all on function public.security_table_report() from anon;
revoke all on function public.security_policy_report() from anon;
grant execute on function public.security_table_report() to authenticated;
grant execute on function public.security_policy_report() to authenticated;