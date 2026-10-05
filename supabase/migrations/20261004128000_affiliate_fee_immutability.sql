create or replace function public.guard_affiliate_fee_payment()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.status = 'approved' and exists
    (select 1 from public.affiliate_fee_allocations where payment_id = old.id)
    and (new.status is distinct from old.status or new.store_id is distinct from old.store_id or
      new.plan_type is distinct from old.plan_type or new.amount_usd is distinct from old.amount_usd or
      new.created_at is distinct from old.created_at)
  then raise exception 'Un fee conciliado no puede reescribirse; registra un ajuste'; end if;
  return new;
end;
$$;
create trigger guard_affiliate_fee_payment_before_update
before update on public.store_subscription_payments
for each row execute function public.guard_affiliate_fee_payment();

create or replace function public.guard_allocated_order_fee()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.platform_service_fee_usd is distinct from old.platform_service_fee_usd and exists
    (select 1 from public.affiliate_fee_allocations where order_id = old.id)
  then raise exception 'El fee conciliado del pedido no puede modificarse'; end if;
  return new;
end;
$$;
create trigger guard_allocated_order_fee_before_update
before update of platform_service_fee_usd on public.orders
for each row execute function public.guard_allocated_order_fee();
