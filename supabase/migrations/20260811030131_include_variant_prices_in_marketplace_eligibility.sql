create or replace function public.marketplace_eligible_store_ids(p_store_ids uuid[])
returns table (store_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  select stores.id
  from public.stores
  where stores.id = any(p_store_ids)
    and nullif(trim(stores.logo_url), '') is not null
    and exists (
      select 1
      from public.products
      where products.store_id = stores.id
        and (
          products.price_usd > 0
          or exists (
            select 1
            from public.product_variants
            where product_variants.product_id = products.id
              and product_variants.is_available = true
              and product_variants.price_usd > 0
          )
        )
    );
$$;
