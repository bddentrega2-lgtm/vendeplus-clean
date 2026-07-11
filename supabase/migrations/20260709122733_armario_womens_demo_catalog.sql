-- Convert Armario into a polished women's fashion demo catalog.
-- Idempotent data migration: keeps order history, hides old products, and does not add delivery rules.

do $$
declare
  armario_id uuid;
  blusas_id uuid;
  vestidos_id uuid;
  pantalones_id uuid;
  conjuntos_id uuid;
  accesorios_id uuid;
  product_row record;
  product_id uuid;
begin
  select id
    into armario_id
  from public.stores
  where lower(slug) = 'armario'
     or lower(name) = 'armario'
  limit 1;

  if armario_id is null then
    insert into public.stores (
      name,
      slug,
      description,
      business_type,
      whatsapp,
      address,
      latitude,
      longitude,
      cover_image_url,
      opening_hours,
      delivery_estimate,
      pickup_estimate,
      payment_methods,
      usd_to_bs,
      primary_color,
      accent_color,
      button_text_color,
      accepts_delivery,
      accepts_pickup,
      is_active
    )
    values (
      'Armario',
      'armario',
      'Tienda demo de moda femenina con prendas casuales, conjuntos, vestidos y accesorios para mostrar VendeMas a comercios de ropa.',
      'fashion',
      '584245666025',
      'Maracay, Aragua',
      10.25051,
      -67.59583,
      'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&q=80',
      'Lunes a sabado - 10:00 AM a 7:00 PM',
      'No configurado',
      'Retiro coordinado por WhatsApp',
      '["Pago movil", "Transferencia", "Efectivo", "Zelle"]'::jsonb,
      600,
      '#24212A',
      '#D7A86E',
      '#24212A',
      false,
      true,
      true
    )
    returning id into armario_id;
  else
    update public.stores
    set
      name = 'Armario',
      slug = 'armario',
      description = 'Tienda demo de moda femenina con prendas casuales, conjuntos, vestidos y accesorios para mostrar VendeMas a comercios de ropa.',
      business_type = 'fashion',
      cover_image_url = 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&q=80',
      opening_hours = 'Lunes a sabado - 10:00 AM a 7:00 PM',
      pickup_estimate = 'Retiro coordinado por WhatsApp',
      delivery_estimate = 'No configurado',
      payment_methods = '["Pago movil", "Transferencia", "Efectivo", "Zelle"]'::jsonb,
      primary_color = '#24212A',
      accent_color = '#D7A86E',
      button_text_color = '#24212A',
      accepts_delivery = false,
      accepts_pickup = true,
      is_active = true
    where id = armario_id;
  end if;

  update public.store_delivery_settings
  set
    delivery_enabled = false,
    pickup_enabled = true,
    delivery_provider = 'disabled',
    pricing_type = 'manual',
    fixed_fee_usd = 0,
    updated_at = now()
  where store_id = armario_id;

  update public.categories
  set is_active = false
  where store_id = armario_id;

  select id into blusas_id
  from public.categories
  where store_id = armario_id and lower(name) = 'blusas y tops'
  limit 1;

  if blusas_id is null then
    insert into public.categories (store_id, name, sort_order, is_active)
    values (armario_id, 'Blusas y tops', 10, true)
    returning id into blusas_id;
  else
    update public.categories set sort_order = 10, is_active = true where id = blusas_id;
  end if;

  select id into vestidos_id
  from public.categories
  where store_id = armario_id and lower(name) = 'vestidos'
  limit 1;

  if vestidos_id is null then
    insert into public.categories (store_id, name, sort_order, is_active)
    values (armario_id, 'Vestidos', 20, true)
    returning id into vestidos_id;
  else
    update public.categories set sort_order = 20, is_active = true where id = vestidos_id;
  end if;

  select id into pantalones_id
  from public.categories
  where store_id = armario_id and lower(name) = 'jeans y pantalones'
  limit 1;

  if pantalones_id is null then
    insert into public.categories (store_id, name, sort_order, is_active)
    values (armario_id, 'Jeans y pantalones', 30, true)
    returning id into pantalones_id;
  else
    update public.categories set sort_order = 30, is_active = true where id = pantalones_id;
  end if;

  select id into conjuntos_id
  from public.categories
  where store_id = armario_id and lower(name) = 'conjuntos'
  limit 1;

  if conjuntos_id is null then
    insert into public.categories (store_id, name, sort_order, is_active)
    values (armario_id, 'Conjuntos', 40, true)
    returning id into conjuntos_id;
  else
    update public.categories set sort_order = 40, is_active = true where id = conjuntos_id;
  end if;

  select id into accesorios_id
  from public.categories
  where store_id = armario_id and lower(name) = 'accesorios'
  limit 1;

  if accesorios_id is null then
    insert into public.categories (store_id, name, sort_order, is_active)
    values (armario_id, 'Accesorios', 50, true)
    returning id into accesorios_id;
  else
    update public.categories set sort_order = 50, is_active = true where id = accesorios_id;
  end if;

  update public.products
  set is_available = false
  where store_id = armario_id
    and name not in (
      'Blusa satin champagne',
      'Top rib basico',
      'Vestido midi lino',
      'Jeans wide leg azul',
      'Set blazer y short',
      'Falda satinada negra',
      'Body escote cuadrado',
      'Cartera mini estructurada'
    );

  for product_row in
    select *
    from (
      values
        ('Blusa satin champagne', blusas_id, 'Blusa satinada de caida suave para outfits elegantes o casuales.', 22::numeric, 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80', true, 10),
        ('Top rib basico', blusas_id, 'Top acanalado elastico, ideal para combinar con jeans, faldas o blazer.', 14::numeric, 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80', true, 20),
        ('Vestido midi lino', vestidos_id, 'Vestido fresco en tono neutro con silueta limpia para el dia a dia.', 34::numeric, 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80', true, 30),
        ('Jeans wide leg azul', pantalones_id, 'Jean tiro alto bota ancha con lavado azul medio y calce comodo.', 31::numeric, 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=900&q=80', false, 40),
        ('Set blazer y short', conjuntos_id, 'Conjunto coordinado para elevar un look de salida o reunion casual.', 46::numeric, 'https://images.unsplash.com/photo-1539008835657-9e8e9680c956?auto=format&fit=crop&w=900&q=80', true, 50),
        ('Falda satinada negra', pantalones_id, 'Falda midi satinada con brillo sutil y cintura comoda.', 26::numeric, 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80', false, 60),
        ('Body escote cuadrado', blusas_id, 'Body basico de escote cuadrado para armar looks minimalistas.', 18::numeric, 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80', false, 70),
        ('Cartera mini estructurada', accesorios_id, 'Cartera pequena de mano con acabado elegante para complementar outfits.', 24::numeric, 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=80', true, 80)
    ) as rows(name, category_id, description, price_usd, image_url, is_featured, sort_order)
  loop
    select id into product_id
    from public.products
    where store_id = armario_id and lower(name) = lower(product_row.name)
    limit 1;

    if product_id is null then
      insert into public.products (
        store_id,
        category_id,
        name,
        description,
        price_usd,
        image_url,
        is_available,
        is_featured,
        sort_order
      )
      values (
        armario_id,
        product_row.category_id,
        product_row.name,
        product_row.description,
        product_row.price_usd,
        product_row.image_url,
        true,
        product_row.is_featured,
        product_row.sort_order
      );
    else
      update public.products
      set
        category_id = product_row.category_id,
        description = product_row.description,
        price_usd = product_row.price_usd,
        image_url = product_row.image_url,
        is_available = true,
        is_featured = product_row.is_featured,
        sort_order = product_row.sort_order
      where id = product_id;
    end if;
  end loop;
end $$;
