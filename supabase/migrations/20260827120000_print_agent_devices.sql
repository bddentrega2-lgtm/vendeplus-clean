-- Dispositivos revocables para la app de impresion Vende+.
create table if not exists public.print_agent_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  code_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.print_agent_devices (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  platform text not null default 'windows',
  app_version text,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists print_agent_pairing_codes_store_idx
  on public.print_agent_pairing_codes (store_id, created_at desc);
create index if not exists print_agent_devices_store_idx
  on public.print_agent_devices (store_id, created_at desc);

alter table public.print_agent_pairing_codes enable row level security;
alter table public.print_agent_devices enable row level security;
revoke all on table public.print_agent_pairing_codes from public, anon, authenticated;
revoke all on table public.print_agent_devices from public, anon, authenticated;
grant all on table public.print_agent_pairing_codes to service_role;
grant all on table public.print_agent_devices to service_role;

create or replace function public.pair_print_agent_device(
  p_code_hash text,
  p_token_hash text,
  p_name text,
  p_platform text,
  p_app_version text
)
returns table (id uuid, store_id uuid, name text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_pairing public.print_agent_pairing_codes%rowtype;
begin
  select * into v_pairing
  from public.print_agent_pairing_codes
  where code_hash = p_code_hash and used_at is null and expires_at > now()
  for update skip locked;

  if not found then return; end if;

  update public.print_agent_pairing_codes set used_at = now() where print_agent_pairing_codes.id = v_pairing.id;
  return query
    insert into public.print_agent_devices (store_id, name, token_hash, platform, app_version, last_seen_at)
    values (v_pairing.store_id, left(p_name, 100), p_token_hash, left(p_platform, 30), left(p_app_version, 30), now())
    returning print_agent_devices.id, print_agent_devices.store_id, print_agent_devices.name;
end;
$$;

revoke all on function public.pair_print_agent_device(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.pair_print_agent_device(text, text, text, text, text) to service_role;

alter table public.store_print_settings drop constraint if exists store_print_settings_connector_check;
alter table public.store_print_settings alter column connector set default 'agent';
update public.store_print_settings set connector = 'agent' where connector = 'qz';
alter table public.store_print_settings
  add constraint store_print_settings_connector_check check (connector in ('agent'));

alter table public.order_print_jobs drop constraint if exists order_print_jobs_event_type_check;
alter table public.order_print_jobs
  add constraint order_print_jobs_event_type_check check (event_type in ('received', 'paid', 'manual'));
alter table public.order_print_jobs add column if not exists dedupe_key text;
update public.order_print_jobs set dedupe_key = event_type where dedupe_key is null;
alter table public.order_print_jobs alter column dedupe_key set default gen_random_uuid()::text;
alter table public.order_print_jobs alter column dedupe_key set not null;
alter table public.order_print_jobs drop constraint if exists order_print_jobs_store_id_order_id_event_type_key;
create unique index if not exists order_print_jobs_dedupe_idx
  on public.order_print_jobs (store_id, order_id, dedupe_key);

create or replace function public.enqueue_store_print_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.store_print_settings%rowtype;
begin
  select * into v_settings from public.store_print_settings
  where store_id = new.store_id and is_enabled = true;
  if not found then return new; end if;

  if tg_op = 'INSERT' and v_settings.trigger_mode in ('received', 'both') then
    insert into public.order_print_jobs (store_id, order_id, event_type, dedupe_key)
    values (new.store_id, new.id, 'received', 'received')
    on conflict (store_id, order_id, dedupe_key) do nothing;
  end if;
  if v_settings.trigger_mode in ('paid', 'both')
    and new.payment_status = 'verified'
    and (tg_op = 'INSERT' or old.payment_status is distinct from 'verified') then
    insert into public.order_print_jobs (store_id, order_id, event_type, dedupe_key)
    values (new.store_id, new.id, 'paid', 'paid')
    on conflict (store_id, order_id, dedupe_key) do nothing;
  end if;
  return new;
end;
$$;
