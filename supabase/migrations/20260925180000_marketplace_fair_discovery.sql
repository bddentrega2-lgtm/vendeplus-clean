create or replace function public.marketplace_discovery_v2(p_limit integer default 12)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select greatest(4, least(coalesce(p_limit, 12), 24)) as item_limit
  ),
  eligible_stores as (
    select stores.*
    from public.stores
    where stores.is_active is true
      and stores.marketplace_visible is true
      and stores.is_test is not true
      and nullif(trim(stores.logo_url), '') is not null
      and lower(coalesce(stores.subscription_status, 'active')) not in ('expired', 'past_due', 'paused', 'cancelled')
      and (stores.trial_ends_at is null or stores.trial_ends_at >= now() or stores.plan_type <> 'trial')
      and (stores.subscription_ends_at is null or stores.subscription_ends_at >= now())
  ),
  eligible_products as (
    select
      products.id as product_id,
      products.store_id,
      products.name as product_name,
      coalesce(products.description, '') as description,
      coalesce(products.image_url, stores.logo_url, stores.cover_image_url, '') as image_url,
      coalesce(products.price_usd, 0)::numeric as price_usd,
      greatest(0, least(coalesce(products.discount_percent, 0), 95))::numeric as discount_percent,
      products.created_at,
      stores.name as store_name,
      stores.slug as store_slug
    from public.products
    join eligible_stores stores on stores.id = products.store_id
    where products.is_available is true
      and products.price_usd > 0
  ),
  ranked_offers as (
    select
      eligible_products.*,
      row_number() over (
        partition by eligible_products.store_id
        order by eligible_products.discount_percent desc, eligible_products.created_at desc, eligible_products.product_id
      ) as store_rank
    from eligible_products
    where discount_percent > 0
  ),
  offers as (
    select *
    from ranked_offers
    where store_rank <= 2
    order by store_rank, discount_percent desc, created_at desc, product_id
    limit (select item_limit from params)
  ),
  new_store_candidates as (
    select
      stores.id as store_id,
      stores.created_at,
      count(products.id) as active_product_count
    from eligible_stores stores
    join public.products products
      on products.store_id = stores.id
      and products.is_available is true
      and products.price_usd > 0
    where stores.created_at >= now() - interval '30 days'
    group by stores.id, stores.created_at
    having count(products.id) >= 3
  ),
  new_stores as (
    select *
    from new_store_candidates
    order by created_at desc, md5(store_id::text || current_date::text)
    limit (select item_limit from params)
  ),
  ranked_new_store_products as (
    select
      eligible_products.*,
      row_number() over (
        partition by eligible_products.store_id
        order by eligible_products.created_at desc, eligible_products.product_id
      ) as product_rank
    from eligible_products
    join new_stores on new_stores.store_id = eligible_products.store_id
  ),
  newest as (
    select ranked_new_store_products.*
    from ranked_new_store_products
    join new_stores on new_stores.store_id = ranked_new_store_products.store_id
    where product_rank = 1
    order by new_stores.created_at desc, md5(ranked_new_store_products.store_id::text || current_date::text)
  ),
  weekly_sales as (
    select
      eligible_products.product_id,
      sum(order_items.quantity)::bigint as units_sold
    from eligible_products
    join public.order_items on order_items.product_id = eligible_products.product_id
    join public.orders on orders.id = order_items.order_id
    where orders.created_at >= now() - interval '7 days'
      and lower(coalesce(orders.status, '')) not in ('cancelled', 'canceled', 'cancelado')
    group by eligible_products.product_id
  ),
  ranked_weekly_products as (
    select
      eligible_products.*,
      weekly_sales.units_sold,
      row_number() over (
        partition by eligible_products.store_id
        order by weekly_sales.units_sold desc, eligible_products.product_name
      ) as store_rank
    from weekly_sales
    join eligible_products on eligible_products.product_id = weekly_sales.product_id
    where weekly_sales.units_sold >= 10
  ),
  best_sellers as (
    select *
    from ranked_weekly_products
    where store_rank = 1
    order by units_sold desc, product_name
    limit (select item_limit from params)
  )
  select jsonb_build_object(
    'offers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'productId', product_id, 'storeId', store_id, 'storeName', store_name,
        'storeSlug', store_slug, 'productName', product_name, 'description', description,
        'imageUrl', image_url, 'priceUsd', price_usd, 'discountPercent', discount_percent,
        'createdAt', created_at
      ) order by store_rank, discount_percent desc, created_at desc, product_id)
      from offers
    ), '[]'::jsonb),
    'bestSellers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'productId', product_id, 'storeId', store_id, 'storeName', store_name,
        'storeSlug', store_slug, 'productName', product_name, 'description', description,
        'imageUrl', image_url, 'priceUsd', price_usd, 'discountPercent', discount_percent,
        'createdAt', created_at, 'unitsSold', units_sold
      ) order by units_sold desc, product_name)
      from best_sellers
    ), '[]'::jsonb),
    'newStoreIds', coalesce((
      select jsonb_agg(store_id order by created_at desc, md5(store_id::text || current_date::text))
      from new_stores
    ), '[]'::jsonb),
    'newProducts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'productId', product_id, 'storeId', store_id, 'storeName', store_name,
        'storeSlug', store_slug, 'productName', product_name, 'description', description,
        'imageUrl', image_url, 'priceUsd', price_usd, 'discountPercent', discount_percent,
        'createdAt', created_at
      ) order by created_at desc)
      from newest
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.marketplace_discovery_v2(integer) from public, anon, authenticated;
grant execute on function public.marketplace_discovery_v2(integer) to service_role;

comment on function public.marketplace_discovery_v2(integer) is
  'Fair Marketplace discovery: up to two offers per store, one best seller per store and one representative product per new store.';
