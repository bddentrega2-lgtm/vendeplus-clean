create or replace function public.manage_inventory_product(
  p_store_id uuid,
  p_product_id uuid,
  p_skus jsonb,
  p_presentations jsonb,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entry jsonb;
  v_sku public.product_inventory_skus%rowtype;
  v_removed_sku public.product_inventory_skus%rowtype;
  v_saved_skus jsonb := '[]'::jsonb;
  v_saved_ids uuid[] := '{}';
  v_variant_id uuid;
  v_units integer;
begin
  if jsonb_typeof(coalesce(p_skus, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_skus, '[]'::jsonb)) > 500 then
    raise exception using errcode = '22023', message = 'La lista de combinaciones no es válida.';
  end if;
  if jsonb_typeof(coalesce(p_presentations, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_presentations, '[]'::jsonb)) > 50 then
    raise exception using errcode = '22023', message = 'La lista de presentaciones no es válida.';
  end if;

  for v_entry in select value from jsonb_array_elements(coalesce(p_skus, '[]'::jsonb))
  loop
    select * into v_sku from public.manage_inventory_sku(
      p_store_id,
      p_product_id,
      nullif(v_entry->>'id', '')::uuid,
      v_entry->>'code',
      coalesce(v_entry->'attributes', '{}'::jsonb),
      (v_entry->>'stock_on_hand')::integer,
      'Ajuste desde panel de inventario',
      p_actor_user_id
    );
    v_saved_ids := array_append(v_saved_ids, v_sku.id);
    v_saved_skus := v_saved_skus || jsonb_build_array(to_jsonb(v_sku));
  end loop;

  for v_removed_sku in
    select *
      from public.product_inventory_skus
     where store_id = p_store_id
       and product_id = p_product_id
       and is_active = true
       and not (id = any(v_saved_ids))
     for update
  loop
    update public.product_inventory_skus
       set stock_on_hand = 0, is_active = false, updated_at = now()
     where id = v_removed_sku.id;

    if v_removed_sku.stock_on_hand <> 0 then
      insert into public.inventory_movements (
        store_id, product_id, sku_id, movement_type, quantity_delta,
        stock_after, reference, created_by
      ) values (
        p_store_id, p_product_id, v_removed_sku.id, 'adjustment',
        -v_removed_sku.stock_on_hand, 0, 'Combinación eliminada desde panel de inventario',
        p_actor_user_id
      );
    end if;
  end loop;

  for v_entry in select value from jsonb_array_elements(coalesce(p_presentations, '[]'::jsonb))
  loop
    v_variant_id := nullif(v_entry->>'id', '')::uuid;
    v_units := (v_entry->>'inventory_units')::integer;
    if v_variant_id is null or v_units not between 1 and 50 then
      raise exception using errcode = '22023', message = 'La presentación no es válida.';
    end if;
    update public.product_variants variant
       set inventory_units = v_units
     where variant.id = v_variant_id
       and variant.product_id = p_product_id
       and exists (
         select 1 from public.products product
          where product.id = p_product_id and product.store_id = p_store_id
       );
    if not found then
      raise exception using errcode = 'P0002', message = 'La presentación no pertenece al producto.';
    end if;
  end loop;

  return jsonb_build_object('skus', v_saved_skus, 'ok', true);
end;
$$;

revoke all on function public.manage_inventory_product(uuid, uuid, jsonb, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.manage_inventory_product(uuid, uuid, jsonb, jsonb, uuid)
  to service_role;

comment on function public.manage_inventory_product(uuid, uuid, jsonb, jsonb, uuid) is
  'Guarda combinaciones activas de inventario y desactiva las eliminadas desde el panel.';
