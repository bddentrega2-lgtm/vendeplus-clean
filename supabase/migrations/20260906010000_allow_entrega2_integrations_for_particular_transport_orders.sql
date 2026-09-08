alter table public.order_integrations
  alter column order_id drop not null,
  add column if not exists transport_order_id uuid
    references public.transport_orders(id) on delete cascade,
  add column if not exists particular_request_id uuid
    references public.transport_particular_requests(id) on delete cascade;

alter table public.order_integrations
  drop constraint if exists order_integrations_source_check;

alter table public.order_integrations
  add constraint order_integrations_source_check check (
    order_id is not null
    or transport_order_id is not null
    or particular_request_id is not null
  );

create unique index if not exists order_integrations_transport_order_provider_idx
  on public.order_integrations(transport_order_id, provider)
  where transport_order_id is not null;

create unique index if not exists order_integrations_particular_request_provider_idx
  on public.order_integrations(particular_request_id, provider)
  where particular_request_id is not null;

create index if not exists order_integrations_transport_order_id_idx
  on public.order_integrations(transport_order_id)
  where transport_order_id is not null;

create index if not exists order_integrations_particular_request_id_idx
  on public.order_integrations(particular_request_id)
  where particular_request_id is not null;

comment on column public.order_integrations.transport_order_id is
  'Servicio operativo de empresa delivery integrado con un proveedor externo cuando no existe pedido de comercio.';

comment on column public.order_integrations.particular_request_id is
  'Solicitud particular integrada con un proveedor externo.';
