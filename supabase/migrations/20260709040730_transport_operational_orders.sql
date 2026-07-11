-- Transport operational orders for traceable commerce <-> agency delivery.

create table if not exists public.transport_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  agency_id uuid not null references public.transport_agencies(id) on delete cascade,
  connection_id uuid references public.store_transport_agency_connections(id) on delete set null,
  status text not null default 'pending_agency',
  store_name_snapshot text,
  store_whatsapp_snapshot text,
  agency_name_snapshot text,
  agency_whatsapp_snapshot text,
  customer_name_snapshot text,
  customer_phone_snapshot text,
  pickup_address text,
  pickup_reference text,
  delivery_address text,
  delivery_reference text,
  delivery_zone_name text,
  delivery_fee_usd numeric,
  pricing_type text,
  commerce_note text,
  agency_status_note text,
  rejection_reason text,
  sent_to_agency_at timestamptz,
  agency_received_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  assigned_at timestamptz,
  picked_up_at timestamptz,
  on_the_way_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transport_orders_status_check
    check (status in (
      'pending_agency',
      'sent_to_agency',
      'agency_received',
      'agency_accepted',
      'agency_rejected',
      'driver_assigned',
      'pickup_pending',
      'picked_up',
      'on_the_way',
      'delivered',
      'delivery_failed',
      'issue_reported',
      'cancelled'
    )),
  constraint transport_orders_order_agency_unique unique (order_id, agency_id)
);

create table if not exists public.transport_order_events (
  id uuid primary key default gen_random_uuid(),
  transport_order_id uuid not null references public.transport_orders(id) on delete cascade,
  event_type text not null,
  status_from text,
  status_to text,
  note text,
  actor_type text not null default 'system',
  actor_user_id uuid,
  actor_name text,
  created_at timestamptz not null default now(),
  constraint transport_order_events_actor_type_check
    check (actor_type in ('commerce', 'agency', 'admin', 'system'))
);

create index if not exists transport_orders_store_idx
  on public.transport_orders(store_id, created_at desc);

create index if not exists transport_orders_agency_idx
  on public.transport_orders(agency_id, status, created_at desc);

create index if not exists transport_orders_order_idx
  on public.transport_orders(order_id);

create index if not exists transport_order_events_order_idx
  on public.transport_order_events(transport_order_id, created_at desc);

alter table public.transport_orders enable row level security;
alter table public.transport_order_events enable row level security;

grant select, insert, update on public.transport_orders to authenticated;
grant select, insert on public.transport_order_events to authenticated;

drop policy if exists "transport_orders_authenticated_none" on public.transport_orders;
create policy "transport_orders_authenticated_none"
  on public.transport_orders
  for all
  to authenticated
  using (false)
  with check (false);

drop policy if exists "transport_order_events_authenticated_none" on public.transport_order_events;
create policy "transport_order_events_authenticated_none"
  on public.transport_order_events
  for all
  to authenticated
  using (false)
  with check (false);
