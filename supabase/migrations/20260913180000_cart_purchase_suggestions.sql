alter table public.products
  add column if not exists is_cart_suggestion boolean not null default false;

create index if not exists products_cart_suggestions_idx
  on public.products (store_id, is_available, is_cart_suggestion, sort_order)
  where is_cart_suggestion = true;
