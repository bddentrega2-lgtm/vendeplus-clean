-- VendeMas data persistence checks.
-- Read-only: run in Supabase SQL Editor after test orders or during pilot.

select
  'recent_orders_summary' as check_name,
  stores.slug as store_slug,
  count(*) as orders_count,
  min(orders.created_at) as first_order_at,
  max(orders.created_at) as last_order_at
from public.orders orders
join public.stores stores
  on stores.id = orders.store_id
where orders.created_at >= now() - interval '7 days'
group by stores.slug
order by last_order_at desc;

select
  'recent_order_integrity' as check_name,
  orders.public_code,
  stores.slug as store_slug,
  orders.created_at,
  orders.delivery_type,
  orders.payment_method,
  orders.payment_status,
  orders.total_usd,
  orders.customer_id is not null as has_customer_link,
  orders.whatsapp_message is not null as has_whatsapp_message,
  count(distinct order_items.id) as item_count,
  count(order_item_options.order_item_id) as option_count
from public.orders orders
join public.stores stores
  on stores.id = orders.store_id
left join public.order_items order_items
  on order_items.order_id = orders.id
left join public.order_item_options order_item_options
  on order_item_options.order_item_id = order_items.id
where orders.created_at >= now() - interval '7 days'
group by
  orders.id,
  orders.public_code,
  stores.slug,
  orders.created_at,
  orders.delivery_type,
  orders.payment_method,
  orders.payment_status,
  orders.total_usd,
  orders.customer_id,
  orders.whatsapp_message
order by orders.created_at desc
limit 50;

select
  'orders_without_items' as check_name,
  count(*) as count,
  count(*) = 0 as ok
from public.orders orders
where orders.created_at >= now() - interval '7 days'
  and not exists (
    select 1
    from public.order_items order_items
    where order_items.order_id = orders.id
  );

select
  'order_items_without_order' as check_name,
  count(*) as count,
  count(*) = 0 as ok
from public.order_items order_items
left join public.orders orders
  on orders.id = order_items.order_id
where orders.id is null;

select
  'order_item_options_without_item' as check_name,
  count(*) as count,
  count(*) = 0 as ok
from public.order_item_options options
left join public.order_items order_items
  on order_items.id = options.order_item_id
where order_items.id is null;

select
  'recent_orders_without_customer_record' as check_name,
  count(*) as count,
  count(*) = 0 as ok
from public.orders orders
where orders.created_at >= now() - interval '7 days'
  and orders.customer_phone_normalized is not null
  and not exists (
    select 1
    from public.customers customers
    where customers.store_id = orders.store_id
      and customers.phone_normalized = orders.customer_phone_normalized
  );

select
  'delivery_data_capture' as check_name,
  stores.slug as store_slug,
  orders.delivery_type,
  orders.delivery_provider,
  orders.delivery_pricing_type,
  count(*) as orders_count,
  count(*) filter (where orders.delivery_type = 'pickup' or orders.delivery_fee_usd is not null) as with_delivery_fee,
  count(*) filter (where orders.delivery_type = 'pickup' or orders.delivery_status is not null) as with_delivery_status
from public.orders orders
join public.stores stores
  on stores.id = orders.store_id
where orders.created_at >= now() - interval '7 days'
group by
  stores.slug,
  orders.delivery_type,
  orders.delivery_provider,
  orders.delivery_pricing_type
order by stores.slug, orders.delivery_type;

select
  'payment_data_capture' as check_name,
  stores.slug as store_slug,
  orders.payment_method,
  orders.payment_status,
  count(*) as orders_count,
  count(*) filter (where orders.payment_method is not null and orders.payment_method <> '') as with_payment_method,
  count(*) filter (where orders.payment_status is not null and orders.payment_status <> '') as with_payment_status
from public.orders orders
join public.stores stores
  on stores.id = orders.store_id
where orders.created_at >= now() - interval '7 days'
group by stores.slug, orders.payment_method, orders.payment_status
order by stores.slug, orders.payment_method;

select
  'customers_summary' as check_name,
  stores.slug as store_slug,
  count(*) as customers_count,
  max(customers.last_order_at) as last_customer_order_at,
  sum(customers.orders_count) as tracked_orders_count,
  sum(customers.total_spent_usd) as tracked_total_usd
from public.customers customers
join public.stores stores
  on stores.id = customers.store_id
group by stores.slug
order by last_customer_order_at desc nulls last;

select
  'active_store_delivery_settings' as check_name,
  stores.slug as store_slug,
  stores.accepts_delivery,
  stores.accepts_pickup,
  settings.delivery_enabled,
  settings.pickup_enabled,
  settings.delivery_provider,
  settings.pricing_type,
  count(distinct zones.id) filter (where zones.is_active is true) as active_zones,
  count(distinct rates.id) filter (where rates.is_active is true) as active_distance_rates
from public.stores stores
left join public.store_delivery_settings settings
  on settings.store_id = stores.id
left join public.store_delivery_zones zones
  on zones.store_id = stores.id
left join public.store_delivery_distance_rates rates
  on rates.store_id = stores.id
where stores.is_active is true
group by
  stores.slug,
  stores.accepts_delivery,
  stores.accepts_pickup,
  settings.delivery_enabled,
  settings.pickup_enabled,
  settings.delivery_provider,
  settings.pricing_type
order by stores.slug;

