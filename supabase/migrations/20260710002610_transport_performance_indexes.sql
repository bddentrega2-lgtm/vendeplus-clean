-- Performance indexes for Empresas Delivery V2 panels and checkout lookups.
-- Non-destructive and compatible with already-applied transport migrations.

create index if not exists transport_agencies_active_name_idx
  on public.transport_agencies(status, is_active, name);

create index if not exists transport_agency_rates_active_agency_idx
  on public.transport_agency_rates(agency_id, is_active);

create index if not exists transport_agency_zones_active_sort_idx
  on public.transport_agency_zones(agency_id, is_active, sort_order);

create index if not exists transport_agency_distance_rates_active_sort_idx
  on public.transport_agency_distance_rates(agency_id, is_active, sort_order);

create index if not exists store_transport_agency_requests_store_status_created_idx
  on public.store_transport_agency_requests(store_id, status, created_at desc);

create index if not exists store_transport_agency_requests_agency_status_created_idx
  on public.store_transport_agency_requests(agency_id, status, created_at desc);

create index if not exists store_transport_agency_connections_store_status_connected_idx
  on public.store_transport_agency_connections(store_id, status, connected_at desc);

create index if not exists store_transport_agency_connections_agency_status_connected_idx
  on public.store_transport_agency_connections(agency_id, status, connected_at desc);

create index if not exists transport_orders_agency_created_idx
  on public.transport_orders(agency_id, created_at desc);

create index if not exists transport_orders_agency_store_created_idx
  on public.transport_orders(agency_id, store_id, created_at desc);

create index if not exists orders_store_transport_status_created_idx
  on public.orders(store_id, transport_agency_status, created_at desc)
  where transport_agency_id is not null;
