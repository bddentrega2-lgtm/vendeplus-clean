-- Approved fee payments are allocated to orders FIFO; only fully collected fees can earn a commission.
create table public.affiliate_fee_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.store_subscription_payments(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  amount_usd numeric(10,2) not null check (amount_usd > 0),
  created_at timestamptz not null default now(),
  unique (payment_id, order_id)
);
create index affiliate_fee_allocations_order_idx on public.affiliate_fee_allocations(order_id);

create table public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.affiliate_referrals(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  order_id uuid not null unique references public.orders(id) on delete restrict,
  fee_usd numeric(10,2) not null check (fee_usd > 0),
  commission_percent numeric(5,2) not null,
  amount_usd numeric(10,2) not null check (amount_usd > 0),
  eligible_at timestamptz not null,
  window_started_at timestamptz not null,
  window_ends_at timestamptz not null,
  status text not null default 'available' check (status in ('available', 'paid', 'reversed')),
  created_at timestamptz not null default now()
);
create index affiliate_commissions_referral_status_idx on public.affiliate_commissions(referral_id, status, created_at desc);

create table public.affiliate_settlements (
  id uuid primary key default gen_random_uuid(),
  beneficiary_user_id uuid not null references auth.users(id) on delete restrict,
  amount_usd numeric(12,2) not null check (amount_usd > 0),
  paid_at timestamptz not null,
  method text not null,
  reference text not null,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create table public.affiliate_settlement_items (
  settlement_id uuid not null references public.affiliate_settlements(id) on delete restrict,
  commission_id uuid not null unique references public.affiliate_commissions(id) on delete restrict,
  amount_usd numeric(10,2) not null check (amount_usd > 0),
  primary key (settlement_id, commission_id)
);
create table public.affiliate_commission_adjustments (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.affiliate_commissions(id) on delete restrict,
  amount_usd numeric(10,2) not null check (amount_usd <> 0),
  reason text not null,
  source_key text not null unique,
  created_by uuid,
  created_at timestamptz not null default now()
);

create or replace function public.recognize_affiliate_commission(p_order_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_order public.orders%rowtype;
declare v_ref public.affiliate_referrals%rowtype;
declare v_paid numeric(10,2);
declare v_amount numeric(10,2);
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.status <> 'completed' or v_order.completed_at is null or coalesce(v_order.platform_service_fee_usd, 0) <= 0 then return; end if;
  select * into v_ref from public.affiliate_referrals
    where store_id = v_order.store_id and beneficiary_user_id is not null
      and commission_percent > 0 and activated_at <= v_order.completed_at and ends_at > v_order.completed_at;
  if not found then return; end if;
  select coalesce(sum(amount_usd), 0) into v_paid from public.affiliate_fee_allocations where order_id = p_order_id;
  if v_paid < round(v_order.platform_service_fee_usd, 2) then return; end if;
  v_amount := round(v_order.platform_service_fee_usd * v_ref.commission_percent / 100, 2);
  if v_amount <= 0 then return; end if;
  insert into public.affiliate_commissions
    (referral_id, store_id, order_id, fee_usd, commission_percent, amount_usd, eligible_at, window_started_at, window_ends_at)
  values (v_ref.id, v_order.store_id, p_order_id, round(v_order.platform_service_fee_usd, 2),
    v_ref.commission_percent, v_amount, v_order.completed_at, v_ref.activated_at, v_ref.ends_at)
  on conflict (order_id) do nothing;
end;
$$;

create or replace function public.allocate_affiliate_fee_payment()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_order record;
declare v_remaining numeric(10,2);
declare v_unpaid numeric(10,2);
declare v_applied numeric(10,2);
begin
  if old.status = 'approved' or new.status <> 'approved' or new.plan_type <> 'per_service' then return new; end if;
  if not exists (select 1 from public.affiliate_referrals where store_id = new.store_id) then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.store_id::text, 20261004));
  v_remaining := greatest(round(new.amount_usd, 2), 0);
  if v_remaining <= 0 then return new; end if;
  for v_order in
    select o.id, round(o.platform_service_fee_usd, 2) as fee, coalesce(paid.allocated, 0) as allocated
    from public.orders o
    left join lateral (select sum(a.amount_usd) as allocated from public.affiliate_fee_allocations a where a.order_id = o.id) paid on true
    where o.store_id = new.store_id and o.created_at <= new.created_at and o.platform_service_fee_usd > 0
      and round(o.platform_service_fee_usd, 2) > coalesce(paid.allocated, 0)
    order by o.created_at, o.id
  loop
    v_unpaid := greatest(v_order.fee - v_order.allocated, 0);
    v_applied := least(v_unpaid, v_remaining);
    if v_applied > 0 then
      insert into public.affiliate_fee_allocations(payment_id, order_id, amount_usd)
        values (new.id, v_order.id, v_applied)
        on conflict (payment_id, order_id) do nothing;
      v_remaining := v_remaining - v_applied;
      perform public.recognize_affiliate_commission(v_order.id);
    end if;
    exit when v_remaining <= 0;
  end loop;
  return new;
end;
$$;

create trigger allocate_affiliate_fee_payment_after_approval
after update of status on public.store_subscription_payments
for each row when (old.status is distinct from new.status and new.status = 'approved')
execute function public.allocate_affiliate_fee_payment();

create or replace function public.recognize_affiliate_order_completion()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    perform public.recognize_affiliate_commission(new.id);
  elsif old.status = 'completed' and new.status <> 'completed' then
    insert into public.affiliate_commission_adjustments(commission_id, amount_usd, reason, source_key)
      select id, -amount_usd, 'Pedido revertido despues de completarse', 'order-reversed:' || new.id::text
      from public.affiliate_commissions where order_id = new.id
      on conflict (source_key) do nothing;
    update public.affiliate_commissions set status = 'reversed'
      where order_id = new.id and status = 'available';
  end if;
  return new;
end;
$$;
create trigger recognize_affiliate_order_completion_after_update
after update of status on public.orders
for each row when (old.status is distinct from new.status)
execute function public.recognize_affiliate_order_completion();

create or replace function public.settle_affiliate_commissions(
  p_commission_ids uuid[], p_paid_at timestamptz, p_method text, p_reference text, p_actor uuid
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer;
declare v_beneficiary uuid;
declare v_amount numeric(12,2);
declare v_settlement uuid;
begin
  if cardinality(p_commission_ids) = 0 or cardinality(p_commission_ids) > 100 or
     p_method is null or trim(p_method) = '' or p_reference is null or trim(p_reference) = '' or
     p_actor is null or p_paid_at is null then raise exception 'Liquidacion invalida'; end if;
  if (select count(distinct x) from unnest(p_commission_ids) x) <> cardinality(p_commission_ids) then
    raise exception 'Comisiones duplicadas';
  end if;
  perform c.id from public.affiliate_commissions c
    where c.id = any(p_commission_ids) order by c.id for update;
  select count(*), (array_agg(r.beneficiary_user_id))[1], sum(c.amount_usd + coalesce(a.adjustment_usd, 0))
    into v_count, v_beneficiary, v_amount
  from public.affiliate_commissions c
  join public.affiliate_referrals r on r.id = c.referral_id
  left join lateral (select sum(amount_usd) as adjustment_usd from public.affiliate_commission_adjustments where commission_id = c.id) a on true
  where c.id = any(p_commission_ids) and c.status = 'available'
    and c.amount_usd + coalesce(a.adjustment_usd, 0) > 0
  ;
  if v_count <> cardinality(p_commission_ids) or v_beneficiary is null or
     (select count(distinct r.beneficiary_user_id) from public.affiliate_commissions c join public.affiliate_referrals r on r.id = c.referral_id where c.id = any(p_commission_ids)) <> 1
  then raise exception 'Comisiones no disponibles o de distintos aliados'; end if;
  insert into public.affiliate_settlements(beneficiary_user_id, amount_usd, paid_at, method, reference, created_by)
    values (v_beneficiary, v_amount, p_paid_at, trim(p_method), trim(p_reference), p_actor) returning id into v_settlement;
  insert into public.affiliate_settlement_items(settlement_id, commission_id, amount_usd)
    select v_settlement, c.id, c.amount_usd + coalesce((select sum(a.amount_usd) from public.affiliate_commission_adjustments a where a.commission_id = c.id), 0)
    from public.affiliate_commissions c where c.id = any(p_commission_ids);
  update public.affiliate_commissions set status = 'paid' where id = any(p_commission_ids);
  return v_settlement;
end;
$$;

alter table public.affiliate_fee_allocations enable row level security;
alter table public.affiliate_commissions enable row level security;
alter table public.affiliate_settlements enable row level security;
alter table public.affiliate_settlement_items enable row level security;
alter table public.affiliate_commission_adjustments enable row level security;
revoke all on public.affiliate_fee_allocations, public.affiliate_commissions, public.affiliate_settlements,
  public.affiliate_settlement_items, public.affiliate_commission_adjustments from public, anon, authenticated;
grant all on public.affiliate_fee_allocations, public.affiliate_commissions, public.affiliate_settlements,
  public.affiliate_settlement_items, public.affiliate_commission_adjustments to service_role;
revoke all on function public.recognize_affiliate_commission(uuid), public.settle_affiliate_commissions(uuid[], timestamptz, text, text, uuid) from public, anon, authenticated;
grant execute on function public.settle_affiliate_commissions(uuid[], timestamptz, text, text, uuid) to service_role;

create or replace function public.approve_per_service_fee_payment(p_payment_id uuid, p_actor uuid, p_notes text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_payment public.store_subscription_payments%rowtype;
declare v_now timestamptz := now();
declare v_period interval;
begin
  select * into v_payment from public.store_subscription_payments where id = p_payment_id for update;
  if not found or v_payment.status <> 'pending' or v_payment.plan_type <> 'per_service' then
    raise exception 'Pago no disponible para aprobar';
  end if;
  v_period := case when v_payment.billing_period = 'annual' then interval '365 days' else interval '30 days' end;
  update public.store_subscription_payments set status = 'approved', reviewed_by = p_actor,
    reviewed_at = v_now, notes = coalesce(nullif(trim(p_notes), ''), notes)
    where id = p_payment_id;
  update public.stores set plan_type = 'per_service', subscription_status = 'active',
    subscription_started_at = v_now, subscription_ends_at = v_now + v_period,
    next_payment_due_at = v_now + v_period, last_payment_at = v_payment.created_at,
    service_fee_billing_cycle = 'monthly', monthly_price_usd = 0.10
    where id = v_payment.store_id;
end;
$$;
revoke all on function public.approve_per_service_fee_payment(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.approve_per_service_fee_payment(uuid, uuid, text) to service_role;
