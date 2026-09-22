-- Preview uses v2; keep the previous RPC unchanged for existing deployments.
create or replace function public.update_table_order_status_v2(
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
revoke all on function public.update_table_order_status_v2(uuid,uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.update_table_order_status_v2(uuid,uuid,text,text,text,text) to service_role;
