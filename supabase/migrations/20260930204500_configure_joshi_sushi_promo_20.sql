do $$
declare
  v_store_id uuid;
  v_promo_id uuid;
  v_box_id uuid;
  v_roll_group_id uuid;
begin
  select id into v_store_id from public.stores where slug = 'joshi-sushi' limit 1;
  select id into v_promo_id from public.products
    where store_id = v_store_id and lower(name) = lower('PROMO 20 piezas') limit 1;
  select id into v_box_id from public.products
    where store_id = v_store_id and lower(name) = lower('Box 20 piezas') limit 1;

  if v_store_id is null or v_promo_id is null or v_box_id is null then
    raise exception 'No se encontro Joshi Sushi, PROMO 20 piezas o Box 20 piezas';
  end if;

  select groups.id into v_roll_group_id
  from public.product_option_group_products assignments
  join public.product_option_groups groups on groups.id = assignments.option_group_id
  where assignments.product_id = v_box_id
    and lower(groups.name) = lower('Elige tus rolls')
  limit 1;

  if v_roll_group_id is null then
    raise exception 'Box 20 piezas no tiene el grupo Elige tus rolls';
  end if;

  insert into public.product_option_group_products (
    store_id, product_id, option_group_id, sort_order
  ) values (v_store_id, v_promo_id, v_roll_group_id, 10)
  on conflict (product_id, option_group_id) do update
  set sort_order = excluded.sort_order, updated_at = now();

  delete from public.product_option_group_products assignments
  using public.product_option_groups groups
  where assignments.option_group_id = groups.id
    and assignments.product_id = v_promo_id
    and groups.store_id = v_store_id
    and lower(groups.name) = lower('Frío');
end $$;
