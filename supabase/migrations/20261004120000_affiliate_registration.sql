-- Affiliate terms are frozen on the application, then activated once the store is approved.
create table public.affiliate_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,32}$'),
  name text not null,
  contact text,
  beneficiary_user_id uuid references auth.users(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'paused', 'disabled')),
  discount_percent numeric(5,2) not null default 50 check (discount_percent between 0 and 100),
  commission_percent numeric(5,2) not null default 50 check (commission_percent between 0 and 100),
  duration_months smallint not null default 3 check (duration_months between 1 and 3),
  starts_at timestamptz,
  expires_at timestamptz,
  max_uses integer check (max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  created_at timestamptz not null default now(),
  constraint affiliate_code_beneficiary_check check (commission_percent = 0 or beneficiary_user_id is not null),
  constraint affiliate_code_dates_check check (expires_at is null or starts_at is null or expires_at > starts_at)
);

alter table public.commerce_registration_requests
  add column affiliate_code_id uuid references public.affiliate_codes(id) on delete restrict,
  add column setup_base_usd numeric(10,2) not null default 20,
  add column setup_discount_percent numeric(5,2) not null default 0,
  add column setup_due_usd numeric(10,2) not null default 20,
  add column setup_payment_status text not null default 'pending',
  add column setup_payment_reference text,
  add column setup_payment_proof_path text,
  add column setup_payment_reported_at timestamptz,
  add column setup_payment_confirmed_at timestamptz,
  add column setup_payment_confirmed_by uuid,
  add column setup_paid_usd numeric(10,2),
  add constraint commerce_registration_setup_payment_status_check
    check (setup_payment_status in ('pending', 'reported', 'confirmed', 'waived')),
  add constraint commerce_registration_setup_amount_check
    check (setup_base_usd = 20 and setup_due_usd = round(setup_base_usd * (100 - setup_discount_percent) / 100, 2)
      and setup_discount_percent between 0 and 100),
  add constraint commerce_registration_setup_confirmation_check
    check (setup_payment_status not in ('confirmed', 'waived') or
      (setup_payment_confirmed_at is not null and setup_payment_confirmed_by is not null and
       ((setup_payment_status = 'confirmed' and setup_due_usd > 0 and setup_paid_usd = setup_due_usd) or
        (setup_payment_status = 'waived' and setup_due_usd = 0 and setup_paid_usd is null))));

create table public.affiliate_referrals (
  id uuid primary key default gen_random_uuid(),
  registration_request_id uuid not null unique references public.commerce_registration_requests(id) on delete restrict,
  affiliate_code_id uuid not null references public.affiliate_codes(id) on delete restrict,
  beneficiary_user_id uuid references auth.users(id) on delete restrict,
  store_id uuid unique references public.stores(id) on delete restrict,
  discount_percent numeric(5,2) not null,
  commission_percent numeric(5,2) not null,
  duration_months smallint not null check (duration_months between 1 and 3),
  activated_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  constraint affiliate_referral_window_check check ((activated_at is null and ends_at is null) or (activated_at is not null and ends_at > activated_at))
);

create or replace function public.prepare_affiliate_registration()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_code public.affiliate_codes%rowtype;
begin
  -- The API supplies an ID only; the database owns every price and term snapshot.
  new.setup_base_usd := 20;
  new.setup_discount_percent := 0;
  new.setup_due_usd := 20;
  new.setup_payment_status := 'pending';
  if new.affiliate_code_id is not null then
    update public.affiliate_codes
      set used_count = used_count + 1
      where id = new.affiliate_code_id and status = 'active'
        and (starts_at is null or starts_at <= now())
        and (expires_at is null or expires_at > now())
        and (max_uses is null or used_count < max_uses)
      returning * into v_code;
    if not found then raise exception 'El codigo no esta disponible'; end if;
    new.setup_discount_percent := v_code.discount_percent;
    new.setup_due_usd := round(20 * (100 - v_code.discount_percent) / 100, 2);
  end if;
  return new;
end;
$$;

create trigger prepare_affiliate_registration_before_insert
before insert on public.commerce_registration_requests
for each row execute function public.prepare_affiliate_registration();

create or replace function public.link_affiliate_registration()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.affiliate_code_id is not null then
    insert into public.affiliate_referrals
      (registration_request_id, affiliate_code_id, beneficiary_user_id, discount_percent, commission_percent, duration_months)
    select new.id, id, beneficiary_user_id, discount_percent, commission_percent, duration_months
    from public.affiliate_codes where id = new.affiliate_code_id;
  end if;
  return new;
end;
$$;

create trigger link_affiliate_registration_after_insert
after insert on public.commerce_registration_requests
for each row execute function public.link_affiliate_registration();

create or replace function public.guard_registration_activation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status in ('activating', 'approved') and old.status is distinct from new.status then
    if new.setup_payment_status not in ('confirmed', 'waived') then
      raise exception 'Confirma el pago inicial antes de activar el comercio';
    end if;
  end if;
  if old.status = 'approved' and new.status <> 'approved' then
    raise exception 'Una solicitud aprobada no puede revertirse';
  end if;
  if new.status = 'approved' and old.status <> 'approved' and new.affiliate_code_id is not null then
    update public.affiliate_referrals
      set store_id = new.store_id,
          activated_at = coalesce(activated_at, now()),
          ends_at = coalesce(ends_at, now() + make_interval(months => duration_months))
      where registration_request_id = new.id and store_id is null;
  end if;
  return new;
end;
$$;

create trigger guard_registration_activation_before_update
before update on public.commerce_registration_requests
for each row execute function public.guard_registration_activation();

create index affiliate_referrals_beneficiary_idx on public.affiliate_referrals(beneficiary_user_id, activated_at desc);
create index affiliate_referrals_store_window_idx on public.affiliate_referrals(store_id, activated_at, ends_at);

alter table public.affiliate_codes enable row level security;
alter table public.affiliate_referrals enable row level security;
revoke all on public.affiliate_codes, public.affiliate_referrals from public, anon, authenticated;
grant all on public.affiliate_codes, public.affiliate_referrals to service_role;
