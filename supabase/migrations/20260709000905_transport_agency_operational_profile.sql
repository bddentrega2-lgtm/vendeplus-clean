alter table public.transport_agencies
  add column if not exists capacity_dimensions_cm text,
  add column if not exists capacity_weight_kg numeric,
  add column if not exists max_wait_time_minutes integer,
  add column if not exists charges_cash_return boolean not null default false,
  add column if not exists cash_return_fee_usd numeric not null default 0,
  add column if not exists additional_conditions text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transport_agencies_capacity_weight_check'
  ) then
    alter table public.transport_agencies
      add constraint transport_agencies_capacity_weight_check
      check (capacity_weight_kg is null or capacity_weight_kg >= 0) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'transport_agencies_wait_time_check'
  ) then
    alter table public.transport_agencies
      add constraint transport_agencies_wait_time_check
      check (max_wait_time_minutes is null or max_wait_time_minutes >= 0) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'transport_agencies_cash_return_fee_check'
  ) then
    alter table public.transport_agencies
      add constraint transport_agencies_cash_return_fee_check
      check (cash_return_fee_usd >= 0) not valid;
  end if;
end $$;
