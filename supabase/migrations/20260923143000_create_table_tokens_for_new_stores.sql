create or replace function private.ensure_store_table_order_token()
returns trigger
language plpgsql
security definer
set search_path = private, public, pg_temp
as $$
begin
  insert into private.store_table_order_tokens (store_id)
  values (new.id)
  on conflict (store_id) do nothing;

  return new;
end;
$$;

revoke all on function private.ensure_store_table_order_token() from public, anon, authenticated;

drop trigger if exists stores_create_table_order_token on public.stores;
create trigger stores_create_table_order_token
after insert on public.stores
for each row execute function private.ensure_store_table_order_token();

insert into private.store_table_order_tokens (store_id)
select stores.id
from public.stores
on conflict (store_id) do nothing;

comment on function private.ensure_store_table_order_token() is
  'Creates the private Mesa / Barra QR token whenever a store is created.';
