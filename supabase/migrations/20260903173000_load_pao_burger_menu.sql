-- Carga idempotente del menu de Pao Burger; solo afecta slug `pao-burger`.
do $$
declare v_store_id uuid; v_row record; v_id uuid; v_group_id uuid;
begin
  select id into v_store_id from public.stores where slug='pao-burger' limit 1;
  if v_store_id is null then raise exception 'No existe pao-burger.'; end if;
  create temp table tmp_pb_cat(name text primary key,sort_order int,id uuid) on commit drop;
  insert into tmp_pb_cat(name,sort_order) values ('Entradas',1),('Bebidas',2),('Shawarmas',3),('Perros',4),('Hamburguesas',5),('Club House',6),('Pollo a la broaster',7),('Pizzas',8),('Pepitos',9);
  for v_row in select * from tmp_pb_cat loop
    select id into v_id from public.categories where store_id=v_store_id and lower(btrim(name))=lower(btrim(v_row.name)) order by created_at limit 1;
    if v_id is null then insert into public.categories(store_id,name,is_active,sort_order) values(v_store_id,v_row.name,true,v_row.sort_order) returning id into v_id;
    else update public.categories set name=v_row.name,is_active=true,sort_order=v_row.sort_order where id=v_id; end if;
    update tmp_pb_cat set id=v_id where name=v_row.name;
  end loop;
  create temp table tmp_pb_prod(category_name text,name text,description text,price numeric,sort_order int,id uuid,primary key(category_name,name)) on commit drop;
  insert into tmp_pb_prod(category_name,name,description,price,sort_order) values
    ('Entradas','Papas Fritas',null,2.5,1),('Entradas','Papas Fritas con Cheddar y Tocineta',null,4,2),('Entradas','Salchipapas',null,5,3),('Entradas','Tender de Pollo',null,5,4),('Entradas','Nuggets de Pollo',null,5,5),
    ('Bebidas','Botella',null,1,1),('Bebidas','Agua Mineral',null,1,2),('Bebidas','Malta',null,1,3),('Bebidas','Jugos',null,1.5,4),('Bebidas','Nestea Pequeño',null,1.5,5),('Bebidas','Nestea Mediano',null,2,6),('Bebidas','Nestea Grande',null,2.5,7),('Bebidas','Refresco 1 L',null,3,8),('Bebidas','Refresco 1.5 L',null,3.5,9),
    ('Shawarmas','Shawarma de Pollo',null,7,1),('Shawarmas','Shawarma Mixto',null,8,2),
    ('Perros','Sencillo','Salchicha Alimex, queso amarillo, papitas, ensalada y salsas clásicas.',2.5,1),('Perros','Especial','Tocineta, maíz, papitas, ensalada y salsas clásicas.',3,2),('Perros','Polaco','Salchicha polaca, maíz, queso amarillo, tocineta, papitas, ensalada y salsas clásicas.',4,3),('Perros','Frankfurt','Salchicha Frankfurt, maíz, tocineta, queso amarillo, ensalada y salsas.',4,4),('Perros','Alemán','Salchicha alemana, maíz, tocineta, queso amarillo, ensalada y salsas clásicas.',4,5),('Perros','Pepiperro','Carne, pollo y chorizo a la plancha, tocineta, vegetales, maíz, queso amarillo, papitas, salsas y 300 g de papas fritas.',7,6),
    ('Hamburguesas','Kids','100 g de carne o pollo, queso amarillo y papas ralladas. Incluye papas fritas.',4,1),('Hamburguesas','Americana','150 g de carne o pollo, tocineta, maíz, queso amarillo, vegetales, papas ralladas y salsas. Incluye papas fritas.',7,2),('Hamburguesas','Chuleta Ahumada','150 g de chuleta ahumada, tocineta, maíz, queso amarillo, vegetales, papas ralladas y salsas. Incluye papas fritas.',7,3),('Hamburguesas','Crispy','150 g de pollo crispy, tocineta, maíz, queso amarillo, papas ralladas, vegetales y salsas. Incluye papas fritas.',8,4),('Hamburguesas','Callejera','150 g de carne o pollo, chorizo, tocineta, huevo, maíz, queso amarillo, vegetales, papas ralladas y salsas. Incluye papas fritas.',8,5),('Hamburguesas','Lomito','150 g de lomito, maíz, huevo, tocineta, queso amarillo, papas ralladas, vegetales y salsas. Incluye papas fritas.',9,6),('Hamburguesas','Doble o Mixta','300 g de carne, pollo o chuleta, tocineta, maíz, huevo, papas ralladas, queso amarillo, vegetales y salsas. Incluye papas fritas.',9,7),('Hamburguesas','Triple','150 g de carne, 150 g de pollo, 150 g de chuleta, maíz, tocineta, chorizo, queso amarillo, huevo, papas ralladas, vegetales y salsas. Incluye papas fritas.',12,8),
    ('Club House','Club House','Milanesa, huevo, tomate, lechuga, queso amarillo, jamón, tocineta y salsas. Incluye papas fritas.',12,1),
    ('Pollo a la broaster','Combo Pollo a la Broaster','Pollo broaster, tostón, arepitas, ensalada y salsas.',6,1),
    ('Pizzas','Margarita','Salsa napolitana y queso mozzarella.',5,1),('Pizzas','Pepperoni','Salsa napolitana, queso mozzarella y pepperoni.',6,2),('Pizzas','Primavera','Salsa napolitana, mozzarella, tocineta, maíz, pimentón y cebolla.',7,3),
    ('Pepitos','Pepito Carne o Pollo','300 g de carne o pollo, tocineta, queso amarillo, vegetales y salsas. Incluye papas fritas.',12,1),('Pepitos','Pepito Estocada','300 g de lomito, tocineta, papas ralladas, queso amarillo, vegetales y salsas. Incluye papas fritas.',12,2),('Pepitos','Pepito Mixto','300 g de carne, pollo o chuleta, tocineta, papas ralladas, queso amarillo y vegetales. Incluye papas fritas.',12,3),('Pepitos','Pepito Salteado','300 g de carne y pollo, tocineta, pimentón, cebolla, mozzarella y salsas. Incluye papas fritas.',12,4),('Pepitos','Pepito Picador','200 g de tocineta, queso amarillo, papas ralladas, vegetales y salsas. Incluye papas fritas.',12,5),('Pepitos','Pepito Guaro','300 g de carne y pollo, tocineta, queso amarillo, maíz, queso pecorino gratinado y salsas. Incluye papas fritas.',12,6),('Pepitos','Granjero','Pollo granjero, vegetales, maíz, tocineta y salsas. Incluye papas fritas.',12,7),('Pepitos','Torero Plaza','300 g de carne y pollo o chuleta, tocineta, papas ralladas, papas naturales, queso amarillo, queso paisa y vegetales.',12,8);
  for v_row in select * from tmp_pb_prod loop
    select id into v_id from public.products where store_id=v_store_id and lower(btrim(name))=lower(btrim(v_row.name)) order by created_at limit 1;
    if v_id is null then insert into public.products(store_id,category_id,name,description,price_usd,discount_percent,image_url,is_available,is_featured,sort_order) values(v_store_id,(select id from tmp_pb_cat where name=v_row.category_name),v_row.name,v_row.description,v_row.price,0,null,true,false,v_row.sort_order) returning id into v_id;
    else update public.products set category_id=(select id from tmp_pb_cat where name=v_row.category_name),name=v_row.name,description=v_row.description,price_usd=v_row.price,discount_percent=0,is_available=true,is_featured=false,sort_order=v_row.sort_order,updated_at=now() where id=v_id; end if;
    update tmp_pb_prod set id=v_id where category_name=v_row.category_name and name=v_row.name;
  end loop;
  create temp table tmp_pb_var(category_name text,product_name text,name text,price numeric,sort_order int,primary key(category_name,product_name,name)) on commit drop;
  insert into tmp_pb_var values
    ('Club House','Club House','4 piezas · Pollo',12,1),('Club House','Club House','4 piezas · Mixto',14,2),('Club House','Club House','8 piezas · Pollo',19,3),('Club House','Club House','8 piezas · Mixto',21,4),
    ('Pollo a la broaster','Combo Pollo a la Broaster','2 piezas',6,1),('Pollo a la broaster','Combo Pollo a la Broaster','4 piezas',9,2),('Pollo a la broaster','Combo Pollo a la Broaster','6 piezas',12,3),('Pollo a la broaster','Combo Pollo a la Broaster','8 piezas',14,4),('Pollo a la broaster','Combo Pollo a la Broaster','10 piezas',16,5),('Pollo a la broaster','Combo Pollo a la Broaster','14 piezas',20,6),('Pollo a la broaster','Combo Pollo a la Broaster','20 piezas',27,7),
    ('Pizzas','Margarita','Mediana',5,1),('Pizzas','Margarita','Familiar',10,2),('Pizzas','Pepperoni','Mediana',6,1),('Pizzas','Pepperoni','Familiar',11,2),('Pizzas','Primavera','Mediana',7,1),('Pizzas','Primavera','Familiar',12,2);
  for v_row in select v.*,p.id product_id from tmp_pb_var v join tmp_pb_prod p on p.category_name=v.category_name and p.name=v.product_name loop
    if exists(select 1 from public.product_variants where product_id=v_row.product_id and lower(btrim(name))=lower(btrim(v_row.name))) then update public.product_variants set name=v_row.name,price_usd=v_row.price,is_available=true,sort_order=v_row.sort_order where product_id=v_row.product_id and lower(btrim(name))=lower(btrim(v_row.name));
    else insert into public.product_variants(product_id,name,price_usd,is_available,sort_order) values(v_row.product_id,v_row.name,v_row.price,true,v_row.sort_order); end if;
  end loop;
  create temp table tmp_pb_groups(group_key text primary key,name text,description text,group_id uuid) on commit drop;
  insert into tmp_pb_groups values ('meat2','Proteína','Selecciona carne o pollo.',null),('meat3','Tipo de proteína','Selecciona carne, pollo o chuleta.',null),('torero','Preparación Torero','Selecciona carne y pollo o chuleta.',null);
  for v_row in select * from tmp_pb_groups loop
    select id into v_group_id from public.product_option_groups where store_id=v_store_id and lower(btrim(name))=lower(btrim(v_row.name)) order by created_at limit 1;
    if v_group_id is null then insert into public.product_option_groups(store_id,name,description,selection_type,required,min_select,max_select,is_active,sort_order) values(v_store_id,v_row.name,v_row.description,'single',true,1,1,true,1) returning id into v_group_id;
    else update public.product_option_groups set description=v_row.description,selection_type='single',required=true,min_select=1,max_select=1,is_active=true,updated_at=now() where id=v_group_id; end if;
    update tmp_pb_groups set group_id=v_group_id where group_key=v_row.group_key;
  end loop;
  create temp table tmp_pb_opt(group_key text,name text,sort_order int,primary key(group_key,name)) on commit drop;
  insert into tmp_pb_opt values ('meat2','Carne',1),('meat2','Pollo',2),('meat3','Carne',1),('meat3','Pollo',2),('meat3','Chuleta',3),('torero','Carne y pollo',1),('torero','Chuleta',2);
  for v_row in select o.*,g.group_id from tmp_pb_opt o join tmp_pb_groups g using(group_key) loop
    if exists(select 1 from public.product_option_values where option_group_id=v_row.group_id and lower(btrim(name))=lower(btrim(v_row.name))) then update public.product_option_values set name=v_row.name,price_delta_usd=0,is_active=true,sort_order=v_row.sort_order,updated_at=now() where option_group_id=v_row.group_id and lower(btrim(name))=lower(btrim(v_row.name));
    else insert into public.product_option_values(option_group_id,name,description,price_delta_usd,is_active,sort_order) values(v_row.group_id,v_row.name,null,0,true,v_row.sort_order); end if;
  end loop;
  create temp table tmp_pb_links(group_key text,category_name text,product_name text,primary key(group_key,category_name,product_name)) on commit drop;
  insert into tmp_pb_links values ('meat2','Hamburguesas','Kids'),('meat2','Hamburguesas','Americana'),('meat2','Hamburguesas','Callejera'),('meat2','Pepitos','Pepito Carne o Pollo'),('meat3','Hamburguesas','Doble o Mixta'),('meat3','Pepitos','Pepito Mixto'),('torero','Pepitos','Torero Plaza');
  for v_row in select l.*,g.group_id,p.id product_id from tmp_pb_links l join tmp_pb_groups g using(group_key) join tmp_pb_prod p on p.category_name=l.category_name and p.name=l.product_name loop
    insert into public.product_option_group_products(store_id,product_id,option_group_id,sort_order) values(v_store_id,v_row.product_id,v_row.group_id,1) on conflict(product_id,option_group_id) do update set store_id=excluded.store_id,updated_at=now();
  end loop;
end $$;
