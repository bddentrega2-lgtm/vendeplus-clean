alter table public.store_delivery_settings
  add column if not exists delivery_promo_enabled boolean not null default false,
  add column if not exists delivery_promo_min_subtotal_usd numeric,
  add column if not exists delivery_promo_discount_type text not null default 'free',
  add column if not exists delivery_promo_discount_value numeric not null default 0;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'store_delivery_settings_pricing_check') then
    alter table public.store_delivery_settings
      drop constraint store_delivery_settings_pricing_check;
  end if;

  alter table public.store_delivery_settings
    add constraint store_delivery_settings_pricing_check
    check (pricing_type in ('fixed', 'fixed_distance', 'distance_ranges', 'zones', 'free_over_amount', 'manual'));

  if not exists (select 1 from pg_constraint where conname = 'store_delivery_settings_promo_discount_type_check') then
    alter table public.store_delivery_settings
      add constraint store_delivery_settings_promo_discount_type_check
      check (delivery_promo_discount_type in ('free', 'amount', 'percent'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'store_delivery_settings_promo_min_check') then
    alter table public.store_delivery_settings
      add constraint store_delivery_settings_promo_min_check
      check (delivery_promo_min_subtotal_usd is null or delivery_promo_min_subtotal_usd >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'store_delivery_settings_promo_value_check') then
    alter table public.store_delivery_settings
      add constraint store_delivery_settings_promo_value_check
      check (delivery_promo_discount_value >= 0);
  end if;
end $$;

update public.store_delivery_settings
set
  delivery_promo_enabled = true,
  delivery_promo_min_subtotal_usd = free_delivery_min_usd,
  delivery_promo_discount_type = 'free',
  delivery_promo_discount_value = 0
where free_delivery_min_usd is not null
  and free_delivery_min_usd > 0
  and delivery_promo_enabled = false;

alter table public.stores
  add column if not exists business_hours jsonb not null default '{}'::jsonb,
  add column if not exists manual_open_status text not null default 'auto',
  add column if not exists manual_open_note text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stores_manual_open_status_check') then
    alter table public.stores
      add constraint stores_manual_open_status_check
      check (manual_open_status in ('auto', 'open', 'closed'));
  end if;
end $$;

create index if not exists stores_manual_open_status_idx
  on public.stores(manual_open_status);
