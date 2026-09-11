alter table public.stores
  add column if not exists payment_proof_mode text not null default 'disabled',
  add column if not exists payment_proof_required boolean not null default false;

alter table public.stores drop constraint if exists stores_payment_proof_mode_check;
alter table public.stores add constraint stores_payment_proof_mode_check
  check (payment_proof_mode in ('disabled', 'reference', 'image'));
alter table public.stores drop constraint if exists stores_payment_proof_required_check;
alter table public.stores add constraint stores_payment_proof_required_check
  check (payment_proof_mode <> 'disabled' or payment_proof_required = false);

alter table public.transport_agencies
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null;

create table if not exists public.order_payment_receipts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  storage_path text unique,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 2097152),
  created_at timestamptz not null default now(),
  attached_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  deleted_at timestamptz,
  constraint order_payment_receipts_single_order unique (order_id)
);

create index if not exists order_payment_receipts_cleanup_idx
  on public.order_payment_receipts (expires_at)
  where deleted_at is null and storage_path is not null;
create index if not exists order_payment_receipts_store_order_idx
  on public.order_payment_receipts (store_id, order_id);

alter table public.order_payment_receipts enable row level security;
revoke all on table public.order_payment_receipts from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-receipts',
  'payment-receipts',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "No direct payment receipt access" on storage.objects;
create policy "No direct payment receipt access"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'payment-receipts' and false);

create or replace function public.archive_transport_agency(
  p_agency_id uuid,
  p_archived_by uuid default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
  v_connection_ids uuid[];
  v_affected_store_ids uuid[];
begin
  select slug into v_slug
  from public.transport_agencies
  where id = p_agency_id and archived_at is null
  for update;

  if v_slug is null then return 0; end if;
  if v_slug = 'entrega2' then raise exception 'system_agency'; end if;

  select coalesce(array_agg(id), array[]::uuid[])
    into v_connection_ids
  from public.store_transport_agency_connections
  where agency_id = p_agency_id and status = 'active';

  select coalesce(array_agg(distinct store_id), array[]::uuid[])
    into v_affected_store_ids
  from public.store_delivery_settings
  where transport_agency_connection_id = any(v_connection_ids);

  update public.store_transport_agency_connections
  set status = 'paused', is_default = false, paused_at = now(), updated_at = now()
  where id = any(v_connection_ids);

  update public.store_delivery_settings
  set delivery_enabled = false,
      delivery_provider = 'disabled',
      transport_agency_connection_id = null,
      transport_agency_id = null,
      updated_at = now()
  where transport_agency_connection_id = any(v_connection_ids);

  update public.stores set accepts_delivery = false where id = any(v_affected_store_ids);

  update public.transport_agencies
  set archived_at = now(), archived_by = p_archived_by, is_active = false,
      premium_dispatch_enabled = false, status = 'paused', updated_at = now()
  where id = p_agency_id;

  return cardinality(v_affected_store_ids);
end;
$$;

revoke all on function public.archive_transport_agency(uuid, uuid) from public, anon, authenticated;
grant execute on function public.archive_transport_agency(uuid, uuid) to service_role;
