create index if not exists orders_store_created_at_idx
  on public.orders(store_id, created_at desc);

create index if not exists orders_store_status_created_at_idx
  on public.orders(store_id, status, created_at desc);

create index if not exists orders_public_code_idx
  on public.orders(public_code);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_subtotal_usd_nonnegative_check') then
    alter table public.orders add constraint orders_subtotal_usd_nonnegative_check check (subtotal_usd >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'orders_delivery_usd_nonnegative_check') then
    alter table public.orders add constraint orders_delivery_usd_nonnegative_check check (delivery_usd >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'orders_total_usd_nonnegative_check') then
    alter table public.orders add constraint orders_total_usd_nonnegative_check check (total_usd >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'orders_total_bs_nonnegative_check') then
    alter table public.orders add constraint orders_total_bs_nonnegative_check check (total_bs >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'orders_delivery_distance_nonnegative_check') then
    alter table public.orders add constraint orders_delivery_distance_nonnegative_check check (delivery_distance_km is null or delivery_distance_km >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'orders_distance_nonnegative_check') then
    alter table public.orders add constraint orders_distance_nonnegative_check check (distance_km is null or distance_km >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'order_items_quantity_positive_check') then
    alter table public.order_items add constraint order_items_quantity_positive_check check (quantity > 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'order_items_unit_price_nonnegative_check') then
    alter table public.order_items add constraint order_items_unit_price_nonnegative_check check (unit_price_usd >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'order_items_total_nonnegative_check') then
    alter table public.order_items add constraint order_items_total_nonnegative_check check (total_usd >= 0) not valid;
  end if;
end $$;

grant select on public.store_delivery_settings to anon, authenticated;
grant select on public.store_delivery_distance_rates to anon, authenticated;
grant select on public.store_delivery_zones to anon, authenticated;
grant select on public.product_option_groups to anon, authenticated;
grant select on public.product_option_values to anon, authenticated;
grant select on public.product_option_group_products to anon, authenticated;

revoke all on public.customers from anon, authenticated;
revoke all on public.order_integrations from anon, authenticated;
revoke all on public.order_item_options from anon, authenticated;
