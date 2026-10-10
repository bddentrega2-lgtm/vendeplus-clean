alter table public.stores
  alter column product_limit set default 50;

update public.stores
set product_limit = 50
where coalesce(product_limit, 0) < 50;
