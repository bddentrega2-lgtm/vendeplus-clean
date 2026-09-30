-- Run ONLY through the staging-identity guard in supabase-buyer-staging.ps1.
-- Fictional catalog; no contact, payment account, integration or device data.
begin;
do $$ begin
  if exists(select 1 from public.stores) or exists(select 1 from auth.users)
    or exists(select 1 from public.orders) then
    raise exception 'Catalog initialization requires an empty staging database';
  end if;
end $$;

insert into public.service_cities(id, state_name, name, slug, center_latitude, center_longitude)
values
 ('50000000-0000-4000-8000-000000000001','Distrito Capital','Caracas Demo','caracas-demo',10.4806,-66.9036),
 ('50000000-0000-4000-8000-000000000002','Miranda','Los Teques Demo','los-teques-demo',10.3445,-67.0433);

insert into public.stores(id, slug, name, description, city_id, latitude, longitude,
  address, logo_url, payment_methods, manual_open_status, plan_type, subscription_status,
  auto_update_exchange_rate, show_prices_in_bs, catalog_layout, request_customer_id_number)
values
 ('51000000-0000-4000-8000-000000000001','cocina-demo','Cocina Demo','Comercio ficticio de pruebas.',
  '50000000-0000-4000-8000-000000000001',10.481,-66.904,'Ubicacion ficticia de pruebas',
  '/brand/new-somos-preview/somos-icon-preview-192.png','["Efectivo"]','open','founder','active',false,false,'visual',true),
 ('51000000-0000-4000-8000-000000000002','tienda-demo','Tienda Demo','Comercio ficticio de pruebas.',
  '50000000-0000-4000-8000-000000000002',10.345,-67.044,'Ubicacion ficticia de pruebas',
  '/brand/new-somos-preview/somos-icon-preview-192.png','["Efectivo"]','open','founder','active',false,false,'classic',false);

insert into public.categories(id, store_id, name) values
 ('52000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','Menu de prueba'),
 ('52000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000002','Productos de prueba');

insert into public.products(id, store_id, category_id, name, description, price_usd, discount_percent)
values
 ('53000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','Combo Demo','Producto ficticio, no se despacha.',10,10),
 ('53000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','Bebida Demo','Producto ficticio, no se despacha.',2,0),
 ('53000000-0000-4000-8000-000000000003','51000000-0000-4000-8000-000000000002','52000000-0000-4000-8000-000000000002','Articulo Demo','Producto ficticio, no se despacha.',5,0);

insert into public.store_delivery_settings(store_id, delivery_enabled, pickup_enabled, delivery_provider)
values ('51000000-0000-4000-8000-000000000001',false,true,'disabled'),
 ('51000000-0000-4000-8000-000000000002',false,true,'disabled');
commit;
select (select count(*) from public.stores) as fictional_stores,
 (select count(*) from public.products) as fictional_products,
 (select count(*) from public.orders) as orders,
 (select count(*) from auth.users) as auth_users;
