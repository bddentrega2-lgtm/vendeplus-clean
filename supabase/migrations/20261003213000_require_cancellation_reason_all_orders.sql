create or replace function public.cancel_order_with_reason(
  p_order_id uuid,
  p_store_id uuid,
  p_reason text
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
begin
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception using errcode = 'P0001', message = 'Selecciona el motivo de cancelacion.';
  end if;

  perform public.cancel_order_with_inventory(p_order_id, p_store_id);

  update public.orders
     set table_cancellation_reason = trim(p_reason),
         table_cancelled_at = coalesce(table_cancelled_at, now())
   where id = p_order_id
     and store_id = p_store_id
  returning * into v_order;

  if not found then
    raise exception using errcode = 'P0002', message = 'Pedido no encontrado.';
  end if;

  return v_order;
end;
$$;

revoke all on function public.cancel_order_with_reason(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.cancel_order_with_reason(uuid, uuid, text) to service_role;

comment on function public.cancel_order_with_reason(uuid, uuid, text) is
  'Cancela cualquier pedido, restaura inventario una sola vez y conserva el motivo operativo.';
