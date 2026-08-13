alter table public.orders
  add column if not exists idempotency_key text;

create unique index if not exists orders_store_idempotency_key_idx
  on public.orders (store_id, idempotency_key)
  where idempotency_key is not null;
