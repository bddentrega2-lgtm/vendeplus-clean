-- National shipping was added to checkout after the original orders table was
-- created. Older projects can still have a delivery_type check that only
-- accepts delivery and pickup, causing /api/orders to fail before WhatsApp.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select constraint_info.conname
    from pg_constraint as constraint_info
    where constraint_info.conrelid = 'public.orders'::regclass
      and constraint_info.contype = 'c'
      and pg_get_constraintdef(constraint_info.oid) ilike '%delivery_type%'
  loop
    execute format(
      'alter table public.orders drop constraint %I',
      constraint_row.conname
    );
  end loop;
end
$$;

alter table public.orders
  add constraint orders_delivery_type_check
  check (delivery_type in ('delivery', 'pickup', 'national_shipping'))
  not valid;

alter table public.orders
  validate constraint orders_delivery_type_check;

comment on constraint orders_delivery_type_check on public.orders is
  'Supported fulfillment modes for public and manually created orders.';
