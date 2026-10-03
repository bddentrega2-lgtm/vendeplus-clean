-- Synthetic store only. Never mutate human preview orders. Always roll back.
begin;
set local statement_timeout='30s';
insert into public.stores(id,slug,name,table_orders_access_enabled,table_orders_enabled)
values ('62000000-0000-4000-8000-000000000041','status-time-qa','Timing QA',true,true);
insert into public.store_kitchen_settings(store_id,enabled,dispatch_mode)
values ('62000000-0000-4000-8000-000000000041',true,'manual');
insert into public.products(id,store_id,name,price_usd)
values ('63000000-0000-4000-8000-000000000041','62000000-0000-4000-8000-000000000041','Timing QA',10);
do $$
declare
  s uuid := '62000000-0000-4000-8000-000000000041';
  oid uuid := gen_random_uuid();
  initial timestamptz; phase timestamptz; durations jsonb;
begin
  perform public.create_order_atomic(jsonb_build_object('id',oid,'store_id',s,'public_code','TIMING-QA',
    'idempotency_key',gen_random_uuid(),'customer_name','QA','customer_phone','','delivery_type','pickup',
    'payment_method','Efectivo','payment_status','pending','subtotal_usd',10,'total_usd',10),
    '[{"product_id":"63000000-0000-4000-8000-000000000041","product_name":"QA","quantity":1,"unit_price_usd":10,"total_usd":10,"options":[]}]');
  select status_entered_at into initial from public.orders where id=oid;
  if initial is null then raise exception 'Missing initial phase time'; end if;
  perform public.operate_kitchen_order(s,oid,'send',null,'QA');
  update public.orders set payment_status='verified' where id=oid;
  if (select status_entered_at from public.orders where id=oid)<>initial then raise exception 'Payment/dispatch reset phase'; end if;
  perform pg_sleep(0.03);
  perform public.operate_kitchen_order(s,oid,'prepare','queued','QA');
  select status_entered_at,status_elapsed_ms into phase,durations from public.orders where id=oid;
  if phase<=initial or (durations->>'received')::numeric<20 then raise exception 'Kitchen did not track order phase'; end if;
  perform public.operate_kitchen_order(s,oid,'prepare','queued','QA');
  if (select status_entered_at from public.orders where id=oid)<>phase then raise exception 'Retry reset phase'; end if;
  perform pg_sleep(0.03);
  update public.orders set status='ready' where id=oid;
  if (select state from public.order_kitchen_tickets where order_id=oid)<>'ready' then raise exception 'Orders not synchronized with kitchen'; end if;
  update public.orders set status='completed' where id=oid;
  select status_entered_at,status_elapsed_ms into phase,durations from public.orders where id=oid;
  update public.orders set payment_status='verified' where id=oid;
  if (select status_elapsed_ms from public.orders where id=oid)<>durations then raise exception 'Closed durations changed'; end if;
  if (durations->>'preparing')::numeric<20 then raise exception 'Preparation duration missing'; end if;
  if (select completed_at from public.orders where id=oid) is null then raise exception 'Existing milestone tracking regressed'; end if;
end $$;
select 'PASS: real RPC, dispatch, payment, retries, kitchen/order sync, durations, completion; rolled back' as result;
rollback;
