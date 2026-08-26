-- Menu regular idempotente de Pizza Mia.
-- No toca la categoria Promociones ni sus productos/opciones.
-- Todos los productos regulares quedan ocultos hasta que el comercio cargue fotos y los active.

do $$
declare
  v_store_id uuid;
  v_row record;
  v_product_id uuid;
  v_group_id uuid;
  v_value_id uuid;
begin
  select id into v_store_id
  from public.stores
  where slug = 'pizza-mia'
  limit 1;

  if v_store_id is null then
    raise exception 'No existe el comercio Pizza Mia con slug pizza-mia.';
  end if;

  create temp table tmp_pizza_mia_categories (
    name text primary key,
    sort_order integer not null,
    category_id uuid
  ) on commit drop;

  insert into tmp_pizza_mia_categories (name, sort_order) values
    ('Pizzas / Especialidades', 2),
    ('Nuevas', 3),
    ('Arma tu pizza', 4),
    ('Otros', 5),
    ('Subs', 6);

  for v_row in select * from tmp_pizza_mia_categories loop
    select id into v_row.category_id
    from public.categories
    where store_id = v_store_id
      and lower(btrim(name)) = lower(btrim(v_row.name))
    order by created_at
    limit 1;

    if v_row.category_id is null then
      insert into public.categories (store_id, name, is_active, sort_order)
      values (v_store_id, v_row.name, true, v_row.sort_order)
      returning id into v_row.category_id;
    else
      update public.categories
      set name = v_row.name,
          is_active = true,
          sort_order = v_row.sort_order
      where id = v_row.category_id;
    end if;

    update tmp_pizza_mia_categories
    set category_id = v_row.category_id
    where name = v_row.name;
  end loop;

  create temp table tmp_pizza_mia_products (
    category_name text not null,
    name text not null,
    description text not null,
    base_price_usd numeric not null,
    sort_order integer not null,
    small_price numeric,
    large_price numeric,
    giant_price numeric,
    sicilian_price numeric,
    product_id uuid,
    primary key (category_name, name)
  ) on commit drop;

  insert into tmp_pizza_mia_products (
    category_name, name, description, base_price_usd, sort_order,
    small_price, large_price, giant_price, sicilian_price
  ) values
    ('Pizzas / Especialidades', 'Mía Especial', 'Salsa de la casa, queso mozzarella, pepperoni, cebolla, pimentón verde, jamón y extra de queso.', 10, 1, 10, 15, 19, 22),
    ('Pizzas / Especialidades', 'Combo Charcutero', 'Salsa de la casa, queso mozzarella, jamón, chorizo italiano, tocineta y pepperoni.', 10, 2, 10, 15, 19, 22),
    ('Pizzas / Especialidades', 'Fresca Primavera', 'Salsa de la casa, queso mozzarella, tomates frescos, albahaca, aceite de oliva, crema de ajo y queso parmesano.', 8, 3, 8, 13, 17, 20),
    ('Pizzas / Especialidades', 'Vegetariana', 'Salsa de la casa, queso mozzarella, aceitunas negras, cebolla, pimentón verde, champiñones y tomates frescos.', 9, 4, 9, 14, 18, 21),
    ('Pizzas / Especialidades', 'Mexicana', '🌶 Picante. Salsa de la casa, queso mozzarella, cebolla, jalapeños, carne molida, tomates frescos y queso parmesano.', 9, 5, 9, 14, 18, 21),
    ('Pizzas / Especialidades', 'Bianca', 'Sin salsa, queso mozzarella, ricotta, brócoli, tomates frescos y crema de ajo.', 8, 6, 8, 13, 17, 20),
    ('Pizzas / Especialidades', 'Combo Italiano', 'Salsa de la casa, queso mozzarella, chorizo italiano, cebolla, pimentón verde y crema de ajo.', 8, 7, 8, 13, 17, 20),
    ('Pizzas / Especialidades', 'Cuatro Quesos', 'Salsa de la casa, queso mozzarella, queso provolone, queso pecorino y queso parmesano.', 9, 8, 9, 14, 18, 21),
    ('Pizzas / Especialidades', 'Combo Mixto', 'Salsa de la casa, queso mozzarella, cebolla, pimentón verde, aceitunas negras, tocineta, anchoas y extra de queso.', 10, 9, 10, 15, 19, 22),
    ('Pizzas / Especialidades', 'Mía BBQ', 'Sin salsa, queso mozzarella, cebolla, pimentón verde, tocineta y salsa BBQ.', 8, 10, 8, 13, 17, 20),
    ('Pizzas / Especialidades', 'Hawaiana', 'Salsa de la casa, queso mozzarella, tocineta, jamón, piña y canela opcional.', 10, 11, 10, 15, 19, 22),
    ('Pizzas / Especialidades', 'Capresa', 'Salsa de la casa, queso mozzarella, tomates frescos, bocconcini y pesto.', 9, 12, 9, 14, 18, 21),
    ('Pizzas / Especialidades', 'Triestre', 'Salsa de la casa, queso mozzarella, ricotta, cebollas caramelizadas y tomates secos.', 9, 13, 9, 14, 18, 21),
    ('Pizzas / Especialidades', 'Pan Pizza', 'Pizza de masa esponjosa con salsa de la casa y queso mozzarella.', 12, 14, null, null, null, null),
    ('Pizzas / Especialidades', 'Pizza Siciliana', 'Pizza cuadrada de masa gruesa con salsa de la casa y queso mozzarella. Precio base pendiente por confirmar.', 0, 15, null, null, null, null),
    ('Nuevas', 'Buffalo Chicken Pizza', '🌶 Picante. Salsa de la casa, queso mozzarella, pollo crispy en salsa Buffalo y ranch.', 9, 1, 9, 14, 18, 21),
    ('Arma tu pizza', 'Arma tu pizza como quieras', 'Pizza Margarita como base. Selecciona el tamaño y agrega los ingredientes que quieras.', 4, 1, null, null, null, null),
    ('Otros', 'Calzone', 'Salsa de la casa, queso mozzarella, ricotta y jamón.', 8, 1, null, null, null, null),
    ('Otros', 'Stromboli', 'Salsa de la casa, queso mozzarella, pepperoni, cebolla y pimentón verde.', 8, 2, null, null, null, null),
    ('Otros', 'Pasticho', 'Pasticho de carne con salsa de la casa y queso gratinado acompañado de pan con ajo.', 10, 3, null, null, null, null),
    ('Subs', 'Philly Cheesesteak', 'Sub de carne, cebolla, pimentón y queso mozzarella, acompañado con papas fritas.', 7, 1, null, null, null, null),
    ('Subs', 'Crispy Chicken', 'Sub de pollo crispy con topping de queso cheddar, tocineta y cebolla caramelizada, acompañado con papas fritas.', 7, 2, null, null, null, null);

  for v_row in select * from tmp_pizza_mia_products loop
    select products.id into v_product_id
    from public.products products
    join tmp_pizza_mia_categories categories
      on categories.category_id = products.category_id
    where products.store_id = v_store_id
      and categories.name = v_row.category_name
      and lower(btrim(products.name)) = lower(btrim(v_row.name))
    order by products.created_at
    limit 1;

    if v_product_id is null then
      insert into public.products (
        store_id, category_id, name, description, price_usd,
        discount_percent, image_url, is_available, is_featured, sort_order
      ) values (
        v_store_id,
        (select category_id from tmp_pizza_mia_categories where name = v_row.category_name),
        v_row.name,
        v_row.description,
        v_row.base_price_usd,
        0,
        null,
        false,
        false,
        v_row.sort_order
      ) returning id into v_product_id;
    else
      update public.products
      set name = v_row.name,
          description = v_row.description,
          price_usd = v_row.base_price_usd,
          discount_percent = 0,
          is_available = false,
          is_featured = false,
          sort_order = v_row.sort_order,
          updated_at = now()
      where id = v_product_id;
    end if;

    update tmp_pizza_mia_products
    set product_id = v_product_id
    where category_name = v_row.category_name and name = v_row.name;
  end loop;

  create temp table tmp_pizza_mia_variants (
    product_id uuid not null,
    name text not null,
    price_usd numeric not null,
    sort_order integer not null,
    variant_id uuid,
    primary key (product_id, name)
  ) on commit drop;

  insert into tmp_pizza_mia_variants (product_id, name, price_usd, sort_order)
  select product_id, 'Pequeña (10" / 25 cm)', small_price, 1
  from tmp_pizza_mia_products where small_price is not null
  union all
  select product_id, 'Grande (13" / 33 cm)', large_price, 2
  from tmp_pizza_mia_products where large_price is not null
  union all
  select product_id, 'Grande con borde de queso (13" / 33 cm)', large_price + 3, 3
  from tmp_pizza_mia_products where large_price is not null
  union all
  select product_id, 'Pan Pizza (14" / 35 cm)', giant_price, 4
  from tmp_pizza_mia_products where giant_price is not null
  union all
  select product_id, 'Gigante (17" / 42 cm)', giant_price, 5
  from tmp_pizza_mia_products where giant_price is not null
  union all
  select product_id, 'Siciliana (40 × 40 cm)', sicilian_price, 6
  from tmp_pizza_mia_products where sicilian_price is not null;

  insert into tmp_pizza_mia_variants (product_id, name, price_usd, sort_order)
  select product_id, variant.name, variant.price_usd, variant.sort_order
  from tmp_pizza_mia_products products
  cross join (
    values
      ('Personal (8" / 20.5 cm)', 4::numeric, 1),
      ('Pequeña (10" / 25 cm)', 6::numeric, 2),
      ('Grande (13" / 33 cm)', 10::numeric, 3),
      ('Grande con borde de queso (13" / 33 cm)', 13::numeric, 4),
      ('Gigante (17" / 42 cm)', 12::numeric, 5)
  ) as variant(name, price_usd, sort_order)
  where products.name = 'Arma tu pizza como quieras';

  for v_row in select * from tmp_pizza_mia_variants loop
    select id into v_value_id
    from public.product_variants
    where product_id = v_row.product_id
      and lower(btrim(name)) = lower(btrim(v_row.name))
    order by created_at
    limit 1;

    if v_value_id is null then
      insert into public.product_variants (product_id, name, price_usd, is_available, sort_order)
      values (v_row.product_id, v_row.name, v_row.price_usd, true, v_row.sort_order)
      returning id into v_value_id;
    else
      update public.product_variants
      set name = v_row.name,
          price_usd = v_row.price_usd,
          is_available = true,
          sort_order = v_row.sort_order
      where id = v_value_id;
    end if;

    update tmp_pizza_mia_variants
    set variant_id = v_value_id
    where product_id = v_row.product_id and name = v_row.name;
  end loop;

  update public.product_variants variants
  set is_available = false
  where variants.product_id in (select product_id from tmp_pizza_mia_products)
    and not exists (
      select 1 from tmp_pizza_mia_variants wanted
      where wanted.variant_id = variants.id
    );

  create temp table tmp_pizza_mia_groups (
    group_key text primary key,
    name text not null,
    description text not null,
    selection_type text not null,
    required boolean not null,
    min_select integer not null,
    max_select integer not null,
    sort_order integer not null,
    group_id uuid
  ) on commit drop;

  insert into tmp_pizza_mia_groups values
    ('arma-ingredientes', 'Ingredientes adicionales - Arma tu pizza', 'El precio de cada ingrediente cambia según el tamaño seleccionado.', 'multiple', false, 0, 28, 1, null),
    ('pan-ingredientes', 'Ingredientes adicionales - Pan Pizza', 'Cada ingrediente adicional cuesta $2.50.', 'multiple', false, 0, 28, 1, null),
    ('siciliana-ingredientes', 'Ingredientes adicionales - Pizza Siciliana', 'Cada ingrediente adicional cuesta $3.00.', 'multiple', false, 0, 28, 1, null),
    ('hawaiana-canela', 'Canela', 'Puedes agregar canela sin costo.', 'single', false, 0, 1, 1, null),
    ('subs-extras', 'Extras para tu Sub', 'Agrega extras por $1.50 cada uno.', 'multiple', false, 0, 3, 1, null);

  for v_row in select * from tmp_pizza_mia_groups loop
    select id into v_group_id
    from public.product_option_groups
    where store_id = v_store_id
      and lower(btrim(name)) = lower(btrim(v_row.name))
    order by created_at
    limit 1;

    if v_group_id is null then
      insert into public.product_option_groups (
        store_id, name, description, selection_type, required,
        min_select, max_select, is_active, sort_order
      ) values (
        v_store_id, v_row.name, v_row.description, v_row.selection_type,
        v_row.required, v_row.min_select, v_row.max_select, true, v_row.sort_order
      ) returning id into v_group_id;
    else
      update public.product_option_groups
      set name = v_row.name,
          description = v_row.description,
          selection_type = v_row.selection_type,
          required = v_row.required,
          min_select = v_row.min_select,
          max_select = v_row.max_select,
          is_active = true,
          sort_order = v_row.sort_order,
          updated_at = now()
      where id = v_group_id;
    end if;

    update tmp_pizza_mia_groups set group_id = v_group_id where group_key = v_row.group_key;
  end loop;

  create temp table tmp_pizza_mia_ingredients (
    name text primary key,
    sort_order integer not null
  ) on commit drop;

  insert into tmp_pizza_mia_ingredients values
    ('Cebolla', 1), ('Pimentón verde', 2), ('Tomates frescos', 3),
    ('Brócoli', 4), ('Piña', 5), ('Jalapeños', 6), ('Maíz dulce', 7),
    ('Champiñones', 8), ('Banana peppers', 9), ('Pimentón rostizado', 10),
    ('Aceitunas negras', 11), ('Cebollas caramelizadas', 12), ('Tomates secos', 13),
    ('Pepperoni', 14), ('Jamón', 15), ('Tocineta', 16), ('Chorizo italiano', 17),
    ('Carne molida', 18), ('Pollo crispy', 19), ('Jamón ahumado', 20),
    ('Albóndigas de carne', 21), ('Pesto', 22), ('Salsa BBQ', 23), ('Anchoas', 24),
    ('Ricotta', 25), ('Crema de ajo', 26), ('Bocconcini', 27), ('Extra de queso', 28);

  create temp table tmp_pizza_mia_values (
    group_key text not null,
    name text not null,
    price_delta_usd numeric not null,
    sort_order integer not null,
    value_id uuid,
    primary key (group_key, name)
  ) on commit drop;

  insert into tmp_pizza_mia_values (group_key, name, price_delta_usd, sort_order)
  select groups.group_key, ingredients.name,
    case groups.group_key
      when 'arma-ingredientes' then 1
      when 'pan-ingredientes' then 2.5
      when 'siciliana-ingredientes' then 3
    end,
    ingredients.sort_order
  from tmp_pizza_mia_groups groups
  cross join tmp_pizza_mia_ingredients ingredients
  where groups.group_key in ('arma-ingredientes', 'pan-ingredientes', 'siciliana-ingredientes');

  insert into tmp_pizza_mia_values values
    ('hawaiana-canela', 'Agregar canela', 0, 1, null),
    ('subs-extras', 'Tocineta', 1.5, 1, null),
    ('subs-extras', 'Queso cheddar', 1.5, 2, null),
    ('subs-extras', 'Champiñones', 1.5, 3, null);

  for v_row in select values.*, groups.group_id from tmp_pizza_mia_values values join tmp_pizza_mia_groups groups using (group_key) loop
    select id into v_value_id
    from public.product_option_values
    where option_group_id = v_row.group_id
      and lower(btrim(name)) = lower(btrim(v_row.name))
    order by created_at
    limit 1;

    if v_value_id is null then
      insert into public.product_option_values (
        option_group_id, name, description, price_delta_usd, is_active, sort_order
      ) values (
        v_row.group_id, v_row.name, null, v_row.price_delta_usd, true, v_row.sort_order
      ) returning id into v_value_id;
    else
      update public.product_option_values
      set name = v_row.name,
          description = null,
          price_delta_usd = v_row.price_delta_usd,
          is_active = true,
          sort_order = v_row.sort_order,
          updated_at = now()
      where id = v_value_id;
    end if;

    update tmp_pizza_mia_values
    set value_id = v_value_id
    where group_key = v_row.group_key and name = v_row.name;
  end loop;

  update public.product_option_values option_values
  set is_active = false,
      updated_at = now()
  where option_values.option_group_id in (select group_id from tmp_pizza_mia_groups)
    and not exists (
      select 1 from tmp_pizza_mia_values wanted
      where wanted.value_id = option_values.id
    );

  insert into public.product_option_value_variant_prices (
    option_value_id, variant_id, price_delta_usd
  )
  select values.value_id, variants.variant_id,
    case variants.name
      when 'Personal (8" / 20.5 cm)' then 1
      when 'Pequeña (10" / 25 cm)' then 1.5
      when 'Grande (13" / 33 cm)' then 2
      when 'Grande con borde de queso (13" / 33 cm)' then 2
      when 'Gigante (17" / 42 cm)' then 2.5
    end
  from tmp_pizza_mia_values values
  join tmp_pizza_mia_products products on products.name = 'Arma tu pizza como quieras'
  join tmp_pizza_mia_variants variants on variants.product_id = products.product_id
  where values.group_key = 'arma-ingredientes'
  on conflict (option_value_id, variant_id) do update
  set price_delta_usd = excluded.price_delta_usd,
      updated_at = now();

  create temp table tmp_pizza_mia_assignments (
    product_name text not null,
    group_key text not null,
    sort_order integer not null
  ) on commit drop;

  insert into tmp_pizza_mia_assignments values
    ('Arma tu pizza como quieras', 'arma-ingredientes', 1),
    ('Pan Pizza', 'pan-ingredientes', 1),
    ('Pizza Siciliana', 'siciliana-ingredientes', 1),
    ('Hawaiana', 'hawaiana-canela', 1),
    ('Philly Cheesesteak', 'subs-extras', 1),
    ('Crispy Chicken', 'subs-extras', 1);

  insert into public.product_option_group_products (
    store_id, product_id, option_group_id, sort_order
  )
  select v_store_id, products.product_id, groups.group_id, assignments.sort_order
  from tmp_pizza_mia_assignments assignments
  join tmp_pizza_mia_products products on products.name = assignments.product_name
  join tmp_pizza_mia_groups groups on groups.group_key = assignments.group_key
  on conflict (product_id, option_group_id) do update
  set sort_order = excluded.sort_order,
      updated_at = now();
end
$$;
