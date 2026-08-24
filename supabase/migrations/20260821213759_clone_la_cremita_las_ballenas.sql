do $$
declare
  v_source_store_id uuid := 'b3230730-3f45-4c7e-8a7e-61badaefef80';
  v_target_store_id uuid;
  v_source_product record;
  v_target_product_id uuid;
  v_source_group record;
  v_target_group_id uuid;
begin
  if not exists (select 1 from public.stores where id = v_source_store_id) then
    raise exception 'No se encontro la sede origen La Cremita Gourmet Guasimal';
  end if;

  update public.stores
  set
    name = 'La Cremita Gourmet Guasimal',
    address = 'Guasimal, Maracay, Aragua',
    updated_at = now()
  where id = v_source_store_id;

  select id into v_target_store_id
  from public.stores
  where slug = 'la-cremita-gourmet-las-ballenas';

  if v_target_store_id is null then
    insert into public.stores (
      slug, name, description, address, latitude, longitude, whatsapp,
      cover_image_url, logo_url, is_active, accepts_delivery, accepts_pickup,
      business_type, opening_hours, delivery_estimate, pickup_estimate,
      payment_methods, usd_to_bs, whatsapp_message_note, primary_color,
      accent_color, button_text_color, payment_details, base_currency,
      exchange_rate_source, exchange_rate_updated_at, location_link, plan_type,
      trial_started_at, trial_ends_at, onboarding_seen_at, business_hours,
      manual_open_status, manual_open_note, subscription_status,
      subscription_started_at, subscription_ends_at, next_payment_due_at,
      monthly_price_usd, billing_notes, last_payment_at, show_prices_in_bs,
      auto_update_exchange_rate, service_fee_payer, service_fee_billing_cycle,
      accepts_national_shipping, product_limit, is_test,
      table_orders_access_enabled, table_orders_enabled, table_payment_methods,
      table_order_fulfillment_mode, request_customer_id_number,
      marketplace_visible
    )
    select
      'la-cremita-gourmet-las-ballenas',
      'La Cremita Gourmet Las Ballenas',
      source.description,
      'Las Ballenas, Maracay, Aragua',
      10.267079665610519,
      -67.59386449349098,
      source.whatsapp,
      source.cover_image_url,
      source.logo_url,
      true,
      source.accepts_delivery,
      source.accepts_pickup,
      source.business_type,
      source.opening_hours,
      source.delivery_estimate,
      source.pickup_estimate,
      source.payment_methods,
      source.usd_to_bs,
      source.whatsapp_message_note,
      source.primary_color,
      source.accent_color,
      source.button_text_color,
      source.payment_details,
      source.base_currency,
      source.exchange_rate_source,
      source.exchange_rate_updated_at,
      'https://www.google.com/maps?q=10.267079665610519,-67.59386449349098',
      source.plan_type,
      source.trial_started_at,
      source.trial_ends_at,
      source.onboarding_seen_at,
      source.business_hours,
      source.manual_open_status,
      source.manual_open_note,
      source.subscription_status,
      source.subscription_started_at,
      source.subscription_ends_at,
      source.next_payment_due_at,
      source.monthly_price_usd,
      source.billing_notes,
      source.last_payment_at,
      source.show_prices_in_bs,
      source.auto_update_exchange_rate,
      source.service_fee_payer,
      source.service_fee_billing_cycle,
      source.accepts_national_shipping,
      source.product_limit,
      false,
      source.table_orders_access_enabled,
      source.table_orders_enabled,
      source.table_payment_methods,
      source.table_order_fulfillment_mode,
      source.request_customer_id_number,
      source.marketplace_visible
    from public.stores source
    where source.id = v_source_store_id
    returning id into v_target_store_id;
  end if;

  insert into public.store_users (store_id, user_id, role)
  select v_target_store_id, source_user.user_id, source_user.role
  from public.store_users source_user
  where source_user.store_id = v_source_store_id
    and not exists (
      select 1 from public.store_users target_user
      where target_user.store_id = v_target_store_id
        and target_user.user_id = source_user.user_id
    );

  insert into public.categories (store_id, name, sort_order, is_active)
  select v_target_store_id, source_category.name, source_category.sort_order, source_category.is_active
  from public.categories source_category
  where source_category.store_id = v_source_store_id
    and not exists (
      select 1 from public.categories target_category
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
    select id into v_target_product_id
    from public.products
    where store_id = v_target_store_id
      and lower(name) = lower(v_source_product.name)
    limit 1;

    if v_target_product_id is null then
      insert into public.products (
        store_id, category_id, name, description, price_usd, image_url,
        is_available, is_featured, sort_order, discount_percent
      ) values (
        v_target_store_id,
        (select id from public.categories where store_id = v_target_store_id and lower(name) = lower(v_source_product.category_name) limit 1),
        v_source_product.name,
        v_source_product.description,
        v_source_product.price_usd,
        v_source_product.image_url,
        v_source_product.is_available,
        v_source_product.is_featured,
        v_source_product.sort_order,
        v_source_product.discount_percent
      ) returning id into v_target_product_id;
    end if;

    insert into public.product_images (product_id, store_id, image_url, alt_text, sort_order, is_active)
    select v_target_product_id, v_target_store_id, source_image.image_url,
      source_image.alt_text, source_image.sort_order, source_image.is_active
    from public.product_images source_image
    where source_image.store_id = v_source_store_id
      and source_image.product_id = v_source_product.id
      and not exists (
        select 1 from public.product_images target_image
        where target_image.product_id = v_target_product_id
          and target_image.image_url = source_image.image_url
      );
  end loop;

  for v_source_group in
    select * from public.product_option_groups
    where store_id = v_source_store_id
    order by sort_order, created_at
  loop
    select id into v_target_group_id
    from public.product_option_groups
    where store_id = v_target_store_id
      and lower(name) = lower(v_source_group.name)
    limit 1;

    if v_target_group_id is null then
      insert into public.product_option_groups (
        store_id, name, description, selection_type, required,
        min_select, max_select, is_active, sort_order
      ) values (
        v_target_store_id, v_source_group.name, v_source_group.description,
        v_source_group.selection_type, v_source_group.required,
        v_source_group.min_select, v_source_group.max_select,
        v_source_group.is_active, v_source_group.sort_order
      ) returning id into v_target_group_id;
    end if;

    insert into public.product_option_values (
      option_group_id, name, description, price_delta_usd, is_active, sort_order
    )
    select v_target_group_id, source_value.name, source_value.description,
      source_value.price_delta_usd, source_value.is_active, source_value.sort_order
    from public.product_option_values source_value
    where source_value.option_group_id = v_source_group.id
      and not exists (
        select 1 from public.product_option_values target_value
        where target_value.option_group_id = v_target_group_id
          and lower(target_value.name) = lower(source_value.name)
      );

    insert into public.product_option_group_products (
      store_id, product_id, option_group_id, sort_order
    )
    select
      v_target_store_id,
      target_product.id,
      v_target_group_id,
      source_link.sort_order
    from public.product_option_group_products source_link
    join public.products source_product on source_product.id = source_link.product_id
    join public.products target_product
      on target_product.store_id = v_target_store_id
      and lower(target_product.name) = lower(source_product.name)
    where source_link.store_id = v_source_store_id
      and source_link.option_group_id = v_source_group.id
      and not exists (
        select 1 from public.product_option_group_products target_link
        where target_link.store_id = v_target_store_id
          and target_link.product_id = target_product.id
          and target_link.option_group_id = v_target_group_id
      );
  end loop;

  insert into public.store_delivery_settings (
    store_id, delivery_enabled, pickup_enabled, delivery_provider, pricing_type,
    fixed_fee_usd, free_delivery_min_usd, max_distance_km, distance_factor,
    manual_quote_message, delivery_promo_enabled,
    delivery_promo_min_subtotal_usd, delivery_promo_discount_type,
    delivery_promo_discount_value, national_shipping_enabled
  )
  select
    v_target_store_id, source.delivery_enabled, source.pickup_enabled,
    source.delivery_provider, source.pricing_type, source.fixed_fee_usd,
    source.free_delivery_min_usd, source.max_distance_km, source.distance_factor,
    source.manual_quote_message, source.delivery_promo_enabled,
    source.delivery_promo_min_subtotal_usd, source.delivery_promo_discount_type,
    source.delivery_promo_discount_value, source.national_shipping_enabled
  from public.store_delivery_settings source
  where source.store_id = v_source_store_id
    and not exists (
      select 1 from public.store_delivery_settings target
      where target.store_id = v_target_store_id
    );
end
$$;
