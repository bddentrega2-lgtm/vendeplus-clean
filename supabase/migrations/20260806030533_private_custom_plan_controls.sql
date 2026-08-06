alter table public.stores
  add column if not exists product_limit integer;

alter table public.stores drop constraint if exists stores_plan_type_check;
alter table public.stores add constraint stores_plan_type_check
  check (plan_type in ('trial', 'monthly', 'per_service', 'custom', 'emprendedor', 'visionario', 'founder'));

alter table public.stores drop constraint if exists stores_product_limit_check;
alter table public.stores add constraint stores_product_limit_check
  check (product_limit is null or product_limit between 1 and 10000);

update public.stores
set product_limit = coalesce(product_limit, case when plan_type = 'founder' then 9999 else 50 end);

comment on column public.stores.product_limit is
  'Maximum products allowed for this store. Customizable only by founder/admin.';
