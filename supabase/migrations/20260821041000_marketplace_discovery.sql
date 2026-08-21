-- Real product discovery for Marketplace. Aggregation stays in PostgreSQL and
-- only public catalog fields are returned to the server-side page loader.

create index if not exists order_items_product_id_idx
  on public.order_items (product_id)
  where product_id is not null;

create index if not exists products_marketplace_created_idx
  on public.products (created_at desc)
  where is_available is true;

create or replace function public.marketplace_discovery(p_limit integer default 12)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select greatest(4, least(coalesce(p_limit, 12), 24)) as item_limit
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
    join public.stores on stores.id = products.store_id
    where products.is_available is true
      and products.price_usd > 0
      and stores.is_active is true
      and stores.marketplace_visible is true
      and stores.is_test is not true
      and nullif(trim(stores.logo_url), '') is not null
      and lower(coalesce(stores.subscription_status, 'active')) not in ('expired', 'past_due', 'paused', 'cancelled')
      and (stores.trial_ends_at is null or stores.trial_ends_at >= now() or stores.plan_type <> 'trial')
      and (stores.subscription_ends_at is null or stores.subscription_ends_at >= now())
  ),
  offers as (
    select *
    from eligible_products
    where discount_percent > 0
    order by discount_percent desc, created_at desc
    limit (select item_limit from params)
  ),
  newest as (
    select *
    from eligible_products
    where created_at >= now() - interval '45 days'
    order by created_at desc
    limit (select item_limit from params)
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
      ) order by discount_percent desc, created_at desc)
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

revoke all on function public.marketplace_discovery(integer) from public, anon, authenticated;
grant execute on function public.marketplace_discovery(integer) to service_role;

comment on function public.marketplace_discovery(integer) is
  'Real offers, recent products and one weekly best seller per store with at least 10 units. Service-role only.';
