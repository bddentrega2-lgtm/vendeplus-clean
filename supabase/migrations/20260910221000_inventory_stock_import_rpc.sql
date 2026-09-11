create or replace function public.import_inventory_stock(
  p_store_id uuid,
  p_product_id uuid,
  p_code text,
  p_attributes jsonb,
  p_stock_on_hand integer,
  p_reference text default null
)
returns public.product_inventory_skus
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sku public.product_inventory_skus%rowtype;
  v_delta integer;
  v_is_new boolean := false;
begin
  if not coalesce((
    select settings.enabled
      from public.store_inventory_settings settings
     where settings.store_id = p_store_id
  ), false) then
    raise exception using errcode = '42501', message = 'El inventario no está habilitado para este comercio.';
  end if;

  if p_stock_on_hand < 0 then
    raise exception using errcode = '22023', message = 'La existencia no puede ser negativa.';
  end if;

  if btrim(coalesce(p_code, '')) = '' then
    raise exception using errcode = '22023', message = 'El código del SKU es obligatorio.';
  end if;

  if jsonb_typeof(coalesce(p_attributes, '{}'::jsonb)) <> 'object' then
    raise exception using errcode = '22023', message = 'Los atributos del SKU deben ser un objeto.';
  end if;

  if not exists (
    select 1
      from public.products product
     where product.id = p_product_id
       and product.store_id = p_store_id
  ) then
    raise exception using errcode = '23514', message = 'El producto no pertenece al comercio indicado.';
  end if;

  select sku.*
    into v_sku
    from public.product_inventory_skus sku
   where sku.store_id = p_store_id
     and sku.code = btrim(p_code)
   for update;

  if found then
    if v_sku.product_id <> p_product_id
       or v_sku.attributes <> coalesce(p_attributes, '{}'::jsonb) then
      raise exception using errcode = '23505',
        message = 'El código de SKU ya identifica otra combinación.';
    end if;

    v_delta := p_stock_on_hand - v_sku.stock_on_hand;
    update public.product_inventory_skus
       set stock_on_hand = p_stock_on_hand,
           is_active = true,
           updated_at = now()
     where id = v_sku.id
     returning * into v_sku;
  else
    v_is_new := true;
    insert into public.product_inventory_skus (
      store_id, product_id, code, attributes, stock_on_hand, is_active
    ) values (
      p_store_id, p_product_id, btrim(p_code),
      coalesce(p_attributes, '{}'::jsonb), p_stock_on_hand, true
    )
    returning * into v_sku;
    v_delta := p_stock_on_hand;
  end if;

  if v_delta <> 0 then
    insert into public.inventory_movements (
      store_id, product_id, sku_id, movement_type,
      quantity_delta, stock_after, reference
    ) values (
      p_store_id, p_product_id, v_sku.id,
      case when v_is_new
        then 'import'
        else 'adjustment'
      end,
      v_delta, p_stock_on_hand, nullif(btrim(coalesce(p_reference, '')), '')
    );
  end if;

  return v_sku;
end;
$$;

revoke all on function public.import_inventory_stock(uuid, uuid, text, jsonb, integer, text)
  from public, anon, authenticated;
grant execute on function public.import_inventory_stock(uuid, uuid, text, jsonb, integer, text)
  to service_role;
