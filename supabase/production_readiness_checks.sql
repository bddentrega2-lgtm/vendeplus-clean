-- VendeMas production readiness checks.
-- Read-only: run this in the Supabase SQL Editor before enabling real merchants.
-- Some Supabase projects do not expose CLI migration history in SQL Editor.
-- If migration_history.status is "not_available", use required_column checks as the source of truth.

select
  'migration_history' as check_name,
  'supabase_migrations.schema_migrations' as table_name,
  case
    when to_regclass('supabase_migrations.schema_migrations') is null then 'not_available'
    else 'available'
  end as status;

with required_columns(table_name, column_name) as (
  values
    ('stores', 'subscription_status'),
    ('stores', 'subscription_started_at'),
    ('stores', 'subscription_ends_at'),
    ('stores', 'next_payment_due_at'),
    ('stores', 'monthly_price_usd'),
    ('stores', 'billing_notes'),
    ('stores', 'last_payment_at'),
    ('stores', 'base_currency'),
    ('stores', 'show_prices_in_bs'),
    ('stores', 'auto_update_exchange_rate'),
    ('stores', 'exchange_rate_source'),
    ('stores', 'exchange_rate_updated_at'),
    ('stores', 'accepts_delivery'),
    ('stores', 'accepts_pickup'),
    ('store_subscription_payments', 'payment_bank'),
    ('store_subscription_payments', 'paid_at'),
    ('orders', 'payment_status'),
    ('orders', 'delivery_status'),
    ('orders', 'customer_phone_normalized')
)
select
  'required_column' as check_name,
  required_columns.table_name,
  required_columns.column_name,
  (columns.column_name is not null) as ok
from required_columns
left join information_schema.columns columns
  on columns.table_schema = 'public'
  and columns.table_name = required_columns.table_name
  and columns.column_name = required_columns.column_name
order by required_columns.table_name, required_columns.column_name;

select
  'rls_enabled' as check_name,
  classes.relname as table_name,
  classes.relrowsecurity as ok
from pg_class classes
join pg_namespace namespaces
  on namespaces.oid = classes.relnamespace
where namespaces.nspname = 'public'
  and classes.relkind = 'r'
  and classes.relname in (
    'stores',
    'store_users',
    'products',
    'categories',
    'orders',
    'order_items',
    'order_item_options',
    'customers',
    'store_delivery_settings',
    'store_delivery_zones',
    'store_delivery_distance_rates',
    'order_integrations',
    'store_subscription_payments'
  )
order by classes.relname;

with required_public_grants(table_name, grantee) as (
  select table_name, grantee
  from (
    values
      ('stores'),
      ('products'),
      ('categories'),
      ('store_delivery_settings'),
      ('store_delivery_zones'),
      ('store_delivery_distance_rates'),
      ('product_option_groups'),
      ('product_option_values'),
      ('product_option_group_products')
  ) as tables(table_name)
  cross join (
    values
      ('anon'),
      ('authenticated')
  ) as roles(grantee)
)
select
  'public_read_grant' as check_name,
  required_public_grants.table_name,
  required_public_grants.grantee,
  exists (
    select 1
    from information_schema.role_table_grants grants
    where grants.table_schema = 'public'
      and grants.table_name = required_public_grants.table_name
      and grants.grantee = required_public_grants.grantee
      and grants.privilege_type = 'SELECT'
  ) as ok
from required_public_grants
order by required_public_grants.table_name, required_public_grants.grantee;

select
  'private_table_not_exposed' as check_name,
  private_tables.table_name,
  not exists (
    select 1
    from information_schema.role_table_grants grants
    where grants.table_schema = 'public'
      and grants.table_name = private_tables.table_name
      and grants.grantee in ('anon', 'authenticated')
      and grants.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  ) as ok
from (
  values
    ('customers'),
    ('order_integrations'),
    ('order_item_options'),
    ('store_subscription_payments')
) as private_tables(table_name)
order by private_tables.table_name;

select
  'subscription_payments_table' as check_name,
  exists (
    select 1
    from information_schema.tables tables
    where tables.table_schema = 'public'
      and tables.table_name = 'store_subscription_payments'
  ) as ok;

select
  'storage_bucket' as check_name,
  'product-images' as bucket_name,
  exists (
    select 1
    from storage.buckets buckets
    where buckets.id = 'product-images'
      and buckets.public = true
  ) as ok;

select
  'delivery_settings_missing' as check_name,
  count(*) as active_stores_without_settings,
  count(*) = 0 as ok
from public.stores stores
where stores.is_active is true
  and not exists (
    select 1
    from public.store_delivery_settings settings
    where settings.store_id = stores.id
  );
