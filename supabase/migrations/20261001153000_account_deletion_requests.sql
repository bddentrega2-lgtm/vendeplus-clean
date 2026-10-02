begin;

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  account_type text not null default 'buyer',
  store_ids uuid[] not null default '{}',
  agency_ids uuid[] not null default '{}',
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid,
  updated_at timestamptz not null default now(),
  constraint account_deletion_requests_type_check
    check (account_type in ('buyer', 'commerce', 'delivery', 'mixed')),
  constraint account_deletion_requests_status_check
    check (status in ('pending', 'completed', 'rejected'))
);

create unique index if not exists account_deletion_requests_pending_user_unique
  on public.account_deletion_requests(user_id)
  where status = 'pending' and user_id is not null;

create index if not exists account_deletion_requests_status_requested_idx
  on public.account_deletion_requests(status, requested_at desc);

alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public, anon, authenticated;
grant all on public.account_deletion_requests to service_role;

commit;
