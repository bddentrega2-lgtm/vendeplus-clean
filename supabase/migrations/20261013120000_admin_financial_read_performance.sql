create function public.admin_open_fee_balances()
returns table (store_id uuid, period_start timestamptz, service_count bigint, amount_usd numeric)
language sql stable security invoker set search_path = public
as $$
  with eligible as (
    select stores.id,
      coalesce(last_payment.created_at, stores.last_payment_at,
        stores.subscription_started_at, stores.trial_ends_at, stores.created_at) as starts_at
    from public.stores
    left join lateral (
      select payments.created_at
      from public.store_subscription_payments as payments
      where payments.store_id = stores.id
        and payments.status = 'approved'
        and payments.plan_type = 'per_service'
      order by payments.created_at desc, payments.id desc
      limit 1
    ) as last_payment on true
    where stores.plan_type = 'per_service' and stores.is_test is not true
  )
  select eligible.id, eligible.starts_at,
    count(orders.id)::bigint,
    (coalesce(sum(round(orders.platform_service_fee_usd * 100)), 0) / 100)::numeric
  from eligible
  left join public.orders on orders.store_id = eligible.id
    and orders.platform_service_fee_usd > 0
    and (eligible.starts_at is null or orders.created_at >= eligible.starts_at)
  group by eligible.id, eligible.starts_at;
$$;

create function public.admin_approved_payments_total()
returns numeric
language sql stable security invoker set search_path = public
as $$
  select (coalesce(sum(round(payments.amount_usd * 100)), 0) / 100)::numeric
  from public.store_subscription_payments as payments
  join public.stores on stores.id = payments.store_id
  where payments.status = 'approved' and stores.is_test is not true;
$$;

revoke all on function public.admin_open_fee_balances() from public, anon, authenticated;
revoke all on function public.admin_approved_payments_total() from public, anon, authenticated;
grant execute on function public.admin_open_fee_balances() to service_role;
grant execute on function public.admin_approved_payments_total() to service_role;
