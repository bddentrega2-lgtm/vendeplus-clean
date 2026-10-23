-- Only the guarded recovery script may execute this fictional fixture setup.
begin;
do $$ begin
 if (select count(*) from public.stores) <> 2
  or exists(select 1 from public.stores where slug not in ('cocina-demo','tienda-demo')) then
  raise exception 'Not the isolated audit database';
 end if;
end $$;
update public.stores set is_test=true,auto_update_exchange_rate=false,request_customer_id_number=false;
update public.stores set accepts_delivery=true,accepts_pickup=true,
 table_orders_access_enabled=true,table_orders_enabled=true,table_payment_methods=array['Efectivo'],
 table_order_fulfillment_mode='table_service'
 where slug='cocina-demo';
update public.store_delivery_settings set delivery_enabled=true,pickup_enabled=true,
 delivery_provider='own_delivery',pricing_type='fixed',fixed_fee_usd=1,
 transport_agency_connection_id=null,transport_agency_id=null
 where store_id='51000000-0000-4000-8000-000000000001';
insert into public.store_inventory_settings(store_id,enabled)
 values('51000000-0000-4000-8000-000000000002',true)
 on conflict(store_id) do update set enabled=true;
insert into public.product_inventory_skus(id,store_id,product_id,code,stock_on_hand)
 values('54000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000002',
  '53000000-0000-4000-8000-000000000003','DEMO',10)
 on conflict(id) do nothing;
commit;
