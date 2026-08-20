create or replace function public.create_order_atomic(
  p_order jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_item jsonb;
  v_option jsonb;
  v_item_id uuid;
  v_store_id uuid;
  v_idempotency_key text;
begin
  if jsonb_typeof(p_order) <> 'object' then
    raise exception using errcode = '22023', message = 'El pedido debe ser un objeto.';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = '22023', message = 'El pedido necesita al menos un producto.';
  end if;

  v_store_id := nullif(p_order->>'store_id', '')::uuid;
  v_idempotency_key := nullif(p_order->>'idempotency_key', '');

  if v_store_id is null then
    raise exception using errcode = '22023', message = 'Falta el comercio del pedido.';
  end if;

  insert into public.orders (
    id,
    public_code,
    store_id,
    idempotency_key,
    customer_name,
    customer_phone,
    customer_phone_normalized,
    delivery_type,
    payment_method,
    payment_status,
    payment_reference,
    payment_currency,
    subtotal_usd,
    delivery_usd,
    total_usd,
    total_bs,
    platform_service_fee_usd,
    platform_service_fee_payer,
    platform_service_fee_customer_usd,
    platform_service_fee_billing_cycle,
    distance_km,
    delivery_lat,
    delivery_lng,
    delivery_reference,
    store_table_id,
    table_name_snapshot,
    table_zone_snapshot,
    table_fulfillment_snapshot,
    delivery_provider,
    delivery_fee_usd,
    delivery_zone_id,
    delivery_zone_name,
    delivery_distance_km,
    delivery_pricing_type,
    delivery_status,
    delivery_notes,
    delivery_address,
    transport_agency_id,
    transport_agency_name,
    transport_agency_fee_usd,
    transport_agency_pricing_type,
    transport_agency_zone_name,
    transport_agency_status,
    order_details,
    notes,
    status,
    whatsapp_message
  ) values (
    nullif(p_order->>'id', '')::uuid,
    p_order->>'public_code',
    v_store_id,
    v_idempotency_key,
    p_order->>'customer_name',
    p_order->>'customer_phone',
    nullif(p_order->>'customer_phone_normalized', ''),
    p_order->>'delivery_type',
    p_order->>'payment_method',
    p_order->>'payment_status',
    nullif(p_order->>'payment_reference', ''),
    nullif(p_order->>'payment_currency', ''),
    coalesce((p_order->>'subtotal_usd')::numeric, 0),
    coalesce((p_order->>'delivery_usd')::numeric, 0),
    coalesce((p_order->>'total_usd')::numeric, 0),
    coalesce((p_order->>'total_bs')::numeric, 0),
    coalesce((p_order->>'platform_service_fee_usd')::numeric, 0),
    nullif(p_order->>'platform_service_fee_payer', ''),
    coalesce((p_order->>'platform_service_fee_customer_usd')::numeric, 0),
    nullif(p_order->>'platform_service_fee_billing_cycle', ''),
    nullif(p_order->>'distance_km', '')::numeric,
    nullif(p_order->>'delivery_lat', '')::numeric,
    nullif(p_order->>'delivery_lng', '')::numeric,
    nullif(p_order->>'delivery_reference', ''),
    nullif(p_order->>'store_table_id', '')::uuid,
    nullif(p_order->>'table_name_snapshot', ''),
    nullif(p_order->>'table_zone_snapshot', ''),
    nullif(p_order->>'table_fulfillment_snapshot', ''),
    nullif(p_order->>'delivery_provider', ''),
    nullif(p_order->>'delivery_fee_usd', '')::numeric,
    nullif(p_order->>'delivery_zone_id', '')::uuid,
    nullif(p_order->>'delivery_zone_name', ''),
    nullif(p_order->>'delivery_distance_km', '')::numeric,
    nullif(p_order->>'delivery_pricing_type', ''),
    nullif(p_order->>'delivery_status', ''),
    nullif(p_order->>'delivery_notes', ''),
    nullif(p_order->>'delivery_address', ''),
    nullif(p_order->>'transport_agency_id', '')::uuid,
    nullif(p_order->>'transport_agency_name', ''),
    nullif(p_order->>'transport_agency_fee_usd', '')::numeric,
    nullif(p_order->>'transport_agency_pricing_type', ''),
    nullif(p_order->>'transport_agency_zone_name', ''),
    nullif(p_order->>'transport_agency_status', ''),
    nullif(p_order->>'order_details', ''),
    nullif(p_order->>'notes', ''),
    coalesce(nullif(p_order->>'status', ''), 'received'),
    nullif(p_order->>'whatsapp_message', '')
  )
  on conflict (store_id, idempotency_key)
    where idempotency_key is not null
    do nothing
  returning * into v_order;

  if not found then
    if v_idempotency_key is null then
      raise exception using errcode = '23505', message = 'No se pudo crear el pedido.';
    end if;

    select *
      into v_order
      from public.orders
      where store_id = v_store_id
        and idempotency_key = v_idempotency_key;

    if not found then
      raise exception using errcode = '40001', message = 'No se pudo recuperar el pedido idempotente.';
    end if;

    return jsonb_build_object(
      'order', to_jsonb(v_order),
      'idempotent_replay', true
    );
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_item_id := coalesce(nullif(v_item->>'id', '')::uuid, gen_random_uuid());

    insert into public.order_items (
      id,
      order_id,
      product_id,
      product_name,
      variant_name,
      quantity,
      unit_price_usd,
      total_usd,
      notes
    ) values (
      v_item_id,
      v_order.id,
      nullif(v_item->>'product_id', '')::uuid,
      v_item->>'product_name',
      nullif(v_item->>'variant_name', ''),
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price_usd')::numeric,
      (v_item->>'total_usd')::numeric,
      nullif(v_item->>'notes', '')
    );

    for v_option in
      select value
      from jsonb_array_elements(coalesce(v_item->'options', '[]'::jsonb))
    loop
      insert into public.order_item_options (
        order_item_id,
        option_group_name,
        option_name,
        price_delta_usd,
        quantity
      ) values (
        v_item_id,
        v_option->>'option_group_name',
        v_option->>'option_name',
        coalesce((v_option->>'price_delta_usd')::numeric, 0),
        coalesce((v_option->>'quantity')::integer, 1)
      );
    end loop;
  end loop;

  return jsonb_build_object(
    'order', to_jsonb(v_order),
    'idempotent_replay', false
  );
end;
$$;

revoke all on function public.create_order_atomic(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_order_atomic(jsonb, jsonb) to service_role;

comment on function public.create_order_atomic(jsonb, jsonb) is
  'Crea cabecera, items y opciones congeladas en una sola transacción idempotente.';
