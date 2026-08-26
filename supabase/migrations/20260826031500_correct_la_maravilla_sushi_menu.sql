-- Corrige de forma idempotente el menu de La Maravilla del Sushi.
-- Conserva IDs e imagenes de productos equivalentes y no toca otros comercios.

do $$
declare
  v_store_id uuid;
  v_row record;
  v_category_id uuid;
  v_product_id uuid;
begin
  select id into v_store_id
  from public.stores
  where slug = 'la-maravilla-del-sushi'
  limit 1;

  if v_store_id is null then
    raise exception 'No existe el comercio La Maravilla del Sushi.';
  end if;

  create temp table tmp_maravilla_categories (
    desired_name text primary key,
    previous_name text,
    sort_order integer not null,
    category_id uuid
  ) on commit drop;

  insert into tmp_maravilla_categories (desired_name, previous_name, sort_order) values
    ('Entradas', null, 1),
    ('Tempurizados', 'Tempurizados (12 piezas)', 2),
    ('Fríos', 'Fríos (10 piezas)', 3),
    ('Promociones', null, 4);

  for v_row in select * from tmp_maravilla_categories loop
    select id into v_category_id
    from public.categories
    where store_id = v_store_id
      and (
        lower(btrim(name)) = lower(btrim(v_row.desired_name))
        or (v_row.previous_name is not null and lower(btrim(name)) = lower(btrim(v_row.previous_name)))
      )
    order by created_at
    limit 1;

    if v_category_id is null then
      insert into public.categories (store_id, name, is_active, sort_order)
      values (v_store_id, v_row.desired_name, true, v_row.sort_order)
      returning id into v_category_id;
    else
      update public.categories
      set name = v_row.desired_name,
          is_active = true,
          sort_order = v_row.sort_order
      where id = v_category_id;
    end if;

    update tmp_maravilla_categories
    set category_id = v_category_id
    where desired_name = v_row.desired_name;
  end loop;

  create temp table tmp_maravilla_products (
    category_name text not null,
    desired_name text not null,
    previous_name text,
    description text not null,
    price_usd numeric not null,
    sort_order integer not null,
    product_id uuid,
    primary key (category_name, desired_name)
  ) on commit drop;

  insert into tmp_maravilla_products (
    category_name, desired_name, previous_name, description, price_usd, sort_order
  ) values
    ('Entradas', 'Ensalada Dinamita', null, 'Porción con topping de cangrejo y wakame.', 4, 1),
    ('Entradas', 'Croquetas de Cangrejo', 'Croquetas de cangrejo', '6 piezas con topping de salsa tártara.', 4, 2),
    ('Entradas', 'Cangrejo Especial', null, '5 piezas rellenas con queso crema y cebollín. Topping de semillas de sésamo y salsa anguila.', 4, 3),
    ('Entradas', 'Camarones Rebosados', null, 'Porción de camarones rebosados con topping de salsa miel mostaza.', 5, 4),

    ('Tempurizados', 'Tera Roll', null, 'Nori, arroz, camarón, surimi, queso crema y aguacate. Topping de kani, wakame, salsa miel mostaza y salsa anguila. 12 piezas.', 9, 1),
    ('Tempurizados', 'Dinamita Roll', 'Dinamit Roll', 'Nori, arroz, dinamita, queso crema y aguacate. Topping de salsa dragón y salsa anguila. 12 piezas.', 7, 2),
    ('Tempurizados', 'Sakana Roll', null, 'Nori, arroz, pescado blanco, surimi, queso crema y aguacate. Topping de atún, cebollín, salsa dragón y salsa anguila. 12 piezas.', 9, 3),
    ('Tempurizados', 'Chicken Roll', null, 'Nori, arroz, pollo, tocineta, queso crema y plátano. Topping de salsa dragón y salsa anguila. 12 piezas.', 9, 4),
    ('Tempurizados', 'Umi Roll', null, 'Nori, arroz, pescado blanco, surimi, queso crema y cebollín. Topping de cangrejo, cebollín y salsa anguila. 12 piezas.', 9, 5),
    ('Tempurizados', 'Camarón Roll', null, 'Nori, arroz, camarón, aguacate, queso crema y cebollín. Topping de camarón, salsa miel mostaza y salsa dragón. 12 piezas.', 10, 6),

    ('Fríos', 'Skin Roll', null, 'Nori, arroz, queso crema, aguacate y piel de salmón crudo. Topping de salsa dragón y semillas de sésamo. 10 piezas.', 6, 1),
    ('Fríos', 'Kani Roll', null, 'Nori, arroz, surimi, aguacate, queso crema y cebollín. Topping de cangrejo, semillas de sésamo y salsa anguila. 10 piezas.', 7, 2),
    ('Fríos', 'Tuna Roll', null, 'Nori, arroz, atún, dinamita, aguacate y queso crema. Topping de plátano y salsa anguila. 10 piezas.', 7, 3),
    ('Fríos', 'California Roll', null, 'Nori, arroz, cangrejo, pepino y aguacate. Topping de masago y semillas de sésamo. 10 piezas.', 7, 4),
    ('Fríos', 'Aguacate Roll', null, 'Nori, arroz, camarón tempurizado, surimi, aguacate, queso crema y cebollín. Topping de aguacate, cebollín y salsa anguila. 10 piezas.', 9, 5),
    ('Fríos', 'Salmón Roll', null, 'Nori, arroz, salmón, aguacate y queso crema. Topping de aguacate, salmón y wakame crunchy. 10 piezas.', 11, 6),

    ('Promociones', 'Me Prefieres a Mí', null, '18 piezas: 6 Camarón Roll, 6 Chicken Roll y 6 Sakana Roll. Incluye refresco de litro.', 11, 1),
    ('Promociones', 'Flow La Marash', null, '15 piezas: 5 Aguacate Roll, 5 California Roll y 5 Kani Roll. Incluye refresco de litro.', 11, 2),
    ('Promociones', 'La Sensación', null, '16 piezas: 5 Cangrejo Rolls, 6 Chicken Rolls y 5 Skin Rolls. Incluye refresco de litro.', 11, 3),
    ('Promociones', 'Pa'' Que La Pases Bien', null, '33 piezas: 5 Kani Roll, 5 Skin Roll, 5 California Roll, 6 Chicken Roll, 6 Sakana Roll y 6 Camarón Roll. Incluye refresco de litro.', 21, 4);

  for v_row in select * from tmp_maravilla_products loop
    select products.id into v_product_id
    from public.products products
    where products.store_id = v_store_id
      and (
        lower(btrim(products.name)) = lower(btrim(v_row.desired_name))
        or (v_row.previous_name is not null and lower(btrim(products.name)) = lower(btrim(v_row.previous_name)))
      )
    order by
      case when lower(btrim(products.name)) = lower(btrim(v_row.desired_name)) then 0 else 1 end,
      products.created_at
    limit 1;

    if v_product_id is null then
      insert into public.products (
        store_id, category_id, name, description, price_usd,
        discount_percent, image_url, is_available, is_featured, sort_order
      ) values (
        v_store_id,
        (select category_id from tmp_maravilla_categories where desired_name = v_row.category_name),
        v_row.desired_name,
        v_row.description,
        v_row.price_usd,
        0,
        null,
        true,
        false,
        v_row.sort_order
      ) returning id into v_product_id;
    else
      update public.products
      set category_id = (select category_id from tmp_maravilla_categories where desired_name = v_row.category_name),
          name = v_row.desired_name,
          description = v_row.description,
          price_usd = v_row.price_usd,
          discount_percent = 0,
          is_available = true,
          is_featured = false,
          sort_order = v_row.sort_order,
          updated_at = now()
      where id = v_product_id;
    end if;

    update tmp_maravilla_products
    set product_id = v_product_id
    where category_name = v_row.category_name and desired_name = v_row.desired_name;
  end loop;

  -- Los dos "Topinng" eran una personalizacion incorrecta de Ensalada Dinamita.
  delete from public.product_variants
  where product_id = (
    select product_id from tmp_maravilla_products where desired_name = 'Ensalada Dinamita'
  )
    and lower(btrim(name)) in ('topinng cangrejo', 'topinng wakame');

  -- Conserva registros no reconocidos para historial, pero los retira del catalogo.
  update public.products products
  set is_available = false,
      updated_at = now()
  where products.store_id = v_store_id
    and not exists (
      select 1 from tmp_maravilla_products desired
      where desired.product_id = products.id
    );

  update public.categories categories
  set is_active = false
  where categories.store_id = v_store_id
    and not exists (
      select 1 from tmp_maravilla_categories desired
      where desired.category_id = categories.id
    );
end
$$;
