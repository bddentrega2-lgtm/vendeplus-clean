-- Freeze the production RLS posture for public tenant data.
--
-- Intent:
-- 1) Every public tenant/business table has RLS enabled in migrations.
-- 2) Browser roles only receive direct SELECT on tables that are intentionally public
--    for catalog/checkout discovery.
-- 3) All writes stay behind server APIs using the service role and server-side validation.

alter table if exists public.stores enable row level security;
alter table if exists public.store_users enable row level security;
alter table if exists public.categories enable row level security;
alter table if exists public.products enable row level security;
alter table if exists public.product_variants enable row level security;
alter table if exists public.product_option_groups enable row level security;
alter table if exists public.product_option_values enable row level security;
alter table if exists public.product_option_group_products enable row level security;
alter table if exists public.product_option_value_variant_prices enable row level security;
alter table if exists public.orders enable row level security;
alter table if exists public.order_items enable row level security;
alter table if exists public.order_item_options enable row level security;
alter table if exists public.order_integrations enable row level security;
alter table if exists public.customers enable row level security;
alter table if exists public.store_delivery_settings enable row level security;
alter table if exists public.store_delivery_zones enable row level security;
alter table if exists public.store_delivery_distance_rates enable row level security;
alter table if exists public.store_subscription_payments enable row level security;
alter table if exists public.transport_agencies enable row level security;
alter table if exists public.transport_agency_users enable row level security;
alter table if exists public.transport_agency_rates enable row level security;
alter table if exists public.transport_agency_zones enable row level security;
alter table if exists public.transport_agency_distance_rates enable row level security;
alter table if exists public.store_transport_agency_requests enable row level security;
alter table if exists public.store_transport_agency_connections enable row level security;
alter table if exists public.transport_orders enable row level security;
alter table if exists public.transport_order_events enable row level security;
alter table if exists public.transport_agency_weekly_statements enable row level security;

-- Remove accidental broad table privileges from browser roles.
revoke all privileges on table public.stores from anon, authenticated;
revoke all privileges on table public.store_users from anon, authenticated;
revoke all privileges on table public.categories from anon, authenticated;
revoke all privileges on table public.products from anon, authenticated;
revoke all privileges on table public.product_variants from anon, authenticated;
revoke all privileges on table public.product_option_groups from anon, authenticated;
revoke all privileges on table public.product_option_values from anon, authenticated;
revoke all privileges on table public.product_option_group_products from anon, authenticated;
revoke all privileges on table public.product_option_value_variant_prices from anon, authenticated;
revoke all privileges on table public.orders from anon, authenticated;
revoke all privileges on table public.order_items from anon, authenticated;
revoke all privileges on table public.order_item_options from anon, authenticated;
revoke all privileges on table public.order_integrations from anon, authenticated;
revoke all privileges on table public.customers from anon, authenticated;
revoke all privileges on table public.store_delivery_settings from anon, authenticated;
revoke all privileges on table public.store_delivery_zones from anon, authenticated;
revoke all privileges on table public.store_delivery_distance_rates from anon, authenticated;
revoke all privileges on table public.store_subscription_payments from anon, authenticated;
revoke all privileges on table public.transport_agencies from anon, authenticated;
revoke all privileges on table public.transport_agency_users from anon, authenticated;
revoke all privileges on table public.transport_agency_rates from anon, authenticated;
revoke all privileges on table public.transport_agency_zones from anon, authenticated;
revoke all privileges on table public.transport_agency_distance_rates from anon, authenticated;
revoke all privileges on table public.store_transport_agency_requests from anon, authenticated;
revoke all privileges on table public.store_transport_agency_connections from anon, authenticated;
revoke all privileges on table public.transport_orders from anon, authenticated;
revoke all privileges on table public.transport_order_events from anon, authenticated;
revoke all privileges on table public.transport_agency_weekly_statements from anon, authenticated;

-- Keep direct reads only for public storefront/marketplace data.
grant select on table public.stores to anon, authenticated;
grant select on table public.categories to anon, authenticated;
grant select on table public.products to anon, authenticated;
grant select on table public.product_variants to anon, authenticated;
grant select on table public.product_option_groups to anon, authenticated;
grant select on table public.product_option_values to anon, authenticated;
grant select on table public.product_option_group_products to anon, authenticated;
grant select on table public.product_option_value_variant_prices to anon, authenticated;
grant select on table public.store_delivery_settings to anon, authenticated;
grant select on table public.store_delivery_zones to anon, authenticated;
grant select on table public.store_delivery_distance_rates to anon, authenticated;
grant select on table public.transport_agencies to anon, authenticated;
grant select on table public.transport_agency_rates to anon, authenticated;
grant select on table public.transport_agency_zones to anon, authenticated;
grant select on table public.transport_agency_distance_rates to anon, authenticated;

drop policy if exists "Public can read active stores" on public.stores;
create policy "Public can read active stores"
  on public.stores
  for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "Public can read active categories" on public.categories;
create policy "Public can read active categories"
  on public.categories
  for select
  to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1
      from public.stores
      where stores.id = categories.store_id
        and stores.is_active = true
    )
  );

drop policy if exists "Public can read available products" on public.products;
create policy "Public can read available products"
  on public.products
  for select
  to anon, authenticated
  using (
    is_available = true
    and exists (
      select 1
      from public.stores
      where stores.id = products.store_id
        and stores.is_active = true
    )
  );

drop policy if exists "Public can read available variants" on public.product_variants;
create policy "Public can read available variants"
  on public.product_variants
  for select
  to anon, authenticated
  using (
    is_available = true
    and exists (
      select 1
      from public.products
      join public.stores on stores.id = products.store_id
      where products.id = product_variants.product_id
        and products.is_available = true
        and stores.is_active = true
    )
  );

drop policy if exists "Public can read active option groups" on public.product_option_groups;
create policy "Public can read active option groups"
  on public.product_option_groups
  for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "Public can read active option values" on public.product_option_values;
create policy "Public can read active option values"
  on public.product_option_values
  for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "Public can read product option assignments" on public.product_option_group_products;
create policy "Public can read product option assignments"
  on public.product_option_group_products
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can read option value variant prices" on public.product_option_value_variant_prices;
create policy "Public can read option value variant prices"
  on public.product_option_value_variant_prices
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.product_option_values option_values
      join public.product_option_groups groups on groups.id = option_values.option_group_id
      join public.product_variants variants on variants.id = product_option_value_variant_prices.variant_id
      where option_values.id = product_option_value_variant_prices.option_value_id
        and option_values.is_active is true
        and groups.is_active is true
        and variants.is_available is true
    )
  );

drop policy if exists "Customers are readable through server APIs" on public.customers;
create policy "Customers are readable through server APIs"
  on public.customers
  for select
  to anon, authenticated
  using (false);

drop policy if exists "Public can read delivery settings" on public.store_delivery_settings;
create policy "Public can read delivery settings"
  on public.store_delivery_settings
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can read active delivery zones" on public.store_delivery_zones;
create policy "Public can read active delivery zones"
  on public.store_delivery_zones
  for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "Public can read active delivery rates" on public.store_delivery_distance_rates;
create policy "Public can read active delivery rates"
  on public.store_delivery_distance_rates
  for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "Public can read active transport agencies" on public.transport_agencies;
create policy "Public can read active transport agencies"
  on public.transport_agencies
  for select
  to anon, authenticated
  using (status = 'active'::text and is_active = true);

drop policy if exists "Public can read active transport agency rates" on public.transport_agency_rates;
create policy "Public can read active transport agency rates"
  on public.transport_agency_rates
  for select
  to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1
      from public.transport_agencies agency
      where agency.id = transport_agency_rates.agency_id
        and agency.status = 'active'::text
        and agency.is_active = true
    )
  );

drop policy if exists "Public can read active transport agency zones" on public.transport_agency_zones;
create policy "Public can read active transport agency zones"
  on public.transport_agency_zones
  for select
  to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1
      from public.transport_agencies agency
      where agency.id = transport_agency_zones.agency_id
        and agency.status = 'active'::text
        and agency.is_active = true
    )
  );

drop policy if exists "Public can read active transport agency distance rates" on public.transport_agency_distance_rates;
create policy "Public can read active transport agency distance rates"
  on public.transport_agency_distance_rates
  for select
  to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1
      from public.transport_agencies agency
      where agency.id = transport_agency_distance_rates.agency_id
        and agency.status = 'active'::text
        and agency.is_active = true
    )
  );

drop policy if exists "transport_orders_authenticated_none" on public.transport_orders;
create policy "transport_orders_authenticated_none"
  on public.transport_orders
  for all
  to authenticated
  using (false)
  with check (false);

drop policy if exists "transport_order_events_authenticated_none" on public.transport_order_events;
create policy "transport_order_events_authenticated_none"
  on public.transport_order_events
  for all
  to authenticated
  using (false)
  with check (false);
