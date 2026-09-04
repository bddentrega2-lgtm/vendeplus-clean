-- Carga idempotente del menu suministrado para Coliseo San Felipe.
-- Solo modifica el comercio con slug exacto `coliseo` y no elimina contenido.
do $$
declare
  v_store_id uuid;
  v_row record;
  v_category_id uuid;
  v_product_id uuid;
  v_group_id uuid;
begin
  select id into v_store_id
  from public.stores
  where slug = 'coliseo'
  limit 1;

  if v_store_id is null then
    raise exception 'No existe el comercio coliseo.';
  end if;

  create temp table tmp_coliseo_categories (
    name text primary key,
    sort_order integer not null,
    category_id uuid
  ) on commit drop;

  insert into tmp_coliseo_categories (name, sort_order) values
    ('Entradas', 1),
    ('Ensaladas', 2),
    ('Carnes y aves', 3),
    ('Parrillas', 4),
    ('Pastas', 5),
    ('Pizzas', 6),
    ('Hamburguesas', 7),
    ('Sándwiches', 8),
    ('Bebidas', 9),
    ('Raciones', 10);

  for v_row in select * from tmp_coliseo_categories loop
    select id into v_category_id
    from public.categories
    where store_id = v_store_id
      and lower(btrim(name)) = lower(btrim(v_row.name))
    order by created_at
    limit 1;

    if v_category_id is null then
      insert into public.categories (store_id, name, is_active, sort_order)
      values (v_store_id, v_row.name, true, v_row.sort_order)
      returning id into v_category_id;
    else
      update public.categories
      set name = v_row.name,
          is_active = true,
          sort_order = v_row.sort_order
      where id = v_category_id;
    end if;

    update tmp_coliseo_categories
    set category_id = v_category_id
    where name = v_row.name;
  end loop;

  create temp table tmp_coliseo_products (
    category_name text not null,
    name text not null,
    description text,
    price numeric(10,2) not null,
    sort_order integer not null,
    product_id uuid,
    primary key (category_name, name)
  ) on commit drop;

  insert into tmp_coliseo_products (category_name, name, description, price, sort_order) values
    ('Entradas', 'Crispy Tenders con Papas Fritas', '6 tiras de pollo empanizadas, con una ración de papas fritas y salsa.', 8.00, 1),
    ('Entradas', 'Bruschetta Napolitana', '6 rebanadas de pan, tomate horneado en aceto balsámico, queso parmesano y pesto.', 6.00, 2),

    ('Ensaladas', 'Ensalada César de Pollo', 'Tiras de pollo a la plancha o crispy, lechuga romana, aderezo César, tocineta, crotones y queso parmesano.', 11.00, 1),

    ('Carnes y aves', 'Milanesa Parmesana César', 'Pollo empanizado bañado con salsa napolitana, parmesano y salsa pesto, acompañado con ensalada César y papas fritas.', 14.00, 1),
    ('Carnes y aves', 'Lomo de Cerdo', 'Aromatizado con finas especias, puré de papa y ensalada César.', 13.00, 2),
    ('Carnes y aves', 'Milanesa a la Suiza', 'Bañada con salsa blanca y queso mozzarella. Incluye 2 contornos.', 13.00, 3),
    ('Carnes y aves', 'Solomo Coliseo', 'Churrasco de solomo acompañado de 2 contornos.', 13.00, 4),
    ('Carnes y aves', 'Milanesa al Ajillo', 'Bañada con deliciosa salsa al ajillo y especias. Incluye 2 contornos.', 11.00, 5),

    ('Parrillas', 'Parrilla Mixta Familiar', 'Carne, pollo, chorizo, ensalada rallada o criolla, arepitas fritas, guasacaca y tostones.', 43.00, 1),
    ('Parrillas', 'Parrilla Mixta 2 Personas', 'Carne, pollo, chorizo, ensalada rallada o criolla, arepitas fritas, guasacaca y tostones.', 24.00, 2),

    ('Pastas', 'Pasticho', 'Salsa de carne, salsa blanca, queso mozzarella y parmesano gratinado. Acompañado de pan al ajillo.', 10.00, 1),
    ('Pastas', 'Pasta al Pesto con Pollo', 'Linguini o pluma, crema de pesto, tiras de pollo y parmesano. Acompañada de pan al ajillo.', 10.00, 2),
    ('Pastas', 'Pasta Carbonara', 'Linguini o pluma, salsa blanca, tocineta, cebolla y parmesano. Acompañada de pan al ajillo.', 8.50, 3),
    ('Pastas', 'Pasta Primavera', 'Linguini o pluma, salsa blanca, jamón, tocineta, maíz y parmesano. Acompañada de pan al ajillo.', 8.50, 4),

    ('Pizzas', 'Margarita', 'Queso mozzarella y salsa.', 6.50, 1),
    ('Pizzas', 'Coliseo', 'Salsa, jamón y queso.', 7.50, 2),
    ('Pizzas', 'Vegetariana', 'Salsa, mozzarella, pimentón, cebolla y maíz.', 8.00, 3),
    ('Pizzas', 'Emperador', 'Salsa, queso mozzarella y pepperoni.', 8.00, 4),
    ('Pizzas', 'Primavera', 'Salsa, tocineta, mozzarella y maíz.', 9.00, 5),

    ('Hamburguesas', 'Americana Burger', 'Carne, queso cheddar, pepinillo y tocineta. Incluye papas fritas o aros de cebolla.', 8.00, 1),
    ('Hamburguesas', 'Maximus Burger', 'Carne o pollo, aros de cebolla, queso cheddar, tocineta, lechuga romana y aderezo de la casa. Incluye papas fritas o aros de cebolla.', 8.00, 2),
    ('Hamburguesas', 'Julio César Crispy', 'Pollo crispy, queso cheddar, tocineta, lechuga romana y aderezo César. Incluye papas fritas o aros de cebolla.', 8.00, 3),
    ('Hamburguesas', 'Gladiador Burger', 'Carne o pollo, aderezo de la casa, queso cheddar, tocineta y cebolla caramelizada. Incluye papas fritas o aros de cebolla.', 8.00, 4),

    ('Sándwiches', 'Sándwich Coliseo', 'Carne, pollo, queso mozzarella, chorizo, pimentón asado y aderezo de la casa.', 11.00, 1),
    ('Sándwiches', 'Sándwich de Cerdo', 'Corte de cerdo gratinado con mozzarella, vegetales y aderezo de la casa.', 11.00, 2),
    ('Sándwiches', 'Sándwich Romano', 'Carne salteada con cebolla y pimentón, queso cheddar, queso parmesano, vegetales y salsa de la casa.', 10.00, 3),
    ('Sándwiches', 'Pesto Chicken', 'Pollo a la parrilla o crispy con mozzarella, lechuga romana y salsa pesto en pan tostado.', 10.00, 4),
    ('Sándwiches', 'Club House', '4 piezas de club house, papas fritas y ensalada César.', 18.00, 5),

    ('Bebidas', 'Cerveza Pilsen y Light', 'Selecciona Pilsen o Light.', 1.20, 1),
    ('Bebidas', 'Cerveza Solera', null, 1.40, 2),
    ('Bebidas', 'Agua Mineral', null, 1.00, 3),
    ('Bebidas', 'Batidos Naturales', null, 3.00, 4),
    ('Bebidas', 'Nestea', null, 2.50, 5),
    ('Bebidas', 'Refresco 350 ml', null, 2.00, 6),
    ('Bebidas', 'Refresco 1 L', null, 3.00, 7),
    ('Bebidas', 'Refresco 1.5 L', null, 4.00, 8),
    ('Bebidas', 'Copa de Sangría Coliseo', null, 3.50, 9),
    ('Bebidas', 'Jarra de Sangría', null, 12.00, 10),

    ('Raciones', 'Pan al Ajillo', 'Ración de 6.', 2.00, 1),
    ('Raciones', 'Guasacaca', null, 1.00, 2),
    ('Raciones', 'Tajadas', 'Ración de 6.', 2.00, 3),
    ('Raciones', 'Tostones', 'Ración de 6.', 3.00, 4),
    ('Raciones', 'Papas Fritas', null, 4.00, 5),
    ('Raciones', 'Arepitas Fritas', 'Incluye salsa de su preferencia.', 4.00, 6);

  for v_row in select * from tmp_coliseo_products loop
    select id into v_product_id
    from public.products
    where store_id = v_store_id
      and lower(btrim(name)) = lower(btrim(v_row.name))
    order by created_at
    limit 1;

    if v_product_id is null then
      insert into public.products (
        store_id, category_id, name, description, price_usd,
        discount_percent, image_url, is_available, is_featured, sort_order
      ) values (
        v_store_id,
        (select category_id from tmp_coliseo_categories where name = v_row.category_name),
        v_row.name, v_row.description, v_row.price,
        0, null, true, false, v_row.sort_order
      ) returning id into v_product_id;
    else
      update public.products
      set category_id = (select category_id from tmp_coliseo_categories where name = v_row.category_name),
          name = v_row.name,
          description = v_row.description,
          price_usd = v_row.price,
          discount_percent = 0,
          is_available = true,
          is_featured = false,
          sort_order = v_row.sort_order,
          updated_at = now()
      where id = v_product_id;
    end if;

    update tmp_coliseo_products
    set product_id = v_product_id
    where category_name = v_row.category_name and name = v_row.name;
  end loop;

  create temp table tmp_coliseo_variants (
    product_name text not null,
    name text not null,
    price numeric(10,2) not null,
    sort_order integer not null,
    primary key (product_name, name)
  ) on commit drop;

  insert into tmp_coliseo_variants (product_name, name, price, sort_order) values
    ('Margarita', 'Mediana', 6.50, 1), ('Margarita', 'Grande', 8.00, 2),
    ('Coliseo', 'Mediana', 7.50, 1), ('Coliseo', 'Grande', 9.00, 2),
    ('Vegetariana', 'Mediana', 8.00, 1), ('Vegetariana', 'Grande', 11.00, 2),
    ('Emperador', 'Mediana', 8.00, 1), ('Emperador', 'Grande', 11.00, 2),
    ('Primavera', 'Mediana', 9.00, 1), ('Primavera', 'Grande', 12.00, 2),
    ('Cerveza Pilsen y Light', 'Pilsen', 1.20, 1),
    ('Cerveza Pilsen y Light', 'Light', 1.20, 2);

  for v_row in
    select variants.*, products.product_id
    from tmp_coliseo_variants variants
    join tmp_coliseo_products products on products.name = variants.product_name
  loop
    if exists (
      select 1 from public.product_variants
      where product_id = v_row.product_id
        and lower(btrim(name)) = lower(btrim(v_row.name))
    ) then
      update public.product_variants
      set name = v_row.name,
          price_usd = v_row.price,
          is_available = true,
          sort_order = v_row.sort_order
      where product_id = v_row.product_id
        and lower(btrim(name)) = lower(btrim(v_row.name));
    else
      insert into public.product_variants (product_id, name, price_usd, is_available, sort_order)
      values (v_row.product_id, v_row.name, v_row.price, true, v_row.sort_order);
    end if;
  end loop;

  create temp table tmp_coliseo_groups (
    group_key text primary key,
    name text not null,
    description text,
    selection_type text not null,
    required boolean not null,
    min_select integer not null,
    max_select integer not null,
    sort_order integer not null,
    group_id uuid
  ) on commit drop;

  insert into tmp_coliseo_groups values
    ('chicken_prep', 'Preparación del pollo', 'Selecciona cómo deseas el pollo.', 'single', true, 1, 1, 1, null),
    ('salad_type', 'Tipo de ensalada', 'Selecciona la ensalada de la parrilla.', 'single', true, 1, 1, 1, null),
    ('pasta_type', 'Tipo de pasta', 'Selecciona linguini o pluma.', 'single', true, 1, 1, 1, null),
    ('burger_side', 'Acompañamiento', 'Selecciona el acompañamiento incluido.', 'single', true, 1, 1, 1, null),
    ('burger_protein', 'Proteína', 'Selecciona carne o pollo.', 'single', true, 1, 1, 1, null);

  for v_row in select * from tmp_coliseo_groups loop
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
        v_store_id, v_row.name, v_row.description, v_row.selection_type, v_row.required,
        v_row.min_select, v_row.max_select, true, v_row.sort_order
      ) returning id into v_group_id;
    else
      update public.product_option_groups
      set description = v_row.description,
          selection_type = v_row.selection_type,
          required = v_row.required,
          min_select = v_row.min_select,
          max_select = v_row.max_select,
          is_active = true,
          sort_order = v_row.sort_order,
          updated_at = now()
      where id = v_group_id;
    end if;

    update tmp_coliseo_groups set group_id = v_group_id where group_key = v_row.group_key;
  end loop;

  create temp table tmp_coliseo_options (
    group_key text not null,
    name text not null,
    price numeric(10,2) not null,
    sort_order integer not null,
    primary key (group_key, name)
  ) on commit drop;

  insert into tmp_coliseo_options values
    ('chicken_prep', 'A la plancha', 0, 1),
    ('chicken_prep', 'Crispy', 0, 2),
    ('salad_type', 'Ensalada rallada', 0, 1),
    ('salad_type', 'Ensalada criolla', 0, 2),
    ('pasta_type', 'Linguini', 0, 1),
    ('pasta_type', 'Pluma', 0, 2),
    ('burger_side', 'Papas fritas', 0, 1),
    ('burger_side', 'Aros de cebolla', 0, 2),
    ('burger_protein', 'Carne', 0, 1),
    ('burger_protein', 'Pollo', 0, 2);

  for v_row in
    select options.*, groups.group_id
    from tmp_coliseo_options options
    join tmp_coliseo_groups groups using (group_key)
  loop
    if exists (
      select 1 from public.product_option_values
      where option_group_id = v_row.group_id
        and lower(btrim(name)) = lower(btrim(v_row.name))
    ) then
      update public.product_option_values
      set name = v_row.name,
          price_delta_usd = v_row.price,
          is_active = true,
          sort_order = v_row.sort_order,
          updated_at = now()
      where option_group_id = v_row.group_id
        and lower(btrim(name)) = lower(btrim(v_row.name));
    else
      insert into public.product_option_values (
        option_group_id, name, description, price_delta_usd, is_active, sort_order
      ) values (v_row.group_id, v_row.name, null, v_row.price, true, v_row.sort_order);
    end if;
  end loop;

  create temp table tmp_coliseo_links (
    group_key text not null,
    product_name text not null,
    sort_order integer not null,
    primary key (group_key, product_name)
  ) on commit drop;

  insert into tmp_coliseo_links values
    ('chicken_prep', 'Ensalada César de Pollo', 1),
    ('chicken_prep', 'Pesto Chicken', 1),
    ('salad_type', 'Parrilla Mixta Familiar', 1),
    ('salad_type', 'Parrilla Mixta 2 Personas', 1),
    ('pasta_type', 'Pasta al Pesto con Pollo', 1),
    ('pasta_type', 'Pasta Carbonara', 1),
    ('pasta_type', 'Pasta Primavera', 1),
    ('burger_side', 'Americana Burger', 1),
    ('burger_side', 'Maximus Burger', 1),
    ('burger_side', 'Julio César Crispy', 1),
    ('burger_side', 'Gladiador Burger', 1),
    ('burger_protein', 'Maximus Burger', 2),
    ('burger_protein', 'Gladiador Burger', 2);

  for v_row in
    select links.*, groups.group_id, products.product_id
    from tmp_coliseo_links links
    join tmp_coliseo_groups groups using (group_key)
    join tmp_coliseo_products products on products.name = links.product_name
  loop
    insert into public.product_option_group_products (
      store_id, product_id, option_group_id, sort_order
    ) values (
      v_store_id, v_row.product_id, v_row.group_id, v_row.sort_order
    )
    on conflict (product_id, option_group_id)
    do update set
      store_id = excluded.store_id,
      sort_order = excluded.sort_order,
      updated_at = now();
  end loop;
end $$;
