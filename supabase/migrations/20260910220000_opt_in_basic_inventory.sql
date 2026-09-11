-- Inventario basico opt-in. Sin una fila habilitada, el comercio conserva el flujo legacy.
create table if not exists public.store_inventory_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  enabled boolean not null default false,
  enabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_inventory_skus (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  code text not null,
  attributes jsonb not null default '{}'::jsonb,
  stock_on_hand integer not null default 0 check (stock_on_hand >= 0),
  low_stock_threshold integer not null default 0 check (low_stock_threshold >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_inventory_skus_code_not_blank check (btrim(code) <> ''),
  constraint product_inventory_skus_attributes_object check (jsonb_typeof(attributes) = 'object'),
  constraint product_inventory_skus_store_code_key unique (store_id, code),
  constraint product_inventory_skus_product_attributes_key unique (product_id, attributes)
);

alter table public.product_variants
  add column if not exists inventory_units integer not null default 1;

alter table public.product_variants
  drop constraint if exists product_variants_inventory_units_check;
alter table public.product_variants
  add constraint product_variants_inventory_units_check
  check (inventory_units between 1 and 50) not valid;
alter table public.product_variants validate constraint product_variants_inventory_units_check;

create table if not exists public.order_item_inventory_allocations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  sku_id uuid not null references public.product_inventory_skus(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  attributes_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'allocated' check (status in ('allocated', 'released')),
  created_at timestamptz not null default now(),
  released_at timestamptz,
  constraint order_item_inventory_allocations_item_sku_key unique (order_item_id, sku_id)
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  sku_id uuid not null references public.product_inventory_skus(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  order_item_id uuid references public.order_items(id) on delete restrict,
  movement_type text not null check (movement_type in ('import', 'adjustment', 'sale', 'release')),
  quantity_delta integer not null check (quantity_delta <> 0),
  stock_after integer not null check (stock_after >= 0),
  reference text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists product_inventory_skus_store_product_idx
  on public.product_inventory_skus(store_id, product_id, is_active);
create index if not exists product_inventory_skus_available_idx
  on public.product_inventory_skus(store_id, product_id)
  where is_active = true and stock_on_hand > 0;
create index if not exists order_inventory_allocations_order_idx
  on public.order_item_inventory_allocations(store_id, order_id, status);
create index if not exists inventory_movements_store_created_idx
  on public.inventory_movements(store_id, created_at desc);
create index if not exists inventory_movements_sku_created_idx
  on public.inventory_movements(sku_id, created_at desc);

alter table public.store_inventory_settings enable row level security;
alter table public.product_inventory_skus enable row level security;
alter table public.order_item_inventory_allocations enable row level security;
alter table public.inventory_movements enable row level security;

revoke all on table public.store_inventory_settings from public, anon, authenticated;
revoke all on table public.product_inventory_skus from public, anon, authenticated;
revoke all on table public.order_item_inventory_allocations from public, anon, authenticated;
revoke all on table public.inventory_movements from public, anon, authenticated;
grant all on table public.store_inventory_settings to service_role;
grant all on table public.product_inventory_skus to service_role;
grant all on table public.order_item_inventory_allocations to service_role;
grant all on table public.inventory_movements to service_role;

create or replace function public.enforce_inventory_sku_store()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.products product
     where product.id = new.product_id and product.store_id = new.store_id
  ) then
    raise exception using errcode = '23514', message = 'El SKU no pertenece al comercio del producto.';
  end if;
  return new;
end;
$$;

drop trigger if exists product_inventory_skus_store_guard on public.product_inventory_skus;
create trigger product_inventory_skus_store_guard
before insert or update of store_id, product_id on public.product_inventory_skus
for each row execute function public.enforce_inventory_sku_store();

create or replace function public.prevent_inventory_order_reopen()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if lower(coalesce(old.status, '')) in ('cancelled', 'canceled', 'cancelado')
     and lower(coalesce(new.status, '')) not in ('cancelled', 'canceled', 'cancelado')
     and exists (
       select 1 from public.order_item_inventory_allocations allocation
        where allocation.order_id = old.id
     ) then
    raise exception using errcode = '22023',
      message = 'Un pedido cancelado con inventario no puede reabrirse. Crea un pedido nuevo.';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_inventory_reopen_guard on public.orders;
create trigger orders_inventory_reopen_guard
before update of status on public.orders
for each row execute function public.prevent_inventory_order_reopen();

revoke all on function public.enforce_inventory_sku_store() from public, anon, authenticated;
revoke all on function public.prevent_inventory_order_reopen() from public, anon, authenticated;

insert into public.store_inventory_settings (store_id, enabled, enabled_at)
select id, true, now()
from public.stores
where id = '126f8168-f1ca-4a08-8eaf-c3816b9d9195'::uuid
  and slug = 'shibui'
on conflict (store_id) do update
set enabled = true,
    enabled_at = coalesce(public.store_inventory_settings.enabled_at, excluded.enabled_at),
    updated_at = now();

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
  v_inventory_entry jsonb;
  v_item_id uuid;
  v_store_id uuid;
  v_idempotency_key text;
  v_inventory_enabled boolean := false;
  v_product_id uuid;
  v_variant_id uuid;
  v_sku_id uuid;
  v_sku public.product_inventory_skus%rowtype;
  v_inventory_quantity integer;
  v_inventory_total integer;
  v_required_units integer;
  v_stock_after integer;
  v_inventory_label text;
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

  select coalesce(settings.enabled, false)
    into v_inventory_enabled
    from public.store_inventory_settings settings
   where settings.store_id = v_store_id;
  v_inventory_enabled := coalesce(v_inventory_enabled, false);

  insert into public.orders (
    id, public_code, store_id, idempotency_key, customer_name, customer_phone,
    customer_phone_normalized, delivery_type, payment_method, payment_status,
    payment_reference, payment_currency, subtotal_usd, delivery_usd, total_usd,
    total_bs, platform_service_fee_usd, platform_service_fee_payer,
    platform_service_fee_customer_usd, platform_service_fee_billing_cycle,
    distance_km, delivery_lat, delivery_lng, delivery_reference, store_table_id,
    table_name_snapshot, table_zone_snapshot, table_fulfillment_snapshot,
    delivery_provider, delivery_fee_usd, delivery_zone_id, delivery_zone_name,
    delivery_distance_km, delivery_pricing_type, delivery_status, delivery_notes,
    delivery_address, transport_agency_id, transport_agency_name,
    transport_agency_fee_usd, transport_agency_pricing_type,
    transport_agency_zone_name, transport_agency_status, order_details, notes,
    status, whatsapp_message
  ) values (
    nullif(p_order->>'id', '')::uuid, p_order->>'public_code', v_store_id,
    v_idempotency_key, p_order->>'customer_name', p_order->>'customer_phone',
    nullif(p_order->>'customer_phone_normalized', ''), p_order->>'delivery_type',
    p_order->>'payment_method', p_order->>'payment_status',
    nullif(p_order->>'payment_reference', ''), nullif(p_order->>'payment_currency', ''),
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
    nullif(p_order->>'delivery_status', ''), nullif(p_order->>'delivery_notes', ''),
    nullif(p_order->>'delivery_address', ''),
    nullif(p_order->>'transport_agency_id', '')::uuid,
    nullif(p_order->>'transport_agency_name', ''),
    nullif(p_order->>'transport_agency_fee_usd', '')::numeric,
    nullif(p_order->>'transport_agency_pricing_type', ''),
    nullif(p_order->>'transport_agency_zone_name', ''),
    nullif(p_order->>'transport_agency_status', ''),
    nullif(p_order->>'order_details', ''), nullif(p_order->>'notes', ''),
    coalesce(nullif(p_order->>'status', ''), 'received'),
    nullif(p_order->>'whatsapp_message', '')
  )
  on conflict (store_id, idempotency_key) where idempotency_key is not null
  do nothing
  returning * into v_order;

  if not found then
    if v_idempotency_key is null then
      raise exception using errcode = '23505', message = 'No se pudo crear el pedido.';
    end if;
    select * into v_order from public.orders
     where store_id = v_store_id and idempotency_key = v_idempotency_key;
    if not found then
      raise exception using errcode = '40001', message = 'No se pudo recuperar el pedido idempotente.';
    end if;
    return jsonb_build_object('order', to_jsonb(v_order), 'idempotent_replay', true);
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_item_id := coalesce(nullif(v_item->>'id', '')::uuid, gen_random_uuid());
    v_product_id := nullif(v_item->>'product_id', '')::uuid;
    v_variant_id := nullif(v_item->>'variant_id', '')::uuid;

    insert into public.order_items (
      id, order_id, product_id, product_name, variant_name, quantity,
      unit_price_usd, total_usd, notes
    ) values (
      v_item_id, v_order.id, v_product_id, v_item->>'product_name',
      nullif(v_item->>'variant_name', ''), (v_item->>'quantity')::integer,
      (v_item->>'unit_price_usd')::numeric, (v_item->>'total_usd')::numeric,
      nullif(v_item->>'notes', '')
    );

    for v_option in select value from jsonb_array_elements(coalesce(v_item->'options', '[]'::jsonb))
    loop
      insert into public.order_item_options (
        order_item_id, option_group_name, option_name, price_delta_usd, quantity
      ) values (
        v_item_id, v_option->>'option_group_name', v_option->>'option_name',
        coalesce((v_option->>'price_delta_usd')::numeric, 0),
        coalesce((v_option->>'quantity')::integer, 1)
      );
    end loop;

    if v_inventory_enabled and exists (
      select 1 from public.product_inventory_skus managed
       where managed.store_id = v_store_id and managed.product_id = v_product_id
    ) then
      v_required_units := (v_item->>'quantity')::integer * coalesce((
        select variants.inventory_units
          from public.product_variants variants
         where variants.id = v_variant_id and variants.product_id = v_product_id
      ), 1);
      select coalesce(sum((entry.value->>'quantity')::integer), 0)
        into v_inventory_total
        from jsonb_array_elements(coalesce(v_item->'inventory', '[]'::jsonb)) entry;
      if v_inventory_total <> v_required_units then
        raise exception using errcode = '22023',
          message = format('El inventario de %s necesita %s unidad(es) seleccionada(s).', v_item->>'product_name', v_required_units);
      end if;

      for v_inventory_entry in
        select jsonb_build_object(
          'sku_id', entry.value->>'sku_id',
          'quantity', sum((entry.value->>'quantity')::integer)
        )
        from jsonb_array_elements(coalesce(v_item->'inventory', '[]'::jsonb)) entry
        group by entry.value->>'sku_id'
      loop
        v_sku_id := nullif(v_inventory_entry->>'sku_id', '')::uuid;
        v_inventory_quantity := (v_inventory_entry->>'quantity')::integer;
        if v_sku_id is null or v_inventory_quantity <= 0 then
          raise exception using errcode = '22023', message = 'El inventario seleccionado no es válido.';
        end if;

        update public.product_inventory_skus sku
           set stock_on_hand = sku.stock_on_hand - v_inventory_quantity,
               updated_at = now()
         where sku.id = v_sku_id
           and sku.store_id = v_store_id
           and sku.product_id = v_product_id
           and sku.is_active = true
           and sku.stock_on_hand >= v_inventory_quantity
        returning * into v_sku;
        if not found then
          raise exception using errcode = 'P0001',
            message = format('No queda stock suficiente de %s. Actualiza el carrito e intenta nuevamente.', v_item->>'product_name');
        end if;
        v_stock_after := v_sku.stock_on_hand;

        insert into public.order_item_inventory_allocations (
          store_id, order_id, order_item_id, sku_id, quantity, attributes_snapshot
        ) values (
          v_store_id, v_order.id, v_item_id, v_sku_id, v_inventory_quantity, v_sku.attributes
        );
        v_inventory_label := concat_ws(
          ' · ',
          nullif(v_sku.attributes->>'color', ''),
          nullif(v_sku.attributes->>'talla', ''),
          nullif(v_sku.attributes->>'detalle', '')
        );
        if btrim(coalesce(v_inventory_label, '')) = '' then
          v_inventory_label := v_sku.code;
        end if;
        insert into public.order_item_options (
          order_item_id, option_group_name, option_name, price_delta_usd, quantity
        ) values (
          v_item_id,
          'Color y talla',
          case when v_inventory_quantity > 1
            then format('%sx %s', v_inventory_quantity, v_inventory_label)
            else v_inventory_label
          end,
          0,
          v_inventory_quantity
        );
        insert into public.inventory_movements (
          store_id, product_id, sku_id, order_id, order_item_id,
          movement_type, quantity_delta, stock_after, reference
        ) values (
          v_store_id, v_product_id, v_sku_id, v_order.id, v_item_id,
          'sale', -v_inventory_quantity, v_stock_after, v_order.public_code
        );
      end loop;
    end if;
  end loop;

  return jsonb_build_object('order', to_jsonb(v_order), 'idempotent_replay', false);
end;
$$;

create or replace function public.cancel_order_with_inventory(
  p_order_id uuid,
  p_store_id uuid
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_allocation public.order_item_inventory_allocations%rowtype;
  v_product_id uuid;
  v_stock_after integer;
begin
  select * into v_order from public.orders
   where id = p_order_id and store_id = p_store_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Pedido no encontrado.';
  end if;
  if lower(coalesce(v_order.status, '')) in ('cancelled', 'canceled', 'cancelado') then
    return v_order;
  end if;

  for v_allocation in
    select * from public.order_item_inventory_allocations
     where order_id = p_order_id and store_id = p_store_id and status = 'allocated'
     for update
  loop
    update public.product_inventory_skus sku
       set stock_on_hand = sku.stock_on_hand + v_allocation.quantity,
           updated_at = now()
     where sku.id = v_allocation.sku_id and sku.store_id = p_store_id
    returning product_id, stock_on_hand into v_product_id, v_stock_after;
    if not found then
      raise exception using errcode = 'P0001', message = 'No se pudo devolver el inventario del pedido.';
    end if;

    update public.order_item_inventory_allocations
       set status = 'released', released_at = now()
     where id = v_allocation.id;
    insert into public.inventory_movements (
      store_id, product_id, sku_id, order_id, order_item_id,
      movement_type, quantity_delta, stock_after, reference
    ) values (
      p_store_id, v_product_id, v_allocation.sku_id, p_order_id,
      v_allocation.order_item_id, 'release', v_allocation.quantity,
      v_stock_after, v_order.public_code
    );
  end loop;

  update public.orders set status = 'cancelled'
   where id = p_order_id and store_id = p_store_id
  returning * into v_order;
  return v_order;
end;
$$;

revoke all on function public.create_order_atomic(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_order_atomic(jsonb, jsonb) to service_role;
revoke all on function public.cancel_order_with_inventory(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancel_order_with_inventory(uuid, uuid) to service_role;

comment on table public.store_inventory_settings is
  'Interruptor opt-in por comercio. La ausencia de fila equivale a inventario deshabilitado.';
comment on function public.create_order_atomic(jsonb, jsonb) is
  'Crea pedido e items y, solo en comercios opt-in con SKU administrado, descuenta stock en la misma transacción.';
comment on function public.cancel_order_with_inventory(uuid, uuid) is
  'Cancela un pedido y devuelve una sola vez las unidades de inventario que fueron asignadas.';
