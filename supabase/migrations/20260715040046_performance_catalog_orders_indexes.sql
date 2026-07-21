-- Performance indexes for public catalog, checkout validation, and order detail reads.
-- Non-destructive and safe to re-run through Supabase migrations.

create index if not exists products_store_available_sort_idx
  on public.products (store_id, is_available, sort_order, name);

create index if not exists products_store_category_sort_idx
  on public.products (store_id, category_id, sort_order, name);

create index if not exists categories_store_active_sort_idx
  on public.categories (store_id, is_active, sort_order, name);

create index if not exists product_images_product_active_sort_idx
  on public.product_images (product_id, is_active, sort_order);

create index if not exists product_variants_product_available_sort_idx
  on public.product_variants (product_id, is_available, sort_order);

create index if not exists order_items_order_id_idx
  on public.order_items (order_id);

create index if not exists store_users_user_store_idx
  on public.store_users (user_id, store_id);
