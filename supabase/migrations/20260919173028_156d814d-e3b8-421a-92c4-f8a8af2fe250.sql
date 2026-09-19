create table public.customer_push_tokens (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  token text not null unique,
  platform text not null default 'WEB',
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_cpt_customer on public.customer_push_tokens(customer_id);
create index idx_cpt_business on public.customer_push_tokens(business_id) where is_active;

grant select on public.customer_push_tokens to authenticated;
grant all on public.customer_push_tokens to service_role;

alter table public.customer_push_tokens enable row level security;

create policy "Business members can view push devices"
on public.customer_push_tokens for select to authenticated
using (public.is_business_member(business_id));