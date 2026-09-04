-- Agrega Sushi Club-87 al catalogo de Coffee Diner 87 sin alterar su menu existente.
do $$
declare v_store_id uuid; v_row record; v_id uuid; v_group_id uuid;
begin
  select id into v_store_id from public.stores where slug='coffee-diner-87' limit 1;
  if v_store_id is null then raise exception 'No existe coffee-diner-87.'; end if;
  create temp table tmp_sc_cat(name text primary key,sort_order int,id uuid) on commit drop;
  insert into tmp_sc_cat(name,sort_order) values
    ('Sushi · Entradas y ensaladas',20),('Sushi · Rolls fríos',21),('Sushi · Rolls tempura',22),('Sushi · Rolls sin arroz',23);
  for v_row in select * from tmp_sc_cat loop
    select id into v_id from public.categories where store_id=v_store_id and lower(btrim(name))=lower(btrim(v_row.name)) order by created_at limit 1;
    if v_id is null then insert into public.categories(store_id,name,is_active,sort_order) values(v_store_id,v_row.name,true,v_row.sort_order) returning id into v_id;
    else update public.categories set name=v_row.name,is_active=true,sort_order=v_row.sort_order where id=v_id; end if;
    update tmp_sc_cat set id=v_id where name=v_row.name;
  end loop;
  create temp table tmp_sc_prod(category_name text,name text,description text,price numeric,sort_order int,id uuid,primary key(category_name,name)) on commit drop;
  insert into tmp_sc_prod(category_name,name,description,price,sort_order) values
    ('Sushi · Entradas y ensaladas','Gyoza','Empanaditas rellenas de cerdo y vegetales.',8.90,1),
    ('Sushi · Entradas y ensaladas','Shumai','Empanaditas rellenas de camarones y vegetales.',8.90,2),
    ('Sushi · Entradas y ensaladas','Croquetas de Salmón','Mezcla de salmón con vegetales en salsa tártara.',8.90,3),
    ('Sushi · Entradas y ensaladas','Kani Crab','Cangrejo, crunch de tempura, atún, camarones apanados, aceite de ajonjolí y batata crocante.',9.50,4),
    ('Sushi · Entradas y ensaladas','Diamante Salad','Empanaditas rellenas de camarones y vegetales.',10.90,5),
    ('Sushi · Entradas y ensaladas','Ceviche Tradicional','Róbalo, cebolla morada, pimentón, ají dulce y cilantro en leche de tigre. Acompañado de galletas crocantes.',11.99,6),
    ('Sushi · Entradas y ensaladas','Wakame Especial','Wakame, edamames, salmón y atún.',14.99,7),
    ('Sushi · Entradas y ensaladas','Neptuno Salad','Cangrejo, wakame, salmón, atún, cebollín y salsa drago picante.',14.99,8),
    ('Sushi · Rolls fríos','Dinamita Roll','Queso crema, aguacate y pasta dinamita. Topping de masago, ajonjolí y salsa de anguila.',9.90,1),
    ('Sushi · Rolls fríos','California Roll','Queso crema, aguacate, pepino y cangrejo. Topping de masago y ajonjolí.',12,2),
    ('Sushi · Rolls fríos','Thay Crunch','Queso crema, cebollín y róbalo apanado. Topping de aguacate, salsa drago picante y anguila.',12.90,3),
    ('Sushi · Rolls fríos','Thaity Roll','Mamenori de ajonjolí con queso crema, aguacate, pasta dinamita y camarones apanados. Topping de batata crujiente, salsa fuji y anguila.',13.90,4),
    ('Sushi · Rolls fríos','Alaska Especial','Queso crema, aguacate y salmón. Topping de aguacate, salmón, wakame y masago.',13.99,5),
    ('Sushi · Rolls fríos','Nobu Roll','Mamenori de ajonjolí con queso crema, aguacate, salmón y camarones apanados. Topping de salmón, wakame, cangrejo y salsa de anguila.',15.50,6),
    ('Sushi · Rolls fríos','Matziu Roll','Mamenori de ajonjolí con queso crema, atún y cangrejo. Topping de atún picante, crunch de tempura y salsa de anguila.',15.50,7),
    ('Sushi · Rolls fríos','Tuna Kani','Queso crema y cangrejo. Topping de aguacate, tartar de atún, crunch de tempura y salsa drago picante.',15.50,8),
    ('Sushi · Rolls fríos','Tuna Roll','Queso crema, aguacate y atún. Topping de atún, aguacate, cebollín y salsa drago picante.',16.50,9),
    ('Sushi · Rolls fríos','Tartar Roll','Atún y cangrejo apanado. Topping de atún y tartar de atún con cangrejo, crunch y masago.',16.50,10),
    ('Sushi · Rolls tempura','Fuji Roll','Camarones apanados, queso crema, aguacate y cebollín. Topping de camarones apanados y salsa fuji.',12.90,1),
    ('Sushi · Rolls tempura','Ebi Crunch','Queso crema, aguacate, ajonjolí, camarones apanados y cebollín. Salsa dely y de anguila.',13.50,2),
    ('Sushi · Rolls tempura','Kani Roll','Queso crema, wakame, róbalo apanado y salmón. Topping de pasta dinamita y salsa de anguila.',13.50,3),
    ('Sushi · Rolls tempura','Banana Roll','Queso crema, aguacate, cangrejo y camarones en tempura, envuelto en plátano maduro.',13.50,4),
    ('Sushi · Rolls tempura','Eskin Roll','Queso crema, wakame, cebollín y camarones apanados. Topping de piel de salmón crocante, salsa dely y de anguila.',13.90,5),
    ('Sushi · Rolls tempura','Tiger Roll','Queso crema, aguacate, salmón y masago. Salsa dely y de anguila.',15.99,6),
    ('Sushi · Rolls sin arroz','Fish Roll','Mamenori de ajonjolí con aguacate, wakame, pasta dinamita, róbalo y atún.',17.90,1),
    ('Sushi · Rolls sin arroz','Sake Roll','Queso crema, aguacate, cebollín, atún, cangrejo, róbalo y wakame. Envuelto en salmón con salsa drago picante y de anguila.',18.50,2),
    ('Sushi · Rolls sin arroz','Natzu Roll','Hojas de arroz con cangrejo, crunch de tempura, cebollín y aguacate. Envuelto en salmón con atún, aceite de trufa, salsa drago picante y de anguila.',18.50,3);
  for v_row in select * from tmp_sc_prod loop
    select id into v_id from public.products where store_id=v_store_id and lower(btrim(name))=lower(btrim(v_row.name)) order by created_at limit 1;
    if v_id is null then
      insert into public.products(store_id,category_id,name,description,price_usd,discount_percent,image_url,is_available,is_featured,sort_order)
      values(v_store_id,(select id from tmp_sc_cat where name=v_row.category_name),v_row.name,v_row.description,v_row.price,0,null,true,false,v_row.sort_order) returning id into v_id;
    else
      update public.products set category_id=(select id from tmp_sc_cat where name=v_row.category_name),name=v_row.name,description=v_row.description,price_usd=v_row.price,discount_percent=0,is_available=true,is_featured=false,sort_order=v_row.sort_order,updated_at=now() where id=v_id;
    end if;
    update tmp_sc_prod set id=v_id where category_name=v_row.category_name and name=v_row.name;
  end loop;
  select id into v_group_id from public.product_option_groups where store_id=v_store_id and lower(btrim(name))='preparación sushi' order by created_at limit 1;
  if v_group_id is null then
    insert into public.product_option_groups(store_id,name,description,selection_type,required,min_select,max_select,is_active,sort_order)
    values(v_store_id,'Preparación sushi','Selecciona cómo deseas la entrada.','single',true,1,1,true,1) returning id into v_group_id;
  else update public.product_option_groups set description='Selecciona cómo deseas la entrada.',selection_type='single',required=true,min_select=1,max_select=1,is_active=true,sort_order=1,updated_at=now() where id=v_group_id; end if;
  for v_row in select * from (values('Al vapor',1),('Fritas',2)) options(name,sort_order) loop
    if exists(select 1 from public.product_option_values where option_group_id=v_group_id and lower(btrim(name))=lower(btrim(v_row.name))) then
      update public.product_option_values set name=v_row.name,price_delta_usd=0,is_active=true,sort_order=v_row.sort_order,updated_at=now() where option_group_id=v_group_id and lower(btrim(name))=lower(btrim(v_row.name));
    else insert into public.product_option_values(option_group_id,name,description,price_delta_usd,is_active,sort_order) values(v_group_id,v_row.name,null,0,true,v_row.sort_order); end if;
  end loop;
  for v_row in select id from tmp_sc_prod where name in('Gyoza','Shumai') loop
    insert into public.product_option_group_products(store_id,product_id,option_group_id,sort_order) values(v_store_id,v_row.id,v_group_id,1)
    on conflict(product_id,option_group_id) do update set store_id=excluded.store_id,sort_order=excluded.sort_order,updated_at=now();
  end loop;
end $$;
