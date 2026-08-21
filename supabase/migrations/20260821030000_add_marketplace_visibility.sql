alter table public.stores
  add column if not exists marketplace_visible boolean not null default true;

comment on column public.stores.marketplace_visible is
  'Controls discovery in the Somos marketplace. Direct catalog links remain available.';

update public.stores
set
  payment_methods = '["Efectivo"]'::jsonb,
  is_active = true,
  marketplace_visible = false
where slug in (
  'pasteleria-tdk',
  'pasteleria-tdk-delicias',
  'pasteleria-tdk-los-cedros'
);

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
    and stores.marketplace_visible is true
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

revoke all on function public.marketplace_eligible_store_ids(uuid[]) from public;
grant execute on function public.marketplace_eligible_store_ids(uuid[]) to anon, authenticated, service_role;
