alter table public.products
  add column if not exists discount_percent numeric not null default 0;

alter table public.products
  drop constraint if exists products_discount_percent_check;

alter table public.products
  add constraint products_discount_percent_check
  check (discount_percent >= 0 and discount_percent <= 95);

create index if not exists products_store_discount_idx
  on public.products(store_id, discount_percent)
  where discount_percent > 0;
