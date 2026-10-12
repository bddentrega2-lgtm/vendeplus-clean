create or replace function public.affiliate_monthly_snapshot_by_codes(p_code_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_start timestamptz;
declare v_end timestamptz;
declare v_rows jsonb;
begin
  if cardinality(p_code_ids) is null or cardinality(p_code_ids) > 100 then
    raise exception 'Invalid affiliate code scope';
  end if;
  v_start := date_trunc('month', now() at time zone 'America/Caracas') at time zone 'America/Caracas';
  v_end := ((date_trunc('month', now() at time zone 'America/Caracas')) + interval '1 month') at time zone 'America/Caracas';

  with scoped as (
    select r.id, r.store_id, r.affiliate_code_id, r.commission_percent,
      r.fee_started_at, r.fee_ends_at
    from public.affiliate_referrals r
    where r.affiliate_code_id = any(p_code_ids) and r.store_id is not null
  ), orders_month as (
    select r.id as referral_id,
      count(o.id)::integer as order_count,
      coalesce(sum(o.platform_service_fee_usd), 0)::numeric(12,2) as fee_generated_usd,
      coalesce(sum(least(o.platform_service_fee_usd, coalesce(a.paid_usd, 0))), 0)::numeric(12,2) as fee_collected_usd,
      coalesce(sum(case when o.id is not null and c.id is null then
        round(o.platform_service_fee_usd * r.commission_percent / 100, 2) else 0 end), 0)::numeric(12,2) as commission_in_progress_usd
    from scoped r
    left join public.orders o on o.store_id = r.store_id
      and o.created_at >= v_start and o.created_at < v_end
      and o.created_at >= r.fee_started_at and o.created_at < r.fee_ends_at
      and o.platform_service_fee_usd > 0
    left join lateral (
      select sum(amount_usd) as paid_usd from public.affiliate_fee_allocations
      where order_id = o.id
    ) a on o.id is not null
    left join public.affiliate_commissions c on c.order_id = o.id and c.referral_id = r.id
    group by r.id
  ), commissions_month as (
    select r.id as referral_id,
      coalesce(sum(c.amount_usd + coalesce(a.adjustment_usd, 0)) filter (where c.status = 'available'), 0)::numeric(12,2) as commission_available_usd,
      coalesce(sum(c.amount_usd + coalesce(a.adjustment_usd, 0)) filter (where c.status = 'paid'), 0)::numeric(12,2) as commission_paid_usd
    from scoped r
    left join public.affiliate_commissions c on c.referral_id = r.id and c.kind = 'fee'
      and c.eligible_at >= v_start and c.eligible_at < v_end
    left join lateral (
      select sum(amount_usd) as adjustment_usd from public.affiliate_commission_adjustments
      where commission_id = c.id
    ) a on c.id is not null
    group by r.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'referralId', r.id, 'storeId', r.store_id, 'codeId', r.affiliate_code_id,
    'orderCount', o.order_count, 'feeGeneratedUsd', o.fee_generated_usd,
    'feeCollectedUsd', o.fee_collected_usd,
    'commissionInProgressUsd', o.commission_in_progress_usd,
    'commissionAvailableUsd', c.commission_available_usd,
    'commissionPaidUsd', c.commission_paid_usd
  ) order by r.id), '[]'::jsonb) into v_rows
  from scoped r
  join orders_month o on o.referral_id = r.id
  join commissions_month c on c.referral_id = r.id;

  return jsonb_build_object('monthStart', v_start, 'monthEnd', v_end,
    'asOf', now(), 'stores', v_rows);
end;
$$;

revoke all on function public.affiliate_monthly_snapshot_by_codes(uuid[]) from public, anon, authenticated;
grant execute on function public.affiliate_monthly_snapshot_by_codes(uuid[]) to service_role;
