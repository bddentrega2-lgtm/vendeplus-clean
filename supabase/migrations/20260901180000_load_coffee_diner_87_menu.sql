-- Carga idempotente del menú vigente de Coffee Diner 87.
-- Omite alcohol, productos y adicionales sin precio. No modifica otros comercios.
do $$
declare
  v_store_id uuid;
  v_row record;
  v_category_id uuid;
  v_product_id uuid;
  v_variant_id uuid;
  v_group_id uuid;
begin
  select id into v_store_id from public.stores where slug = 'coffee-diner-87' limit 1;
  if v_store_id is null then raise exception 'No existe coffee-diner-87.'; end if;

  create temp table tmp_cd_categories(name text primary key, sort_order int, category_id uuid) on commit drop;
  insert into tmp_cd_categories(name, sort_order) values
    ('Entradas',1),('Tex Mex',2),('Fresh Salad',3),('Hot Dogs',4),('Burgers',5),
    ('Principales',6),('Sandwich',7),('Kids',8),('Kids Box',9),('Pastas',10),
    ('Café tradicional',11),('Café de especialidad',12),('Cafés fríos',13),('Postres',14),
    ('Waffles',15),('Helados EFE',16),('Malteadas',17),('Infusiones',18),('Bebidas no alcohólicas',19);

  for v_row in select * from tmp_cd_categories loop
    select id into v_category_id from public.categories where store_id=v_store_id and lower(btrim(name))=lower(btrim(v_row.name)) order by created_at limit 1;
    if v_category_id is null then
      insert into public.categories(store_id,name,is_active,sort_order) values(v_store_id,v_row.name,true,v_row.sort_order) returning id into v_category_id;
    else
      update public.categories set name=v_row.name,is_active=true,sort_order=v_row.sort_order where id=v_category_id;
    end if;
    update tmp_cd_categories set category_id=v_category_id where name=v_row.name;
  end loop;

  create temp table tmp_cd_products(category_name text,name text,description text,price numeric,sort_order int,product_id uuid,primary key(category_name,name)) on commit drop;
  insert into tmp_cd_products(category_name,name,description,price,sort_order) values
    ('Entradas','Aros de Cebolla','Crujientes aros de cebolla acompañados de salsa BBQ y tártara hecha en casa.',6.99,1),
    ('Entradas','Chicken Wings','12 alitas de pollo aderezadas con salsa BBQ, con un ligero toque picante y acompañadas con papas.',11.99,2),
    ('Entradas','Tequeños de Queso','Tequeños rellenos de queso acompañados con salsa tártara.',7.50,3),
    ('Entradas','Flautas de Pollo','Tortillas de trigo rellenas de pollo guisado, cortadas y servidas con salsa tártara hecha en casa.',7.99,4),
    ('Entradas','Tenders de Pollo','Crujientes tiras de milanesa de pollo rebozadas, acompañadas con papas, kétchup y salsa tártara de la casa.',8.99,5),
    ('Tex Mex','Nachos con Queso Fundido','Opción para 2 personas. Crujientes tostadas de maíz bañadas con queso fundido, acompañadas de carne al estilo mexicano, pico de gallo y guacamole.',16.90,1),
    ('Tex Mex','Fajitas','Opción para 2 personas. Servidas sobre una cama de vegetales salteados con un toque de salsa agridulce. Acompañadas de tortillas, guacamole, crema de leche, pico de gallo y queso americano.',24.90,2),
    ('Fresh Salad','César Salad','Frescas hojas de lechuga bañadas en aderezo César, con crutones de pan tostado y queso parmesano.',8.50,1),
    ('Fresh Salad','Tijuana Salad','Combinación de lechuga, pico de gallo y guacamole, aderezada con salsa César de la casa, nachos y queso americano.',9.99,2),
    ('Fresh Salad','Tropical Salad','Mixtura de lechuga con rúcula, praliné de nueces, tomates secos, manzana, lonjas de parmesano y reducción de aceite balsámico.',8.90,3),
    ('Fresh Salad','Diner Salad','Mixtura de lechuga con aderezo de miel y mostaza, acompañada con croquetas de queso de cabra, fresas y almendras fileteadas.',8.99,4),
    ('Hot Dogs','Tradicional Pequeño','Salchicha tipo wiener, cebolla picada, pepinillo picado y queso pecorino.',2.00,1),
    ('Hot Dogs','Tradicional',null,2.50,2),
    ('Hot Dogs','Tradicional Premium','Salchicha a elección, cebolla picada, pepinillo picado, papas y queso pecorino.',3.50,3),
    ('Hot Dogs','Hot Dog 87','Salchicha a elección con cebolla salteada, pepinillo picado, papas fritas y queso pecorino.',3.99,4),
    ('Burgers','Burger Clásica','Hamburguesa americana con carne de res al grill, queso fundido, tocineta, pepinillo, tomate y lechuga fresca.',5.00,1),
    ('Burgers','Smash Burger','Hamburguesa estilo Oklahoma con carne de res, cebolla salteada, queso americano, pepinillo y salsa de la casa.',5.00,2),
    ('Burgers','Smash Deluxe',null,9.00,3),('Burgers','Original Burger','Carne de res, lechuga fresca, tomate, pepinillos, queso fundido y salsa 87.',7.50,4),
    ('Burgers','Original Deluxe',null,9.50,5),('Burgers','Bistro Burger','Carne de res al grill, cebolla caramelizada, queso fundido, tocineta, tomate, lechuga fresca y salsa alioli.',8.70,6),
    ('Burgers','Bistro Deluxe',null,9.90,7),('Burgers','Cowboy Burger','Carne de res al grill con queso americano, pimentón asado, chorizo o chistorra, tomate, lechuga fresca y salsa alioli.',8.50,8),
    ('Burgers','Cowboy Deluxe',null,9.90,9),('Burgers','Mushroom Burger','Carne de res al grill cubierta con queso Muenster, tocineta y topping mushroom/champiñones hecho en casa.',8.70,10),
    ('Burgers','Mushroom Deluxe',null,10.50,11),('Burgers','Crispy Classic','Suprema de pollo dorada, queso fundido, lechuga fresca, tomate, salsa 87 y salsa César.',5.99,12),
    ('Burgers','Crispy Burger','Milanesa de pollo empanizado, queso americano, lechuga, tomate y salsa César.',6.80,13),
    ('Burgers','Crispy Deluxe',null,9.50,14),('Burgers','Chicken Burger','Milanesa de pollo al grill, queso americano, lechuga, tomate y salsa César.',6.50,15),
    ('Burgers','Chicken Deluxe',null,8.50,16),('Burgers','Bacon Chicken','Suprema de pollo rebozada con tocineta, queso americano, salsa BBQ, aderezo y salsa 87.',6.90,17),
    ('Burgers','Bacon Deluxe',null,9.50,18),
    ('Principales','Salsa 4 Quesos','Proteína bañada con salsa cuatro quesos de la casa.',12.99,1),
    ('Principales','A la Pimienta','Proteína al grill bañada con salsa pimienta con un ligero toque picante.',13.99,2),
    ('Principales','Al Champiñón','Proteína al grill bañada con salsa de champiñones de la casa.',13.99,3),
    ('Principales','A la Mostaza','Proteína al grill bañada con salsa mostaza de la casa.',12.99,4),
    ('Principales','Cordon Bleu','Milanesa de pollo enrollada, rellena de queso Muenster, tocineta y jamón, bañada con salsa.',14.50,5),
    ('Principales','Cotoletta de Pollo','Pechuga de pollo empanizada y dorada.',13.99,6),
    ('Sandwich','César Sandwich','Milanesa de pollo con aderezo César, lechuga, tocineta y queso parmesano en pan suave.',10.90,1),
    ('Sandwich','Deli Sandwich','Proteína cubierta con queso fundido y Muenster, cebolla caramelizada, salsa de la casa y tocineta.',10.90,2),
    ('Sandwich','Mushroom Sandwich','Proteína cubierta con topping mushroom/champiñones, queso Muenster, tocineta y salsa de la casa.',11.50,3),
    ('Sandwich','Sandwich 4 Quesos','Proteína acompañada de salsa cuatro quesos, tocineta y queso Muenster en pan suave.',11.99,4),
    ('Sandwich','Club House de Pollo','Plato tradicional preparado al estilo Coffee Diner 87, acompañado con papas fritas y salsas tradicionales.',22.99,5),
    ('Kids','Hamburguesa Kids',null,5.50,1),('Kids','Hamburguesa Chicken Kids',null,5.50,2),('Kids','Pasta Mac Cheese',null,10.90,3),('Kids','Nuggets de Pollo',null,6.99,4),
    ('Kids Box','Kids Box 1','Incluye hamburguesa de carne, papas y refresco.',8.50,1),('Kids Box','Kids Box 2','Incluye hamburguesa de pollo crispy, papas y refresco.',8.50,2),('Kids Box','Kids Box 3','Incluye nuggets de pollo, papas y refresco.',7.99,3),
    ('Pastas','Pasta Boloña','Pasta en salsa boloña de la casa terminada con queso parmesano rallado. Acompañada de pan al ajillo.',8.99,1),
    ('Pastas','Pasta 4 Quesos','Pasta bañada con salsa cuatro quesos y queso parmesano. Acompañada de pan al ajillo.',7.99,2),
    ('Pastas','Pasta al Pesto Crema','Pasta bañada en crema pesto de la casa y queso parmesano. Acompañada de pan al ajillo.',8.50,3),
    ('Pastas','Pasta Pomodoro','Pasta bañada con salsa pomodoro y toque de pesto. Acompañada de pan al ajillo.',7.99,4),
    ('Pastas','Canelones','Rollos de lasaña rellenos de carne, bañados en salsa boloña y bechamel, gratinados con parmesano y mozzarella. Acompañados de pan al ajillo.',10.99,5),
    ('Pastas','Pasticho','Láminas de pasta con salsa boloña, bechamel, jamón, mozzarella y parmesano gratinado. Acompañado de pan al ajillo.',11.99,6),
    ('Café tradicional','Negrito',null,2.00,1),('Café tradicional','Guayoyo',null,2.00,2),('Café tradicional','Latte',null,2.50,3),('Café tradicional','Cappuccino',null,2.50,4),
    ('Café de especialidad','Mocca','Presentación de 6 oz.',3.99,1),('Café de especialidad','Mocca Nutella','Presentación de 6 oz.',4.99,2),('Café de especialidad','Mocca Oreo','Presentación de 6 oz.',4.99,3),('Café de especialidad','Latte Cupcake Once Once','Presentación de 6 oz.',4.99,4),
    ('Cafés fríos','Afogatto',null,5.50,1),('Cafés fríos','Ice Cream Hazelnut Latte',null,4.80,2),('Cafés fríos','Ice Cream Mocca Latte',null,4.50,3),('Cafés fríos','Ice Cream Caramel Latte',null,4.50,4),('Cafés fríos','Frapuchino Mocca',null,4.90,5),('Cafés fríos','Frapuchino Mocca Nutella',null,4.90,6),
    ('Postres','Brownie con Helado',null,5.99,1),('Postres','Torta Matilda',null,6.50,2),('Postres','Torta de Zanahoria',null,4.99,3),('Postres','Torta Marmoleada',null,2.50,4),('Postres','Cheesecake de Fresa',null,6.00,5),('Postres','Cheesecake de Oreo',null,6.00,6),('Postres','Galletas New York',null,6.00,7),('Postres','Sandwich de Galleta con Helado',null,7.50,8),
    ('Waffles','Waffle con Frutas','Waffle con fresa, melocotón, arándano y kiwi, con topping de chocolate y/o fresa.',6.50,1),('Waffles','Waffle con Helado','Waffle acompañado de helado y topping a elección.',8.90,2),('Waffles','Dinner Waffle','Waffle con helado y frutas, con topping de chocolate, fresa o ambos.',9.50,3),
    ('Helados EFE','Helado en Copa',null,3.50,1),('Helados EFE','Banana Split',null,9.50,2),('Helados EFE','Barquilla',null,1.50,3),('Helados EFE','Sundae de Fresa',null,4.50,4),('Helados EFE','Sundae de Chocolate',null,4.50,5),
    ('Malteadas','Malteada Oreo',null,4.99,1),('Malteadas','Malteada Fresa',null,4.99,2),('Malteadas','Malteada Especial Mundialista',null,3.99,3),
    ('Infusiones','Infusiones',null,3.50,1),
    ('Bebidas no alcohólicas','Batidos',null,3.50,1),('Bebidas no alcohólicas','Batidos Mix',null,3.99,2),('Bebidas no alcohólicas','Refresco 16 oz',null,1.50,3),('Bebidas no alcohólicas','Refresco de Lata',null,3.00,4),('Bebidas no alcohólicas','Agua 600 ml',null,2.00,5),('Bebidas no alcohólicas','Soda',null,3.00,6),('Bebidas no alcohólicas','Té Lipton 16 oz',null,2.99,7),('Bebidas no alcohólicas','Toddy',null,3.99,8);

  for v_row in select * from tmp_cd_products loop
    select id into v_product_id from public.products where store_id=v_store_id and lower(btrim(name))=lower(btrim(v_row.name)) order by created_at limit 1;
    if v_product_id is null then
      insert into public.products(store_id,category_id,name,description,price_usd,discount_percent,image_url,is_available,is_featured,sort_order)
      values(v_store_id,(select category_id from tmp_cd_categories where name=v_row.category_name),v_row.name,v_row.description,v_row.price,0,null,true,false,v_row.sort_order) returning id into v_product_id;
    else
      update public.products set category_id=(select category_id from tmp_cd_categories where name=v_row.category_name),name=v_row.name,description=v_row.description,price_usd=v_row.price,discount_percent=0,is_available=true,is_featured=false,sort_order=v_row.sort_order,updated_at=now() where id=v_product_id;
    end if;
    update tmp_cd_products set product_id=v_product_id where category_name=v_row.category_name and name=v_row.name;
  end loop;

  create temp table tmp_cd_variants(product_name text,name text,price numeric,sort_order int,primary key(product_name,name)) on commit drop;
  insert into tmp_cd_variants(product_name,name,price,sort_order) values
    ('Fajitas','Pollo',24.90,1),('Fajitas','Lomito',27.99,2),('Fajitas','Mixto',25.90,3),
    ('César Salad','Medium · Pollo al grill',8.50,1),('César Salad','Medium · Pollo crispy',8.90,2),('César Salad','Grande · Pollo al grill',11.90,3),('César Salad','Grande · Pollo crispy',12.50,4),
    ('Tijuana Salad','Medium · Pollo al grill',9.99,1),('Tijuana Salad','Medium · Pollo crispy',10.80,2),('Tijuana Salad','Grande · Pollo al grill',13.50,3),('Tijuana Salad','Grande · Pollo crispy',14.50,4),
    ('Tropical Salad','Medium · Pollo al grill',8.90,1),('Tropical Salad','Medium · Pollo crispy',9.80,2),('Tropical Salad','Grande · Pollo al grill',11.50,3),('Tropical Salad','Grande · Pollo crispy',11.99,4),
    ('Diner Salad','Medium · Pollo al grill',8.99,1),('Diner Salad','Grande · Pollo al grill',11.99,2),
    ('Tradicional Premium','Polaca',3.50,1),('Tradicional Premium','Frankfurt',3.50,2),('Tradicional Premium','Alemana',3.50,3),
    ('Hot Dog 87','Polaca',3.99,1),('Hot Dog 87','Frankfurt',3.99,2),('Hot Dog 87','Alemana',3.99,3),
    ('Salsa 4 Quesos','Pollo',12.99,1),('Salsa 4 Quesos','Lomito',15.99,2),('A la Pimienta','Pollo',13.99,1),('A la Pimienta','Lomito',15.99,2),('Al Champiñón','Pollo',13.99,1),('Al Champiñón','Lomito',15.99,2),('A la Mostaza','Pollo',12.99,1),('A la Mostaza','Lomito',15.99,2),
    ('Cotoletta de Pollo','Salsa 4 Quesos',13.99,1),('Cotoletta de Pollo','Salsa Pomodoro',13.99,2),
    ('César Sandwich','Al grill',10.90,1),('César Sandwich','Crispy',11.50,2),('Deli Sandwich','Al grill',10.90,1),('Deli Sandwich','Crispy',11.50,2),('Deli Sandwich','Lomito',15.99,3),('Mushroom Sandwich','Al grill',11.50,1),('Mushroom Sandwich','Crispy',11.99,2),('Mushroom Sandwich','Lomito',15.99,3),('Sandwich 4 Quesos','Al grill',11.99,1),('Sandwich 4 Quesos','Crispy',12.50,2),('Sandwich 4 Quesos','Lomito',15.99,3),
    ('Pasta Boloña','Medium',8.99,1),
    ('Pasta 4 Quesos','Medium · Sin proteína',7.99,1),('Pasta 4 Quesos','Medium · Pollo',9.50,2),('Pasta 4 Quesos','Medium · Lomito',13.50,3),('Pasta 4 Quesos','Grande · Pollo',12.99,4),('Pasta 4 Quesos','Grande · Lomito',15.99,5),
    ('Pasta al Pesto Crema','Medium · Sin proteína',8.50,1),('Pasta al Pesto Crema','Medium · Pollo',9.99,2),('Pasta al Pesto Crema','Medium · Lomito',13.50,3),('Pasta al Pesto Crema','Grande · Pollo',13.50,4),('Pasta al Pesto Crema','Grande · Lomito',16.50,5),
    ('Pasta Pomodoro','Medium · Sin proteína',7.99,1),('Pasta Pomodoro','Medium · Pollo',9.90,2),('Pasta Pomodoro','Medium · Lomito',13.50,3),('Pasta Pomodoro','Grande · Pollo',12.99,4),('Pasta Pomodoro','Grande · Lomito',15.99,5),
    ('Negrito','4 oz',2.00,1),('Negrito','6 oz',2.50,2),('Guayoyo','4 oz',2.00,1),('Guayoyo','6 oz',2.50,2),('Latte','4 oz',2.50,1),('Latte','6 oz',3.00,2),('Cappuccino','4 oz',2.50,1),('Cappuccino','6 oz',3.00,2),
    ('Helado en Copa','1 porción',3.50,1),('Helado en Copa','2 porciones',6.50,2),
    ('Infusiones','Ónix Ice Tea',3.50,1),('Infusiones','Diner Ice Tea',3.50,2),('Infusiones','Pink Ice Tea',3.50,3),
    ('Batidos','Fresa',3.50,1),('Batidos','Parchita',3.50,2),('Batidos','Piña',3.50,3),('Batidos','Cambur',3.50,4),('Batidos','Limón',3.50,5),
    ('Batidos Mix','Fresa + Limón',3.99,1),('Batidos Mix','Limón + Ice Cream',3.99,2),('Batidos Mix','Piña + Hierbabuena',3.99,3),('Batidos Mix','Limón + Hierbabuena',3.99,4),('Batidos Mix','Fresa + Cambur',3.99,5);

  -- Variantes Unidad / Combo de burgers simples.
  insert into tmp_cd_variants
  select product_name,variant_name,price,sort_order from (values
    ('Burger Clásica',5.00,7.50,8.50),('Smash Burger',5.00,7.50,8.50),('Smash Deluxe',9.00,10.70,12.50),('Original Burger',7.50,9.50,10.90),('Original Deluxe',9.50,11.50,12.90),('Bistro Burger',8.70,10.70,12.50),('Bistro Deluxe',9.90,11.99,13.50),('Mushroom Burger',8.70,10.90,12.00),('Mushroom Deluxe',10.50,12.50,13.50),('Crispy Classic',5.99,7.99,9.50),('Crispy Burger',6.80,8.80,10.50),('Crispy Deluxe',9.50,11.50,12.90),('Chicken Burger',6.50,8.50,9.99),('Chicken Deluxe',8.50,10.50,11.90),('Bacon Chicken',6.90,9.90,10.50),('Bacon Deluxe',9.50,11.50,12.90)
  ) p(product_name,unit_price,regular_price,large_price)
  cross join lateral (values('Unidad',p.unit_price,1),('Combo Regular',p.regular_price,2),('Combo Grande',p.large_price,3)) v(variant_name,price,sort_order);

  insert into tmp_cd_variants values
    ('Cowboy Burger','Chorizo · Unidad',8.50,1),('Cowboy Burger','Chorizo · Combo Regular',10.50,2),('Cowboy Burger','Chorizo · Combo Grande',12.00,3),('Cowboy Burger','Chistorra · Unidad',9.80,4),('Cowboy Burger','Chistorra · Combo Regular',11.80,5),('Cowboy Burger','Chistorra · Combo Grande',13.00,6),
    ('Cowboy Deluxe','Chorizo · Unidad',9.90,1),('Cowboy Deluxe','Chorizo · Combo Regular',11.90,2),('Cowboy Deluxe','Chorizo · Combo Grande',13.50,3),('Cowboy Deluxe','Chistorra · Unidad',11.50,4),('Cowboy Deluxe','Chistorra · Combo Regular',13.50,5),('Cowboy Deluxe','Chistorra · Combo Grande',14.50,6);

  for v_row in select variants.*,products.product_id from tmp_cd_variants variants join tmp_cd_products products on products.name=variants.product_name loop
    select id into v_variant_id from public.product_variants where product_id=v_row.product_id and lower(btrim(name))=lower(btrim(v_row.name)) order by created_at limit 1;
    if v_variant_id is null then insert into public.product_variants(product_id,name,price_usd,is_available,sort_order) values(v_row.product_id,v_row.name,v_row.price,true,v_row.sort_order);
    else update public.product_variants set name=v_row.name,price_usd=v_row.price,is_available=true,sort_order=v_row.sort_order where id=v_variant_id; end if;
  end loop;

  update public.product_variants pv set is_available=false where pv.product_id in(select product_id from tmp_cd_products)
    and not exists(select 1 from tmp_cd_variants tv join tmp_cd_products tp on tp.name=tv.product_name where tp.product_id=pv.product_id and lower(btrim(tv.name))=lower(btrim(pv.name)));

  create temp table tmp_cd_groups(group_key text primary key,name text,description text,selection_type text,required boolean,min_select int,max_select int,sort_order int,group_id uuid) on commit drop;
  insert into tmp_cd_groups values
    ('sides','Acompañantes','Puedes seleccionar hasta 2 acompañantes sin recargo.','multiple',false,0,2,1,null),
    ('pasta','Tipo de pasta','Selecciona el tipo de pasta.','single',true,1,1,1,null),
    ('icecream','Sabor','Selecciona el sabor del helado.','single',true,1,1,1,null),
    ('waffle','Topping de waffle','Selecciona chocolate, fresa o ambos.','single',true,1,1,1,null),
    ('extras','Acompañantes extra','Agrega acompañantes con costo adicional.','multiple',false,0,3,2,null);
  for v_row in select * from tmp_cd_groups loop
    select id into v_group_id from public.product_option_groups where store_id=v_store_id and lower(btrim(name))=lower(btrim(v_row.name)) order by created_at limit 1;
    if v_group_id is null then insert into public.product_option_groups(store_id,name,description,selection_type,required,min_select,max_select,is_active,sort_order) values(v_store_id,v_row.name,v_row.description,v_row.selection_type,v_row.required,v_row.min_select,v_row.max_select,true,v_row.sort_order) returning id into v_group_id;
    else update public.product_option_groups set description=v_row.description,selection_type=v_row.selection_type,required=v_row.required,min_select=v_row.min_select,max_select=v_row.max_select,is_active=true,sort_order=v_row.sort_order,updated_at=now() where id=v_group_id; end if;
    update tmp_cd_groups set group_id=v_group_id where group_key=v_row.group_key;
  end loop;

  create temp table tmp_cd_options(group_key text,name text,price numeric,sort_order int,primary key(group_key,name)) on commit drop;
  insert into tmp_cd_options values
    ('sides','Ensalada César',0,1),('sides','Guacamole',0,2),('sides','Pico de gallo',0,3),('sides','Papas Ranch',0,4),('sides','Papas fritas',0,5),('sides','Ensalada Diner',0,6),('sides','Pan al ajillo',0,7),('sides','Puré',0,8),
    ('pasta','Rigatoni',0,1),('pasta','Fettuccine al huevo',0,2),('pasta','Linguini',0,3),('pasta','Pluma',0,4),
    ('icecream','Mantecado',0,1),('icecream','Fresa',0,2),('icecream','Chocolate',0,3),
    ('waffle','Chocolate',0,1),('waffle','Fresa',0,2),('waffle','Ambos',0,3),
    ('extras','Papas fritas',2.80,1),('extras','Papas Ranch',2.90,2),('extras','Papas Medium',1.50,3);
  for v_row in select options.*,groups.group_id from tmp_cd_options options join tmp_cd_groups groups using(group_key) loop
    if exists(select 1 from public.product_option_values where option_group_id=v_row.group_id and lower(btrim(name))=lower(btrim(v_row.name))) then
      update public.product_option_values set name=v_row.name,price_delta_usd=v_row.price,is_active=true,sort_order=v_row.sort_order,updated_at=now() where option_group_id=v_row.group_id and lower(btrim(name))=lower(btrim(v_row.name));
    else insert into public.product_option_values(option_group_id,name,description,price_delta_usd,is_active,sort_order) values(v_row.group_id,v_row.name,null,v_row.price,true,v_row.sort_order); end if;
  end loop;

  create temp table tmp_cd_links(group_key text,product_name text,sort_order int,primary key(group_key,product_name)) on commit drop;
  insert into tmp_cd_links
  select 'sides',name,1 from tmp_cd_products where category_name='Principales'
  union all select 'pasta',name,1 from tmp_cd_products where name in('Pasta Boloña','Pasta 4 Quesos','Pasta al Pesto Crema','Pasta Pomodoro')
  union all select 'icecream','Helado en Copa',1
  union all select 'waffle',name,1 from tmp_cd_products where category_name='Waffles'
  union all select 'extras',name,2 from tmp_cd_products where category_name in('Burgers','Sandwich');
  for v_row in select links.*,groups.group_id,products.product_id from tmp_cd_links links join tmp_cd_groups groups using(group_key) join tmp_cd_products products on products.name=links.product_name loop
    insert into public.product_option_group_products(store_id,product_id,option_group_id,sort_order) values(v_store_id,v_row.product_id,v_row.group_id,v_row.sort_order)
    on conflict(product_id,option_group_id) do update set store_id=excluded.store_id,sort_order=excluded.sort_order,updated_at=now();
  end loop;
end $$;
