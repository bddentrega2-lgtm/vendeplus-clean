alter table public.stores
  add column if not exists table_orders_access_enabled boolean not null default false,
  add column if not exists table_orders_enabled boolean not null default false,
  add column if not exists table_order_token uuid not null default gen_random_uuid(),
  add column if not exists table_payment_methods text[] not null default '{}'::text[];

create unique index if not exists stores_table_order_token_uidx
  on public.stores(table_order_token);

create table if not exists public.store_tables (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  zone text check (zone is null or char_length(trim(zone)) between 1 and 40),
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, name)
);

create index if not exists store_tables_store_enabled_idx
  on public.store_tables(store_id, is_enabled, name);

alter table public.store_tables enable row level security;
revoke all on table public.store_tables from anon, authenticated;
grant all on table public.store_tables to service_role;

alter table public.orders
  add column if not exists store_table_id uuid references public.store_tables(id) on delete set null,
  add column if not exists table_name_snapshot text,
  add column if not exists table_zone_snapshot text;

do $$
declare
  constraint_info record;
begin
  for constraint_info in
    select constraint_name
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'orders'
      and constraint_type = 'CHECK'
      and constraint_name in (
        select conname
        from pg_constraint
        where conrelid = 'public.orders'::regclass
          and contype = 'c'
          and pg_get_constraintdef(oid) ilike '%delivery_type%'
      )
  loop
    execute format(
      'alter table public.orders drop constraint if exists %I',
      constraint_info.constraint_name
    );
  end loop;
end
$$;

alter table public.orders
  add constraint orders_delivery_type_check
  check (delivery_type in ('delivery', 'pickup', 'national_shipping', 'table'))
  not valid;

alter table public.orders
  validate constraint orders_delivery_type_check;

create index if not exists orders_active_table_idx
  on public.orders(store_id, store_table_id, created_at desc)
  where store_table_id is not null
    and status not in ('completed', 'cancelled');

comment on column public.stores.table_order_token is
  'Token estable del QR unico del comercio para iniciar pedidos en mesa.';
comment on column public.stores.table_orders_access_enabled is
  'Acceso premium a Pedidos en Mesa, habilitado manualmente por Super Admin.';
comment on column public.stores.table_orders_enabled is
  'Interruptor operativo de Pedidos en Mesa administrado por el comercio.';
comment on table public.store_tables is
  'Mesas configurables por comercio para el modulo Pedidos en Mesa.';
