create table if not exists public.product_option_value_variant_prices (
  id uuid primary key default gen_random_uuid(),
  option_value_id uuid not null references public.product_option_values(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  price_delta_usd numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_option_value_variant_prices_unique unique (option_value_id, variant_id),
  constraint product_option_value_variant_prices_price_check check (price_delta_usd >= 0)
);

create index if not exists product_option_value_variant_prices_value_idx
  on public.product_option_value_variant_prices(option_value_id);

create index if not exists product_option_value_variant_prices_variant_idx
  on public.product_option_value_variant_prices(variant_id);

alter table public.product_option_value_variant_prices enable row level security;

drop policy if exists "Public can read option value variant prices"
  on public.product_option_value_variant_prices;

create policy "Public can read option value variant prices"
  on public.product_option_value_variant_prices
  for select
  using (
    exists (
      select 1
      from public.product_option_values values
      join public.product_option_groups groups
        on groups.id = values.option_group_id
      join public.product_variants variants
        on variants.id = product_option_value_variant_prices.variant_id
      where values.id = product_option_value_variant_prices.option_value_id
        and values.is_active is true
        and groups.is_active is true
        and variants.is_available is true
    )
  );

grant select on public.product_option_value_variant_prices to anon, authenticated;
