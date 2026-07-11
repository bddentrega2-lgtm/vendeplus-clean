create table if not exists public.transport_agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  legal_name text,
  rif text,
  contact_name text not null,
  contact_email text not null,
  contact_phone text not null,
  whatsapp_phone text,
  city text,
  state text,
  coverage_notes text,
  logo_url text,
  modality text not null default 'open',
  pricing_type text not null default 'flat',
  status text not null default 'pending',
  is_active boolean not null default false,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transport_agencies_slug_unique unique (slug),
  constraint transport_agencies_modality_check
    check (modality in ('open', 'exclusive', 'mixed')),
  constraint transport_agencies_pricing_type_check
    check (pricing_type in ('flat', 'zones', 'distance_ranges', 'manual')),
  constraint transport_agencies_status_check
    check (status in ('pending', 'active', 'paused', 'rejected'))
);

create table if not exists public.transport_agency_users (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.transport_agencies(id) on delete cascade,
  user_id uuid,
  email text not null,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  constraint transport_agency_users_role_check
    check (role in ('owner', 'admin', 'operator', 'billing')),
  constraint transport_agency_users_agency_email_unique unique (agency_id, email)
);

create table if not exists public.transport_agency_rates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.transport_agencies(id) on delete cascade,
  flat_fee_usd numeric not null default 0,
  max_distance_km numeric,
  distance_factor_usd numeric,
  minimum_order_usd numeric,
  manual_quote_message text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transport_agency_rates_agency_unique unique (agency_id),
  constraint transport_agency_rates_fee_check check (flat_fee_usd >= 0),
  constraint transport_agency_rates_max_distance_check
    check (max_distance_km is null or max_distance_km >= 0),
  constraint transport_agency_rates_factor_check
    check (distance_factor_usd is null or distance_factor_usd >= 0),
  constraint transport_agency_rates_minimum_order_check
    check (minimum_order_usd is null or minimum_order_usd >= 0)
);

create table if not exists public.transport_agency_zones (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.transport_agencies(id) on delete cascade,
  name text not null,
  description text,
  fee_usd numeric not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transport_agency_zones_fee_check check (fee_usd >= 0)
);

create table if not exists public.transport_agency_distance_rates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.transport_agencies(id) on delete cascade,
  min_km numeric not null default 0,
  max_km numeric,
  fee_usd numeric not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transport_agency_distance_rates_min_check check (min_km >= 0),
  constraint transport_agency_distance_rates_max_check
    check (max_km is null or max_km >= min_km),
  constraint transport_agency_distance_rates_fee_check check (fee_usd >= 0)
);

create table if not exists public.store_transport_agency_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  agency_id uuid not null references public.transport_agencies(id) on delete cascade,
  requested_by uuid,
  contact_name text,
  contact_phone text,
  message text,
  status text not null default 'pending',
  response_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_transport_agency_requests_status_check
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  constraint store_transport_agency_requests_unique unique (store_id, agency_id)
);

create table if not exists public.store_transport_agency_connections (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  agency_id uuid not null references public.transport_agencies(id) on delete cascade,
  request_id uuid references public.store_transport_agency_requests(id) on delete set null,
  status text not null default 'active',
  is_default boolean not null default false,
  is_exclusive boolean not null default false,
  connected_at timestamptz not null default now(),
  paused_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_transport_agency_connections_status_check
    check (status in ('active', 'paused', 'cancelled')),
  constraint store_transport_agency_connections_unique unique (store_id, agency_id)
);

create table if not exists public.transport_agency_weekly_statements (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.transport_agencies(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  orders_count integer not null default 0,
  gross_delivery_usd numeric not null default 0,
  platform_fee_usd numeric not null default 0,
  net_payable_usd numeric not null default 0,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transport_agency_weekly_statements_status_check
    check (status in ('open', 'review', 'paid', 'void')),
  constraint transport_agency_weekly_statements_unique unique (agency_id, week_start)
);

alter table public.store_delivery_settings
  add column if not exists transport_agency_connection_id uuid
    references public.store_transport_agency_connections(id) on delete set null,
  add column if not exists transport_agency_id uuid
    references public.transport_agencies(id) on delete set null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'store_delivery_settings_provider_check'
  ) then
    alter table public.store_delivery_settings
      drop constraint store_delivery_settings_provider_check;
  end if;
end $$;

alter table public.store_delivery_settings
  add constraint store_delivery_settings_provider_check
  check (delivery_provider in ('own_delivery', 'entrega2', 'manual_quote', 'transport_agency', 'disabled'));

alter table public.orders
  add column if not exists transport_agency_id uuid
    references public.transport_agencies(id) on delete set null,
  add column if not exists transport_agency_name text,
  add column if not exists transport_agency_fee_usd numeric,
  add column if not exists transport_agency_pricing_type text,
  add column if not exists transport_agency_zone_name text,
  add column if not exists transport_agency_status text;

create index if not exists transport_agencies_status_idx
  on public.transport_agencies(status, is_active, city);
create index if not exists transport_agency_users_email_idx
  on public.transport_agency_users(email);
create index if not exists transport_agency_zones_agency_idx
  on public.transport_agency_zones(agency_id, is_active, sort_order);
create index if not exists transport_agency_distance_rates_agency_idx
  on public.transport_agency_distance_rates(agency_id, is_active, sort_order);
create index if not exists store_transport_agency_requests_store_idx
  on public.store_transport_agency_requests(store_id, status);
create index if not exists store_transport_agency_requests_agency_idx
  on public.store_transport_agency_requests(agency_id, status);
create index if not exists store_transport_agency_connections_store_idx
  on public.store_transport_agency_connections(store_id, status, is_default);
create index if not exists store_transport_agency_connections_agency_idx
  on public.store_transport_agency_connections(agency_id, status);
create index if not exists orders_transport_agency_idx
  on public.orders(transport_agency_id, created_at desc);

create unique index if not exists store_transport_agency_default_unique
  on public.store_transport_agency_connections(store_id)
  where is_default = true and status = 'active';

alter table public.transport_agencies enable row level security;
alter table public.transport_agency_users enable row level security;
alter table public.transport_agency_rates enable row level security;
alter table public.transport_agency_zones enable row level security;
alter table public.transport_agency_distance_rates enable row level security;
alter table public.store_transport_agency_requests enable row level security;
alter table public.store_transport_agency_connections enable row level security;
alter table public.transport_agency_weekly_statements enable row level security;

create policy "Public can read active transport agencies"
  on public.transport_agencies
  for select
  using (status = 'active' and is_active = true);

create policy "Public can read active transport agency rates"
  on public.transport_agency_rates
  for select
  using (
    is_active = true
    and exists (
      select 1 from public.transport_agencies agency
      where agency.id = transport_agency_rates.agency_id
        and agency.status = 'active'
        and agency.is_active = true
    )
  );

create policy "Public can read active transport agency zones"
  on public.transport_agency_zones
  for select
  using (
    is_active = true
    and exists (
      select 1 from public.transport_agencies agency
      where agency.id = transport_agency_zones.agency_id
        and agency.status = 'active'
        and agency.is_active = true
    )
  );

create policy "Public can read active transport agency distance rates"
  on public.transport_agency_distance_rates
  for select
  using (
    is_active = true
    and exists (
      select 1 from public.transport_agencies agency
      where agency.id = transport_agency_distance_rates.agency_id
        and agency.status = 'active'
        and agency.is_active = true
    )
  );

grant select on public.transport_agencies to anon, authenticated;
grant select on public.transport_agency_rates to anon, authenticated;
grant select on public.transport_agency_zones to anon, authenticated;
grant select on public.transport_agency_distance_rates to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('transport-agency-logos', 'transport-agency-logos', true)
on conflict (id) do nothing;
