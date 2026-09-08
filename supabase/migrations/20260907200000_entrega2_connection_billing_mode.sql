alter table public.store_transport_agency_connections
  add column if not exists delivery_billing_mode text not null default 'cash';

alter table public.store_transport_agency_connections
  drop constraint if exists store_transport_agency_connections_billing_mode_check;

alter table public.store_transport_agency_connections
  add constraint store_transport_agency_connections_billing_mode_check
  check (delivery_billing_mode in ('cash', 'credit'));

comment on column public.store_transport_agency_connections.delivery_billing_mode is
  'Modo operativo para Entrega2: credit envia directo a Entrega2 App; cash pasa por validacion en Somos.';
