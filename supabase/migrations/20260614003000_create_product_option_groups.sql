create table if not exists public.product_option_groups (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  description text,
  selection_type text not null default 'single',
  required boolean not null default false,
  min_select integer not null default 0,
  max_select integer not null default 1,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_option_groups_selection_type_check
    check (selection_type in ('single', 'multiple')),
  constraint product_option_groups_min_select_check check (min_select >= 0),
  constraint product_option_groups_max_select_check check (max_select >= 0),
  constraint product_option_groups_select_range_check check (max_select = 0 or max_select >= min_select)
);

create table if not exists public.product_option_values (
  id uuid primary key default gen_random_uuid(),
  option_group_id uuid not null references public.product_option_groups(id) on delete cascade,
  name text not null,
  description text,
  price_delta_usd numeric not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_option_values_price_delta_check check (price_delta_usd >= 0)
);

create table if not exists public.product_option_group_products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  option_group_id uuid not null references public.product_option_groups(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_option_group_products_unique unique (product_id, option_group_id)
);

create table if not exists public.order_item_options (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  option_group_name text not null,
  option_name text not null,
  price_delta_usd numeric not null default 0,
  quantity integer not null default 1,
  created_at timestamptz not null default now(),
  constraint order_item_options_quantity_check check (quantity > 0),
  constraint order_item_options_price_delta_check check (price_delta_usd >= 0)
);

create index if not exists product_option_groups_store_idx
  on public.product_option_groups(store_id, is_active, sort_order);

create index if not exists product_option_values_group_idx
  on public.product_option_values(option_group_id, is_active, sort_order);

create index if not exists product_option_group_products_store_idx
  on public.product_option_group_products(store_id);

create index if not exists product_option_group_products_product_idx
  on public.product_option_group_products(product_id, sort_order);

create index if not exists product_option_group_products_group_idx
  on public.product_option_group_products(option_group_id);

create index if not exists order_item_options_order_item_idx
  on public.order_item_options(order_item_id);

alter table public.product_option_groups enable row level security;
alter table public.product_option_values enable row level security;
alter table public.product_option_group_products enable row level security;
alter table public.order_item_options enable row level security;

create policy "Public can read active option groups"
  on public.product_option_groups
  for select
  using (is_active = true);

create policy "Public can read active option values"
  on public.product_option_values
  for select
  using (is_active = true);

create policy "Public can read product option assignments"
  on public.product_option_group_products
  for select
  using (true);
