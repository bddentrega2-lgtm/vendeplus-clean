-- Weekly control for Entrega2 external app and WhatsApp services.
-- All access is server-side through authenticated transport agency routes.

create table if not exists public.transport_control_allies (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.transport_agencies(id) on delete cascade,
  external_key text not null,
  name text not null,
  payment_terms text not null default 'credit',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint transport_control_allies_key_not_blank check (length(btrim(external_key)) > 0),
  constraint transport_control_allies_name_not_blank check (length(btrim(name)) > 0),
  constraint transport_control_allies_payment_terms_check check (payment_terms in ('credit', 'cash')),
  unique (agency_id, external_key)
);

create table if not exists public.transport_control_driver_rates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.transport_agencies(id) on delete cascade,
  normalized_name text not null,
  name text not null,
  vehicle_key text not null,
  vehicle_name text not null,
  commission_percent numeric(5,2) not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint transport_control_driver_rates_name_not_blank check (length(btrim(normalized_name)) > 0),
  constraint transport_control_driver_rates_vehicle_not_blank check (length(btrim(vehicle_key)) > 0),
  constraint transport_control_driver_rates_percent_check check (commission_percent >= 0 and commission_percent <= 100),
  unique (agency_id, normalized_name, vehicle_key)
);

create table if not exists public.transport_control_imports (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.transport_agencies(id) on delete cascade,
  source text not null,
  week_start date not null,
  week_end date not null,
  file_name text not null,
  file_hash text not null,
  rows_count integer not null default 0,
  imported_by uuid,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint transport_control_imports_source_check check (source in ('app', 'whatsapp')),
  constraint transport_control_imports_week_check check (week_end >= week_start),
  unique (agency_id, file_hash)
);

create table if not exists public.transport_control_services (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.transport_agencies(id) on delete cascade,
  import_id uuid not null references public.transport_control_imports(id) on delete cascade,
  source text not null,
  source_row integer not null,
  external_id text,
  service_date date not null,
  service_type text,
  ally_id uuid not null references public.transport_control_allies(id),
  ally_external_key text not null,
  ally_name_snapshot text not null,
  payment_terms_snapshot text not null,
  driver_rate_id uuid not null references public.transport_control_driver_rates(id),
  driver_name_snapshot text not null,
  vehicle_key_snapshot text not null,
  vehicle_name_snapshot text not null,
  fee_usd numeric(12,2) not null,
  commission_percent numeric(5,2) not null,
  driver_payout_usd numeric(12,2) not null,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint transport_control_services_source_check check (source in ('app', 'whatsapp')),
  constraint transport_control_services_payment_terms_check check (payment_terms_snapshot in ('credit', 'cash')),
  constraint transport_control_services_fee_check check (fee_usd >= 0),
  constraint transport_control_services_payout_check check (driver_payout_usd >= 0),
  unique (import_id, source_row)
);

create unique index if not exists idx_transport_control_services_external
  on public.transport_control_services (agency_id, source, external_id)
  where external_id is not null;

create index if not exists idx_transport_control_services_week
  on public.transport_control_services (agency_id, service_date);
create index if not exists idx_transport_control_services_ally_week
  on public.transport_control_services (agency_id, ally_id, service_date);
create index if not exists idx_transport_control_services_driver_week
  on public.transport_control_services (agency_id, driver_rate_id, service_date);

create table if not exists public.transport_control_weeks (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.transport_agencies(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  status text not null default 'open',
  closed_at timestamptz,
  closed_by uuid,
  reopened_at timestamptz,
  reopened_by uuid,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint transport_control_weeks_status_check check (status in ('open', 'closed')),
  unique (agency_id, week_start, week_end)
);

create table if not exists public.transport_control_ally_settlements (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.transport_control_weeks(id) on delete cascade,
  ally_id uuid not null references public.transport_control_allies(id),
  payment_status text not null default 'pending',
  paid_at timestamptz,
  updated_by uuid,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint transport_control_ally_settlements_status_check check (payment_status in ('pending', 'paid')),
  unique (week_id, ally_id)
);

create table if not exists public.transport_control_driver_settlements (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.transport_control_weeks(id) on delete cascade,
  driver_rate_id uuid not null references public.transport_control_driver_rates(id),
  payment_status text not null default 'pending',
  paid_at timestamptz,
  updated_by uuid,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint transport_control_driver_settlements_status_check check (payment_status in ('pending', 'paid')),
  unique (week_id, driver_rate_id)
);

alter table public.transport_control_allies enable row level security;
alter table public.transport_control_driver_rates enable row level security;
alter table public.transport_control_imports enable row level security;
alter table public.transport_control_services enable row level security;
alter table public.transport_control_weeks enable row level security;
alter table public.transport_control_ally_settlements enable row level security;
alter table public.transport_control_driver_settlements enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'transport_control_allies', 'transport_control_driver_rates', 'transport_control_imports',
    'transport_control_services', 'transport_control_weeks',
    'transport_control_ally_settlements', 'transport_control_driver_settlements'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_no_direct_access', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (false) with check (false)',
      table_name || '_no_direct_access', table_name
    );
  end loop;
end $$;
