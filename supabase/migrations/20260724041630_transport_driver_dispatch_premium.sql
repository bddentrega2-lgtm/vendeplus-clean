alter table if exists public.transport_agencies
  add column if not exists premium_dispatch_enabled boolean not null default false;

create table if not exists public.transport_drivers (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.transport_agencies(id) on delete cascade,
  name text not null,
  phone text,
  commission_percent numeric(5,2) not null default 60,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint transport_drivers_name_not_blank check (length(btrim(name)) > 0),
  constraint transport_drivers_commission_percent_check check (
    commission_percent >= 0 and commission_percent <= 100
  )
);

alter table if exists public.transport_orders
  add column if not exists driver_id uuid references public.transport_drivers(id) on delete set null,
  add column if not exists driver_name_snapshot text,
  add column if not exists driver_commission_percent numeric(5,2),
  add column if not exists driver_payout_usd numeric(12,2),
  add column if not exists driver_assigned_at timestamptz,
  add constraint transport_orders_driver_commission_percent_check check (
    driver_commission_percent is null
    or (driver_commission_percent >= 0 and driver_commission_percent <= 100)
  ),
  add constraint transport_orders_driver_payout_usd_check check (
    driver_payout_usd is null or driver_payout_usd >= 0
  );

create index if not exists idx_transport_agencies_premium_dispatch
  on public.transport_agencies (premium_dispatch_enabled)
  where premium_dispatch_enabled = true;

create index if not exists idx_transport_drivers_agency_active_name
  on public.transport_drivers (agency_id, is_active, name);

create index if not exists idx_transport_orders_agency_driver_created
  on public.transport_orders (agency_id, driver_id, created_at desc);

alter table public.transport_drivers enable row level security;

drop policy if exists "transport_drivers_no_direct_access" on public.transport_drivers;
create policy "transport_drivers_no_direct_access"
  on public.transport_drivers
  for all
  to authenticated
  using (false)
  with check (false);
