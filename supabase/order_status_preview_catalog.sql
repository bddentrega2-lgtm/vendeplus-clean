-- Only the fictional Cocina Demo store in somos-buyer-staging.
begin;
do $$
begin
  if not exists (
    select 1 from public.stores where id = '51000000-0000-4000-8000-000000000001'
      and slug = 'cocina-demo'
  ) or not exists (
    select 1 from public.products where id = '53000000-0000-4000-8000-000000000001'
      and store_id = '51000000-0000-4000-8000-000000000001' and name = 'Combo Demo'
  ) then
    raise exception 'El catálogo ficticio cambió; no se aplicó el fixture.';
  end if;
end;
$$;
insert into public.product_variants(id,product_id,name,price_usd,sort_order)
values
  ('a2000000-0000-4000-8000-000000000011','53000000-0000-4000-8000-000000000001','Demo individual',10,0),
  ('a2000000-0000-4000-8000-000000000012','53000000-0000-4000-8000-000000000001','Demo doble',12,1)
on conflict (id) do nothing;
insert into public.product_option_groups(id,store_id,name,selection_type,required,min_select,max_select,sort_order)
values
  ('a2000000-0000-4000-8000-000000000021','51000000-0000-4000-8000-000000000001','Acompañante Demo','single',true,1,1,0),
  ('a2000000-0000-4000-8000-000000000022','51000000-0000-4000-8000-000000000001','Extra Demo','multiple',false,0,2,1)
on conflict (id) do nothing;
insert into public.product_option_group_products(id,store_id,product_id,option_group_id,sort_order)
values
  ('a2000000-0000-4000-8000-000000000031','51000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000021',0),
  ('a2000000-0000-4000-8000-000000000032','51000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000022',1)
on conflict (id) do nothing;
insert into public.product_option_values(id,option_group_id,name,price_delta_usd,sort_order)
values
  ('a2000000-0000-4000-8000-000000000041','a2000000-0000-4000-8000-000000000021','Opción A Demo',0,0),
  ('a2000000-0000-4000-8000-000000000042','a2000000-0000-4000-8000-000000000021','Opción B Demo',0,1),
  ('a2000000-0000-4000-8000-000000000043','a2000000-0000-4000-8000-000000000022','Salsa Demo',0.50,0)
on conflict (id) do nothing;
commit;
