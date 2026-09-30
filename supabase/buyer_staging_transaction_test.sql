-- Staging only. Real order/inventory RPC, synthetic identities, full rollback.
-- This tests database transactions, NOT Google login or the HTTP order endpoint.
begin;
set local statement_timeout = '30s';
insert into auth.users(id, email) values
 ('61000000-0000-4000-8000-000000000001','buyer-a@example.test'),
 ('61000000-0000-4000-8000-000000000002','buyer-b@example.test');
insert into public.stores(id, slug, name) values
 ('62000000-0000-4000-8000-000000000001','transaction-test','Transaction Test');
insert into public.products(id,store_id,name,price_usd) values
 ('63000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','Test product',3);
insert into public.store_inventory_settings(store_id,enabled) values
 ('62000000-0000-4000-8000-000000000001',true);
insert into public.product_inventory_skus(id,store_id,product_id,code,stock_on_hand) values
 ('64000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','63000000-0000-4000-8000-000000000001','TEST',5);

do $$
declare
 a uuid := '61000000-0000-4000-8000-000000000001';
 b uuid := '61000000-0000-4000-8000-000000000002';
 s uuid := '62000000-0000-4000-8000-000000000001';
 oid uuid := '65000000-0000-4000-8000-000000000001';
 gid uuid := '65000000-0000-4000-8000-000000000002';
 failed_id uuid := '65000000-0000-4000-8000-000000000003';
 payload jsonb;
 items jsonb;
 result jsonb;
 rejected boolean;
begin
 payload := jsonb_build_object('id',oid,'store_id',s,'public_code','TEST000001',
   'idempotency_key','staging-transaction-1','customer_name','Synthetic buyer',
   'customer_phone','00000000000','delivery_type','pickup','payment_method','Efectivo',
   'payment_status','pending','subtotal_usd',6,'total_usd',6);
 items := '[{"product_id":"63000000-0000-4000-8000-000000000001","product_name":"Test product","quantity":2,"unit_price_usd":3,"total_usd":6,"options":[],"inventory":[{"sku_id":"64000000-0000-4000-8000-000000000001","quantity":2}]}]';
 result := public.create_buyer_order_atomic(payload,items,a);
 if (result->>'idempotent_replay')::boolean or not exists
   (select 1 from public.buyer_order_accounts where order_id=oid and buyer_user_id=a and store_id=s)
   or (select stock_on_hand from public.product_inventory_skus where store_id=s) <> 3 then
   raise exception 'FAIL: atomic buyer ownership and inventory';
 end if;

 result := public.create_buyer_order_atomic(payload,items,a);
 if not (result->>'idempotent_replay')::boolean
   or (select count(*) from public.orders where store_id=s) <> 1
   or (select count(*) from public.order_items where order_id=oid) <> 1
   or (select count(*) from public.inventory_movements where store_id=s) <> 1
   or (select stock_on_hand from public.product_inventory_skus where store_id=s) <> 3 then
   raise exception 'FAIL: replay changed order or inventory';
 end if;

 rejected := false;
 begin perform public.create_buyer_order_atomic(payload,items,b);
 exception when others then
   if sqlerrm <> 'Buyer order ownership mismatch' then raise; end if;
   rejected := true;
 end;
 if not rejected then raise exception 'FAIL: another buyer claimed an order'; end if;

 rejected := false;
 begin
   perform public.create_buyer_order_atomic(payload || jsonb_build_object('id',failed_id,'public_code','TEST000003','idempotency_key','staging-failure'),
     items || items, a);
 exception when others then
   if sqlerrm not like 'No queda stock suficiente%' then raise; end if;
   rejected := true;
 end;
 if not rejected or exists(select 1 from public.orders where id=failed_id)
   or exists(select 1 from public.buyer_order_accounts where order_id=failed_id)
   or (select count(*) from public.order_items where order_id=oid) <> 1
   or (select count(*) from public.inventory_movements where store_id=s) <> 1
   or (select stock_on_hand from public.product_inventory_skus where store_id=s) <> 3 then
   raise exception 'FAIL: partial order survived stock failure';
 end if;

 payload := payload || jsonb_build_object('id',gid,'public_code','TEST000002','idempotency_key','staging-guest');
 perform public.create_order_atomic(payload,items);
 rejected := false;
 begin perform public.create_buyer_order_atomic(payload,items,a);
 exception when others then
   if sqlerrm <> 'Buyer order ownership mismatch' then raise; end if;
   rejected := true;
 end;
 if not rejected or exists(select 1 from public.buyer_order_accounts where order_id=gid)
   or (select stock_on_hand from public.product_inventory_skus where store_id=s) <> 1 then
   raise exception 'FAIL: guest claim or duplicate inventory';
 end if;

 rejected := false;
 begin perform public.create_buyer_order_atomic(payload,items,null);
 exception when others then
   if sqlerrm <> 'Invalid buyer' then raise; end if;
   rejected := true;
 end;
 if not rejected then raise exception 'FAIL: invalid buyer'; end if;

 rejected := false;
 begin perform public.save_buyer_store_review(oid,a,5);
 exception when others then
   if sqlerrm <> 'Review not allowed' then raise; end if;
   rejected := true;
 end;
 if not rejected then raise exception 'FAIL: incomplete order review'; end if;
 update public.orders set status='completed' where id=oid;
 rejected := false;
 begin perform public.save_buyer_store_review(oid,b,5);
 exception when others then
   if sqlerrm <> 'Review not allowed' then raise; end if;
   rejected := true;
 end;
 if not rejected then raise exception 'FAIL: non-owner review'; end if;

 rejected := false;
 begin perform public.save_buyer_store_review(oid,a,6);
 exception when others then
   if sqlerrm <> 'Invalid rating' then raise; end if;
   rejected := true;
 end;
 if not rejected then raise exception 'FAIL: out-of-range rating'; end if;
 perform public.save_buyer_store_review(oid,a,5);
 perform public.save_buyer_store_review(oid,a,4);
 if (select count(*) from public.buyer_store_reviews where order_id=oid) <> 1
   or not exists(select 1 from public.buyer_store_rating_summaries(array[s]) where average=4 and count=1) then
   raise exception 'FAIL: rating update or aggregate';
 end if;

 perform public.save_buyer_store_review_with_observation(oid,a,4,'  Buena atencion  ');
 if not exists(select 1 from public.buyer_store_reviews where order_id=oid and observation='Buena atencion' and rating=4) then
   raise exception 'FAIL: observation save';
 end if;
 rejected := false;
 begin perform public.save_buyer_store_review_with_observation(oid,b,1,'Ajeno');
 exception when others then
   if sqlerrm <> 'Review not allowed' then raise; end if;
   rejected := true;
 end;
 if not rejected then raise exception 'FAIL: observation ownership'; end if;
 rejected := false;
 begin perform public.save_buyer_store_review_with_observation(oid,a,1,repeat('x',501));
 exception when others then
   if sqlerrm <> 'Invalid observation' then raise; end if;
   rejected := true;
 end;
 if not rejected or not exists(select 1 from public.buyer_store_reviews where order_id=oid and observation='Buena atencion' and rating=4) then
   raise exception 'FAIL: oversized observation changed review';
 end if;
 perform public.save_buyer_store_review_with_observation(oid,a,4,repeat('x',500));
 perform public.save_buyer_store_review_with_observation(oid,a,4,E' \t\n');
 if not exists(select 1 from public.buyer_store_reviews where order_id=oid and observation is null and rating=4) then
   raise exception 'FAIL: observation clear';
 end if;

 insert into public.store_users(store_id,user_id,role) values(s,a,'owner');
 rejected := false;
 begin perform public.save_buyer_store_review(oid,a,5);
 exception when others then
   if sqlerrm <> 'Review not allowed' then raise; end if;
   rejected := true;
 end;
 if not rejected then raise exception 'FAIL: self-store review'; end if;

 update public.orders set status='cancelled' where id=oid;
 if exists(select 1 from public.buyer_store_rating_summaries(array[s])) then
   raise exception 'FAIL: cancelled order in ratings';
 end if;
end $$;
rollback;
select 'PASS: 12 transaction scenarios plus observation save, ownership, limit and clear' as result,
 not exists(select 1 from auth.users where id in ('61000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000002')) as synthetic_users_rolled_back,
 not exists(select 1 from public.stores where id='62000000-0000-4000-8000-000000000001') as synthetic_store_rolled_back,
 (select count(*) from public.orders) as persisted_orders;
