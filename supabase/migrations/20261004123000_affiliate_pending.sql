create index if not exists orders_affiliate_completed_idx
  on public.orders(store_id, completed_at)
  where status = 'completed' and completed_at is not null and platform_service_fee_usd > 0;

create or replace function public.affiliate_pending_fee_commission(p_beneficiary uuid)
returns numeric language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(sum(round(o.platform_service_fee_usd * r.commission_percent / 100, 2)), 0)::numeric(12,2)
  from public.affiliate_referrals r
  join public.orders o on o.store_id = r.store_id
    and o.status = 'completed' and o.completed_at >= r.activated_at and o.completed_at < r.ends_at
    and o.platform_service_fee_usd > 0
  where r.beneficiary_user_id = p_beneficiary and r.commission_percent > 0
    and not exists (select 1 from public.affiliate_commissions c where c.order_id = o.id);
$$;
revoke all on function public.affiliate_pending_fee_commission(uuid) from public, anon, authenticated;
grant execute on function public.affiliate_pending_fee_commission(uuid) to service_role;
