-- Preferencia visual opt-in. Todos los comercios existentes conservan el catálogo clásico.
alter table public.stores
  add column if not exists catalog_layout text not null default 'classic';

alter table public.stores drop constraint if exists stores_catalog_layout_check;
alter table public.stores add constraint stores_catalog_layout_check
  check (catalog_layout in ('classic', 'visual')) not valid;
alter table public.stores validate constraint stores_catalog_layout_check;

-- Ajuste atómico de una combinación desde el panel.
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
    raise exception using errcode = '42501', message = 'El inventario no está habilitado para este comercio.';
  end if;
  if p_stock_on_hand < 0 then
    raise exception using errcode = '22023', message = 'La existencia no puede ser negativa.';
  end if;
  if btrim(coalesce(p_code, '')) = '' then
    raise exception using errcode = '22023', message = 'El código de la combinación es obligatorio.';
  end if;
  if jsonb_typeof(coalesce(p_attributes, '{}'::jsonb)) <> 'object'
     or coalesce(p_attributes, '{}'::jsonb) = '{}'::jsonb then
    raise exception using errcode = '22023', message = 'Agrega al menos una característica a la combinación.';
  end if;
  if not exists (select 1 from public.products where id = p_product_id and store_id = p_store_id) then
    raise exception using errcode = '23514', message = 'El producto no pertenece al comercio indicado.';
  end if;

  if p_sku_id is not null then
    select * into v_sku from public.product_inventory_skus
     where id = p_sku_id and store_id = p_store_id and product_id = p_product_id
     for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'La combinación no existe en este comercio.';
    end if;
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
  'Ajusta o crea una combinación atómicamente. Solo service_role; la API valida manager y tenant.';

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
  v_saved_skus jsonb := '[]'::jsonb;
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
    v_saved_skus := v_saved_skus || jsonb_build_array(to_jsonb(v_sku));
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
