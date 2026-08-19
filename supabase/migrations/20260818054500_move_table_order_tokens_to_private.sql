create schema if not exists private;

create table if not exists private.store_table_order_tokens (
  store_id uuid primary key references public.stores(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  rotated_at timestamptz not null default now()
);

alter table private.store_table_order_tokens enable row level security;
revoke all on table private.store_table_order_tokens from public, anon, authenticated;
grant select, insert, update, delete on table private.store_table_order_tokens to service_role;

insert into private.store_table_order_tokens (store_id, token)
select stores.id, gen_random_uuid()
from public.stores
on conflict (store_id) do nothing;

create or replace function public.table_order_token_for_store(p_store_id uuid)
returns uuid
language sql
stable
security definer
set search_path = private, public, pg_temp
as $$
  select token
  from private.store_table_order_tokens
  where store_id = p_store_id;
$$;

create or replace function public.table_order_store_id_for_token(p_token uuid)
returns uuid
language sql
stable
security definer
set search_path = private, public, pg_temp
as $$
  select store_id
  from private.store_table_order_tokens
  where token = p_token;
$$;

revoke all on function public.table_order_token_for_store(uuid) from public, anon, authenticated;
revoke all on function public.table_order_store_id_for_token(uuid) from public, anon, authenticated;
grant execute on function public.table_order_token_for_store(uuid) to service_role;
grant execute on function public.table_order_store_id_for_token(uuid) to service_role;

comment on table private.store_table_order_tokens is
  'Tokens privados y rotables para iniciar pedidos de Mesa / Barra.';
comment on column private.store_table_order_tokens.token is
  'Secreto estable del QR. Nunca debe exponerse mediante SELECT anonimo de stores.';
