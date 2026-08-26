-- Carga idempotente de promociones para Pizza Mia.
-- Conserva imagenes existentes y no activa el comercio automaticamente.

do $$
declare
  v_store_id uuid;
  v_category_id uuid;
  v_ingredient_group_id uuid;
  v_product record;
  v_product_id uuid;
  v_ingredient text;
  v_sort_order integer;
begin
  select id
  into v_store_id
  from public.stores
  where slug = 'pizza-mia'
  limit 1;

  if v_store_id is null then
    raise exception 'No existe el comercio Pizza Mia con slug pizza-mia.';
  end if;

  select id
  into v_category_id
  from public.categories
  where store_id = v_store_id
    and lower(btrim(name)) = 'promociones'
  order by created_at
  limit 1;

  if v_category_id is null then
    insert into public.categories (store_id, name, is_active, sort_order)
    values (v_store_id, 'Promociones', true, 1)
    returning id into v_category_id;
  else
    update public.categories
    set name = 'Promociones',
        is_active = true
    where id = v_category_id;
  end if;

  for v_product in
    select *
    from (
      values
        (1, 'Pizza Personal Margarita', 'Pizza Margarita + refresco.', 3.99::numeric),
        (2, 'Pizza Personal Tocineta + Maíz', 'Pizza personal de tocineta y maíz + refresco.', 5.99::numeric),
        (3, 'Sici Box', 'Pizza Siciliana + 1 ingrediente incluido a elección + refresco.', 6.99::numeric),
        (4, 'Pasticho Personal', 'Pasticho + pan de ajo y orégano + refresco.', 6.99::numeric),
        (5, 'Pizza Grande Margarita', 'Pizza Margarita grande + 4 refrescos.', 9.99::numeric),
        (6, 'Pizza Grande Charchu Mix', 'Pizza Charchu Mix grande + 2 refrescos.', 14.99::numeric),
        (7, 'Pizza Gigante 4x4', 'Pizza gigante 4x4 + 4 refrescos.', 16.99::numeric),
        (8, '2 Pizzas Grandes', 'Incluye 1 Pizza Grande Margarita + 1 Pizza Grande Charchu Mix + 1 refresco de 1.5 L.', 19.99::numeric),
        (9, 'Siciliana', 'Pizza Siciliana + 1 ingrediente incluido a elección + 4 refrescos.', 19.99::numeric)
    ) as promotions(sort_order, name, description, price_usd)
  loop
    select id
    into v_product_id
    from public.products
    where store_id = v_store_id
      and lower(btrim(name)) = lower(btrim(v_product.name))
    order by created_at
    limit 1;

    if v_product_id is null then
      insert into public.products (
        store_id,
        category_id,
        name,
        description,
        price_usd,
        discount_percent,
        image_url,
        is_available,
        is_featured,
        sort_order
      ) values (
        v_store_id,
        v_category_id,
        v_product.name,
        v_product.description,
        v_product.price_usd,
        0,
        null,
        true,
        false,
        v_product.sort_order
      )
      returning id into v_product_id;
    else
      update public.products
      set category_id = v_category_id,
          name = v_product.name,
          description = v_product.description,
          price_usd = v_product.price_usd,
          discount_percent = 0,
          is_available = true,
          sort_order = v_product.sort_order,
          updated_at = now()
      where id = v_product_id;
    end if;
  end loop;

  select id
  into v_ingredient_group_id
  from public.product_option_groups
  where store_id = v_store_id
    and lower(btrim(name)) = 'elige tu ingrediente incluido'
  order by created_at
  limit 1;

  if v_ingredient_group_id is null then
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
    ) values (
      v_store_id,
      'Elige tu ingrediente incluido',
      'Selecciona un ingrediente sin costo adicional.',
      'single',
      true,
      1,
      1,
      true,
      1
    )
    returning id into v_ingredient_group_id;
  else
    update public.product_option_groups
    set description = 'Selecciona un ingrediente sin costo adicional.',
        selection_type = 'single',
        required = true,
        min_select = 1,
        max_select = 1,
        is_active = true,
        sort_order = 1,
        updated_at = now()
    where id = v_ingredient_group_id;
  end if;

  v_sort_order := 0;
  foreach v_ingredient in array array[
    'Pepperoni',
    'Jamón',
    'Tocineta',
    'Maíz',
    'Cebolla',
    'Pimentón',
    'Aceitunas negras',
    'Champiñones',
    'Piña',
    'Anchoas'
  ]
  loop
    v_sort_order := v_sort_order + 1;

    if exists (
      select 1
      from public.product_option_values
      where option_group_id = v_ingredient_group_id
        and lower(btrim(name)) = lower(btrim(v_ingredient))
    ) then
      update public.product_option_values
      set name = v_ingredient,
          description = null,
          price_delta_usd = 0,
          is_active = true,
          sort_order = v_sort_order,
          updated_at = now()
      where option_group_id = v_ingredient_group_id
        and lower(btrim(name)) = lower(btrim(v_ingredient));
    else
      insert into public.product_option_values (
        option_group_id,
        name,
        description,
        price_delta_usd,
        is_active,
        sort_order
      ) values (
        v_ingredient_group_id,
        v_ingredient,
        null,
        0,
        true,
        v_sort_order
      );
    end if;
  end loop;

  for v_product_id in
    select id
    from public.products
    where store_id = v_store_id
      and lower(btrim(name)) in ('sici box', 'siciliana')
  loop
    insert into public.product_option_group_products (
      store_id,
      product_id,
      option_group_id,
      sort_order
    ) values (
      v_store_id,
      v_product_id,
      v_ingredient_group_id,
      1
    )
    on conflict (product_id, option_group_id)
    do update set
      store_id = excluded.store_id,
      sort_order = excluded.sort_order,
      updated_at = now();
  end loop;
end
$$;
