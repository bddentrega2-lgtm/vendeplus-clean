-- Merchant subscription payment requests and admin approvals.

create table if not exists public.store_subscription_payments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  plan_type text not null default 'emprendedor',
  billing_period text not null default 'monthly',
  amount_usd numeric(10, 2) not null default 0,
  amount_bs numeric(14, 2) not null default 0,
  exchange_rate numeric(14, 4) not null default 0,
  payment_reference text,
  payment_bank text,
  paid_at date,
  proof_url text,
  notes text,
  status text not null default 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_subscription_payments_period_check
    check (billing_period in ('monthly', 'annual')),
  constraint store_subscription_payments_status_check
    check (status in ('pending', 'approved', 'rejected'))
);

alter table public.store_subscription_payments enable row level security;

revoke all on public.store_subscription_payments from anon, authenticated;

create index if not exists store_subscription_payments_store_status_idx
  on public.store_subscription_payments(store_id, status, created_at desc);

create or replace function public.set_store_subscription_payments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists store_subscription_payments_updated_at
  on public.store_subscription_payments;

create trigger store_subscription_payments_updated_at
before update on public.store_subscription_payments
for each row
execute function public.set_store_subscription_payments_updated_at();
