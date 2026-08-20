set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
declare
  v_store_id uuid;
  v_product_id uuid;
  v_order_id uuid := gen_random_uuid();
  v_item_id uuid := gen_random_uuid();
  v_failure_order_id uuid := gen_random_uuid();
  v_key text := 'codex-atomic-rollback-' || gen_random_uuid()::text;
  v_failure_key text := 'codex-atomic-rollback-failure-' || gen_random_uuid()::text;
  v_order jsonb;
  v_items jsonb;
  v_result jsonb;
  v_failure_seen boolean := false;
begin
  select p.store_id, p.id
    into v_store_id, v_product_id
    from public.products p
    where p.store_id is not null
    order by p.created_at desc nulls last
    limit 1;

  if v_store_id is null or v_product_id is null then
    raise exception 'No existe un producto apto para la prueba transaccional.';
  end if;

  v_order := jsonb_build_object(
    'id', v_order_id,
    'public_code', 'QA-' || upper(substr(replace(v_order_id::text, '-', ''), 1, 12)),
    'store_id', v_store_id,
    'idempotency_key', v_key,
    'customer_name', 'Validacion transaccional',
    'customer_phone', '0000000000',
    'customer_phone_normalized', '0000000000',
    'delivery_type', 'pickup',
    'payment_method', 'cash',
    'payment_status', 'pending',
    'subtotal_usd', 1,
    'delivery_usd', 0,
    'total_usd', 1,
    'total_bs', 0,
    'status', 'received'
  );

  v_items := jsonb_build_array(jsonb_build_object(
    'id', v_item_id,
    'product_id', v_product_id,
    'product_name', 'Producto de validacion',
    'quantity', 1,
    'unit_price_usd', 1,
    'total_usd', 1,
    'options', jsonb_build_array(jsonb_build_object(
      'option_group_name', 'Grupo de validacion',
      'option_name', 'Opcion de validacion',
      'price_delta_usd', 0,
      'quantity', 1
    ))
  ));

  v_result := public.create_order_atomic(v_order, v_items);

  if coalesce((v_result->>'idempotent_replay')::boolean, true) then
    raise exception 'La primera creacion fue marcada incorrectamente como repetida.';
  end if;

  if (v_result->'order'->>'id')::uuid <> v_order_id then
    raise exception 'La primera creacion devolvio otro pedido.';
  end if;

  if (select count(*) from public.orders where id = v_order_id) <> 1
    or (select count(*) from public.order_items where order_id = v_order_id) <> 1
    or (select count(*) from public.order_item_options where order_item_id = v_item_id) <> 1 then
    raise exception 'La primera creacion no guardo exactamente cabecera, item y opcion.';
  end if;

  v_result := public.create_order_atomic(v_order, v_items);

  if not coalesce((v_result->>'idempotent_replay')::boolean, false) then
    raise exception 'El reintento no fue reconocido como repetido.';
  end if;

  if (select count(*) from public.orders where idempotency_key = v_key) <> 1
    or (select count(*) from public.order_items where order_id = v_order_id) <> 1
    or (select count(*) from public.order_item_options where order_item_id = v_item_id) <> 1 then
    raise exception 'El reintento genero datos duplicados.';
  end if;

  begin
    perform public.create_order_atomic(
      v_order || jsonb_build_object(
        'id', v_failure_order_id,
        'public_code', 'QA-FAIL-' || upper(substr(replace(v_failure_order_id::text, '-', ''), 1, 8)),
        'idempotency_key', v_failure_key
      ),
      jsonb_build_array(jsonb_build_object(
        'id', gen_random_uuid(),
        'product_id', v_product_id,
        'product_name', 'Producto invalido',
        'quantity', 0,
        'unit_price_usd', 1,
        'total_usd', 0,
        'options', '[]'::jsonb
      ))
    );
  exception
    when check_violation then
      v_failure_seen := true;
  end;

  if not v_failure_seen then
    raise exception 'La prueba de fallo controlado no genero la restriccion esperada.';
  end if;

  if exists (select 1 from public.orders where id = v_failure_order_id or idempotency_key = v_failure_key) then
    raise exception 'El fallo controlado dejo una cabecera incompleta.';
  end if;

  raise notice 'VALIDACION_ATOMICA_OK: creacion completa, reintento sin duplicados y fallo sin residuos.';
end;
$$;
