create table if not exists public.transport_push_devices (
  fcm_token text primary key check (char_length(fcm_token) between 40 and 512),
  user_id uuid not null references auth.users(id) on delete cascade,
  agency_id uuid not null references public.transport_agencies(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transport_push_devices_agency_updated_idx
  on public.transport_push_devices (agency_id, updated_at desc);

alter table public.transport_push_devices enable row level security;
revoke all on public.transport_push_devices from anon, authenticated;
grant all on public.transport_push_devices to service_role;
