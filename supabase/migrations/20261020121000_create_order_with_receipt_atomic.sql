-- The receipt lock, order/items/stock write and attachment share one transaction.
create or replace function public.create_order_with_receipt_atomic(
  p_order jsonb, p_items jsonb, p_buyer_id uuid, p_receipt_id uuid
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_store_id uuid;
  v_receipt public.order_payment_receipts%rowtype;
  v_result jsonb;
  v_order_id uuid;
begin
  if p_receipt_id is null or jsonb_typeof(p_order) <> 'object' then
    raise exception using errcode = '22023', message = 'La captura de pago no es valida.';
  end if;
  v_store_id := nullif(p_order->>'store_id', '')::uuid;
  if v_store_id is null then
    raise exception using errcode = '22023', message = 'Falta el comercio del pedido.';
  end if;

  select * into v_receipt from public.order_payment_receipts
   where id = p_receipt_id and store_id = v_store_id
     and deleted_at is null and expires_at > now()
   for update;
  if not found then
    raise exception using errcode = '22023', message = 'La captura de pago ya no esta disponible. Subela nuevamente.';
  end if;

  if p_buyer_id is null then
    v_result := public.create_order_atomic(p_order, p_items);
  else
    v_result := public.create_buyer_order_atomic(p_order, p_items, p_buyer_id);
  end if;
  v_order_id := nullif(v_result->'order'->>'id', '')::uuid;
  if v_order_id is null then
    raise exception using errcode = 'P0001', message = 'No se pudo asociar la captura al pedido.';
  end if;
  if v_receipt.order_id is not null and v_receipt.order_id <> v_order_id then
    raise exception using errcode = 'P0001', message = 'La captura de pago ya fue utilizada. Subela nuevamente.';
  end if;

  if v_receipt.order_id is null then
    update public.order_payment_receipts
       set order_id = v_order_id, attached_at = now()
     where id = p_receipt_id and store_id = v_store_id and order_id is null;
    if not found then
      raise exception using errcode = 'P0001', message = 'No se pudo asociar la captura al pedido.';
    end if;
  end if;
  return v_result;
end;
$$;

revoke all on function public.create_order_with_receipt_atomic(jsonb, jsonb, uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_order_with_receipt_atomic(jsonb, jsonb, uuid, uuid) to service_role;
