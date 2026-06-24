do $$
declare
  estilo_id uuid;
  damas_id uuid;
  caballeros_id uuid;
  calzado_id uuid;
  accesorios_id uuid;
begin
  select id
    into estilo_id
  from public.stores
  where lower(slug) = 'estilo'
     or lower(name) = 'estilo'
  limit 1;

  if estilo_id is null then
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
      'Estilo',
      'estilo',
      'Ropa, moda y accesorios para vestir mejor todos los dias: basicos, outfits casuales, calzado y accesorios con entrega rapida.',
      'fashion',
      '584245666025',
      'Maracay, Aragua',
      10.25051,
      -67.59583,
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1400&q=80',
      'Abierto hoy · 9:30 AM - 7:30 PM',
      '25-45 min',
      '15-25 min',
      array['Pago móvil', 'Transferencia', 'Efectivo', 'Zelle', 'Binance'],
      600,
      '#1F2937',
      '#E7B75F',
      '#1F2937',
      true,
      true,
      true
    )
    returning id into estilo_id;
  else
    update public.stores
    set
      name = 'Estilo',
      slug = 'estilo',
      description = 'Ropa, moda y accesorios para vestir mejor todos los dias: basicos, outfits casuales, calzado y accesorios con entrega rapida.',
      business_type = 'fashion',
      cover_image_url = coalesce(
        nullif(cover_image_url, ''),
        'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1400&q=80'
      ),
      opening_hours = coalesce(nullif(opening_hours, ''), 'Abierto hoy · 9:30 AM - 7:30 PM'),
      delivery_estimate = coalesce(nullif(delivery_estimate, ''), '25-45 min'),
      pickup_estimate = coalesce(nullif(pickup_estimate, ''), '15-25 min'),
      payment_methods = case
        when payment_methods is null or array_length(payment_methods, 1) is null
          then array['Pago móvil', 'Transferencia', 'Efectivo', 'Zelle', 'Binance']
        else payment_methods
      end,
      primary_color = '#1F2937',
      accent_color = '#E7B75F',
      button_text_color = '#1F2937',
      accepts_delivery = true,
      accepts_pickup = true,
      is_active = true
    where id = estilo_id;
  end if;

  select id into damas_id
  from public.categories
  where store_id = estilo_id and lower(name) = 'damas'
  limit 1;

  if damas_id is null then
    insert into public.categories (store_id, name, sort_order, is_active)
    values (estilo_id, 'Damas', 10, true)
    returning id into damas_id;
  end if;

  select id into caballeros_id
  from public.categories
  where store_id = estilo_id and lower(name) = 'caballeros'
  limit 1;

  if caballeros_id is null then
    insert into public.categories (store_id, name, sort_order, is_active)
    values (estilo_id, 'Caballeros', 20, true)
    returning id into caballeros_id;
  end if;

  select id into calzado_id
  from public.categories
  where store_id = estilo_id and lower(name) = 'calzado'
  limit 1;

  if calzado_id is null then
    insert into public.categories (store_id, name, sort_order, is_active)
    values (estilo_id, 'Calzado', 30, true)
    returning id into calzado_id;
  end if;

  select id into accesorios_id
  from public.categories
  where store_id = estilo_id and lower(name) = 'accesorios'
  limit 1;

  if accesorios_id is null then
    insert into public.categories (store_id, name, sort_order, is_active)
    values (estilo_id, 'Accesorios', 40, true)
    returning id into accesorios_id;
  end if;

  if not exists (select 1 from public.products where store_id = estilo_id) then
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
    values
      (
        estilo_id,
        caballeros_id,
        'Chaqueta denim clasica',
        'Chaqueta de jean azul con corte casual para combinar con todo.',
        32,
        'https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=900&q=80',
        true,
        true,
        10
      ),
      (
        estilo_id,
        caballeros_id,
        'Camisa lino premium',
        'Camisa fresca de lino para clima calido, ideal para uso diario o salida.',
        24,
        'https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=900&q=80',
        true,
        false,
        20
      ),
      (
        estilo_id,
        damas_id,
        'Vestido casual midi',
        'Vestido ligero con caida suave para un look comodo y elegante.',
        28,
        'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80',
        true,
        true,
        30
      ),
      (
        estilo_id,
        calzado_id,
        'Sneakers urbanos',
        'Zapatos deportivos para caminar comodo sin perder estilo.',
        38,
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',
        true,
        false,
        40
      ),
      (
        estilo_id,
        accesorios_id,
        'Bolso tote diario',
        'Bolso amplio para trabajo, compras o universidad.',
        18,
        'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=80',
        true,
        true,
        50
      );
  end if;
end $$;

delete from public.stores store_to_delete
where (lower(store_to_delete.slug) = 'penbox' or lower(store_to_delete.name) = 'penbox')
  and not exists (
    select 1
    from public.orders existing_order
    where existing_order.store_id = store_to_delete.id
  );

update public.stores
set is_active = false
where lower(slug) = 'penbox'
   or lower(name) = 'penbox';
