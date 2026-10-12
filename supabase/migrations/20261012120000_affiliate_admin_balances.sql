create index if not exists affiliate_referrals_code_idx on public.affiliate_referrals(affiliate_code_id);
create index if not exists affiliate_commission_adjustments_commission_idx
  on public.affiliate_commission_adjustments(commission_id);

create or replace function public.affiliate_admin_balances()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  with adjustments as (
    select commission_id, sum(amount_usd) as amount_usd
    from public.affiliate_commission_adjustments group by commission_id
  ), per_code as (
    select r.affiliate_code_id,
      coalesce(sum(greatest(c.amount_usd + coalesce(a.amount_usd, 0), 0))
        filter (where c.kind = 'setup' and c.status = 'available'), 0)::numeric(12,2) as setup_pending,
      coalesce(sum(greatest(c.amount_usd + coalesce(a.amount_usd, 0), 0))
        filter (where c.kind = 'fee' and c.status = 'available'), 0)::numeric(12,2) as fee_pending,
      coalesce(sum(i.amount_usd) filter (where c.kind = 'setup' and c.status = 'paid'), 0)::numeric(12,2) as setup_paid,
      coalesce(sum(i.amount_usd) filter (where c.kind = 'fee' and c.status = 'paid'), 0)::numeric(12,2) as fee_paid
    from public.affiliate_commissions c
    join public.affiliate_referrals r on r.id = c.referral_id
    left join adjustments a on a.commission_id = c.id
    left join public.affiliate_settlement_items i on i.commission_id = c.id
    where c.status in ('available', 'paid')
    group by r.affiliate_code_id
  ), allies as (
    select case when code.transport_agency_id is not null then 'agency:' || code.transport_agency_id::text
      else 'email:' || lower(code.beneficiary_email) end as ally_key,
      coalesce(max(agency.name), min(code.name)) as display_name,
      max(code.beneficiary_email) as beneficiary_email,
      code.transport_agency_id,
      array_agg(code.code order by code.code) as codes,
      coalesce(sum(p.setup_pending), 0)::numeric(12,2) as setup_pending,
      coalesce(sum(p.fee_pending), 0)::numeric(12,2) as fee_pending,
      coalesce(sum(p.setup_paid), 0)::numeric(12,2) as setup_paid,
      coalesce(sum(p.fee_paid), 0)::numeric(12,2) as fee_paid
    from public.affiliate_codes code
    left join public.transport_agencies agency on agency.id = code.transport_agency_id
    left join per_code p on p.affiliate_code_id = code.id
    where code.beneficiary_email is not null or code.transport_agency_id is not null
    group by ally_key, code.transport_agency_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'allyKey', ally_key, 'displayName', display_name,
    'beneficiaryEmail', beneficiary_email, 'transportAgencyId', transport_agency_id,
    'codes', codes, 'setupPendingUsd', setup_pending, 'feePendingUsd', fee_pending,
    'setupPaidUsd', setup_paid, 'feePaidUsd', fee_paid
  ) order by display_name, ally_key), '[]'::jsonb)
  from allies;
$$;
revoke all on function public.affiliate_admin_balances() from public, anon, authenticated;
grant execute on function public.affiliate_admin_balances() to service_role;
