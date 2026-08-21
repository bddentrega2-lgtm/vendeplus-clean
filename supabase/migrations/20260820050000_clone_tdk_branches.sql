do $$
declare
  v_source_store_id uuid := '95bdeb7e-1ce7-4e0a-903c-c5867ff1b854';
  v_branch record;
  v_target_store_id uuid;
  v_source_product record;
  v_target_product_id uuid;
begin
  if not exists (select 1 from public.stores where id = v_source_store_id) then
    raise exception 'No se encontro la sede origen Pasteleria TDK';
  end if;

  for v_branch in
    select *
    from (values
      ('pasteleria-tdk-delicias'::text, 'Pastelería TDK Delicias'::text),
      ('pasteleria-tdk-los-cedros'::text, 'Pastelería TDK Los Cedros'::text)
    ) as branches(slug, name)
  loop
    select id
    into v_target_store_id
    from public.stores
    where slug = v_branch.slug;

    if v_target_store_id is null then
      insert into public.stores (
        slug,
        name,
        description,
        address,
        latitude,
        longitude,
        whatsapp,
        cover_image_url,
        logo_url,
        is_active,
        accepts_delivery,
        accepts_pickup,
        business_type,
        opening_hours,
        delivery_estimate,
        pickup_estimate,
        payment_methods,
        usd_to_bs,
        whatsapp_message_note,
        primary_color,
        accent_color,
        button_text_color,
        payment_details,
        base_currency,
        exchange_rate_source,
        plan_type,
        trial_started_at,
        trial_ends_at,
        business_hours,
        manual_open_status,
        subscription_status,
        subscription_started_at,
        subscription_ends_at,
        next_payment_due_at,
        monthly_price_usd,
        billing_notes,
        show_prices_in_bs,
        auto_update_exchange_rate,
        service_fee_payer,
        service_fee_billing_cycle,
        accepts_national_shipping,
        product_limit,
        is_test,
        table_orders_access_enabled,
        table_orders_enabled,
        table_payment_methods,
        table_order_fulfillment_mode,
        request_customer_id_number
      )
      select
        v_branch.slug,
        v_branch.name,
        source.description,
        null,
        null,
        null,
        source.whatsapp,
        source.cover_image_url,
        source.logo_url,
        false,
        true,
        source.accepts_pickup,
        source.business_type,
        source.opening_hours,
        source.delivery_estimate,
        source.pickup_estimate,
        '[]'::jsonb,
        source.usd_to_bs,
        source.whatsapp_message_note,
        source.primary_color,
        source.accent_color,
        source.button_text_color,
        '{}'::jsonb,
        source.base_currency,
        source.exchange_rate_source,
        source.plan_type,
        source.trial_started_at,
        source.trial_ends_at,
        source.business_hours,
        'auto',
        source.subscription_status,
        source.subscription_started_at,
        source.subscription_ends_at,
        source.next_payment_due_at,
        source.monthly_price_usd,
        source.billing_notes,
        source.show_prices_in_bs,
        source.auto_update_exchange_rate,
        source.service_fee_payer,
        source.service_fee_billing_cycle,
        false,
        source.product_limit,
        false,
        false,
        false,
        '{}'::text[],
        'table_service',
        source.request_customer_id_number
      from public.stores source
      where source.id = v_source_store_id
      returning id into v_target_store_id;
    end if;

    insert into public.store_users (store_id, user_id, role)
    select v_target_store_id, source_user.user_id, source_user.role
    from public.store_users source_user
    where source_user.store_id = v_source_store_id
      and not exists (
        select 1
        from public.store_users target_user
        where target_user.store_id = v_target_store_id
          and target_user.user_id = source_user.user_id
      );

    insert into public.categories (store_id, name, sort_order, is_active)
    select v_target_store_id, source_category.name, source_category.sort_order, source_category.is_active
    from public.categories source_category
    where source_category.store_id = v_source_store_id
      and not exists (
        select 1
        from public.categories target_category
        where target_category.store_id = v_target_store_id
          and lower(target_category.name) = lower(source_category.name)
      );

    for v_source_product in
      select product.*, category.name as category_name
      from public.products product
      left join public.categories category on category.id = product.category_id
      where product.store_id = v_source_store_id
      order by product.sort_order, product.created_at
    loop
      select id
      into v_target_product_id
      from public.products
      where store_id = v_target_store_id
        and lower(name) = lower(v_source_product.name)
      limit 1;

      if v_target_product_id is null then
        insert into public.products (
          store_id,
          category_id,
          name,
          description,
          price_usd,
          image_url,
          is_available,
          is_featured,
          sort_order,
          discount_percent
        )
        values (
          v_target_store_id,
          (
            select id
            from public.categories
            where store_id = v_target_store_id
              and lower(name) = lower(v_source_product.category_name)
            limit 1
          ),
          v_source_product.name,
          v_source_product.description,
          v_source_product.price_usd,
          v_source_product.image_url,
          v_source_product.is_available,
          v_source_product.is_featured,
          v_source_product.sort_order,
          v_source_product.discount_percent
        )
        returning id into v_target_product_id;
      end if;

      insert into public.product_images (
        store_id,
        product_id,
        image_url,
        sort_order,
        is_active
      )
      select
        v_target_store_id,
        v_target_product_id,
        source_image.image_url,
        source_image.sort_order,
        source_image.is_active
      from public.product_images source_image
      where source_image.store_id = v_source_store_id
        and source_image.product_id = v_source_product.id
        and not exists (
          select 1
          from public.product_images target_image
          where target_image.product_id = v_target_product_id
            and target_image.sort_order = source_image.sort_order
        );
    end loop;

    insert into public.store_delivery_settings (
      store_id,
      delivery_enabled,
      pickup_enabled,
      national_shipping_enabled,
      delivery_provider,
      pricing_type,
      manual_quote_message
    )
    select
      v_target_store_id,
      true,
      source.accepts_pickup,
      false,
      'entrega2',
      'manual',
      'Configura la ubicación GPS de esta sede para cotizar con Entrega2 App.'
    from public.stores source
    where source.id = v_source_store_id
      and not exists (
        select 1
        from public.store_delivery_settings settings
        where settings.store_id = v_target_store_id
      );
  end loop;
end
$$;
