-- Aggregate global growth metrics in PostgreSQL for the Founder dashboard.
-- Test stores are excluded. Cancelled orders are reported separately and never
-- count towards order volume, GMV or average ticket.

create index if not exists orders_created_at_idx
  on public.orders (created_at desc);

create or replace function public.admin_growth_metrics(p_months integer default 12)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select greatest(3, least(coalesce(p_months, 12), 24)) as month_count
  ),
  bounds as (
    select
      timezone('America/Caracas', now()) as now_ve,
      date_trunc('month', timezone('America/Caracas', now())) as current_month_ve,
      date_trunc('month', timezone('America/Caracas', now())) - interval '1 month' as previous_month_ve,
      date_trunc('month', timezone('America/Caracas', now()))
        - make_interval(months => (select month_count - 1 from params)) as series_start_ve
  ),
  scoped_orders as (
    select
      orders.id,
      orders.store_id,
      stores.name as store_name,
      timezone('America/Caracas', orders.created_at) as created_at_ve,
      coalesce(orders.total_usd, 0)::numeric as total_usd,
      lower(coalesce(orders.status, '')) in ('cancelled', 'canceled', 'cancelado') as is_cancelled,
      case
        when orders.delivery_type = 'table'
          and coalesce(orders.table_fulfillment_snapshot, '') = 'counter_pickup' then 'bar'
        when orders.delivery_type = 'table' then 'table'
        when orders.delivery_type = 'delivery' then 'delivery'
        when orders.delivery_type = 'pickup' then 'pickup'
        when orders.delivery_type = 'national_shipping' then 'national_shipping'
        else 'other'
      end as channel
    from public.orders
    join public.stores on stores.id = orders.store_id
    where stores.is_test is not true
  ),
  valid_orders as (
    select * from scoped_orders where is_cancelled is false
  ),
  months as (
    select generate_series(
      (select series_start_ve from bounds),
      (select current_month_ve from bounds),
      interval '1 month'
    ) as month_ve
  ),
  monthly as (
    select
      months.month_ve,
      count(valid_orders.id)::bigint as orders,
      coalesce(sum(valid_orders.total_usd), 0)::numeric as sales_usd,
      coalesce(avg(valid_orders.total_usd), 0)::numeric as average_ticket_usd
    from months
    left join valid_orders
      on valid_orders.created_at_ve >= months.month_ve
      and valid_orders.created_at_ve < months.month_ve + interval '1 month'
    group by months.month_ve
  ),
  current_metrics as (
    select
      count(*)::bigint as orders,
      coalesce(sum(total_usd), 0)::numeric as sales_usd,
      coalesce(avg(total_usd), 0)::numeric as average_ticket_usd
    from valid_orders, bounds
    where created_at_ve >= current_month_ve
      and created_at_ve <= now_ve
  ),
  previous_comparable_metrics as (
    select
      count(*)::bigint as orders,
      coalesce(sum(total_usd), 0)::numeric as sales_usd
    from valid_orders, bounds
    where created_at_ve >= previous_month_ve
      and created_at_ve < least(
        current_month_ve,
        previous_month_ve + (now_ve - current_month_ve)
      )
  ),
  cancellation_metrics as (
    select
      count(*) filter (where is_cancelled)::bigint as historical_cancelled,
      count(*) filter (
        where is_cancelled
          and created_at_ve >= (select current_month_ve from bounds)
      )::bigint as current_month_cancelled,
      count(*) filter (
        where created_at_ve >= (select current_month_ve from bounds)
      )::bigint as current_month_all
    from scoped_orders
  ),
  channels as (
    select channel, count(*)::bigint as orders, coalesce(sum(total_usd), 0)::numeric as sales_usd
    from valid_orders, bounds
    where created_at_ve >= current_month_ve
    group by channel
  ),
  ranking as (
    select
      store_id,
      store_name,
      count(*)::bigint as orders,
      coalesce(sum(total_usd), 0)::numeric as sales_usd,
      coalesce(avg(total_usd), 0)::numeric as average_ticket_usd
    from valid_orders, bounds
    where created_at_ve >= current_month_ve
    group by store_id, store_name
    order by sales_usd desc, orders desc, store_name
    limit 10
  )
  select jsonb_build_object(
    'timezone', 'America/Caracas',
    'months', (select month_count from params),
    'historical', jsonb_build_object(
      'orders', (select count(*) from valid_orders),
      'salesUsd', coalesce((select sum(total_usd) from valid_orders), 0),
      'averageTicketUsd', coalesce((select avg(total_usd) from valid_orders), 0),
      'cancelledOrders', (select historical_cancelled from cancellation_metrics)
    ),
    'currentMonth', jsonb_build_object(
      'label', to_char((select current_month_ve from bounds), 'YYYY-MM'),
      'orders', (select orders from current_metrics),
      'salesUsd', (select sales_usd from current_metrics),
      'averageTicketUsd', (select average_ticket_usd from current_metrics),
      'cancelledOrders', (select current_month_cancelled from cancellation_metrics),
      'cancellationRate', case
        when (select current_month_all from cancellation_metrics) = 0 then 0
        else round(
          (select current_month_cancelled from cancellation_metrics)::numeric
          * 100 / (select current_month_all from cancellation_metrics),
          2
        )
      end
    ),
    'comparison', jsonb_build_object(
      'previousLabel', to_char((select previous_month_ve from bounds), 'YYYY-MM'),
      'previousOrders', (select orders from previous_comparable_metrics),
      'previousSalesUsd', (select sales_usd from previous_comparable_metrics),
      'ordersGrowthPct', case
        when (select orders from previous_comparable_metrics) = 0 then null
        else round(
          ((select orders from current_metrics) - (select orders from previous_comparable_metrics))::numeric
          * 100 / (select orders from previous_comparable_metrics),
          2
        )
      end,
      'salesGrowthPct', case
        when (select sales_usd from previous_comparable_metrics) = 0 then null
        else round(
          ((select sales_usd from current_metrics) - (select sales_usd from previous_comparable_metrics))::numeric
          * 100 / (select sales_usd from previous_comparable_metrics),
          2
        )
      end
    ),
    'monthly', coalesce((
      select jsonb_agg(jsonb_build_object(
        'label', to_char(month_ve, 'YYYY-MM'),
        'orders', orders,
        'salesUsd', sales_usd,
        'averageTicketUsd', average_ticket_usd
      ) order by month_ve)
      from monthly
    ), '[]'::jsonb),
    'channels', coalesce((
      select jsonb_agg(jsonb_build_object(
        'channel', channel,
        'orders', orders,
        'salesUsd', sales_usd
      ) order by orders desc, channel)
      from channels
    ), '[]'::jsonb),
    'ranking', coalesce((
      select jsonb_agg(jsonb_build_object(
        'storeId', store_id,
        'storeName', store_name,
        'orders', orders,
        'salesUsd', sales_usd,
        'averageTicketUsd', average_ticket_usd
      ) order by sales_usd desc, orders desc, store_name)
      from ranking
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.admin_growth_metrics(integer) from public, anon, authenticated;
grant execute on function public.admin_growth_metrics(integer) to service_role;

comment on function public.admin_growth_metrics(integer) is
  'Founder growth dashboard aggregates. Service-role only; excludes test stores and separates cancellations.';
