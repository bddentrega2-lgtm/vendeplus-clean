-- Quick operational fixes for Knockouts Pizza and customer favorite products.

-- 1) Knockouts Pizza automatic ordering hours.
update public.stores
set
  opening_hours = 'Lunes a jueves 11:30 AM - 10:00 PM · Viernes a domingo 11:30 AM - 10:30 PM',
  business_hours = '{
    "mon": [{"open": "11:30", "close": "22:00", "enabled": true}],
    "tue": [{"open": "11:30", "close": "22:00", "enabled": true}],
    "wed": [{"open": "11:30", "close": "22:00", "enabled": true}],
    "thu": [{"open": "11:30", "close": "22:00", "enabled": true}],
    "fri": [{"open": "11:30", "close": "22:30", "enabled": true}],
    "sat": [{"open": "11:30", "close": "22:30", "enabled": true}],
    "sun": [{"open": "11:30", "close": "22:30", "enabled": true}]
  }'::jsonb,
  manual_open_status = 'auto',
  manual_open_note = null
where id = '2f38e0ff-9cb2-4ba5-96c9-60530e975d94';

-- 2) Pizza 4 Estaciones: 4 included ingredients are mandatory and free.
--    A 5th ingredient remains an additional paid extra. Cheese crust is not assigned to this product.
do $$
declare
  v_store_id uuid := '2f38e0ff-9cb2-4ba5-96c9-60530e975d94';
  v_product_id uuid := 'e2b0f6b1-4b85-4c1a-b262-95c8876cc1a5';
  v_normal_group_id uuid := '2383fe20-7323-492e-a419-e3e55a1c4778';
  v_special_group_id uuid := '3b993ac8-8975-47d1-86f3-56184ba25a52';
  v_cheese_crust_group_id uuid := 'bb28616a-f59b-48a4-b0b9-5586995daf3f';
  v_included_group_id uuid;
  v_additional_group_id uuid;
begin
  select id
  into v_included_group_id
  from public.product_option_groups
  where store_id = v_store_id
    and name = '4 Estaciones - ingredientes incluidos'
  limit 1;

  if v_included_group_id is null then
    insert into public.product_option_groups (
      store_id,
      name,
      description,
      selection_type,
      required,
      min_select,
      max_select,
      is_active,
      sort_order
    )
    values (
      v_store_id,
      '4 Estaciones - ingredientes incluidos',
      'Elige exactamente 4 ingredientes incluidos con la pizza. No tienen costo adicional.',
      'multiple',
      true,
      4,
      4,
      true,
      0
    )
    returning id into v_included_group_id;
  else
    update public.product_option_groups
    set
      description = 'Elige exactamente 4 ingredientes incluidos con la pizza. No tienen costo adicional.',
      selection_type = 'multiple',
      required = true,
      min_select = 4,
      max_select = 4,
      is_active = true,
      sort_order = 0,
      updated_at = now()
    where id = v_included_group_id;
  end if;

  select id
  into v_additional_group_id
  from public.product_option_groups
  where store_id = v_store_id
    and name = '4 Estaciones - ingrediente adicional'
  limit 1;

  if v_additional_group_id is null then
    insert into public.product_option_groups (
      store_id,
      name,
      description,
      selection_type,
      required,
      min_select,
      max_select,
      is_active,
      sort_order
    )
    values (
      v_store_id,
      '4 Estaciones - ingrediente adicional',
      'Si quieres un 5to ingrediente, selecciónalo aquí como adicional.',
      'multiple',
      false,
      0,
      8,
      true,
      1
    )
    returning id into v_additional_group_id;
  else
    update public.product_option_groups
    set
      description = 'Si quieres un 5to ingrediente, selecciónalo aquí como adicional.',
      selection_type = 'multiple',
      required = false,
      min_select = 0,
      max_select = 8,
      is_active = true,
      sort_order = 1,
      updated_at = now()
    where id = v_additional_group_id;
  end if;

  delete from public.product_option_values
  where option_group_id in (v_included_group_id, v_additional_group_id);

  insert into public.product_option_values (
    option_group_id,
    name,
    description,
    price_delta_usd,
    is_active,
    sort_order
  )
  select
    v_included_group_id,
    source.name,
    source.description,
    0,
    true,
    source.sort_order
  from (
    select distinct on (lower(option_values.name))
      option_values.name,
      option_values.description,
      option_values.sort_order
    from public.product_option_values option_values
    where option_values.option_group_id in (v_normal_group_id, v_special_group_id)
      and option_values.is_active is not false
    order by lower(option_values.name), option_values.sort_order, option_values.name
  ) source
  order by source.sort_order, source.name;

  insert into public.product_option_values (
    option_group_id,
    name,
    description,
    price_delta_usd,
    is_active,
    sort_order
  )
  select
    v_additional_group_id,
    source.name,
    source.description,
    source.price_delta_usd,
    true,
    source.sort_order
  from (
    select distinct on (lower(option_values.name))
      option_values.name,
      option_values.description,
      option_values.price_delta_usd,
      option_values.sort_order
    from public.product_option_values option_values
    where option_values.option_group_id in (v_normal_group_id, v_special_group_id)
      and option_values.is_active is not false
    order by lower(option_values.name), option_values.price_delta_usd desc, option_values.sort_order, option_values.name
  ) source
  order by source.sort_order, source.name;

  delete from public.product_option_group_products
  where product_id = v_product_id
    and option_group_id in (
      v_normal_group_id,
      v_special_group_id,
      v_cheese_crust_group_id,
      v_included_group_id,
      v_additional_group_id
    );

  insert into public.product_option_group_products (
    store_id,
    product_id,
    option_group_id,
    sort_order
  )
  values
    (v_store_id, v_product_id, v_included_group_id, 0),
    (v_store_id, v_product_id, v_additional_group_id, 1)
  on conflict (product_id, option_group_id) do update
  set
    sort_order = excluded.sort_order,
    updated_at = now();
end $$;

-- 3) Refresh existing customer favorite products to top 5.
with favorite_rows as (
  select
    customers.id as customer_id,
    coalesce(nullif(order_items.product_name, ''), 'Producto') ||
      coalesce(' (' || nullif(order_items.variant_name, '') || ')', '') as product_name,
    sum(coalesce(order_items.quantity, 0))::integer as quantity,
    count(distinct orders.id)::integer as orders_count
  from public.customers
  join public.orders
    on orders.store_id = customers.store_id
   and (
      orders.customer_id = customers.id
      or (
        customers.phone_normalized is not null
        and orders.customer_phone_normalized = customers.phone_normalized
      )
    )
  join public.order_items
    on order_items.order_id = orders.id
  group by
    customers.id,
    coalesce(nullif(order_items.product_name, ''), 'Producto') ||
      coalesce(' (' || nullif(order_items.variant_name, '') || ')', '')
),
ranked_favorites as (
  select
    *,
    row_number() over (
      partition by customer_id
      order by quantity desc, orders_count desc, product_name asc
    ) as rank
  from favorite_rows
),
aggregated_favorites as (
  select
    customer_id,
    jsonb_agg(
      jsonb_build_object(
        'name', product_name,
        'quantity', quantity,
        'orders', orders_count
      )
      order by quantity desc, orders_count desc, product_name asc
    ) as products
  from ranked_favorites
  where rank <= 5
  group by customer_id
)
update public.customers
set
  favorite_products = aggregated_favorites.products,
  updated_at = now()
from aggregated_favorites
where customers.id = aggregated_favorites.customer_id;
