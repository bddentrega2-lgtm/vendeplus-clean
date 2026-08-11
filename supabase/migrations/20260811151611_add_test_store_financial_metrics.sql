alter table public.stores
  add column if not exists is_test boolean not null default false;

update public.stores
set is_test = true
where slug = 'smash';

create or replace function public.admin_financial_metrics()
returns table (
  approved_payments_usd numeric,
  pending_service_fees_usd numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce((
      select sum(payments.amount_usd)
      from public.store_subscription_payments as payments
      join public.stores as payment_stores on payment_stores.id = payments.store_id
      where payments.status = 'approved'
        and payment_stores.is_test is not true
    ), 0)::numeric as approved_payments_usd,
    coalesce((
      select sum(orders.platform_service_fee_usd)
      from public.orders
      join public.stores as fee_stores on fee_stores.id = orders.store_id
      where fee_stores.is_test is not true
        and fee_stores.plan_type in ('per_service', 'custom')
        and lower(coalesce(orders.status, '')) not in ('cancelled', 'canceled', 'cancelado')
        and orders.platform_service_fee_usd > 0
        and orders.created_at >= coalesce(
          fee_stores.last_payment_at,
          fee_stores.subscription_started_at,
          fee_stores.trial_ends_at,
          fee_stores.created_at
        )
    ), 0)::numeric as pending_service_fees_usd;
$$;

revoke all on function public.admin_financial_metrics() from public, anon, authenticated;
grant execute on function public.admin_financial_metrics() to service_role;
