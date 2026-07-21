create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint product_images_sort_order_check check (sort_order between 0 and 1),
  constraint product_images_product_sort_unique unique (product_id, sort_order)
);

create index if not exists product_images_store_product_idx
  on public.product_images (store_id, product_id);

alter table public.product_images enable row level security;
revoke all privileges on table public.product_images from anon, authenticated;
grant select on table public.product_images to anon, authenticated;
grant all privileges on table public.product_images to service_role;

drop policy if exists "Public can read active product gallery images" on public.product_images;
create policy "Public can read active product gallery images"
  on public.product_images for select to anon, authenticated
  using (
    is_active = true and exists (
      select 1 from public.products
      join public.stores on stores.id = products.store_id
      where products.id = product_images.product_id
        and products.store_id = product_images.store_id
        and products.is_available is not false
        and stores.is_active = true
    )
  );

alter table public.stores
  add column if not exists service_fee_payer text not null default 'merchant',
  add column if not exists service_fee_billing_cycle text not null default 'monthly';

alter table public.orders
  add column if not exists platform_service_fee_usd numeric not null default 0,
  add column if not exists platform_service_fee_payer text,
  add column if not exists platform_service_fee_customer_usd numeric not null default 0,
  add column if not exists platform_service_fee_billing_cycle text;

alter table public.stores drop constraint if exists stores_service_fee_payer_check;
alter table public.stores add constraint stores_service_fee_payer_check
  check (service_fee_payer in ('merchant', 'customer'));
alter table public.stores drop constraint if exists stores_service_fee_billing_cycle_check;
alter table public.stores add constraint stores_service_fee_billing_cycle_check
  check (service_fee_billing_cycle in ('weekly', 'monthly'));

alter table public.orders drop constraint if exists orders_platform_service_fee_payer_check;
alter table public.orders add constraint orders_platform_service_fee_payer_check
  check (platform_service_fee_payer is null or platform_service_fee_payer in ('merchant', 'customer'));
alter table public.orders drop constraint if exists orders_platform_service_fee_billing_cycle_check;
alter table public.orders add constraint orders_platform_service_fee_billing_cycle_check
  check (platform_service_fee_billing_cycle is null or platform_service_fee_billing_cycle in ('weekly', 'monthly'));

create index if not exists orders_store_service_fee_created_idx
  on public.orders (store_id, created_at desc)
  where platform_service_fee_usd > 0;

create or replace function public.store_service_fee_balance(p_store_id uuid)
returns table (period_start timestamptz, billing_cycle text, orders_count bigint, amount_usd numeric)
language sql stable set search_path = public
as $$
  with config as (
    select service_fee_billing_cycle as cycle,
      case when service_fee_billing_cycle = 'weekly'
        then date_trunc('week', timezone('America/Caracas', now())) at time zone 'America/Caracas'
        else date_trunc('month', timezone('America/Caracas', now())) at time zone 'America/Caracas'
      end as starts_at
    from public.stores where id = p_store_id
  )
  select config.starts_at, config.cycle, count(orders.id)::bigint,
    coalesce(sum(orders.platform_service_fee_usd), 0)::numeric
  from config left join public.orders
    on orders.store_id = p_store_id
    and orders.created_at >= config.starts_at
    and orders.status <> 'cancelled'
    and orders.platform_service_fee_usd > 0
  group by config.starts_at, config.cycle;
$$;

revoke all on function public.store_service_fee_balance(uuid) from public, anon, authenticated;
grant execute on function public.store_service_fee_balance(uuid) to service_role;
