-- Carga idempotente del menu suministrado para Cachapisima.
-- Solo modifica el comercio con slug exacto `cachapisima`; no elimina contenido.
do $$
declare
  v_store_id uuid;
  v_row record;
  v_id uuid;
  v_group_id uuid;
begin
  select id into v_store_id from public.stores where slug='cachapisima' limit 1;
  if v_store_id is null then raise exception 'No existe el comercio cachapisima.'; end if;

  create temp table tmp_cp_categories(name text primary key,sort_order int,category_id uuid) on commit drop;
  insert into tmp_cp_categories(name,sort_order) values ('Cachapas',1),('Bebidas',2);
  for v_row in select * from tmp_cp_categories loop
    select id into v_id from public.categories where store_id=v_store_id and lower(btrim(name))=lower(btrim(v_row.name)) order by created_at limit 1;
    if v_id is null then insert into public.categories(store_id,name,is_active,sort_order) values(v_store_id,v_row.name,true,v_row.sort_order) returning id into v_id;
    else update public.categories set name=v_row.name,is_active=true,sort_order=v_row.sort_order where id=v_id; end if;
    update tmp_cp_categories set category_id=v_id where name=v_row.name;
  end loop;

  create temp table tmp_cp_products(category_name text,name text,description text,price numeric,sort_order int,product_id uuid,primary key(category_name,name)) on commit drop;
  insert into tmp_cp_products(category_name,name,description,price,sort_order) values
    ('Cachapas','La Viuda','Mejor sola que mal acompañada. Cachapa sola de 25 cm de diámetro.',2,1),
    ('Cachapas','La Clásica','Sencilla pero con actitud. Cachapa con queso de mano.',6.5,2),
    ('Cachapas','La Guayanesa','Un clásico que nunca falla. Cachapa con queso guayanés.',7.5,3),
    ('Cachapas','La Quesúa','Más queso, más sabor. Cachapa con doble queso de mano.',8.5,4),
    ('Cachapas','Cachapa Light','Ideal si eres fitness. Cachapa con queso de mano y jamón.',7.5,5),
    ('Cachapas','La Sabrosita','La combinación con tocineta. Queso de mano y tocineta.',8.5,6),
    ('Cachapas','La Tórica','Difícil de olvidar. Cachapa con queso de mano, jamón, queso amarillo y tocineta.',10.5,7),
    ('Cachapas','La Poderosa','Cachapa con queso de mano y chorizo.',9.5,8),
    ('Cachapas','La Reina','La preferida por todos. Cachapa con queso de mano y cochino.',12,9),
    ('Cachapas','La Casada','Doble cachapa con queso de mano y cochino.',16,10),
    ('Cachapas','Cachapa Burger','Doble mini cachapas con queso de mano, queso facilista, tocineta, carne y cochino.',10.5,11),
    ('Cachapas','Porky','1 kg de cerdo ahumado, crocante y delicioso.',25,12),
    ('Bebidas','Refresco 350 ml',null,1.25,1),('Bebidas','Malta 222 ml',null,1.30,2),
    ('Bebidas','Agua Mineral',null,1,3),('Bebidas','Papelón con Limón',null,1.20,4),
    ('Bebidas','Refresco 1.5 L',null,3.50,5);

  for v_row in select * from tmp_cp_products loop
    select id into v_id from public.products where store_id=v_store_id and lower(btrim(name))=lower(btrim(v_row.name)) order by created_at limit 1;
    if v_id is null then
      insert into public.products(store_id,category_id,name,description,price_usd,discount_percent,image_url,is_available,is_featured,sort_order)
      values(v_store_id,(select category_id from tmp_cp_categories where name=v_row.category_name),v_row.name,v_row.description,v_row.price,0,null,true,false,v_row.sort_order) returning id into v_id;
    else
      update public.products set category_id=(select category_id from tmp_cp_categories where name=v_row.category_name),name=v_row.name,description=v_row.description,price_usd=v_row.price,discount_percent=0,is_available=true,is_featured=false,sort_order=v_row.sort_order,updated_at=now() where id=v_id;
    end if;
    update tmp_cp_products set product_id=v_id where category_name=v_row.category_name and name=v_row.name;
  end loop;

  select id into v_group_id from public.product_option_groups where store_id=v_store_id and lower(btrim(name))='extras' order by created_at limit 1;
  if v_group_id is null then
    insert into public.product_option_groups(store_id,name,description,selection_type,required,min_select,max_select,is_active,sort_order)
    values(v_store_id,'Extras','Agrega los extras que desees.','multiple',false,0,4,true,1) returning id into v_group_id;
  else
    update public.product_option_groups set description='Agrega los extras que desees.',selection_type='multiple',required=false,min_select=0,max_select=4,is_active=true,sort_order=1,updated_at=now() where id=v_group_id;
  end if;

  create temp table tmp_cp_options(name text primary key,price numeric,sort_order int) on commit drop;
  insert into tmp_cp_options values ('Limón',1,1),('Chimichurri',1.30,2),('Natilla',1.50,3),('Ración de Cerdo',6.25,4);
  for v_row in select * from tmp_cp_options loop
    if exists(select 1 from public.product_option_values where option_group_id=v_group_id and lower(btrim(name))=lower(btrim(v_row.name))) then
      update public.product_option_values set name=v_row.name,price_delta_usd=v_row.price,is_active=true,sort_order=v_row.sort_order,updated_at=now() where option_group_id=v_group_id and lower(btrim(name))=lower(btrim(v_row.name));
    else insert into public.product_option_values(option_group_id,name,description,price_delta_usd,is_active,sort_order) values(v_group_id,v_row.name,null,v_row.price,true,v_row.sort_order); end if;
  end loop;

  for v_row in select product_id from tmp_cp_products where category_name='Cachapas' loop
    insert into public.product_option_group_products(store_id,product_id,option_group_id,sort_order)
    values(v_store_id,v_row.product_id,v_group_id,1)
    on conflict(product_id,option_group_id) do update set store_id=excluded.store_id,sort_order=excluded.sort_order,updated_at=now();
  end loop;
end $$;
