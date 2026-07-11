-- Add billing currency preference for transport agencies.

alter table public.transport_agencies
  add column if not exists billing_currency text not null default 'USD';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transport_agencies_billing_currency_check'
  ) then
    alter table public.transport_agencies
      add constraint transport_agencies_billing_currency_check
      check (billing_currency in ('USD', 'EUR'));
  end if;
end $$;

update public.transport_agencies
set billing_currency = coalesce(nullif(billing_currency, ''), 'USD')
where billing_currency is null or billing_currency = '';
