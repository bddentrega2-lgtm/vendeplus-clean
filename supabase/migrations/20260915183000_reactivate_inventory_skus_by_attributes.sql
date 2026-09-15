create or replace function public.manage_inventory_sku(
  p_store_id uuid,
  p_product_id uuid,
  p_sku_id uuid,
  p_code text,
  p_attributes jsonb,
  p_stock_on_hand integer,
  p_reference text,
  p_actor_user_id uuid
)
returns public.product_inventory_skus
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sku public.product_inventory_skus%rowtype;
  v_previous_stock integer := 0;
  v_delta integer;
begin
  if not coalesce((select enabled from public.store_inventory_settings where store_id = p_store_id), false) then
    raise exception using errcode = '42501', message = 'El inventario no esta habilitado para este comercio.';
  end if;
  if p_stock_on_hand < 0 then
    raise exception using errcode = '22023', message = 'La existencia no puede ser negativa.';
  end if;
  if btrim(coalesce(p_code, '')) = '' then
    raise exception using errcode = '22023', message = 'El codigo de la combinacion es obligatorio.';
  end if;
  if jsonb_typeof(coalesce(p_attributes, '{}'::jsonb)) <> 'object'
     or coalesce(p_attributes, '{}'::jsonb) = '{}'::jsonb then
    raise exception using errcode = '22023', message = 'Agrega al menos una caracteristica a la combinacion.';
  end if;
  if not exists (select 1 from public.products where id = p_product_id and store_id = p_store_id) then
    raise exception using errcode = '23514', message = 'El producto no pertenece al comercio indicado.';
  end if;

  if p_sku_id is not null then
    select * into v_sku from public.product_inventory_skus
     where id = p_sku_id and store_id = p_store_id and product_id = p_product_id
     for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'La combinacion no existe en este comercio.';
    end if;
    v_previous_stock := v_sku.stock_on_hand;
    update public.product_inventory_skus
       set stock_on_hand = p_stock_on_hand, is_active = true, updated_at = now()
     where id = v_sku.id returning * into v_sku;
  else
    select * into v_sku from public.product_inventory_skus
     where store_id = p_store_id
       and product_id = p_product_id
       and attributes = p_attributes
     for update;

    if found then
      v_previous_stock := v_sku.stock_on_hand;
      update public.product_inventory_skus
         set stock_on_hand = p_stock_on_hand, is_active = true, updated_at = now()
       where id = v_sku.id returning * into v_sku;
    else
      insert into public.product_inventory_skus (
        store_id, product_id, code, attributes, stock_on_hand, is_active
      ) values (
        p_store_id, p_product_id, btrim(p_code), p_attributes, p_stock_on_hand, true
      ) returning * into v_sku;
    end if;
  end if;

  v_delta := p_stock_on_hand - v_previous_stock;
  if v_delta <> 0 then
    insert into public.inventory_movements (
      store_id, product_id, sku_id, movement_type, quantity_delta,
      stock_after, reference, created_by
    ) values (
      p_store_id, p_product_id, v_sku.id, 'adjustment', v_delta,
      p_stock_on_hand, nullif(btrim(coalesce(p_reference, '')), ''), p_actor_user_id
    );
  end if;
  return v_sku;
end;
$$;

revoke all on function public.manage_inventory_sku(uuid, uuid, uuid, text, jsonb, integer, text, uuid)
  from public, anon, authenticated;
grant execute on function public.manage_inventory_sku(uuid, uuid, uuid, text, jsonb, integer, text, uuid)
  to service_role;

comment on function public.manage_inventory_sku(uuid, uuid, uuid, text, jsonb, integer, text, uuid) is
  'Ajusta, crea o reactiva una combinacion por atributos sin duplicar SKUs inactivos.';
