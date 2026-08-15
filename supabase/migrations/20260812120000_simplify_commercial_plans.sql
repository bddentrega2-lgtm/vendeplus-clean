-- Keep only the active Somos commercial models.
-- No rows currently use the removed legacy/custom values in production.

alter table public.stores drop constraint if exists stores_plan_type_check;

alter table public.stores add constraint stores_plan_type_check
  check (plan_type in ('trial', 'monthly', 'per_service', 'founder'));

comment on column public.stores.plan_type is
  'Billing model: public trial, public per-order service fee, private monthly agreement, or founder for test accounts.';
