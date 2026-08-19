drop index if exists public.stores_table_order_token_uidx;

alter table public.stores
  drop column if exists table_order_token;
