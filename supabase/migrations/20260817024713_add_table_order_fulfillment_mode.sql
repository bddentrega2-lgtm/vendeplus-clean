alter table public.stores
  add column if not exists table_order_fulfillment_mode text not null default 'table_service';

alter table public.stores
  drop constraint if exists stores_table_order_fulfillment_mode_check;

alter table public.stores
  add constraint stores_table_order_fulfillment_mode_check
  check (table_order_fulfillment_mode in ('table_service', 'counter_pickup'));

alter table public.orders
  add column if not exists table_fulfillment_snapshot text;

alter table public.orders
  drop constraint if exists orders_table_fulfillment_snapshot_check;

alter table public.orders
  add constraint orders_table_fulfillment_snapshot_check
  check (
    table_fulfillment_snapshot is null
    or table_fulfillment_snapshot in ('table_service', 'counter_pickup')
  ) not valid;

alter table public.orders
  validate constraint orders_table_fulfillment_snapshot_check;

comment on column public.stores.table_order_fulfillment_mode is
  'Modo operativo de Pedidos en Mesa: servir en mesa o retiro en barra.';
comment on column public.orders.table_fulfillment_snapshot is
  'Copia congelada del modo de entrega elegido por el comercio al crear el pedido.';
