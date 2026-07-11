-- Harden public order writes/reads and fix mutable search_path on trigger function.
-- Public checkout must go through /api/orders, where prices and delivery are recalculated server-side.

create or replace function public.set_store_subscription_payments_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table if exists public.orders enable row level security;
alter table if exists public.order_items enable row level security;

drop policy if exists "Public can create orders" on public.orders;
drop policy if exists "Panel demo can read orders" on public.orders;
drop policy if exists "Public can create order items" on public.order_items;
drop policy if exists "Panel demo can read order items" on public.order_items;

revoke select, insert, update, delete on public.orders from anon, authenticated;
revoke select, insert, update, delete on public.order_items from anon, authenticated;
