-- One user-confirmed fictional order. Run ONLY via the staging identity guard.
-- Does not change payment, identity, totals, inventory or ratings.
begin;
set local lock_timeout = '5s';
do $$
declare
 target_id uuid;
 affected integer;
begin
 select o.id into strict target_id
 from public.orders o join public.stores s on s.id=o.store_id
 where o.public_code='SO-0929-465966'
   and s.id='51000000-0000-4000-8000-000000000001'
   and s.slug='cocina-demo' and s.name='Cocina Demo'
   and o.status='received' and o.total_usd=2 and o.delivery_type='pickup'
   and o.transport_agency_id is null
   and exists(select 1 from public.buyer_order_accounts b where b.order_id=o.id and b.store_id=o.store_id)
 for update of o;

 if (select count(*) from public.order_items where order_id=target_id) <> 1
   or not exists(select 1 from public.order_items where order_id=target_id
     and product_id='53000000-0000-4000-8000-000000000002' and quantity=1 and total_usd=2)
   or exists(select 1 from public.buyer_store_reviews where order_id=target_id) then
   raise exception 'Unexpected test order contents; no change allowed';
 end if;

 update public.orders set status='completed'
 where id=target_id and store_id='51000000-0000-4000-8000-000000000001' and status='received';
 get diagnostics affected = row_count;
 if affected <> 1 then raise exception 'Expected exactly one test order update'; end if;
end $$;
commit;
