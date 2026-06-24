create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  phone text not null,
  phone_normalized text not null,
  notes text,
  tags text[] not null default '{}'::text[],
  orders_count integer not null default 0,
  total_spent_usd numeric not null default 0,
  average_ticket_usd numeric not null default 0,
  last_order_id uuid,
  last_order_at timestamptz,
  favorite_products jsonb not null default '[]'::jsonb,
  frequent_address text,
  preferred_payment_method text,
  preferred_fulfillment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_orders_count_check check (orders_count >= 0),
  constraint customers_total_spent_check check (total_spent_usd >= 0),
  constraint customers_average_ticket_check check (average_ticket_usd >= 0),
  constraint customers_store_phone_unique unique (store_id, phone_normalized)
);

alter table public.orders
  add column if not exists customer_id uuid null references public.customers(id) on delete set null,
  add column if not exists customer_phone_normalized text;

create index if not exists customers_store_last_order_idx
  on public.customers(store_id, last_order_at desc nulls last);

create index if not exists customers_store_orders_idx
  on public.customers(store_id, orders_count desc, total_spent_usd desc);

create index if not exists customers_store_phone_idx
  on public.customers(store_id, phone_normalized);

create index if not exists orders_customer_id_idx
  on public.orders(customer_id);

create index if not exists orders_store_customer_phone_normalized_idx
  on public.orders(store_id, customer_phone_normalized);

alter table public.customers enable row level security;

create policy "Customers are readable through server APIs"
  on public.customers
  for select
  using (false);
