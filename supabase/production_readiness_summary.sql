-- VendeMas production readiness summary.
-- Read-only: returns one result set so Supabase CLI and SQL Editor show every check together.

with checks as (
  select
    'migration_history_available' as check_name,
    'supabase_migrations.schema_migrations' as target,
    to_regclass('supabase_migrations.schema_migrations') is not null as ok,
    case
      when to_regclass('supabase_migrations.schema_migrations') is null
        then 'not_available'
      else 'available'
    end as details

  union all

  select
    'required_column' as check_name,
    required_columns.table_name || '.' || required_columns.column_name as target,
    columns.column_name is not null as ok,
    case when columns.column_name is not null then 'present' else 'missing' end as details
  from (
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
  ) as required_columns(table_name, column_name)
  left join information_schema.columns columns
    on columns.table_schema = 'public'
    and columns.table_name = required_columns.table_name
    and columns.column_name = required_columns.column_name

  union all

  select
    'rls_enabled' as check_name,
    classes.relname as target,
    classes.relrowsecurity as ok,
    case when classes.relrowsecurity then 'enabled' else 'disabled' end as details
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

  union all

  select
    'public_read_grant' as check_name,
    required_public_grants.table_name || ':' || required_public_grants.grantee as target,
    exists (
      select 1
      from information_schema.role_table_grants grants
      where grants.table_schema = 'public'
        and grants.table_name = required_public_grants.table_name
        and grants.grantee = required_public_grants.grantee
        and grants.privilege_type = 'SELECT'
    ) as ok,
    'select grant expected' as details
  from (
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
  ) as required_public_grants

  union all

  select
    'private_table_not_exposed' as check_name,
    private_tables.table_name as target,
    not exists (
      select 1
      from information_schema.role_table_grants grants
      where grants.table_schema = 'public'
        and grants.table_name = private_tables.table_name
        and grants.grantee in ('anon', 'authenticated')
        and grants.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
    ) as ok,
    'no anon/authenticated direct grants expected' as details
  from (
    values
      ('customers'),
      ('order_integrations'),
      ('order_item_options'),
      ('store_subscription_payments')
  ) as private_tables(table_name)

  union all

  select
    'storage_bucket' as check_name,
    'product-images' as target,
    exists (
      select 1
      from storage.buckets buckets
      where buckets.id = 'product-images'
        and buckets.public = true
    ) as ok,
    'public bucket expected' as details

  union all

  select
    'delivery_settings_missing' as check_name,
    'active stores without settings' as target,
    count(*) = 0 as ok,
    count(*)::text as details
  from public.stores stores
  where stores.is_active is true
    and not exists (
      select 1
      from public.store_delivery_settings settings
      where settings.store_id = stores.id
    )
)
select *
from checks
order by ok, check_name, target;
