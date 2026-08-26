create or replace function public.panel_store_stats(
  p_store_ids uuid[] default null,
  p_store_id uuid default null,
  p_start timestamptz default now() - interval '7 days',
  p_end timestamptz default now(),
  p_recent_limit integer default 8
)
returns table (
  summary jsonb,
  customers jsonb,
  top_products jsonb,
  top_customers jsonb,
  sales_by_day jsonb,
  orders_by_day jsonb,
  sales_by_week jsonb,
  sales_by_month jsonb,
  orders_by_hour jsonb,
  orders_by_weekday jsonb,
  orders_by_status jsonb,
  orders_by_payment_method jsonb,
  orders_by_delivery_type jsonb,
  revenue_by_store jsonb,
  recent_orders jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  with scoped_stores as (
    select stores.id, stores.name
    from public.stores
    where (p_store_ids is null or stores.id = any(p_store_ids))
      and (p_store_id is null or stores.id = p_store_id)
  ),
  scoped_orders as (
    select
      orders.*,
      scoped_stores.name as store_name,
      coalesce(orders.payment_status, 'pending') as safe_payment_status,
      timezone('America/Caracas', orders.created_at) as created_at_ve,
      timezone('America/Caracas', orders.payment_verified_at) as payment_verified_at_ve,
      coalesce(orders.subtotal_usd, greatest(coalesce(orders.total_usd, 0) - coalesce(orders.delivery_usd, 0), 0)) as merchant_revenue_usd
    from public.orders
    join scoped_stores on scoped_stores.id = orders.store_id
    where orders.created_at >= p_start
      and orders.created_at <= p_end
  ),
  billable_orders as (
    select *
    from scoped_orders
    where lower(coalesce(status, '')) not in ('cancelled', 'canceled', 'cancelado')
  ),
  scoped_products as (
    select products.*
    from public.products
    join scoped_stores on scoped_stores.id = products.store_id
  ),
  scoped_customers as (
    select customers.*
    from public.customers
    join scoped_stores on scoped_stores.id = customers.store_id
  ),
  today_bounds as (
    select
      (date_trunc('day', timezone('America/Caracas', now())) at time zone 'America/Caracas') as start_at,
      ((date_trunc('day', timezone('America/Caracas', now())) + interval '1 day') at time zone 'America/Caracas') as end_at
  ),
  summary_metrics as (
    select
      count(*) filter (where lower(coalesce(status, '')) not in ('cancelled', 'canceled', 'cancelado'))::bigint as total_orders,
      count(*) filter (where status = 'completed')::bigint as completed_orders,
      count(*) filter (where lower(coalesce(status, '')) in ('cancelled', 'canceled', 'cancelado'))::bigint as cancelled_orders,
      count(*) filter (where coalesce(status, '') <> 'completed' and lower(coalesce(status, '')) not in ('cancelled', 'canceled', 'cancelado'))::bigint as in_progress_orders
    from scoped_orders
  ),
  billable_metrics as (
    select
      count(*)::bigint as billable_orders_count,
      coalesce(sum(merchant_revenue_usd), 0)::numeric as total_revenue_usd,
      coalesce(avg(merchant_revenue_usd), 0)::numeric as average_ticket_usd,
      count(*) filter (where delivery_type = 'delivery')::bigint as delivery_orders,
      count(*) filter (where delivery_type = 'pickup')::bigint as pickup_orders,
      coalesce(sum(merchant_revenue_usd) filter (where delivery_type = 'delivery'), 0)::numeric as delivery_revenue_usd,
      coalesce(sum(merchant_revenue_usd) filter (where delivery_type = 'pickup'), 0)::numeric as pickup_revenue_usd,
      coalesce(sum(delivery_usd) filter (where delivery_type = 'delivery'), 0)::numeric as delivery_fees_usd,
      coalesce(avg(delivery_usd) filter (where delivery_type = 'delivery'), 0)::numeric as average_delivery_usd,
      coalesce(avg(distance_km) filter (where delivery_type = 'delivery'), 0)::numeric as average_distance_km,
      count(*) filter (where safe_payment_status in ('pending', 'incomplete'))::bigint as pending_payments,
      count(*) filter (where safe_payment_status = 'review')::bigint as review_payments,
      coalesce(sum(merchant_revenue_usd) filter (where safe_payment_status in ('pending', 'review', 'incomplete')), 0)::numeric as pending_payment_usd,
      count(*) filter (
        where safe_payment_status = 'verified'
          and payment_verified_at >= (select start_at from today_bounds)
          and payment_verified_at < (select end_at from today_bounds)
      )::bigint as verified_payments_today
    from billable_orders
  ),
  product_metrics as (
    select
      count(*) filter (where is_available is not false)::bigint as active_products,
      count(*) filter (where is_available is false)::bigint as inactive_products
    from scoped_products
  ),
  customer_metrics as (
    select
      count(*)::bigint as total_customers,
      count(*) filter (where coalesce(orders_count, 0) >= 3)::bigint as frequent_customers,
      count(*) filter (
        where coalesce(orders_count, 0) >= 2
          and last_order_at is not null
          and last_order_at <= now() - interval '21 days'
      )::bigint as contact_customers
    from scoped_customers
  ),
  top_product_rows as (
    select
      case
        when order_items.variant_name is not null and order_items.variant_name <> ''
          then order_items.product_name || ' (' || order_items.variant_name || ')'
        else order_items.product_name
      end as product,
      coalesce(sum(order_items.quantity), 0)::numeric as quantity,
      coalesce(sum(order_items.total_usd), 0)::numeric as revenue,
      count(*)::bigint as orders
    from billable_orders
    join public.order_items on order_items.order_id = billable_orders.id
    group by 1
  ),
  top_customer_rows as (
    select
      coalesce(nullif(customer_phone, ''), 'Sin telefono') as phone,
      coalesce(max(customer_name), 'Cliente') as customer,
      count(*)::bigint as orders,
      coalesce(sum(merchant_revenue_usd), 0)::numeric as revenue,
      max(created_at)::text as last_order_at
    from billable_orders
    group by 1
  ),
  sales_by_day_rows as (
    select to_char(created_at_ve, 'YYYY-MM-DD') as label, coalesce(sum(merchant_revenue_usd), 0)::numeric as value
    from billable_orders
    group by 1
  ),
  orders_by_day_rows as (
    select to_char(created_at_ve, 'YYYY-MM-DD') as label, count(*)::bigint as value
    from billable_orders
    group by 1
  ),
  sales_by_week_rows as (
    select to_char(created_at_ve, 'IYYY-"W"IW') as label, coalesce(sum(merchant_revenue_usd), 0)::numeric as value
    from billable_orders
    group by 1
  ),
  sales_by_month_rows as (
    select to_char(created_at_ve, 'YYYY-MM') as label, coalesce(sum(merchant_revenue_usd), 0)::numeric as value
    from billable_orders
    group by 1
  ),
  orders_by_hour_rows as (
    select to_char(created_at_ve, 'HH24') || ':00' as label, count(*)::bigint as value
    from billable_orders
    group by 1
  ),
  orders_by_weekday_rows as (
    select
      case extract(dow from created_at_ve)::int
        when 0 then 'domingo'
        when 1 then 'lunes'
        when 2 then 'martes'
        when 3 then 'miercoles'
        when 4 then 'jueves'
        when 5 then 'viernes'
        else 'sabado'
      end as label,
      count(*)::bigint as value
    from billable_orders
    group by 1
  ),
  orders_by_status_rows as (
    select coalesce(nullif(status, ''), 'Sin dato') as label, count(*)::bigint as value
    from billable_orders
    group by 1
  ),
  orders_by_payment_method_rows as (
    select coalesce(nullif(payment_method, ''), 'Sin dato') as label, count(*)::bigint as value
    from billable_orders
    group by 1
  ),
  orders_by_delivery_type_rows as (
    select coalesce(nullif(delivery_type, ''), 'Sin dato') as label, count(*)::bigint as value
    from billable_orders
    group by 1
  ),
  revenue_by_store_rows as (
    select store_name as label, coalesce(sum(merchant_revenue_usd), 0)::numeric as value
    from billable_orders
    group by 1
  ),
  recent_order_rows as (
    select
      scoped_orders.id,
      scoped_orders.public_code,
      scoped_orders.store_id,
      scoped_orders.customer_name,
      scoped_orders.customer_phone,
      scoped_orders.delivery_type,
      scoped_orders.payment_method,
      scoped_orders.safe_payment_status as payment_status,
      scoped_orders.payment_verified_at,
      scoped_orders.subtotal_usd,
      scoped_orders.delivery_usd,
      scoped_orders.total_usd,
      scoped_orders.total_bs,
      scoped_orders.distance_km,
      scoped_orders.status,
      scoped_orders.created_at,
      scoped_orders.store_name
    from billable_orders as scoped_orders
    order by scoped_orders.created_at desc
    limit greatest(1, least(coalesce(p_recent_limit, 8), 20))
  )
  select
    jsonb_build_object(
      'aggregationVersion', 2,
      'totalOrders', coalesce(summary_metrics.total_orders, 0),
      'completedOrders', coalesce(summary_metrics.completed_orders, 0),
      'inProgressOrders', coalesce(summary_metrics.in_progress_orders, 0),
      'cancelledOrders', coalesce(summary_metrics.cancelled_orders, 0),
      'totalRevenueUsd', coalesce(billable_metrics.total_revenue_usd, 0),
      'averageTicketUsd', coalesce(billable_metrics.average_ticket_usd, 0),
      'averageRevenuePerDayUsd', coalesce(billable_metrics.total_revenue_usd, 0) / greatest(1, ceil(extract(epoch from (p_end - p_start)) / 86400)),
      'operationalConversionRate', case when coalesce(summary_metrics.total_orders, 0) > 0 then (summary_metrics.completed_orders::numeric / summary_metrics.total_orders::numeric) * 100 else 0 end,
      'averageDeliveryUsd', coalesce(billable_metrics.average_delivery_usd, 0),
      'deliveryFeesUsd', coalesce(billable_metrics.delivery_fees_usd, 0),
      'averageDistanceKm', coalesce(billable_metrics.average_distance_km, 0),
      'deliveryRevenueUsd', coalesce(billable_metrics.delivery_revenue_usd, 0),
      'pickupRevenueUsd', coalesce(billable_metrics.pickup_revenue_usd, 0),
      'deliveryOrders', coalesce(billable_metrics.delivery_orders, 0),
      'pickupOrders', coalesce(billable_metrics.pickup_orders, 0),
      'pendingPayments', coalesce(billable_metrics.pending_payments, 0),
      'reviewPayments', coalesce(billable_metrics.review_payments, 0),
      'verifiedPaymentsToday', coalesce(billable_metrics.verified_payments_today, 0),
      'pendingPaymentUsd', coalesce(billable_metrics.pending_payment_usd, 0),
      'activeProducts', coalesce(product_metrics.active_products, 0),
      'inactiveProducts', coalesce(product_metrics.inactive_products, 0)
    ) as summary,
    jsonb_build_object(
      'total', coalesce(customer_metrics.total_customers, 0),
      'frequent', coalesce(customer_metrics.frequent_customers, 0),
      'contact', coalesce(customer_metrics.contact_customers, 0)
    ) as customers,
    coalesce((
      select jsonb_agg(jsonb_build_object('product', product, 'quantity', quantity, 'revenue', revenue, 'orders', orders, 'share', case when coalesce(billable_metrics.total_revenue_usd, 0) > 0 then (revenue / billable_metrics.total_revenue_usd) * 100 else 0 end) order by quantity desc)
      from (select * from top_product_rows order by quantity desc limit 10) ranked
    ), '[]'::jsonb) as top_products,
    coalesce((
      select jsonb_agg(jsonb_build_object('customer', customer, 'phone', phone, 'orders', orders, 'revenue', revenue, 'lastOrderAt', last_order_at) order by revenue desc)
      from (select * from top_customer_rows order by revenue desc limit 10) ranked
    ), '[]'::jsonb) as top_customers,
    coalesce((select jsonb_agg(jsonb_build_object('label', label, 'value', value) order by label) from sales_by_day_rows), '[]'::jsonb) as sales_by_day,
    coalesce((select jsonb_agg(jsonb_build_object('label', label, 'value', value) order by label) from orders_by_day_rows), '[]'::jsonb) as orders_by_day,
    coalesce((select jsonb_agg(jsonb_build_object('label', label, 'value', value) order by label) from (select * from sales_by_week_rows order by label desc limit 8) ranked_weeks), '[]'::jsonb) as sales_by_week,
    coalesce((select jsonb_agg(jsonb_build_object('label', label, 'value', value) order by label) from (select * from sales_by_month_rows order by label desc limit 6) ranked_months), '[]'::jsonb) as sales_by_month,
    coalesce((select jsonb_agg(jsonb_build_object('label', label, 'value', value) order by label) from orders_by_hour_rows), '[]'::jsonb) as orders_by_hour,
    coalesce((select jsonb_agg(jsonb_build_object('label', label, 'value', value) order by value desc) from orders_by_weekday_rows), '[]'::jsonb) as orders_by_weekday,
    coalesce((select jsonb_agg(jsonb_build_object('label', label, 'value', value) order by value desc) from orders_by_status_rows), '[]'::jsonb) as orders_by_status,
    coalesce((select jsonb_agg(jsonb_build_object('label', label, 'value', value) order by value desc) from orders_by_payment_method_rows), '[]'::jsonb) as orders_by_payment_method,
    coalesce((select jsonb_agg(jsonb_build_object('label', label, 'value', value) order by value desc) from orders_by_delivery_type_rows), '[]'::jsonb) as orders_by_delivery_type,
    coalesce((select jsonb_agg(jsonb_build_object('label', label, 'value', value) order by value desc) from revenue_by_store_rows), '[]'::jsonb) as revenue_by_store,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'public_code', public_code,
        'store_id', store_id,
        'customer_name', customer_name,
        'customer_phone', customer_phone,
        'delivery_type', delivery_type,
        'payment_method', payment_method,
        'payment_status', payment_status,
        'payment_verified_at', payment_verified_at,
        'subtotal_usd', subtotal_usd,
        'delivery_usd', delivery_usd,
        'total_usd', total_usd,
        'total_bs', total_bs,
        'distance_km', distance_km,
        'status', status,
        'created_at', created_at,
        'stores', jsonb_build_object('name', store_name)
      ) order by created_at desc)
      from recent_order_rows
    ), '[]'::jsonb) as recent_orders
  from summary_metrics, billable_metrics, product_metrics, customer_metrics;
$$;

revoke all on function public.panel_store_stats(uuid[], uuid, timestamptz, timestamptz, integer) from public, anon, authenticated;

grant execute on function public.panel_store_stats(uuid[], uuid, timestamptz, timestamptz, integer) to service_role;

comment on function public.panel_store_stats(uuid[], uuid, timestamptz, timestamptz, integer) is
  'Aggregates tenant-scoped panel metrics in PostgreSQL without row caps; callable only by service_role.';
