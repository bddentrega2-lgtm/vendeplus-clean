alter table public.orders
  add column if not exists payment_status text not null default 'pending',
  add column if not exists payment_reference text,
  add column if not exists payment_currency text,
  add column if not exists amount_paid numeric,
  add column if not exists payment_verified_at timestamptz,
  add column if not exists payment_notes text,
  add column if not exists payment_bank text,
  add column if not exists payment_verified_by uuid;

alter table public.stores
  add column if not exists payment_details jsonb not null default '{}'::jsonb;

create index if not exists orders_payment_status_idx
  on public.orders(payment_status);

create index if not exists orders_store_payment_status_idx
  on public.orders(store_id, payment_status);
