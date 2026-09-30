alter table public.print_agent_devices
  add column if not exists fcm_token text,
  add column if not exists fcm_token_updated_at timestamptz;

create unique index if not exists print_agent_devices_fcm_token_idx
  on public.print_agent_devices (fcm_token)
  where fcm_token is not null;

revoke all on table public.print_agent_devices from public, anon, authenticated;
grant all on table public.print_agent_devices to service_role;
