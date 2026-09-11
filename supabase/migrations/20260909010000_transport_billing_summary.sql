-- Financial aggregates independent of visual-detail pagination. Server-only.
begin;
create or replace function public.transport_billing_summary(
  p_agency_ids uuid[], p_start timestamptz, p_end timestamptz
) returns jsonb
language sql stable security invoker
set search_path = public, pg_temp
as $$
  with billable as (
    select t.driver_id, t.driver_name_snapshot,
      greatest(0, coalesce(t.delivery_fee_usd, o.delivery_usd, 0)) as fee,
      greatest(0, coalesce(t.driver_payout_usd, 0)) as payout
    from public.transport_orders t
    left join public.orders o on o.id = t.order_id
    where t.agency_id = any(coalesce(p_agency_ids, '{}'::uuid[]))
      and t.created_at >= p_start and t.created_at < p_end
      and lower(coalesce(t.status, '')) <> all(array['cancelled','canceled','cancelado','agency_rejected','delivery_failed'])
      and lower(coalesce(o.status, '')) <> all(array['cancelled','canceled','cancelado','agency_rejected','delivery_failed'])
  ), drivers as (
    select driver_id, coalesce(max(nullif(driver_name_snapshot, '')), 'Sin repartidor asignado') as name,
      count(*) as orders_count, sum(fee) as delivery_total, sum(payout) as payout
    from billable group by driver_id
  )
  select jsonb_build_object(
    'ordersCount', (select count(*) from billable),
    'totalUsd', (select coalesce(sum(fee), 0) from billable),
    'driverPayouts', coalesce((select jsonb_agg(jsonb_build_object(
      'driverId', driver_id, 'driverName', name, 'ordersCount', orders_count,
      'deliveryTotalUsd', delivery_total, 'payoutUsd', payout
    ) order by payout desc, driver_id) from drivers), '[]'::jsonb)
  );
$$;
revoke all on function public.transport_billing_summary(uuid[], timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.transport_billing_summary(uuid[], timestamptz, timestamptz) to service_role;
commit;
