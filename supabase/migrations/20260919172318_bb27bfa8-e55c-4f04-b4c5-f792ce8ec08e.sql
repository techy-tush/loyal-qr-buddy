revoke all on function public.security_table_report() from public;
revoke all on function public.security_policy_report() from public;
grant execute on function public.security_table_report() to authenticated;
grant execute on function public.security_policy_report() to authenticated;
drop extension if exists pg_net;
create extension pg_net with schema extensions;