-- Exchange-rate automation and public price display preferences.

alter table public.stores
  add column if not exists base_currency text not null default 'USD',
  add column if not exists show_prices_in_bs boolean not null default true,
  add column if not exists auto_update_exchange_rate boolean not null default true,
  add column if not exists exchange_rate_source text,
  add column if not exists exchange_rate_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'stores_base_currency_check'
      and conrelid = 'public.stores'::regclass
  ) then
    alter table public.stores
      add constraint stores_base_currency_check
      check (base_currency in ('USD', 'EUR'))
      not valid;
  end if;
end $$;

alter table public.stores validate constraint stores_base_currency_check;

update public.stores
set
  base_currency = coalesce(nullif(base_currency, ''), 'USD'),
  show_prices_in_bs = coalesce(show_prices_in_bs, true),
  auto_update_exchange_rate = coalesce(auto_update_exchange_rate, true);
