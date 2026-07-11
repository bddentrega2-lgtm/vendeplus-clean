alter table public.stores
  add column if not exists subscription_status text not null default 'trial',
  add column if not exists subscription_started_at timestamptz,
  add column if not exists subscription_ends_at timestamptz,
  add column if not exists next_payment_due_at timestamptz,
  add column if not exists monthly_price_usd numeric not null default 0,
  add column if not exists billing_notes text,
  add column if not exists last_payment_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stores_subscription_status_check') then
    alter table public.stores
      add constraint stores_subscription_status_check
      check (subscription_status in ('trial', 'active', 'past_due', 'paused', 'cancelled', 'expired'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'stores_monthly_price_usd_check') then
    alter table public.stores
      add constraint stores_monthly_price_usd_check
      check (monthly_price_usd >= 0);
  end if;
end $$;

update public.stores
set
  subscription_status = case
    when is_active = false then 'paused'
    when plan_type = 'trial' and trial_ends_at is not null and trial_ends_at < now() then 'expired'
    when plan_type = 'trial' then 'trial'
    else 'active'
  end,
  subscription_started_at = coalesce(subscription_started_at, trial_started_at, created_at, now()),
  subscription_ends_at = coalesce(subscription_ends_at, trial_ends_at),
  next_payment_due_at = coalesce(next_payment_due_at, trial_ends_at),
  monthly_price_usd = case
    when plan_type = 'visionario' and monthly_price_usd = 0 then 20
    when plan_type = 'emprendedor' and monthly_price_usd = 0 then 10
    else monthly_price_usd
  end
where subscription_started_at is null
  or subscription_ends_at is null
  or next_payment_due_at is null
  or monthly_price_usd = 0;

create index if not exists stores_subscription_status_idx
  on public.stores(subscription_status);

create index if not exists stores_next_payment_due_at_idx
  on public.stores(next_payment_due_at);
