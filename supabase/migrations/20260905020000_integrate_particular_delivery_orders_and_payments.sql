-- This migration follows the base transport_particular_requests migration.
alter table public.transport_agencies
  add column if not exists particular_payment_methods text[] not null default '{}'::text[],
  add column if not exists particular_payment_details jsonb not null default '{}'::jsonb;

alter table public.transport_agencies
  drop constraint if exists transport_agencies_particular_payment_details_object_check;

alter table public.transport_agencies
  add constraint transport_agencies_particular_payment_details_object_check
  check (jsonb_typeof(particular_payment_details) = 'object');

alter table public.transport_orders
  alter column order_id drop not null,
  alter column store_id drop not null,
  add column if not exists particular_request_id uuid
    references public.transport_particular_requests(id) on delete cascade;

create unique index if not exists transport_orders_particular_request_unique_idx
  on public.transport_orders(particular_request_id)
  where particular_request_id is not null;

alter table public.transport_orders
  drop constraint if exists transport_orders_source_check;

alter table public.transport_orders
  add constraint transport_orders_source_check check (
    (order_id is not null and store_id is not null and particular_request_id is null)
    or
    (order_id is null and store_id is null and particular_request_id is not null)
  );

alter table public.transport_particular_requests
  drop constraint if exists transport_particular_status_check;

alter table public.transport_particular_requests
  drop constraint if exists transport_particular_text_lengths_check;

alter table public.transport_particular_requests
  add constraint transport_particular_text_lengths_check check (
    char_length(requester_name) between 1 and 100 and
    char_length(requester_phone) between 1 and 24 and
    char_length(pickup_phone) between 1 and 24 and
    char_length(delivery_phone) between 1 and 24 and
    char_length(pickup_address) between 0 and 240 and
    char_length(delivery_address) between 0 and 240 and
    char_length(package_description) between 1 and 300
  );

alter table public.transport_particular_requests
  add constraint transport_particular_status_check check (status in (
    'pending_agency', 'sent_to_agency', 'agency_received', 'agency_accepted',
    'agency_rejected', 'driver_assigned', 'pickup_pending', 'picked_up',
    'on_the_way', 'delivered', 'delivery_failed', 'issue_reported', 'cancelled'
  ));

create or replace function private.create_transport_order_for_particular_request()
returns trigger
language plpgsql
set search_path = public, private
as $$
declare
  v_transport_order_id uuid;
  v_agency_name text;
  v_agency_whatsapp text;
begin
  select name, coalesce(whatsapp_phone, contact_phone)
    into v_agency_name, v_agency_whatsapp
  from public.transport_agencies
  where id = new.agency_id;

  insert into public.transport_orders (
    order_id,
    store_id,
    agency_id,
    particular_request_id,
    status,
    store_name_snapshot,
    agency_name_snapshot,
    agency_whatsapp_snapshot,
    customer_name_snapshot,
    customer_phone_snapshot,
    pickup_address,
    pickup_reference,
    delivery_address,
    delivery_reference,
    delivery_fee_usd,
    pricing_type,
    commerce_note,
    sent_to_agency_at
  ) values (
    null,
    null,
    new.agency_id,
    new.id,
    'pending_agency',
    'Particular',
    v_agency_name,
    v_agency_whatsapp,
    new.requester_name,
    new.requester_phone,
    nullif(new.pickup_address, ''),
    new.pickup_reference,
    nullif(new.delivery_address, ''),
    new.delivery_reference,
    new.delivery_fee_usd,
    new.pricing_type,
    new.package_description,
    now()
  )
  returning id into v_transport_order_id;

  insert into public.transport_order_events (
    transport_order_id,
    event_type,
    status_to,
    note,
    actor_type,
    actor_name
  ) values (
    v_transport_order_id,
    'particular_request_created',
    'pending_agency',
    'Solicitud creada desde el enlace para particulares.',
    'system',
    'Vende+'
  );

  return new;
end;
$$;

revoke all on function private.create_transport_order_for_particular_request()
  from public, anon, authenticated;

drop trigger if exists transport_particular_request_create_order_trigger
  on public.transport_particular_requests;

create trigger transport_particular_request_create_order_trigger
after insert on public.transport_particular_requests
for each row execute function private.create_transport_order_for_particular_request();

create or replace function private.sync_particular_request_status()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  if new.particular_request_id is not null and new.status is distinct from old.status then
    update public.transport_particular_requests
    set status = new.status, updated_at = now()
    where id = new.particular_request_id;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_particular_request_status()
  from public, anon, authenticated;

drop trigger if exists transport_order_sync_particular_status_trigger
  on public.transport_orders;

create trigger transport_order_sync_particular_status_trigger
after update of status on public.transport_orders
for each row execute function private.sync_particular_request_status();

comment on column public.transport_agencies.particular_payment_methods is
  'Metodos de pago mostrados en el enlace publico para particulares.';
comment on column public.transport_agencies.particular_payment_details is
  'Datos copiables de pago configurados por la empresa delivery.';
comment on column public.transport_orders.particular_request_id is
  'Solicitud particular que origina el servicio cuando no existe pedido de comercio.';
