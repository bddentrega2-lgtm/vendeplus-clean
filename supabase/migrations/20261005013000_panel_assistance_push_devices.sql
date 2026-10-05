create table if not exists public.panel_push_devices (
  fcm_token text primary key check (char_length(fcm_token) between 40 and 512),
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists panel_push_devices_store_updated_idx
  on public.panel_push_devices (store_id, updated_at desc);

alter table public.panel_push_devices enable row level security;
revoke all on public.panel_push_devices from anon, authenticated;
grant all on public.panel_push_devices to service_role;
