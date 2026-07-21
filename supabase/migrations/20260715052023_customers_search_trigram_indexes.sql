-- Speed up customer/recompra searches by name and phone.

create extension if not exists pg_trgm with schema extensions;

create index if not exists customers_name_trgm_idx
  on public.customers
  using gin (name extensions.gin_trgm_ops);

create index if not exists customers_phone_trgm_idx
  on public.customers
  using gin (phone extensions.gin_trgm_ops);

create index if not exists customers_phone_normalized_trgm_idx
  on public.customers
  using gin (phone_normalized extensions.gin_trgm_ops);
