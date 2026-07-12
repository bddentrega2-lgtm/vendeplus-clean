-- Aggregate admin metrics inside Postgres instead of transferring thousands of rows to Next.js.
-- These RPCs are used only by server-side admin APIs through the service role client.

create or replace function public.admin_summary_metrics()
returns table (
  total_orders bigint,
  orders_today bigint,
  orders_last_7_days bigint,
  revenue_usd numeric,
  total_products bigint,
  total_assignments bigint,
  total_customers bigint
)
language sql
stable
set search_path = public
as $$
  with bounds as (
    select
      (date_trunc('day', timezone('America/Caracas', now())) at time zone 'America/Caracas') as today_start,
      now() - interval '7 days' as seven_days_ago
  )
  select
    (select count(*) from public.orders)::bigint as total_orders,
    (select count(*) from public.orders, bounds where orders.created_at >= bounds.today_start)::bigint as orders_today,
    (select count(*) from public.orders, bounds where orders.created_at >= bounds.seven_days_ago)::bigint as orders_last_7_days,
    coalesce((select sum(total_usd) from public.orders), 0)::numeric as revenue_usd,
    (select count(*) from public.products)::bigint as total_products,
    (select count(*) from public.store_users)::bigint as total_assignments,
    (select count(*) from public.customers)::bigint as total_customers;
$$;

create or replace function public.admin_store_metrics()
returns table (
  store_id uuid,
  product_count bigint,
  active_product_count bigint,
  order_count bigint,
  order_count_30d bigint,
  user_count bigint
)
language sql
stable
set search_path = public
as $$
  with product_metrics as (
    select
      products.store_id,
      count(*)::bigint as product_count,
      count(*) filter (where products.is_available is not false)::bigint as active_product_count
    from public.products
    group by products.store_id
  ),
  order_metrics as (
    select
      orders.store_id,
      count(*)::bigint as order_count,
      count(*) filter (where orders.created_at >= now() - interval '30 days')::bigint as order_count_30d
    from public.orders
    group by orders.store_id
  ),
  user_metrics as (
    select
      store_users.store_id,
      count(*)::bigint as user_count
    from public.store_users
    group by store_users.store_id
  )
  select
    stores.id as store_id,
    coalesce(product_metrics.product_count, 0)::bigint as product_count,
    coalesce(product_metrics.active_product_count, 0)::bigint as active_product_count,
    coalesce(order_metrics.order_count, 0)::bigint as order_count,
    coalesce(order_metrics.order_count_30d, 0)::bigint as order_count_30d,
    coalesce(user_metrics.user_count, 0)::bigint as user_count
  from public.stores
  left join product_metrics on product_metrics.store_id = stores.id
  left join order_metrics on order_metrics.store_id = stores.id
  left join user_metrics on user_metrics.store_id = stores.id;
$$;

create or replace function public.admin_store_detail_metrics(p_store_id uuid)
returns table (
  active_products bigint,
  total_products bigint,
  total_orders bigint,
  orders_last_7_days bigint,
  orders_last_30_days bigint,
  total_revenue_usd numeric,
  customers bigint
)
language sql
stable
set search_path = public
as $$
  select
    (select count(*) from public.products where products.store_id = p_store_id and products.is_available is not false)::bigint as active_products,
    (select count(*) from public.products where products.store_id = p_store_id)::bigint as total_products,
    (select count(*) from public.orders where orders.store_id = p_store_id)::bigint as total_orders,
    (select count(*) from public.orders where orders.store_id = p_store_id and orders.created_at >= now() - interval '7 days')::bigint as orders_last_7_days,
    (select count(*) from public.orders where orders.store_id = p_store_id and orders.created_at >= now() - interval '30 days')::bigint as orders_last_30_days,
    coalesce((select sum(total_usd) from public.orders where orders.store_id = p_store_id), 0)::numeric as total_revenue_usd,
    (select count(*) from public.customers where customers.store_id = p_store_id)::bigint as customers;
$$;

revoke all on function public.admin_summary_metrics() from public, anon, authenticated;
revoke all on function public.admin_store_metrics() from public, anon, authenticated;
revoke all on function public.admin_store_detail_metrics(uuid) from public, anon, authenticated;

grant execute on function public.admin_summary_metrics() to service_role;
grant execute on function public.admin_store_metrics() to service_role;
grant execute on function public.admin_store_detail_metrics(uuid) to service_role;
