create table if not exists public.store_registration_profiles (
  store_id uuid primary key references public.stores(id) on delete cascade,
  representative_name text not null,
  representative_id_number text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_registration_profiles_representative_name_check
    check (char_length(trim(representative_name)) between 3 and 120),
  constraint store_registration_profiles_representative_id_check
    check (representative_id_number ~ '^[VEJGP]-[0-9]{5,12}$')
);

alter table public.store_registration_profiles enable row level security;

revoke all on table public.store_registration_profiles from public, anon;
grant select, insert, update on table public.store_registration_profiles to authenticated;
grant all on table public.store_registration_profiles to service_role;

create policy "Store owners can read registration profile"
  on public.store_registration_profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.store_users
      where store_users.store_id = store_registration_profiles.store_id
        and store_users.user_id = (select auth.uid())
    )
  );

create policy "Store owners can update registration profile"
  on public.store_registration_profiles
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.store_users
      where store_users.store_id = store_registration_profiles.store_id
        and store_users.user_id = (select auth.uid())
        and store_users.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.store_users
      where store_users.store_id = store_registration_profiles.store_id
        and store_users.user_id = (select auth.uid())
        and store_users.role in ('owner', 'admin')
    )
  );

create or replace function public.marketplace_eligible_store_ids(p_store_ids uuid[])
returns table (store_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  select stores.id
  from public.stores
  where stores.id = any(p_store_ids)
    and nullif(trim(stores.logo_url), '') is not null
    and exists (
      select 1
      from public.products
      where products.store_id = stores.id
        and products.price_usd > 0
    );
$$;

revoke all on function public.marketplace_eligible_store_ids(uuid[]) from public;
grant execute on function public.marketplace_eligible_store_ids(uuid[]) to anon, authenticated, service_role;
