alter table public.stores add column if not exists table_waiter_calls_enabled boolean not null default false;
alter table public.orders
  add column if not exists table_cancellation_reason text,
  add column if not exists table_cancelled_at timestamptz,
  add column if not exists table_cancelled_by text;

-- Only the new panel calls this function; existing delivery/pickup flows stay unchanged.
create or replace function public.update_table_order_status(
  p_store_id uuid, p_order_id uuid, p_expected_status text, p_status text,
  p_reason text, p_actor text
) returns public.orders language plpgsql security definer set search_path = public, pg_temp as $$
declare v_order public.orders%rowtype;
begin
  select * into v_order from public.orders
    where id = p_order_id and store_id = p_store_id and delivery_type = 'table' for update;
  if not found then raise exception using errcode = 'P0002', message = 'Pedido no encontrado.'; end if;
  if p_expected_status is null or v_order.status is distinct from p_expected_status then
    raise exception 'El pedido cambio en otro dispositivo. Actualiza antes de continuar.';
  end if;
  if p_status is null or p_status not in ('received','accepted','preparing','ready','delivering','completed','cancelled') then
    raise exception 'Estado invalido.';
  end if;
  if v_order.status = p_status then return v_order; end if;
  if v_order.status in ('cancelled','completed') then raise exception 'El pedido ya esta cerrado.'; end if;
  if p_status in ('preparing','ready','delivering','completed') and v_order.payment_status is distinct from 'verified' then
    raise exception 'Verifica el pago antes de preparar o entregar el pedido.';
  end if;
  if p_status = 'cancelled' then
    if length(trim(coalesce(p_reason,''))) not between 3 and 306 or nullif(trim(p_actor),'') is null then
      raise exception 'Indica el motivo de cancelacion.';
    end if;
    perform public.cancel_order_with_inventory(p_order_id, p_store_id);
    update public.orders set table_cancellation_reason = trim(p_reason), table_cancelled_at = now(),
      table_cancelled_by = p_actor where id = p_order_id and store_id = p_store_id returning * into v_order;
  else
    update public.orders set status = p_status where id = p_order_id and store_id = p_store_id returning * into v_order;
  end if;
  return v_order;
end; $$;
revoke all on function public.update_table_order_status(uuid,uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.update_table_order_status(uuid,uuid,text,text,text,text) to service_role;

create table if not exists public.table_waiter_calls (
  table_id uuid primary key references public.store_tables(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text
);
create index if not exists table_waiter_calls_pending on public.table_waiter_calls(store_id, requested_at) where resolved_at is null;
alter table public.table_waiter_calls enable row level security;
revoke all on public.table_waiter_calls from anon, authenticated;
grant all on public.table_waiter_calls to service_role;

create or replace function public.request_table_waiter(p_store_id uuid, p_table_id uuid)
returns public.table_waiter_calls language plpgsql security definer set search_path = public, pg_temp as $$
declare v_call public.table_waiter_calls%rowtype;
begin
  if not exists (select 1 from public.stores where id = p_store_id and is_active = true
    and table_orders_access_enabled and table_orders_enabled and table_waiter_calls_enabled
    and table_order_fulfillment_mode = 'table_service') then
    raise exception 'La llamada al mesero no esta disponible.';
  end if;
  perform 1 from public.store_tables where id = p_table_id and store_id = p_store_id and is_enabled for update;
  if not found then raise exception 'Mesa no disponible.'; end if;
  select * into v_call from public.table_waiter_calls where table_id = p_table_id and store_id = p_store_id for update;
  if found then
    if v_call.resolved_at is null then return v_call; end if;
    if v_call.resolved_at > now() - interval '30 seconds' then raise exception 'Espera unos segundos antes de volver a llamar.'; end if;
  end if;
  insert into public.table_waiter_calls(table_id,store_id,requested_at,resolved_at,resolved_by)
    values(p_table_id,p_store_id,now(),null,null)
    on conflict (table_id) do update set requested_at=now(), resolved_at=null, resolved_by=null
    returning * into v_call;
  return v_call;
end; $$;
revoke all on function public.request_table_waiter(uuid,uuid) from public, anon, authenticated;
grant execute on function public.request_table_waiter(uuid,uuid) to service_role;

create or replace function public.broadcast_table_waiter_call() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform realtime.send(jsonb_build_object('table_id',new.table_id), 'order_changed',
    'store:' || new.store_id::text || ':orders', true);
  return new;
end; $$;
revoke all on function public.broadcast_table_waiter_call() from public, anon, authenticated;
create trigger table_waiter_call_changed after insert or update on public.table_waiter_calls
for each row execute function public.broadcast_table_waiter_call();
