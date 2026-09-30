do $$
declare
  v_store_id uuid;
  v_product_id uuid;
  v_group_id uuid;
  v_entry_group_id uuid;
  v_box record;
  v_option record;
begin
  select id into v_store_id
  from public.stores
  where slug = 'joshi-sushi'
  limit 1;

  if v_store_id is null then
    raise exception 'No se encontro el comercio Joshi Sushi';
  end if;

  for v_box in
    select * from (values
      ('Box 20 piezas', 2, false),
      ('Box 30 Piezas', 3, false),
      ('Box 40 piezas', 4, false),
      ('Box 60 piezas', 6, false),
      ('Box Entrada+20 Piezas', 2, true)
    ) as boxes(product_name, selections, includes_entry)
  loop
    select id into v_product_id
    from public.products
    where store_id = v_store_id
      and lower(name) = lower(v_box.product_name)
    limit 1;

    if v_product_id is null then
      raise exception 'No se encontro el producto %', v_box.product_name;
    end if;

    select groups.id into v_group_id
    from public.product_option_group_products assignments
    join public.product_option_groups groups on groups.id = assignments.option_group_id
    where assignments.product_id = v_product_id
      and lower(groups.name) = lower('Elige tus rolls')
    limit 1;

    if v_group_id is null then
      insert into public.product_option_groups (
        store_id, name, description, selection_type, required,
        min_select, max_select, is_active, sort_order
      ) values (
        v_store_id, 'Elige tus rolls', 'Cada selección de roll incluye 10 piezas',
        'multiple', true, v_box.selections, v_box.selections, true, 10
      ) returning id into v_group_id;

      insert into public.product_option_group_products (
        store_id, product_id, option_group_id, sort_order
      ) values (v_store_id, v_product_id, v_group_id, 10)
      on conflict (product_id, option_group_id) do update
      set sort_order = excluded.sort_order, updated_at = now();
    else
      update public.product_option_groups
      set description = 'Cada selección de roll incluye 10 piezas',
          selection_type = 'multiple',
          required = true,
          min_select = v_box.selections,
          max_select = v_box.selections,
          is_active = true,
          sort_order = 10,
          updated_at = now()
      where id = v_group_id;
    end if;

    for v_option in
      select * from (values
        ('Fish Roll (Tempura)', 10),
        ('Chicken Roll (Tempura)', 20),
        ('Ebi Roll (Frío)', 30),
        ('Dinamita Roll (Frío)', 40)
      ) as options(name, sort_order)
    loop
      if not exists (
        select 1 from public.product_option_values
        where option_group_id = v_group_id and lower(name) = lower(v_option.name)
      ) then
        insert into public.product_option_values (
          option_group_id, name, description, price_delta_usd, is_active, sort_order
        ) values (v_group_id, v_option.name, null, 0, true, v_option.sort_order);
      else
        update public.product_option_values
        set name = v_option.name,
            price_delta_usd = 0,
            is_active = true,
            sort_order = v_option.sort_order,
            updated_at = now()
        where option_group_id = v_group_id and lower(name) = lower(v_option.name);
      end if;
    end loop;

    delete from public.product_option_group_products assignments
    using public.product_option_groups groups
    where assignments.option_group_id = groups.id
      and assignments.product_id = v_product_id
      and groups.store_id = v_store_id
      and lower(groups.name) = lower('Frío');

    if v_box.includes_entry then
      select groups.id into v_entry_group_id
      from public.product_option_group_products assignments
      join public.product_option_groups groups on groups.id = assignments.option_group_id
      where assignments.product_id = v_product_id
        and lower(groups.name) = lower('Elige tu entrada')
      limit 1;

      if v_entry_group_id is null then
        insert into public.product_option_groups (
          store_id, name, description, selection_type, required,
          min_select, max_select, is_active, sort_order
        ) values (
          v_store_id, 'Elige tu entrada', null, 'single', true, 1, 1, true, 20
        ) returning id into v_entry_group_id;

        insert into public.product_option_group_products (
          store_id, product_id, option_group_id, sort_order
        ) values (v_store_id, v_product_id, v_entry_group_id, 20)
        on conflict (product_id, option_group_id) do update
        set sort_order = excluded.sort_order, updated_at = now();
      else
        update public.product_option_groups
        set selection_type = 'single', required = true, min_select = 1,
            max_select = 1, is_active = true, sort_order = 20, updated_at = now()
        where id = v_entry_group_id;
      end if;

      for v_option in
        select * from (values
          ('Camarón Crispy', 10),
          ('Ensalada dinamita', 20),
          ('Croquetas de pescado', 30),
          ('Gyozas de cerdo y vegetales', 40)
        ) as options(name, sort_order)
      loop
        if not exists (
          select 1 from public.product_option_values
          where option_group_id = v_entry_group_id and lower(name) = lower(v_option.name)
        ) then
          insert into public.product_option_values (
            option_group_id, name, description, price_delta_usd, is_active, sort_order
          ) values (v_entry_group_id, v_option.name, null, 0, true, v_option.sort_order);
        else
          update public.product_option_values
          set name = v_option.name,
              price_delta_usd = 0,
              is_active = true,
              sort_order = v_option.sort_order,
              updated_at = now()
          where option_group_id = v_entry_group_id and lower(name) = lower(v_option.name);
        end if;
      end loop;
    end if;
  end loop;
end $$;
