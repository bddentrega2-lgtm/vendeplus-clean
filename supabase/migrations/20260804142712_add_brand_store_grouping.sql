-- Groups operational stores under one commercial brand without changing the
-- existing store-level order, catalog, delivery, payment, or access model.
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stores
  add column if not exists brand_id uuid references public.brands(id) on delete set null,
  add column if not exists branch_name text;

create index if not exists stores_brand_id_name_idx
  on public.stores (brand_id, name)
  where brand_id is not null;

alter table public.brands enable row level security;

-- Brand data is managed through authenticated server APIs. Keeping direct Data
-- API access closed prevents users from discovering brands outside their stores.
revoke all on table public.brands from anon, authenticated;

comment on table public.brands is
  'Commercial brands that group independently operated stores/branches.';
comment on column public.stores.brand_id is
  'Optional parent brand. Null preserves the current single-store behavior.';
comment on column public.stores.branch_name is
  'Human-friendly branch label, for example Las Mercedes or Sambil.';
