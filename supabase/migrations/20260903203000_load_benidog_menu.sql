-- Carga idempotente del menu de Benidog; solo afecta el slug `benidog`.
do $$
declare v_store_id uuid; v_row record; v_id uuid; v_group_id uuid;
begin
  select id into v_store_id from public.stores where slug='benidog' limit 1;
  if v_store_id is null then raise exception 'No existe benidog.'; end if;
  create temp table tmp_bd_cat(name text primary key,sort_order int,id uuid) on commit drop;
  insert into tmp_bd_cat(name,sort_order) values ('Perros calientes',1),('Perros especiales',2),('Papas fritas',3),('Hamburguesas',4),('Hamburguesas especiales',5),('Promociones',6),('Bebidas',7);
  for v_row in select * from tmp_bd_cat loop
    select id into v_id from public.categories where store_id=v_store_id and lower(btrim(name))=lower(btrim(v_row.name)) order by created_at limit 1;
    if v_id is null then insert into public.categories(store_id,name,is_active,sort_order) values(v_store_id,v_row.name,true,v_row.sort_order) returning id into v_id;
    else update public.categories set name=v_row.name,is_active=true,sort_order=v_row.sort_order where id=v_id; end if;
    update tmp_bd_cat set id=v_id where name=v_row.name;
  end loop;
  create temp table tmp_bd_prod(category_name text,name text,description text,price numeric,sort_order int,id uuid,primary key(category_name,name)) on commit drop;
  insert into tmp_bd_prod(category_name,name,description,price,sort_order) values
    ('Perros calientes','Perrito Calle 15 cm','Salchicha Alimex, ensalada, papitas o tostones, mayonesa, kétchup, mostaza y queso de año.',1.50,1),
    ('Perros calientes','Perro Tradicional 20 cm','Salchicha Alimex, cebolla, papitas o tostones, mayonesa, kétchup, mostaza y queso de año.',2.50,2),
    ('Perros calientes','Con Proteína 20 cm','Proteína, cebolla, papitas o tostones, mayonesa, kétchup y mostaza.',6,3),
    ('Perros especiales','Atrevido','Perro de 20 cm con pepinillos agridulces y queso.',3.50,1),
    ('Perros especiales','Hawaiano / Caribeño','Perro de 20 cm con mermelada de piña o pimentón y queso.',3.50,2),
    ('Perros especiales','Benito','Perro de 20 cm con tocineta enrollada, cebolla caramelizada y queso.',3.50,3),
    ('Perros especiales','Gourmet','Perro de 20 cm con mermelada de tocineta y queso.',3.50,4),
    ('Perros especiales','Pepón','Perro de 20 cm con maíz, tocineta y queso.',4,5),
    ('Perros especiales','Full Papas','Perro de 20 cm con papas naturales, tocineta y queso.',4.50,6),
    ('Papas fritas','Papas Fritas',null,2,1),
    ('Hamburguesas','Hamburguesa Normal','Pan brioche, vegetales, papitas o tostones, proteína, queso amarillo rallado, cebolla caramelizada y salsa especial.',4,1),
    ('Hamburguesas','Hamburguesa Especial','Pan brioche, vegetales, papitas o tostones, proteína, huevo, tocineta, queso amarillo rallado, cebolla caramelizada y salsa especial.',5,2),
    ('Hamburguesas especiales','Hamburguesa Atrevida','Pepinillos agridulces, tocineta y queso amarillo rallado, sin vegetales.',5,1),
    ('Hamburguesas especiales','Hamburguesa Hawaiana / Caribeña','Mermelada de piña o pimentón, tocineta y queso amarillo rallado, sin vegetales.',5,2),
    ('Hamburguesas especiales','Gourmet con Tocineta','Mermelada de tocineta y queso amarillo rallado, sin vegetales.',5,3),
    ('Promociones','4 Perritos Calle + Refresco 1 L',null,7,1),
    ('Promociones','10 Perritos Calle + Refresco 1 L',null,15,2),
    ('Promociones','2 Hamburguesas Normal + Papas + Refresco 1 L','Incluye 100 g de papas fritas.',10,3),
    ('Bebidas','Refresco Bombita',null,1.50,1),('Bebidas','Refresco 1 L',null,2,2),('Bebidas','Malta Botella',null,1.50,3),('Bebidas','Ice Tea Benidog',null,1.50,4),('Bebidas','Jugos',null,1.50,5),('Bebidas','Bebida en Lata',null,2,6),('Bebidas','Agua Mineral',null,1.50,7);
  for v_row in select * from tmp_bd_prod loop
    select id into v_id from public.products where store_id=v_store_id and lower(btrim(name))=lower(btrim(v_row.name)) order by created_at limit 1;
    if v_id is null then insert into public.products(store_id,category_id,name,description,price_usd,discount_percent,image_url,is_available,is_featured,sort_order) values(v_store_id,(select id from tmp_bd_cat where name=v_row.category_name),v_row.name,v_row.description,v_row.price,0,null,true,false,v_row.sort_order) returning id into v_id;
    else update public.products set category_id=(select id from tmp_bd_cat where name=v_row.category_name),name=v_row.name,description=v_row.description,price_usd=v_row.price,discount_percent=0,is_available=true,is_featured=false,sort_order=v_row.sort_order,updated_at=now() where id=v_id; end if;
    update tmp_bd_prod set id=v_id where category_name=v_row.category_name and name=v_row.name;
  end loop;
  create temp table tmp_bd_var(category_name text,product_name text,name text,price numeric,sort_order int,primary key(category_name,product_name,name)) on commit drop;
  insert into tmp_bd_var values
    ('Papas fritas','Papas Fritas','100 g',2,1),('Papas fritas','Papas Fritas','200 g',2.50,2),('Papas fritas','Papas Fritas','300 g',3,3),
    ('Hamburguesas','Hamburguesa Normal','Sencilla',4,1),('Hamburguesas','Hamburguesa Normal','Doble',6,2),('Hamburguesas','Hamburguesa Normal','Triple',8,3),
    ('Hamburguesas','Hamburguesa Especial','Sencilla',5,1),('Hamburguesas','Hamburguesa Especial','Doble',7,2),('Hamburguesas','Hamburguesa Especial','Triple',9,3),
    ('Hamburguesas especiales','Hamburguesa Atrevida','Sencilla',5,1),('Hamburguesas especiales','Hamburguesa Atrevida','Doble',7,2),
    ('Hamburguesas especiales','Hamburguesa Hawaiana / Caribeña','Sencilla',5,1),('Hamburguesas especiales','Hamburguesa Hawaiana / Caribeña','Doble',7,2),
    ('Hamburguesas especiales','Gourmet con Tocineta','Sencilla',5,1),('Hamburguesas especiales','Gourmet con Tocineta','Doble',7,2);
  for v_row in select v.*,p.id product_id from tmp_bd_var v join tmp_bd_prod p on p.category_name=v.category_name and p.name=v.product_name loop
    if exists(select 1 from public.product_variants where product_id=v_row.product_id and lower(btrim(name))=lower(btrim(v_row.name))) then update public.product_variants set name=v_row.name,price_usd=v_row.price,is_available=true,sort_order=v_row.sort_order where product_id=v_row.product_id and lower(btrim(name))=lower(btrim(v_row.name));
    else insert into public.product_variants(product_id,name,price_usd,is_available,sort_order) values(v_row.product_id,v_row.name,v_row.price,true,v_row.sort_order); end if;
  end loop;
  create temp table tmp_bd_groups(group_key text primary key,name text,description text,required boolean,min_select int,max_select int,group_id uuid) on commit drop;
  insert into tmp_bd_groups values
    ('crunch','Papitas o tostones','Selecciona una opción.',true,1,1,null),
    ('dog_protein','Proteína del perro','Selecciona la proteína.',true,1,1,null),
    ('jam','Sabor de mermelada','Selecciona piña o pimentón.',true,1,1,null),
    ('burger_protein','Proteína de la hamburguesa','Selecciona la proteína.',true,1,1,null),
    ('dog_extras','Extras para perros','Agrega los extras que desees.',false,0,8,null),
    ('burger_extras','Extras para hamburguesas','Agrega los extras que desees.',false,0,9,null);
  for v_row in select * from tmp_bd_groups loop
    select id into v_group_id from public.product_option_groups where store_id=v_store_id and lower(btrim(name))=lower(btrim(v_row.name)) order by created_at limit 1;
    if v_group_id is null then insert into public.product_option_groups(store_id,name,description,selection_type,required,min_select,max_select,is_active,sort_order) values(v_store_id,v_row.name,v_row.description,case when v_row.required then 'single' else 'multiple' end,v_row.required,v_row.min_select,v_row.max_select,true,1) returning id into v_group_id;
    else update public.product_option_groups set description=v_row.description,selection_type=case when v_row.required then 'single' else 'multiple' end,required=v_row.required,min_select=v_row.min_select,max_select=v_row.max_select,is_active=true,updated_at=now() where id=v_group_id; end if;
    update tmp_bd_groups set group_id=v_group_id where group_key=v_row.group_key;
  end loop;
  create temp table tmp_bd_opt(group_key text,name text,price numeric,sort_order int,primary key(group_key,name)) on commit drop;
  insert into tmp_bd_opt values
    ('crunch','Papitas',0,1),('crunch','Tostones',0,2),
    ('dog_protein','Lomito',0,1),('dog_protein','Pollo',0,2),('dog_protein','Cerdo',0,3),('dog_protein','Chorizo',0,4),('dog_protein','Mixto',0,5),('dog_protein','Tocineta',0,6),
    ('jam','Piña',0,1),('jam','Pimentón',0,2),
    ('burger_protein','Lomito',0,1),('burger_protein','Pollo',0,2),('burger_protein','Chuleta',0,3),('burger_protein','Mixta',0,4),
    ('dog_extras','Salchicha',1,1),('dog_extras','Tocineta',1,2),('dog_extras','Queso Amarillo',0.50,3),('dog_extras','Mermelada de Tocineta',1,4),('dog_extras','Maíz',0.50,5),('dog_extras','Huevo',0.50,6),('dog_extras','Mermeladas',0.50,7),('dog_extras','Pepinillos',0.50,8),
    ('burger_extras','Salchicha',1,1),('burger_extras','Tocineta',1,2),('burger_extras','Queso Amarillo',1,3),('burger_extras','Mermelada de Tocineta',1,4),('burger_extras','Maíz',0.50,5),('burger_extras','Huevo',0.50,6),('burger_extras','Mermeladas',0.50,7),('burger_extras','Pepinillos',0.50,8),('burger_extras','Papas Fritas',1,9);
  for v_row in select o.*,g.group_id from tmp_bd_opt o join tmp_bd_groups g using(group_key) loop
    if exists(select 1 from public.product_option_values where option_group_id=v_row.group_id and lower(btrim(name))=lower(btrim(v_row.name))) then update public.product_option_values set name=v_row.name,price_delta_usd=v_row.price,is_active=true,sort_order=v_row.sort_order,updated_at=now() where option_group_id=v_row.group_id and lower(btrim(name))=lower(btrim(v_row.name));
    else insert into public.product_option_values(option_group_id,name,description,price_delta_usd,is_active,sort_order) values(v_row.group_id,v_row.name,null,v_row.price,true,v_row.sort_order); end if;
  end loop;
  create temp table tmp_bd_links(group_key text,category_name text,product_name text,sort_order int,primary key(group_key,category_name,product_name)) on commit drop;
  insert into tmp_bd_links
    select 'crunch',category_name,name,1 from tmp_bd_prod where category_name in('Perros calientes','Hamburguesas')
    union all select 'dog_protein','Perros calientes','Con Proteína 20 cm',2
    union all select 'jam','Perros especiales','Hawaiano / Caribeño',2
    union all select 'jam','Hamburguesas especiales','Hamburguesa Hawaiana / Caribeña',1
    union all select 'burger_protein','Hamburguesas',name,2 from tmp_bd_prod where category_name='Hamburguesas'
    union all select 'dog_extras',category_name,name,3 from tmp_bd_prod where category_name in('Perros calientes','Perros especiales')
    union all select 'burger_extras',category_name,name,3 from tmp_bd_prod where category_name in('Hamburguesas','Hamburguesas especiales');
  for v_row in select l.*,g.group_id,p.id product_id from tmp_bd_links l join tmp_bd_groups g using(group_key) join tmp_bd_prod p on p.category_name=l.category_name and p.name=l.product_name loop
    insert into public.product_option_group_products(store_id,product_id,option_group_id,sort_order) values(v_store_id,v_row.product_id,v_row.group_id,v_row.sort_order) on conflict(product_id,option_group_id) do update set store_id=excluded.store_id,sort_order=excluded.sort_order,updated_at=now();
  end loop;
end $$;
