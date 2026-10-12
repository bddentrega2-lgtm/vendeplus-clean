create table public.affiliate_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  beneficiary_email text unique,
  transport_agency_id uuid unique references public.transport_agencies(id) on delete restrict,
  holder_name text not null check (char_length(holder_name) between 2 and 120),
  bank_name text not null check (char_length(bank_name) between 2 and 80),
  document_number text not null check (char_length(document_number) between 5 and 20),
  phone text not null check (phone ~ '^04[0-9]{9}$'),
  updated_at timestamptz not null default now(),
  constraint affiliate_payout_owner_check check (
    (beneficiary_email is not null) <> (transport_agency_id is not null)
  ),
  constraint affiliate_payout_email_check check (
    beneficiary_email is null or (beneficiary_email = lower(trim(beneficiary_email)) and beneficiary_email ~ '^[^ @]+@[^ @]+[.][^ @]+$')
  )
);
create index affiliate_payout_accounts_agency_idx on public.affiliate_payout_accounts(transport_agency_id)
  where transport_agency_id is not null;
alter table public.affiliate_payout_accounts enable row level security;
revoke all on public.affiliate_payout_accounts from public, anon, authenticated;
grant all on public.affiliate_payout_accounts to service_role;

create or replace function public.affiliate_earnings_by_codes(p_code_ids uuid[])
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  with scoped as (
    select r.id, r.store_id, r.affiliate_code_id,
      coalesce(q.store_name, s.name, 'Comercio') as store_name
    from public.affiliate_referrals r
    left join public.commerce_registration_requests q on q.id = r.registration_request_id
    left join public.stores s on s.id = r.store_id
    where r.affiliate_code_id = any(p_code_ids)
  ), amounts as (
    select r.id as referral_id, c.kind, c.status,
      case when c.status = 'available' then greatest(c.amount_usd + coalesce(a.adjustment_usd, 0), 0) else 0 end as pending_usd,
      case when c.status = 'paid' then coalesce(i.amount_usd, 0) else 0 end as paid_usd
    from scoped r
    join public.affiliate_commissions c on c.referral_id = r.id and c.status in ('available', 'paid')
    left join lateral (
      select sum(amount_usd) as adjustment_usd from public.affiliate_commission_adjustments where commission_id = c.id
    ) a on true
    left join public.affiliate_settlement_items i on i.commission_id = c.id
  ), per_store as (
    select r.id, r.store_id, r.affiliate_code_id, r.store_name,
      coalesce(sum(a.pending_usd) filter (where a.kind = 'setup'), 0)::numeric(12,2) as setup_pending,
      coalesce(sum(a.paid_usd) filter (where a.kind = 'setup'), 0)::numeric(12,2) as setup_paid,
      coalesce(sum(a.pending_usd) filter (where a.kind = 'fee'), 0)::numeric(12,2) as fee_pending,
      coalesce(sum(a.paid_usd) filter (where a.kind = 'fee'), 0)::numeric(12,2) as fee_paid
    from scoped r left join amounts a on a.referral_id = r.id
    group by r.id, r.store_id, r.affiliate_code_id, r.store_name
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'referralId', id, 'storeId', store_id, 'codeId', affiliate_code_id, 'storeName', store_name,
    'setupPendingUsd', setup_pending, 'setupPaidUsd', setup_paid,
    'feePendingUsd', fee_pending, 'feePaidUsd', fee_paid
  ) order by store_name, id), '[]'::jsonb)
  from per_store;
$$;
revoke all on function public.affiliate_earnings_by_codes(uuid[]) from public, anon, authenticated;
grant execute on function public.affiliate_earnings_by_codes(uuid[]) to service_role;
