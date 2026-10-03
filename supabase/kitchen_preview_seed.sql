-- Run only through the isolated staging helper. No real store data is copied.
begin;
do $$
declare s uuid := '51000000-0000-4000-8000-000000000001'; p public.products%rowtype; oid uuid; tid uuid; n integer;
begin
 if not exists(select 1 from public.stores where id=s and slug='cocina-demo')
   or exists(select 1 from public.stores where slug not in ('cocina-demo','tienda-demo')) then
   raise exception 'Not the isolated demo database';
 end if;
 update public.stores set table_orders_access_enabled=true,table_orders_enabled=true where id=s;
 insert into public.store_kitchen_settings(store_id,enabled,dispatch_mode) values(s,true,'manual') on conflict(store_id) do nothing;
 insert into public.store_tables(store_id,name,zone) values(s,'Mesa 1','Interior'),(s,'Mesa 2','Terraza') on conflict(store_id,name) do nothing;
 select id into tid from public.store_tables where store_id=s and name='Mesa 1';
 select * into p from public.products where store_id=s order by id limit 1;
 if p.id is null then raise exception 'Demo product missing'; end if;
 for n in 1..4 loop
  if exists(select 1 from public.orders where store_id=s and public_code='COCINA-DEMO-'||n) then continue; end if;
  oid:=gen_random_uuid();
  perform public.create_order_atomic(jsonb_build_object('id',oid,'store_id',s,'public_code','COCINA-DEMO-'||n,
    'idempotency_key',gen_random_uuid(),'customer_name','Cliente de prueba','customer_phone','',
    'delivery_type',case n when 1 then 'table' when 2 then 'delivery' else 'pickup' end,
    'delivery_pricing_type',case n when 4 then 'bar' end,
    'store_table_id',case when n=1 then tid end,'table_name_snapshot',case when n=1 then 'Mesa 1' end,
    'table_fulfillment_snapshot',case when n=1 then 'table_service' end,
    'delivery_reference',case when n=1 then 'Mesa 1' end,'notes',case when n=4 then 'Pedido manual.' end,
    'order_details','Pedido ficticio para probar Cocina.','payment_method','Efectivo','payment_status','pending',
    'subtotal_usd',p.price_usd,'total_usd',p.price_usd,'platform_service_fee_usd',0),
    jsonb_build_array(jsonb_build_object('product_id',p.id,'product_name',p.name,'quantity',1,
      'unit_price_usd',p.price_usd,'total_usd',p.price_usd,'notes','Sin cebolla','options','[]'::jsonb)));
  if n<>4 then perform public.operate_kitchen_order(s,oid,'send',null,'Preview'); end if;
 end loop;
end $$;
commit;
