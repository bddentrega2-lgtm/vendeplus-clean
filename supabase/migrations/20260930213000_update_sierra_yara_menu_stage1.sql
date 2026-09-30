do $$
declare
  v_store_id uuid;
  v_postres_id uuid;
  v_pasteles_id uuid;
  v_cesar_id uuid;
  v_variant_id uuid;
begin
  select id into v_store_id from public.stores where slug = 'sierra-yara' limit 1;
  if v_store_id is null then raise exception 'No se encontro Sierra Yara'; end if;

  update public.products
  set is_available = false, updated_at = now()
  where store_id = v_store_id and (
    name in (
      'Espresso', 'Cortado', 'Bombón', 'Durazno', 'Dalgona', 'Affogato',
      'Sierra Yara', 'Cachito Sierra', 'Pan de Queso', 'Cinnamon Roll',
      'Mousse de Chocolate', 'Tres Leche', 'Tiramisú', 'Brownie con Helado',
      'Limón Amapola', 'Signature Premiun', 'Pasta Boloñesa',
      'Croque Madame', 'Croque Monsieur'
    )
    or category_id in (
      select id from public.categories where store_id = v_store_id and name = 'CÓCTELES'
    )
  );

  update public.products set name = 'Toddy Frío', updated_at = now()
  where store_id = v_store_id and name = 'Toddy';

  update public.products
  set description = 'Fresa, mora, parchita y jarabe de goma.', updated_at = now()
  where store_id = v_store_id and name = 'Sierra'
    and category_id in (select id from public.categories where store_id = v_store_id and name = 'BATIDOS DE LA SIERRA');

  update public.products
  set description = 'Limón, naranja, parchita y jarabe de goma.', updated_at = now()
  where store_id = v_store_id and name = 'Citrus';

  update public.products
  set description = 'Hielo, fresa, limón, jarabe de goma y soda.', updated_at = now()
  where store_id = v_store_id and name = 'Sparkling Lemonade';

  update public.products
  set description = 'Miel, jengibre, limón y té verde.', updated_at = now()
  where store_id = v_store_id and name = 'Sierra Yara Hot Tea';

  update public.products
  set description = 'Miel y té de Jamaica.', updated_at = now()
  where store_id = v_store_id and name = 'Honey Tea';

  update public.products set name = 'AGUA MINERAL', updated_at = now()
  where store_id = v_store_id and name = 'Agua';
  update public.products set name = 'REFRESCO EN LATA', updated_at = now()
  where store_id = v_store_id and name = 'Refresco';
  update public.products set name = 'AGUA SPARKLING', updated_at = now()
  where store_id = v_store_id and name = 'Sparkling';

  update public.products
  set name = 'Mix 6 unds de galletas surtidas',
      description = 'Choco-chips, brownie-chips y craqueladas.', updated_at = now()
  where store_id = v_store_id and name = 'Mix 6 Galletas Surtidas';

  update public.products set name = 'NY Style Nuez', updated_at = now()
  where store_id = v_store_id and name = 'NY Style Avellana';

  select id into v_postres_id from public.categories
  where store_id = v_store_id and name = 'POSTRES' limit 1;
  select id into v_pasteles_id from public.categories
  where store_id = v_store_id and name = 'PASTELES' limit 1;
  if v_postres_id is null then raise exception 'No se encontro la categoria POSTRES'; end if;
  if v_pasteles_id is not null then
    update public.products set category_id = v_postres_id, updated_at = now()
    where store_id = v_store_id and category_id = v_pasteles_id;
  end if;

  update public.products
  set name = 'ENSALADA CÉSAR',
      description = 'Ensalada César con aderezo secreto de la casa, pollo a la plancha o crispy, lechuga y rúcula, parmigiano reggiano, jamón coppa di parma y crotones.',
      price_usd = 6,
      updated_at = now()
  where store_id = v_store_id and name = 'ORL'
  returning id into v_cesar_id;

  if v_cesar_id is null then
    select id into v_cesar_id from public.products
    where store_id = v_store_id and name = 'ENSALADA CÉSAR' limit 1;
  end if;
  if v_cesar_id is null then raise exception 'No se encontro la ensalada ORL/CESAR'; end if;

  select id into v_variant_id from public.product_variants
  where product_id = v_cesar_id and lower(name) = 'pequeña' limit 1;
  if v_variant_id is null then
    insert into public.product_variants (product_id, name, price_usd, is_available, sort_order)
    values (v_cesar_id, 'Pequeña', 6, true, 10);
  else
    update public.product_variants set name = 'Pequeña', price_usd = 6,
      is_available = true, sort_order = 10, updated_at = now() where id = v_variant_id;
  end if;

  select id into v_variant_id from public.product_variants
  where product_id = v_cesar_id and lower(name) = 'grande' limit 1;
  if v_variant_id is null then
    insert into public.product_variants (product_id, name, price_usd, is_available, sort_order)
    values (v_cesar_id, 'Grande', 12, true, 20);
  else
    update public.product_variants set name = 'Grande', price_usd = 12,
      is_available = true, sort_order = 20, updated_at = now() where id = v_variant_id;
  end if;
end $$;
