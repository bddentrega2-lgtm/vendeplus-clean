-- Synthetic fixtures and real RPCs. Run only through the guarded staging script.
begin;
set local statement_timeout = '45s';
insert into public.stores(id,slug,name) values
 ('d1000000-0000-4000-8000-000000000001','audit-remediation-qa','Audit QA'),
 ('d1000000-0000-4000-8000-000000000002','audit-remediation-other','Other QA');
insert into public.products(id,store_id,name,price_usd) values
 ('d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','Synthetic item',3);
insert into public.store_inventory_settings(store_id,enabled) values
 ('d1000000-0000-4000-8000-000000000001',true);
insert into public.product_inventory_skus(id,store_id,product_id,code,stock_on_hand) values
 ('d3000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','AUDIT',40);

create function public.audit_qa_fail_attachment() returns trigger language plpgsql as $$
begin
 if new.storage_path = 'audit-force-failure' then raise exception 'audit-injected-attachment-failure'; end if;
 return new;
end $$;
create trigger audit_qa_receipt_failure before update of order_id on public.order_payment_receipts
 for each row execute function public.audit_qa_fail_attachment();

do $$
declare
 s uuid := 'd1000000-0000-4000-8000-000000000001';
 first_receipt uuid;
 receipt uuid;
 oid uuid;
 payload jsonb;
 items jsonb := '[{"product_id":"d2000000-0000-4000-8000-000000000001","product_name":"Synthetic item","quantity":2,"unit_price_usd":3,"total_usd":6,"options":[],"inventory":[{"sku_id":"d3000000-0000-4000-8000-000000000001","quantity":2}]}]';
 mode text;
 n integer := 0;
 rejected boolean;
 result jsonb;
begin
 foreach mode in array array['pickup','delivery','table','bar'] loop
  n := n + 1;
  receipt := gen_random_uuid(); oid := gen_random_uuid();
  if n=1 then first_receipt := receipt; end if;
  insert into public.order_payment_receipts(id,store_id,mime_type,size_bytes,storage_path)
   values(receipt,s,'image/png',100,'audit-fixture-'||mode);
  payload := jsonb_build_object('id',oid,'store_id',s,'public_code','AUDIT-QA-'||mode,
   'idempotency_key','audit-qa-'||mode,'customer_name','Synthetic QA','customer_phone','00000000000',
   'delivery_type',case when mode='bar' then 'pickup' else mode end,
   'delivery_pricing_type',case when mode='bar' then 'bar' else null end,
   'payment_method','Efectivo','payment_status','pending','subtotal_usd',6,'total_usd',6,
   'platform_service_fee_usd',0.10);
  result := public.create_order_with_receipt_atomic(payload,items,null,receipt);
  if not exists(select 1 from public.order_payment_receipts where id=receipt and order_id=oid and attached_at is not null)
   or (select stock_on_hand from public.product_inventory_skus where store_id=s) <> 40-2*n then
   raise exception 'Receipt or inventory mismatch for %', mode;
  end if;
  result := public.create_order_with_receipt_atomic(payload,items,null,receipt);
  if not (result->>'idempotent_replay')::boolean
   or (select count(*) from public.orders where store_id=s) <> n
   or (select stock_on_hand from public.product_inventory_skus where store_id=s) <> 40-2*n then
   raise exception 'Replay duplicated order or stock';
  end if;
 end loop;

 -- A used receipt must roll back the order/items/stock/fee it attempted to create.
 rejected := false;
 begin
  perform public.create_order_with_receipt_atomic(payload || jsonb_build_object('id',gen_random_uuid(),'public_code','AUDIT-REUSE','idempotency_key','audit-reuse'),items,null,first_receipt);
 exception when others then
  if sqlerrm not like '%ya fue utilizada%' then raise; end if;
  rejected := true;
 end;
 if not rejected then raise exception 'Used receipt accepted'; end if;

 receipt := gen_random_uuid();
 insert into public.order_payment_receipts(id,store_id,mime_type,size_bytes,storage_path)
  values(receipt,s,'image/png',100,'audit-force-failure');
 rejected := false;
 begin
  perform public.create_order_with_receipt_atomic(payload || jsonb_build_object('id',gen_random_uuid(),'public_code','AUDIT-FAIL','idempotency_key','audit-fail'),items,null,receipt);
 exception when others then
  if sqlerrm <> 'audit-injected-attachment-failure' then raise; end if;
  rejected := true;
 end;
 if not rejected or (select count(*) from public.orders where store_id=s) <> 4
  or (select count(*) from public.order_items where order_id in (select id from public.orders where store_id=s)) <> 4
  or (select stock_on_hand from public.product_inventory_skus where store_id=s) <> 32
  or (select count(*) from public.inventory_movements where store_id=s) <> 4
  or (select sum(platform_service_fee_usd) from public.orders where store_id=s) <> 0.40
  or exists(select 1 from public.order_payment_receipts where id=receipt and order_id is not null) then
  raise exception 'Partial write after attachment failure';
 end if;

 rejected := false;
 begin
  perform public.create_order_with_receipt_atomic(payload || jsonb_build_object('store_id','d1000000-0000-4000-8000-000000000002'),items,null,first_receipt);
 exception when sqlstate '22023' then rejected := true;
 end;
 if not rejected then raise exception 'Cross-store receipt accepted'; end if;
 if has_function_privilege('anon','public.create_order_with_receipt_atomic(jsonb,jsonb,uuid,uuid)','execute')
  or has_function_privilege('authenticated','public.create_order_with_receipt_atomic(jsonb,jsonb,uuid,uuid)','execute') then
  raise exception 'Receipt RPC exposed';
 end if;
end $$;

-- A merchant without inventory keeps the ordinary order path.
insert into public.products(id,store_id,name,price_usd) values
 ('d2000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002','No inventory QA',5);
do $$
declare s uuid := 'd1000000-0000-4000-8000-000000000002'; r uuid := gen_random_uuid(); o uuid := gen_random_uuid();
begin
 insert into public.order_payment_receipts(id,store_id,mime_type,size_bytes) values(r,s,'image/png',100);
 perform public.create_order_with_receipt_atomic(
  jsonb_build_object('id',o,'store_id',s,'public_code','AUDIT-NO-STOCK','idempotency_key','audit-no-stock',
   'customer_name','Synthetic QA','customer_phone','00000000000','delivery_type','pickup',
   'payment_method','Efectivo','payment_status','pending','subtotal_usd',5,'total_usd',5),
  '[{"product_id":"d2000000-0000-4000-8000-000000000002","product_name":"No inventory QA","quantity":1,"unit_price_usd":5,"total_usd":5,"options":[]}]',null,r);
 if not exists(select 1 from public.orders where id=o and store_id=s)
  or not exists(select 1 from public.order_payment_receipts where id=r and order_id=o)
  or exists(select 1 from public.inventory_movements where store_id=s) then
  raise exception 'Merchant without inventory regressed';
 end if;
end $$;

insert into public.transport_agencies(id,name,slug,contact_name,contact_email,contact_phone,status,is_active,rates_visibility,admin_notes)
 values
 ('d4000000-0000-4000-8000-000000000001','Public QA','audit-public','QA','public@example.invalid','000','active',true,'public','private'),
 ('d4000000-0000-4000-8000-000000000002','Private QA','audit-private','QA','private@example.invalid','000','active',true,'private','private');
insert into public.transport_agency_rates(agency_id,flat_fee_usd)
 select id,2 from public.transport_agencies where slug in ('audit-public','audit-private');
insert into public.transport_agency_zones(agency_id,name,fee_usd)
 select id,'QA zone',2 from public.transport_agencies where slug in ('audit-public','audit-private');
insert into public.transport_agency_distance_rates(agency_id,fee_usd)
 select id,2 from public.transport_agencies where slug in ('audit-public','audit-private');
set local role anon;
do $$
declare rejected boolean := false; t text; n integer;
begin
 if (select count(*) from public.transport_agencies where slug in ('audit-public','audit-private')) <> 2 then
  raise exception 'Public directory broken';
 end if;
 begin perform admin_notes from public.transport_agencies;
 exception when insufficient_privilege then rejected := true; end;
 if not rejected then raise exception 'Private agency columns exposed'; end if;
 foreach t in array array['transport_agency_rates','transport_agency_zones','transport_agency_distance_rates'] loop
  execute format('select count(*) from public.%I where agency_id in (''d4000000-0000-4000-8000-000000000001'',''d4000000-0000-4000-8000-000000000002'')',t) into n;
  if n<>1 then raise exception 'Private rates exposed or public rates hidden: %',t; end if;
 end loop;
end $$;
reset role;
rollback;
select 'PASS: receipt atomicity, replay, four routes, inventory, cross-store rejection, anon agency privacy' as result;
