-- Read-only catalog inspection. Does not query customers/orders or invoke business RPCs.
with required_columns(schema_name, table_name, column_name) as (
  values
    ('auth', 'users', 'id'), ('auth', 'users', 'email'),
    ('public', 'stores', 'id'), ('public', 'stores', 'name'),
    ('public', 'stores', 'slug'), ('public', 'stores', 'logo_url'),
    ('public', 'store_users', 'store_id'), ('public', 'store_users', 'user_id'),
    ('public', 'orders', 'id'), ('public', 'orders', 'store_id'),
    ('public', 'orders', 'status'), ('public', 'orders', 'public_code'),
    ('public', 'orders', 'created_at'), ('public', 'orders', 'total_usd'),
    ('public', 'orders', 'delivery_type'),
    ('public', 'order_items', 'id'), ('public', 'order_items', 'order_id'),
    ('public', 'order_items', 'product_name'), ('public', 'order_items', 'quantity'),
    ('public', 'order_items', 'unit_price_usd'), ('public', 'order_items', 'total_usd'),
    ('public', 'order_items', 'variant_name'),
    ('public', 'order_item_options', 'order_item_id'),
    ('public', 'order_item_options', 'option_name'),
    ('public', 'order_item_options', 'quantity'),
    ('public', 'order_item_options', 'price_delta_usd')
), missing_columns as (
  select r.schema_name || '.' || r.table_name || '.' || r.column_name as name
  from required_columns r
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema = r.schema_name and c.table_name = r.table_name
      and c.column_name = r.column_name
  )
), functions(name) as (
  values ('public.create_order_atomic(jsonb,jsonb)'),
    ('public.create_buyer_order_atomic(jsonb,jsonb,uuid)'),
    ('public.save_buyer_store_review(uuid,uuid,integer)'),
    ('public.buyer_store_rating_summaries(uuid[])')
)
select jsonb_build_object(
  'missing_required_columns', coalesce((select jsonb_agg(name order by name) from missing_columns), '[]'::jsonb),
  'buyer_tables', jsonb_build_object(
    'buyer_order_accounts', to_regclass('public.buyer_order_accounts') is not null,
    'buyer_store_reviews', to_regclass('public.buyer_store_reviews') is not null
  ),
  'functions', (select jsonb_agg(jsonb_build_object(
    'name', f.name,
    'present', p.oid is not null,
    'definition_md5', case when p.oid is not null then md5(pg_get_functiondef(p.oid)) end,
    'security_definer', p.prosecdef,
    'anon_execute', has_function_privilege('anon', p.oid, 'EXECUTE'),
    'authenticated_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
    'service_execute', has_function_privilege('service_role', p.oid, 'EXECUTE')
  ) order by f.name) from functions f left join pg_proc p on p.oid = to_regprocedure(f.name)),
  'buyer_rls', coalesce((select jsonb_agg(jsonb_build_object('table', c.relname, 'enabled', c.relrowsecurity))
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in ('buyer_order_accounts', 'buyer_store_reviews')), '[]'::jsonb)
) as readiness;
