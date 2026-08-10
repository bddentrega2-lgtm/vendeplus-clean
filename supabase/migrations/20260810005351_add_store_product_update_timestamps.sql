alter table public.stores
  add column if not exists updated_at timestamptz not null default now();

alter table public.products
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_catalog_record_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_catalog_record_updated_at() from public, anon, authenticated;

drop trigger if exists stores_set_updated_at on public.stores;
create trigger stores_set_updated_at
before update on public.stores
for each row execute function public.set_catalog_record_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_catalog_record_updated_at();
