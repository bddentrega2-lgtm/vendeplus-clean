create table if not exists public.store_delivery_settings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  delivery_enabled boolean not null default false,
  pickup_enabled boolean not null default true,
  delivery_provider text not null default 'disabled',
  pricing_type text not null default 'manual',
  fixed_fee_usd numeric not null default 0,
  free_delivery_min_usd numeric,
  max_distance_km numeric,
  distance_factor numeric,
  manual_quote_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_delivery_settings_store_unique unique (store_id),
  constraint store_delivery_settings_provider_check
    check (delivery_provider in ('own_delivery', 'entrega2', 'manual_quote', 'disabled')),
  constraint store_delivery_settings_pricing_check
    check (pricing_type in ('fixed', 'distance_ranges', 'zones', 'free_over_amount', 'manual')),
  constraint store_delivery_settings_fixed_fee_check check (fixed_fee_usd >= 0),
  constraint store_delivery_settings_free_min_check
    check (free_delivery_min_usd is null or free_delivery_min_usd >= 0),
  constraint store_delivery_settings_max_distance_check
    check (max_distance_km is null or max_distance_km >= 0),
  constraint store_delivery_settings_distance_factor_check
    check (distance_factor is null or distance_factor >= 0)
);

create table if not exists public.store_delivery_distance_rates (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  min_km numeric not null default 0,
  max_km numeric,
  fee_usd numeric not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_delivery_distance_rates_min_check check (min_km >= 0),
  constraint store_delivery_distance_rates_max_check check (max_km is null or max_km >= min_km),
  constraint store_delivery_distance_rates_fee_check check (fee_usd >= 0)
);

create table if not exists public.store_delivery_zones (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  description text,
  fee_usd numeric not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_delivery_zones_fee_check check (fee_usd >= 0)
);

alter table public.orders
  add column if not exists delivery_provider text,
  add column if not exists delivery_fee_usd numeric,
  add column if not exists delivery_zone_id uuid null references public.store_delivery_zones(id) on delete set null,
  add column if not exists delivery_zone_name text,
  add column if not exists delivery_distance_km numeric,
  add column if not exists delivery_pricing_type text,
  add column if not exists delivery_status text,
  add column if not exists delivery_notes text,
  add column if not exists delivery_address text;

create index if not exists store_delivery_settings_store_idx
  on public.store_delivery_settings(store_id);

create index if not exists store_delivery_distance_rates_store_idx
  on public.store_delivery_distance_rates(store_id, is_active, sort_order);

create index if not exists store_delivery_zones_store_idx
  on public.store_delivery_zones(store_id, is_active, sort_order);

create index if not exists orders_store_delivery_provider_idx
  on public.orders(store_id, delivery_provider);

alter table public.store_delivery_settings enable row level security;
alter table public.store_delivery_distance_rates enable row level security;
alter table public.store_delivery_zones enable row level security;

create policy "Public can read delivery settings"
  on public.store_delivery_settings
  for select
  using (true);

create policy "Public can read active delivery rates"
  on public.store_delivery_distance_rates
  for select
  using (is_active = true);

create policy "Public can read active delivery zones"
  on public.store_delivery_zones
  for select
  using (is_active = true);
