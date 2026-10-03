-- Isolated staging only, synthetic data, all writes rolled back.
begin;
set local statement_timeout='30s';
insert into public.stores(id,slug,name,table_orders_access_enabled,table_orders_enabled) values
 ('62000000-0000-4000-8000-000000000031','kitchen-test-a','Kitchen QA',true,true),
 ('62000000-0000-4000-8000-000000000032','kitchen-test-b','Other QA',true,true);
insert into public.store_kitchen_settings(store_id,enabled,dispatch_mode) values
 ('62000000-0000-4000-8000-000000000031',true,'manual'),('62000000-0000-4000-8000-000000000032',true,'manual');
insert into public.products(id,store_id,name,price_usd) values
 ('63000000-0000-4000-8000-000000000031','62000000-0000-4000-8000-000000000031','QA meal',10);
do $$
declare
 s uuid := '62000000-0000-4000-8000-000000000031';
 other_store uuid := '62000000-0000-4000-8000-000000000032';
 oid uuid; t public.order_kitchen_tickets%rowtype; stamp timestamptz; rejected boolean; n integer;
 items jsonb := '[{"product_id":"63000000-0000-4000-8000-000000000031","product_name":"QA meal","quantity":1,"unit_price_usd":10,"total_usd":10,"options":[]}]';
begin
 for n in 1..4 loop
  oid := gen_random_uuid();
  perform public.create_order_atomic(jsonb_build_object('id',oid,'store_id',s,'public_code','KITCHEN-QA-'||n,
   'idempotency_key',gen_random_uuid(),'customer_name','QA','customer_phone','','delivery_type',case n when 1 then 'table' when 2 then 'delivery' else 'pickup' end,
   'delivery_pricing_type',case n when 4 then 'bar' end,'payment_method','Efectivo','payment_status','review',
   'subtotal_usd',10,'total_usd',10,'platform_service_fee_usd',0.2), items);
  if exists(select 1 from public.order_kitchen_tickets where order_id=oid) then raise exception 'Unexpected auto dispatch'; end if;
  rejected := false;
  begin perform public.operate_kitchen_order(other_store,oid,'send',null,'QA'); exception when others then rejected:=true; end;
  if not rejected then raise exception 'Cross tenant operation accepted'; end if;
  t := public.operate_kitchen_order(s,oid,'send',null,'QA'); stamp:=t.sent_at;
  t := public.operate_kitchen_order(s,oid,'send',null,'QA');
  if t.sent_at<>stamp or (select count(*) from public.order_kitchen_tickets where order_id=oid)<>1 then raise exception 'Duplicate manual dispatch'; end if;
  if not exists(select 1 from public.orders where id=oid and payment_status='review' and total_usd=10 and platform_service_fee_usd=0.2) then raise exception 'Dispatch modified payment/price/fee'; end if;
  t := public.operate_kitchen_order(s,oid,'prepare','queued','QA');
  if t.state<>'preparing' or t.started_at is null or (select status from public.orders where id=oid)<>'preparing' then raise exception 'Prepare did not sync'; end if;
  perform public.operate_kitchen_order(s,oid,'prepare','queued','QA');
  t := public.operate_kitchen_order(s,oid,'ready','preparing','QA');
  if t.state<>'ready' or t.ready_at is null or (select status from public.orders where id=oid)<>'ready' then raise exception 'Ready did not sync'; end if;
  rejected:=false;
  begin perform public.operate_kitchen_order(s,oid,'prepare','queued','QA'); exception when others then rejected:=true; end;
  if not rejected then raise exception 'Stale transition regressed order'; end if;
  update public.orders set status='preparing' where id=oid;
  if exists(select 1 from public.order_kitchen_tickets where order_id=oid and ready_at is not null) then raise exception 'Preparation timer remained frozen after correction'; end if;
  update public.orders set status='accepted' where id=oid;
  if exists(select 1 from public.order_kitchen_tickets where order_id=oid and (ready_at is not null or started_at is not null)) then raise exception 'Queue timer remained frozen after correction'; end if;
  update public.orders set status='completed' where id=oid;
  if (select state from public.order_kitchen_tickets where order_id=oid)<>'completed' then raise exception 'Completion not reflected'; end if;
 end loop;
 -- Auto dispatch only upon verification; repeating verification does not create another ticket.
 update public.store_kitchen_settings set dispatch_mode='paid' where store_id=s;
 oid:=gen_random_uuid();
 perform public.create_order_atomic(jsonb_build_object('id',oid,'store_id',s,'public_code','KITCHEN-PAID',
   'idempotency_key',gen_random_uuid(),'customer_name','QA','customer_phone','','delivery_type','pickup',
   'payment_method','Transferencia','payment_status','review','subtotal_usd',10,'total_usd',10),items);
 if exists(select 1 from public.order_kitchen_tickets where order_id=oid) then raise exception 'Reported payment sent to kitchen'; end if;
 update public.orders set payment_status='verified' where id=oid;
 update public.orders set payment_status='verified' where id=oid;
 if (select count(*) from public.order_kitchen_tickets where order_id=oid)<>1 then raise exception 'Paid dispatch missing or duplicated'; end if;
 update public.orders set status='preparing' where id=oid;
 if (select state from public.order_kitchen_tickets where order_id=oid)<>'preparing' then raise exception 'Orders panel update not synchronized'; end if;
 update public.orders set status='cancelled' where id=oid;
 if (select state from public.order_kitchen_tickets where order_id=oid)<>'cancelled' then raise exception 'Cancellation not synchronized'; end if;
 -- Kitchen must not be mandatory: all normal states remain writable with it disabled.
 update public.store_kitchen_settings set enabled=false where store_id=s;
 oid:=gen_random_uuid();
 perform public.create_order_atomic(jsonb_build_object('id',oid,'store_id',s,'public_code','KITCHEN-OFF',
   'idempotency_key',gen_random_uuid(),'customer_name','QA','customer_phone','','delivery_type','pickup',
   'payment_method','Efectivo','payment_status','pending','subtotal_usd',10,'total_usd',10),items);
 update public.orders set status='accepted' where id=oid;
 update public.orders set status='preparing' where id=oid;
 update public.orders set status='ready' where id=oid;
 update public.orders set status='completed' where id=oid;
 if exists(select 1 from public.order_kitchen_tickets where order_id=oid) then raise exception 'Disabled kitchen received order'; end if;
 update public.store_kitchen_settings set enabled=true where store_id=s;
 update public.stores set table_orders_access_enabled=false where id=s;
 rejected:=false;
 begin perform public.operate_kitchen_order(s,oid,'send',null,'QA'); exception when others then rejected:=true; end;
 if not rejected then raise exception 'Admin gate bypassed'; end if;
 if has_function_privilege('anon','public.operate_kitchen_order(uuid,uuid,text,text,text)','execute')
   or has_table_privilege('authenticated','public.order_kitchen_tickets','select') then raise exception 'Public access to kitchen'; end if;
end $$;
select 'PASS kitchen: four modes, manual exception, payment, tenant, retries, timers, statuses, cancellation, optional module, admin gate, grants' as result;
rollback;
