alter table public.stores
  drop constraint if exists stores_plan_type_check;

alter table public.stores
  add constraint stores_plan_type_check
  check (plan_type in ('trial', 'monthly', 'per_service', 'emprendedor', 'visionario', 'founder'));

alter table public.store_subscription_payments
  alter column plan_type set default 'monthly';

update public.stores
set
  plan_type = 'monthly',
  monthly_price_usd = case
    when monthly_price_usd = 0 then 20
    else monthly_price_usd
  end
where plan_type in ('emprendedor', 'visionario');
