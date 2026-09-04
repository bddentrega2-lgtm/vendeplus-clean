-- Carga idempotente del menu con precio de Start 13 Grill.
-- Solo modifica el comercio con slug exacto `start-13`; no elimina contenido.
do $$
declare
  v_store_id uuid;
  v_row record;
  v_id uuid;
begin
  select id into v_store_id from public.stores where slug='start-13' limit 1;
  if v_store_id is null then raise exception 'No existe el comercio start-13.'; end if;

  create temp table tmp_s13_categories(name text primary key, sort_order int, category_id uuid) on commit drop;
  insert into tmp_s13_categories(name,sort_order) values
    ('Entradas y tapas',1),('Carnes al grill',2),('Cortes premium',3),('Parrillas',4),
    ('Fajitas',5),('Marisquería',6),('Especialidades',7),('Pastas',8),('Ensaladas',9),
    ('Hamburguesas',10),('Broaster',11),('Club House',12),('Menú Kids',13),
    ('Entradas árabes',14),('Cremas árabes',15),('Shawarmas',16),
    ('Sándwiches de falafel',17),('Platos mixtos árabes',18);

  for v_row in select * from tmp_s13_categories loop
    select id into v_id from public.categories where store_id=v_store_id and lower(btrim(name))=lower(btrim(v_row.name)) order by created_at limit 1;
    if v_id is null then
      insert into public.categories(store_id,name,is_active,sort_order) values(v_store_id,v_row.name,true,v_row.sort_order) returning id into v_id;
    else
      update public.categories set name=v_row.name,is_active=true,sort_order=v_row.sort_order where id=v_id;
    end if;
    update tmp_s13_categories set category_id=v_id where name=v_row.name;
  end loop;

  create temp table tmp_s13_products(category_name text,name text,description text,price numeric,sort_order int,product_id uuid,primary key(category_name,name)) on commit drop;
  insert into tmp_s13_products(category_name,name,description,price,sort_order) values
    ('Entradas y tapas','Tequeños Tradicionales','Tequeños de queso acompañados con salsa de la casa.',4,1),
    ('Entradas y tapas','Arepitas con Nata','Crujientes arepitas con crema de nata.',5,2),
    ('Entradas y tapas','Beacon Cheese','Crujientes papas fritas bañadas con queso cheddar fundido.',7,3),
    ('Entradas y tapas','Alitas de Pollo BBQ','Acompañadas con salsa BBQ; también disponibles estilo HOT.',7,4),
    ('Entradas y tapas','Chistorras','Deliciosas montaditas de chistorra.',10,5),
    ('Entradas y tapas','Carpaccio de Lomito','Con salsa pestolinni, alcaparras y tiras de nachos.',12,6),
    ('Entradas y tapas','Nachos Mexicanos','Nachos con queso fundido, pico de gallo, guacamole, crema de leche y chili con carne.',12,7),
    ('Entradas y tapas','Bandeja Start 13 Grill','Tequeños, chistorras, papas fritas, arepitas, nachos y 3 dips.',15,8),
    ('Entradas y tapas','Ceviche de Camarón','Camarones con cebolla, pimentón y ají dulce, acompañados de tiras de plátano verde.',16,9),
    ('Carnes al grill','Suprema de Pollo','Incluye dos contornos a elección.',9,1),
    ('Carnes al grill','Chuletón Ahumado','Incluye dos contornos a elección.',10,2),
    ('Carnes al grill','Churrasco de Solomo','Incluye dos contornos a elección.',12,3),
    ('Carnes al grill','Churrasco de Punta','Incluye dos contornos a elección.',12,4),
    ('Carnes al grill','Churrasco de Lomito','Incluye dos contornos a elección.',13,5),
    ('Carnes al grill','Lomo de Cerdo','Incluye dos contornos a elección.',15,6),
    ('Cortes premium','Solomo Santa Bárbara',null,18,1),
    ('Parrillas','Parrilla Start 13 Grill',null,26,1),
    ('Parrillas','Parrilla Mar y Tierra','Lomito, milanesa, camarones, calamares y pulpo. Incluye tostones o papas fritas.',35,2),
    ('Fajitas','Fajitas','Tortillas de harina de trigo, pico de gallo, crema de leche, guacamole y queso amarillo.',18,1),
    ('Marisquería','Asopado de Marisco',null,15,1),
    ('Marisquería','Camarones al Ajillo o Salteados',null,16,2),
    ('Marisquería','Fosforera',null,16,3),
    ('Marisquería','Churrasco de Róbalo',null,18.99,4),
    ('Especialidades','Lomito al Vino',null,17,1),('Especialidades','Lomito Capressa',null,17,2),
    ('Especialidades','Lomito con Champiñones',null,17.99,3),('Especialidades','Lomito 4 Quesos',null,17.99,4),
    ('Especialidades','Milanesa al Ajillo',null,12,5),('Especialidades','Milanesa a la Suiza',null,14,6),
    ('Especialidades','Milanesa con Champiñones',null,14,7),('Especialidades','Milanesa 4 Quesos',null,14,8),
    ('Especialidades','Cordon Bleu',null,15,9),('Especialidades','Lomo de Cerdo con Champiñones',null,15,10),
    ('Especialidades','Lomo de Cerdo al Vino',null,15,11),('Especialidades','Costillas de Cerdo a la BBQ',null,15,12),
    ('Pastas','Pasta Alfredo','Linguini, fettuccini o penne en salsa Alfredo con pollo.',9,1),
    ('Pastas','Crema de Pesto con Pollo','Base de salsa pesto tradicional y parmesano.',10,2),
    ('Pastas','Pasta 4 Quesos','Linguini, fettuccini o penne en cremosa salsa 4 quesos.',12,3),
    ('Pastas','Start 13 Grill','Pasta con bisque de mariscos, pimentón, camarones, calamares y pulpo.',16,4),
    ('Ensaladas','Ensalada Capressa','Tomate, queso mozzarella y pesto de la casa.',8,1),
    ('Ensaladas','Ensalada César con Pollo','Lechugas, crotones, tocineta, pollo a la plancha, parmesano y aderezo de la casa.',11,2),
    ('Ensaladas','Ensalada Start 13 Grill','Lechugas, crotones, tocineta, camarones, pollo crispy, parmesano y aderezo de la casa.',13,3),
    ('Hamburguesas','Start 13 Grill','180 g de carne, chuleta ahumada, cebolla caramelizada, queso americano, vegetales y aderezo. Incluye papas fritas.',9.5,1),
    ('Hamburguesas','Bacon Cheese','180 g de carne, tocineta caramelizada, aros de cebolla, queso americano, vegetales y aderezo. Incluye papas fritas.',9.5,2),
    ('Hamburguesas','Chicken Crispy','Pollo crispy, tocineta, queso americano, vegetales y aderezo. Incluye papas fritas.',9.5,3),
    ('Hamburguesas','Bacon Burger','180 g de carne o pollo, tocineta, huevo, queso americano, vegetales y salsas. Incluye papas fritas.',9.5,4),
    ('Hamburguesas','Super Start','180 g de carne, queso mozzarella, queso facilista, tocineta, huevo, vegetales y aderezo. Incluye papas fritas.',12,5),
    ('Broaster','Broaster Personal','4 piezas de pollo broaster con arepitas y una ración de ensalada.',9,1),
    ('Broaster','Broaster Familiar','Pollo broaster con 20 arepitas, 2 raciones de ensalada, salsa y refresco de 1.5 L.',28,2),
    ('Club House','Club House Especial','4 piezas de sándwich acompañadas de papas fritas y salsas.',26,1),
    ('Menú Kids','Cheeseburger',null,6,1),('Menú Kids','Tenders de Pollo con Papas',null,7,2),
    ('Entradas árabes','Servicio de Falafel','Croquetas tradicionales de garbanzo especiadas.',5,1),
    ('Entradas árabes','Servicio de Kibbe','Croquetas de carne molida y trigo con especias árabes.',10,2),
    ('Cremas árabes','Crema de Garbanzo',null,4,1),('Cremas árabes','Crema de Berenjena',null,5,2),('Cremas árabes','Crema de Pimentón',null,6,3),
    ('Shawarmas','Shawarma de Pollo 200 g',null,6,1),('Shawarmas','Combo 2 Shawarmas de Pollo 200 g',null,10,2),
    ('Shawarmas','Shawarma 300 g','Selecciona pollo, lomito o mixto.',8,3),
    ('Shawarmas','Combo 2 Shawarmas 300 g','Dos shawarmas de 300 g cada uno. Selecciona pollo, lomito o mixto.',14,4),
    ('Shawarmas','Shawarma Especial en Plato','Acompañado de papas fritas, pepinillos y salsa tum.',12,5),
    ('Sándwiches de falafel','2 Sándwiches de Falafel',null,4,1),('Sándwiches de falafel','Oferta 3 Sándwiches de Falafel',null,10,2),
    ('Platos mixtos árabes','Plato Mixto Individual','Degustación individual de cocina árabe.',15,1),
    ('Platos mixtos árabes','Plato Mixto Familiar','Combinación abundante para compartir en familia.',40,2);

  for v_row in select * from tmp_s13_products loop
    select id into v_id from public.products where store_id=v_store_id and lower(btrim(name))=lower(btrim(v_row.name)) and category_id=(select category_id from tmp_s13_categories where name=v_row.category_name) order by created_at limit 1;
    if v_id is null then
      insert into public.products(store_id,category_id,name,description,price_usd,discount_percent,image_url,is_available,is_featured,sort_order)
      values(v_store_id,(select category_id from tmp_s13_categories where name=v_row.category_name),v_row.name,v_row.description,v_row.price,0,null,true,false,v_row.sort_order) returning id into v_id;
    else
      update public.products set name=v_row.name,description=v_row.description,price_usd=v_row.price,discount_percent=0,is_available=true,is_featured=false,sort_order=v_row.sort_order,updated_at=now() where id=v_id;
    end if;
    update tmp_s13_products set product_id=v_id where category_name=v_row.category_name and name=v_row.name;
  end loop;

  create temp table tmp_s13_variants(category_name text,product_name text,name text,price numeric,sort_order int,primary key(category_name,product_name,name)) on commit drop;
  insert into tmp_s13_variants values
    ('Parrillas','Parrilla Start 13 Grill','2 personas',26,1),('Parrillas','Parrilla Start 13 Grill','4 personas',52,2),('Parrillas','Parrilla Start 13 Grill','6 personas',60,3),
    ('Parrillas','Parrilla Mar y Tierra','2 personas',35,1),('Parrillas','Parrilla Mar y Tierra','Familiar',52,2),
    ('Fajitas','Fajitas','Pollo',18,1),('Fajitas','Fajitas','Lomito',22,2),('Fajitas','Fajitas','Mixtas',22,3);
  for v_row in select v.*,p.product_id from tmp_s13_variants v join tmp_s13_products p on p.category_name=v.category_name and p.name=v.product_name loop
    if exists(select 1 from public.product_variants where product_id=v_row.product_id and lower(btrim(name))=lower(btrim(v_row.name))) then
      update public.product_variants set name=v_row.name,price_usd=v_row.price,is_available=true,sort_order=v_row.sort_order where product_id=v_row.product_id and lower(btrim(name))=lower(btrim(v_row.name));
    else insert into public.product_variants(product_id,name,price_usd,is_available,sort_order) values(v_row.product_id,v_row.name,v_row.price,true,v_row.sort_order); end if;
  end loop;

  create temp table tmp_s13_groups(group_key text primary key,name text,description text,selection_type text,required boolean,min_select int,max_select int,sort_order int,group_id uuid) on commit drop;
  insert into tmp_s13_groups values
    ('wing_style','Estilo de alitas','Selecciona el estilo.','single',true,1,1,1,null),
    ('sides','Contornos','Selecciona 2 contornos incluidos.','multiple',true,2,2,1,null),
    ('sea_side','Acompañamiento','Selecciona el acompañamiento incluido.','single',true,1,1,1,null),
    ('shrimp_style','Preparación','Selecciona la preparación.','single',true,1,1,1,null),
    ('pasta_type','Tipo de pasta','Selecciona el tipo de pasta.','single',true,1,1,1,null),
    ('burger_protein','Proteína','Selecciona carne o pollo.','single',true,1,1,1,null),
    ('shawarma_protein','Proteína','Selecciona pollo, lomito o mixto.','single',true,1,1,1,null);
  for v_row in select * from tmp_s13_groups loop
    select id into v_id from public.product_option_groups where store_id=v_store_id and lower(btrim(name))=lower(btrim(v_row.name)) and lower(coalesce(description,''))=lower(coalesce(v_row.description,'')) order by created_at limit 1;
    if v_id is null then
      insert into public.product_option_groups(store_id,name,description,selection_type,required,min_select,max_select,is_active,sort_order) values(v_store_id,v_row.name,v_row.description,v_row.selection_type,v_row.required,v_row.min_select,v_row.max_select,true,v_row.sort_order) returning id into v_id;
    else update public.product_option_groups set selection_type=v_row.selection_type,required=v_row.required,min_select=v_row.min_select,max_select=v_row.max_select,is_active=true,sort_order=v_row.sort_order,updated_at=now() where id=v_id; end if;
    update tmp_s13_groups set group_id=v_id where group_key=v_row.group_key;
  end loop;

  create temp table tmp_s13_options(group_key text,name text,price numeric,sort_order int,primary key(group_key,name)) on commit drop;
  insert into tmp_s13_options values
    ('wing_style','BBQ',0,1),('wing_style','HOT',0,2),
    ('sides','Papas al Ajillo',0,1),('sides','Papas Fritas',0,2),('sides','Arroz Blanco',0,3),('sides','Yuca',0,4),('sides','Tostones',0,5),('sides','Puré de Papas',0,6),('sides','Pan al Ajillo',0,7),('sides','Queso a la Plancha',0,8),('sides','Vegetales Salteados',0,9),('sides','Ensalada Pico e Gallo',0,10),('sides','Ensalada Mixta',0,11),('sides','Ensalada César',0,12),('sides','Ensalada Cole Slaw',0,13),
    ('sea_side','Tostones',0,1),('sea_side','Papas Fritas',0,2),
    ('shrimp_style','Al Ajillo',0,1),('shrimp_style','Salteados',0,2),
    ('pasta_type','Linguini',0,1),('pasta_type','Fettuccini',0,2),('pasta_type','Penne',0,3),
    ('burger_protein','Carne',0,1),('burger_protein','Pollo',0,2),
    ('shawarma_protein','Pollo',0,1),('shawarma_protein','Lomito',0,2),('shawarma_protein','Mixto',0,3);
  for v_row in select o.*,g.group_id from tmp_s13_options o join tmp_s13_groups g using(group_key) loop
    if exists(select 1 from public.product_option_values where option_group_id=v_row.group_id and lower(btrim(name))=lower(btrim(v_row.name))) then
      update public.product_option_values set name=v_row.name,price_delta_usd=v_row.price,is_active=true,sort_order=v_row.sort_order,updated_at=now() where option_group_id=v_row.group_id and lower(btrim(name))=lower(btrim(v_row.name));
    else insert into public.product_option_values(option_group_id,name,description,price_delta_usd,is_active,sort_order) values(v_row.group_id,v_row.name,null,v_row.price,true,v_row.sort_order); end if;
  end loop;

  create temp table tmp_s13_links(group_key text,category_name text,product_name text,sort_order int,primary key(group_key,category_name,product_name)) on commit drop;
  insert into tmp_s13_links
    select 'sides',category_name,name,1 from tmp_s13_products where category_name='Carnes al grill'
    union all select 'wing_style','Entradas y tapas','Alitas de Pollo BBQ',1
    union all select 'sea_side','Parrillas','Parrilla Mar y Tierra',1
    union all select 'shrimp_style','Marisquería','Camarones al Ajillo o Salteados',1
    union all select 'pasta_type','Pastas','Pasta Alfredo',1
    union all select 'pasta_type','Pastas','Pasta 4 Quesos',1
    union all select 'burger_protein','Hamburguesas','Bacon Burger',1
    union all select 'shawarma_protein','Shawarmas','Shawarma 300 g',1
    union all select 'shawarma_protein','Shawarmas','Combo 2 Shawarmas 300 g',1;
  for v_row in select l.*,g.group_id,p.product_id from tmp_s13_links l join tmp_s13_groups g using(group_key) join tmp_s13_products p on p.category_name=l.category_name and p.name=l.product_name loop
    insert into public.product_option_group_products(store_id,product_id,option_group_id,sort_order) values(v_store_id,v_row.product_id,v_row.group_id,v_row.sort_order)
    on conflict(product_id,option_group_id) do update set store_id=excluded.store_id,sort_order=excluded.sort_order,updated_at=now();
  end loop;
end $$;
