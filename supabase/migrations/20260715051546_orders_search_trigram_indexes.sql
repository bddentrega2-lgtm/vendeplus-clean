-- Speed up panel order searches that use ilike '%text%' across growing order history.
-- Kept intentionally narrow to the fields exposed in /api/panel/orders search.

create extension if not exists pg_trgm with schema extensions;

create index if not exists orders_public_code_trgm_idx
  on public.orders
  using gin (public_code extensions.gin_trgm_ops);

create index if not exists orders_customer_name_trgm_idx
  on public.orders
  using gin (customer_name extensions.gin_trgm_ops);

create index if not exists orders_customer_phone_trgm_idx
  on public.orders
  using gin (customer_phone extensions.gin_trgm_ops);

create index if not exists orders_payment_method_trgm_idx
  on public.orders
  using gin (payment_method extensions.gin_trgm_ops);

create index if not exists orders_delivery_reference_trgm_idx
  on public.orders
  using gin (delivery_reference extensions.gin_trgm_ops);
