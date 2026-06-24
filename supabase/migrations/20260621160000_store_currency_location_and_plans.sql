alter table public.stores
  add column if not exists base_currency text not null default 'USD',
  add column if not exists exchange_rate_source text,
  add column if not exists exchange_rate_updated_at timestamptz,
  add column if not exists location_link text,
  add column if not exists plan_type text not null default 'trial',
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists onboarding_seen_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stores_base_currency_check') then
    alter table public.stores
      add constraint stores_base_currency_check
      check (base_currency in ('USD', 'EUR'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'stores_plan_type_check') then
    alter table public.stores
      add constraint stores_plan_type_check
      check (plan_type in ('trial', 'emprendedor', 'visionario', 'founder'));
  end if;
end $$;

create index if not exists stores_plan_type_idx
  on public.stores(plan_type);

create index if not exists stores_trial_ends_at_idx
  on public.stores(trial_ends_at);

update public.stores
set
  trial_started_at = coalesce(trial_started_at, created_at, now()),
  trial_ends_at = coalesce(trial_ends_at, coalesce(created_at, now()) + interval '15 days')
where plan_type = 'trial';
