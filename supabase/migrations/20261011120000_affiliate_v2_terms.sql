-- V2 keeps referral terms frozen per registration and pays only from SOMOS receipts.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('subscription-receipts', 'subscription-receipts', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.affiliate_codes
  add column partner_type text not null default 'seller' check (partner_type in ('seller', 'creator', 'delivery')),
  add column beneficiary_email text,
  add column transport_agency_id uuid references public.transport_agencies(id) on delete restrict,
  add column setup_commission_percent numeric(5,2) not null default 0 check (setup_commission_percent between 0 and 100);
update public.affiliate_codes c set beneficiary_email = lower(u.email)
  from auth.users u where c.beneficiary_user_id = u.id and c.beneficiary_email is null;
alter table public.affiliate_codes drop constraint affiliate_code_beneficiary_check;
alter table public.affiliate_codes add constraint affiliate_code_v2_beneficiary_check check (
  (partner_type = 'delivery' and transport_agency_id is not null) or
  (partner_type <> 'delivery' and transport_agency_id is null and
    ((commission_percent = 0 and setup_commission_percent = 0) or beneficiary_email is not null))
);
create index affiliate_codes_email_idx on public.affiliate_codes(beneficiary_email) where beneficiary_email is not null;
create index affiliate_codes_agency_idx on public.affiliate_codes(transport_agency_id) where transport_agency_id is not null;

alter table public.affiliate_referrals
  add column partner_type text not null default 'seller',
  add column beneficiary_email text,
  add column transport_agency_id uuid references public.transport_agencies(id) on delete restrict,
  add column setup_commission_percent numeric(5,2) not null default 0,
  add column fee_started_at timestamptz,
  add column fee_ends_at timestamptz,
  add constraint affiliate_referral_fee_window_check check
    ((fee_started_at is null and fee_ends_at is null) or (fee_started_at is not null and fee_ends_at > fee_started_at));
update public.affiliate_referrals r set
  partner_type = c.partner_type, beneficiary_email = c.beneficiary_email,
  transport_agency_id = c.transport_agency_id, setup_commission_percent = c.setup_commission_percent
from public.affiliate_codes c where c.id = r.affiliate_code_id;
create index affiliate_referrals_fee_window_idx on public.affiliate_referrals(store_id, fee_started_at, fee_ends_at);

create or replace function public.link_affiliate_registration()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.affiliate_code_id is not null then
    insert into public.affiliate_referrals
      (registration_request_id, affiliate_code_id, beneficiary_user_id, beneficiary_email,
       transport_agency_id, partner_type, discount_percent, setup_commission_percent,
       commission_percent, duration_months)
    select new.id, id, beneficiary_user_id, beneficiary_email, transport_agency_id,
      partner_type, discount_percent, setup_commission_percent, commission_percent, duration_months
    from public.affiliate_codes where id = new.affiliate_code_id;
  end if;
  return new;
end;
$$;

create or replace function public.guard_registration_activation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status in ('activating', 'approved') and old.status is distinct from new.status and
     new.setup_payment_status not in ('confirmed', 'waived') then
    raise exception 'Confirma el pago inicial antes de activar el comercio';
  end if;
  if old.status = 'approved' and new.status <> 'approved' then
    raise exception 'Una solicitud aprobada no puede revertirse';
  end if;
  if new.status = 'approved' and old.status <> 'approved' and new.affiliate_code_id is not null then
    update public.affiliate_referrals set store_id = new.store_id
      where registration_request_id = new.id and store_id is null;
  end if;
  return new;
end;
$$;

create or replace function public.guard_affiliate_referral_terms()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.registration_request_id is distinct from new.registration_request_id or
     old.affiliate_code_id is distinct from new.affiliate_code_id or
     old.beneficiary_user_id is distinct from new.beneficiary_user_id or
     old.beneficiary_email is distinct from new.beneficiary_email or
     old.transport_agency_id is distinct from new.transport_agency_id or
     old.partner_type is distinct from new.partner_type or
     old.discount_percent is distinct from new.discount_percent or
     old.setup_commission_percent is distinct from new.setup_commission_percent or
     old.commission_percent is distinct from new.commission_percent or
     old.duration_months is distinct from new.duration_months or
     old.timezone is distinct from new.timezone or
     (old.store_id is not null and old.store_id is distinct from new.store_id) or
     (old.fee_started_at is not null and old.fee_started_at is distinct from new.fee_started_at) or
     (old.fee_ends_at is not null and old.fee_ends_at is distinct from new.fee_ends_at)
  then raise exception 'Los terminos del referido no pueden modificarse'; end if;
  return new;
end;
$$;

create or replace function public.activate_affiliate_fee_window(p_store_id uuid, p_at timestamptz)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_order record;
begin
  update public.affiliate_referrals r set
    fee_started_at = p_at,
    fee_ends_at = ((p_at at time zone r.timezone) + make_interval(months => r.duration_months)) at time zone r.timezone
  where r.store_id = p_store_id and r.fee_started_at is null
    and exists (select 1 from public.commerce_registration_requests q
      where q.id = r.registration_request_id and q.status = 'approved');
  if found then
    for v_order in
      select distinct o.id from public.orders o
      join public.affiliate_fee_allocations a on a.order_id = o.id
      join public.affiliate_referrals r on r.store_id = o.store_id
      where o.store_id = p_store_id and o.created_at >= r.fee_started_at
        and o.created_at < r.fee_ends_at and o.platform_service_fee_usd > 0
    loop
      perform public.recognize_affiliate_commission(v_order.id);
    end loop;
  end if;
end;
$$;
create or replace function public.activate_affiliate_fee_window_from_store()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.plan_type = 'per_service' and new.subscription_status = 'active' then
    perform public.activate_affiliate_fee_window(new.id, now());
  end if;
  return new;
end;
$$;
create trigger activate_affiliate_fee_window_on_store
after insert or update on public.stores
for each row execute function public.activate_affiliate_fee_window_from_store();

alter table public.affiliate_commissions
  add column kind text not null default 'fee' check (kind in ('fee', 'setup')),
  add column registration_request_id uuid unique references public.commerce_registration_requests(id) on delete restrict,
  add column setup_paid_usd numeric(10,2),
  alter column order_id drop not null,
  alter column fee_usd drop not null,
  alter column window_started_at drop not null,
  alter column window_ends_at drop not null;
alter table public.affiliate_commissions drop constraint affiliate_commissions_fee_usd_check;
alter table public.affiliate_commissions add constraint affiliate_commission_source_check check (
  (kind = 'fee' and order_id is not null and registration_request_id is null and fee_usd > 0 and setup_paid_usd is null
    and window_started_at is not null and window_ends_at is not null) or
  (kind = 'setup' and order_id is null and registration_request_id is not null and fee_usd is null and setup_paid_usd > 0
    and window_started_at is null and window_ends_at is null)
);

create or replace function public.recognize_affiliate_setup_commission()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ref public.affiliate_referrals%rowtype;
declare v_amount numeric(10,2);
begin
  if new.status <> 'approved' or old.status = 'approved' or new.setup_payment_status <> 'confirmed'
     or coalesce(new.setup_paid_usd, 0) <= 0 then return new; end if;
  select * into v_ref from public.affiliate_referrals where registration_request_id = new.id;
  if not found or v_ref.setup_commission_percent <= 0 then return new; end if;
  v_amount := round(new.setup_paid_usd * v_ref.setup_commission_percent / 100, 2);
  if v_amount <= 0 then return new; end if;
  insert into public.affiliate_commissions
    (referral_id, store_id, kind, registration_request_id, setup_paid_usd,
     commission_percent, amount_usd, eligible_at)
  values (v_ref.id, v_ref.store_id, 'setup', new.id, new.setup_paid_usd,
    v_ref.setup_commission_percent, v_amount, new.setup_payment_confirmed_at)
  on conflict (registration_request_id) do nothing;
  return new;
end;
$$;
create trigger recognize_affiliate_setup_on_approval
after update of status on public.commerce_registration_requests
for each row execute function public.recognize_affiliate_setup_commission();
create or replace function public.activate_affiliate_fee_window_from_registration()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'approved' and old.status is distinct from new.status and new.store_id is not null and
     exists (select 1 from public.stores s where s.id = new.store_id and
       s.plan_type = 'per_service' and s.subscription_status = 'active') then
    perform public.activate_affiliate_fee_window(new.store_id, now());
  end if;
  return new;
end;
$$;
create trigger activate_affiliate_fee_window_on_registration
after update of status on public.commerce_registration_requests
for each row execute function public.activate_affiliate_fee_window_from_registration();

create or replace function public.recognize_affiliate_commission(p_order_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_order public.orders%rowtype;
declare v_ref public.affiliate_referrals%rowtype;
declare v_paid numeric(10,2);
declare v_amount numeric(10,2);
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found or coalesce(v_order.platform_service_fee_usd, 0) <= 0 then return; end if;
  select * into v_ref from public.affiliate_referrals
    where store_id = v_order.store_id and commission_percent > 0
      and fee_started_at <= v_order.created_at and fee_ends_at > v_order.created_at;
  if not found then return; end if;
  select coalesce(sum(amount_usd), 0) into v_paid from public.affiliate_fee_allocations where order_id = p_order_id;
  if v_paid < round(v_order.platform_service_fee_usd, 2) then return; end if;
  v_amount := round(v_order.platform_service_fee_usd * v_ref.commission_percent / 100, 2);
  if v_amount <= 0 then return; end if;
  insert into public.affiliate_commissions
    (referral_id, store_id, kind, order_id, fee_usd, commission_percent, amount_usd,
     eligible_at, window_started_at, window_ends_at)
  values (v_ref.id, v_order.store_id, 'fee', p_order_id, round(v_order.platform_service_fee_usd, 2),
    v_ref.commission_percent, v_amount, v_order.created_at, v_ref.fee_started_at, v_ref.fee_ends_at)
  on conflict (order_id) do nothing;
end;
$$;
create or replace function public.recognize_affiliate_order_completion()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.recognize_affiliate_commission(new.id);
  return new;
end;
$$;
create index orders_affiliate_fee_window_idx on public.orders(store_id, created_at)
  where platform_service_fee_usd > 0;

alter table public.affiliate_settlements
  add column affiliate_code_id uuid references public.affiliate_codes(id) on delete restrict,
  alter column beneficiary_user_id drop not null;
update public.affiliate_settlements s set affiliate_code_id = x.affiliate_code_id
from (
  select i.settlement_id, min(r.affiliate_code_id::text)::uuid as affiliate_code_id
  from public.affiliate_settlement_items i
  join public.affiliate_commissions c on c.id = i.commission_id
  join public.affiliate_referrals r on r.id = c.referral_id
  group by i.settlement_id having count(distinct r.affiliate_code_id) = 1
) x where x.settlement_id = s.id and s.affiliate_code_id is null;

create or replace function public.settle_affiliate_commissions(
  p_commission_ids uuid[], p_paid_at timestamptz, p_method text, p_reference text, p_actor uuid
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer;
declare v_code uuid;
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
  select count(*), (array_agg(r.affiliate_code_id))[1], (array_agg(r.beneficiary_user_id))[1],
    sum(c.amount_usd + coalesce(a.adjustment_usd, 0))
    into v_count, v_code, v_beneficiary, v_amount
  from public.affiliate_commissions c
  join public.affiliate_referrals r on r.id = c.referral_id
  left join lateral (select sum(amount_usd) as adjustment_usd from public.affiliate_commission_adjustments
    where commission_id = c.id) a on true
  where c.id = any(p_commission_ids) and c.status = 'available'
    and c.amount_usd + coalesce(a.adjustment_usd, 0) > 0;
  if v_count <> cardinality(p_commission_ids) or v_code is null or
     (select count(distinct r.affiliate_code_id) from public.affiliate_commissions c
      join public.affiliate_referrals r on r.id = c.referral_id where c.id = any(p_commission_ids)) <> 1
  then raise exception 'Comisiones no disponibles o de distintos aliados'; end if;
  insert into public.affiliate_settlements(affiliate_code_id, beneficiary_user_id, amount_usd, paid_at, method, reference, created_by)
    values (v_code, v_beneficiary, v_amount, p_paid_at, trim(p_method), trim(p_reference), p_actor)
    returning id into v_settlement;
  insert into public.affiliate_settlement_items(settlement_id, commission_id, amount_usd)
    select v_settlement, c.id,
      c.amount_usd + coalesce((select sum(a.amount_usd) from public.affiliate_commission_adjustments a
        where a.commission_id = c.id), 0)
    from public.affiliate_commissions c where c.id = any(p_commission_ids);
  update public.affiliate_commissions set status = 'paid' where id = any(p_commission_ids);
  return v_settlement;
end;
$$;

create or replace function public.affiliate_pending_commission_by_codes(p_code_ids uuid[])
returns numeric language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(sum(round(o.platform_service_fee_usd * r.commission_percent / 100, 2)), 0)::numeric(12,2)
  from public.affiliate_referrals r
  join public.orders o on o.store_id = r.store_id and
    o.created_at >= r.fee_started_at and o.created_at < r.fee_ends_at and o.platform_service_fee_usd > 0
  where r.affiliate_code_id = any(p_code_ids) and r.commission_percent > 0
    and not exists (select 1 from public.affiliate_commissions c where c.order_id = o.id);
$$;
revoke all on function public.affiliate_pending_commission_by_codes(uuid[]) from public, anon, authenticated;
grant execute on function public.affiliate_pending_commission_by_codes(uuid[]) to service_role;

create or replace function public.affiliate_balance_by_codes(p_code_ids uuid[])
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  with commission_totals as (
    select
      coalesce(sum(c.amount_usd + coalesce(a.adjustment_usd, 0)) filter (where c.status = 'available'), 0) as available_usd
    from public.affiliate_commissions c
    join public.affiliate_referrals r on r.id = c.referral_id
    left join lateral (select sum(amount_usd) as adjustment_usd from public.affiliate_commission_adjustments
      where commission_id = c.id) a on true
    where r.affiliate_code_id = any(p_code_ids)
  ), paid_totals as (
    select coalesce(sum(amount_usd), 0) as paid_usd from public.affiliate_settlements
    where affiliate_code_id = any(p_code_ids)
  )
  select jsonb_build_object('availableUsd', commission_totals.available_usd, 'paidUsd', paid_totals.paid_usd)
  from commission_totals cross join paid_totals;
$$;
revoke all on function public.affiliate_balance_by_codes(uuid[]) from public, anon, authenticated;
grant execute on function public.affiliate_balance_by_codes(uuid[]) to service_role;

alter table public.affiliate_commission_adjustments
  add column source_refund_usd numeric(10,2) check (source_refund_usd > 0);

create or replace function public.adjust_affiliate_setup_refund(
  p_commission_id uuid, p_setup_refund_usd numeric, p_reference text, p_actor uuid
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_commission public.affiliate_commissions%rowtype;
declare v_prior numeric(10,2);
declare v_adjustment numeric(10,2);
declare v_id uuid;
declare v_key text;
begin
  if p_setup_refund_usd <= 0 or trim(coalesce(p_reference, '')) = '' or p_actor is null then
    raise exception 'Ajuste invalido'; end if;
  select * into v_commission from public.affiliate_commissions where id = p_commission_id for update;
  if not found or v_commission.kind <> 'setup' then raise exception 'Comision inicial no encontrada'; end if;
  v_key := 'setup-refund:' || p_commission_id::text || ':' || trim(p_reference);
  select id into v_id from public.affiliate_commission_adjustments where source_key = v_key;
  if found then return v_id; end if;
  select coalesce(sum(source_refund_usd), 0) into v_prior from public.affiliate_commission_adjustments
    where commission_id = p_commission_id;
  v_adjustment := least(round(p_setup_refund_usd * v_commission.commission_percent / 100, 2),
    v_commission.amount_usd - round(v_prior * v_commission.commission_percent / 100, 2));
  if p_setup_refund_usd > v_commission.setup_paid_usd - v_prior or v_adjustment <= 0 then
    raise exception 'El reintegro supera el importe disponible'; end if;
  insert into public.affiliate_commission_adjustments(commission_id, amount_usd, source_refund_usd, reason, source_key, created_by)
    values (p_commission_id, -v_adjustment, p_setup_refund_usd, 'Pago inicial reintegrado: ' || trim(p_reference), v_key, p_actor)
    returning id into v_id;
  if v_commission.status = 'available' and v_commission.amount_usd - round(v_prior * v_commission.commission_percent / 100, 2) - v_adjustment <= 0 then
    update public.affiliate_commissions set status = 'reversed' where id = p_commission_id;
  end if;
  return v_id;
end;
$$;
revoke all on function public.adjust_affiliate_setup_refund(uuid, numeric, text, uuid) from public, anon, authenticated;
grant execute on function public.adjust_affiliate_setup_refund(uuid, numeric, text, uuid) to service_role;
