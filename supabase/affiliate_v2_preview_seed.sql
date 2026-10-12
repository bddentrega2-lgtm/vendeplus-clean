do $$
declare v_seller uuid;
declare v_creator uuid;
declare v_delivery uuid;
declare v_agency uuid;
begin
  select id into v_seller from auth.users where lower(email) = 'preview-aliado@somos.test' and email_confirmed_at is not null;
  select id into v_creator from auth.users where lower(email) = 'preview-creador@somos.test' and email_confirmed_at is not null;
  select id into v_delivery from auth.users where lower(email) = 'preview-delivery@somos.test' and email_confirmed_at is not null;
  if v_seller is null or v_creator is null or v_delivery is null then
    raise exception 'Confirmed preview personas are missing'; end if;

  select id into v_agency from public.transport_agencies where slug = 'delivery-referidos-demo';
  if v_agency is null then
    insert into public.transport_agencies
      (name, slug, contact_name, contact_email, contact_phone, status, is_active)
    values ('Delivery Referidos Demo', 'delivery-referidos-demo', 'Delivery Demo', 'preview-delivery@somos.test',
      '584240000000', 'active', false) returning id into v_agency;
  end if;
  insert into public.transport_agency_users(agency_id, user_id, email, role)
    values (v_agency, v_delivery, 'preview-delivery@somos.test', 'owner')
    on conflict (agency_id, email) do nothing;

  insert into public.affiliate_codes
    (code, name, partner_type, beneficiary_email, discount_percent,
     setup_commission_percent, commission_percent, duration_months)
    values ('VENDEDORDEMO', 'Vendedor Demo', 'seller', 'preview-aliado@somos.test', 0, 75, 50, 3)
    on conflict (code) do nothing;
  insert into public.affiliate_codes
    (code, name, partner_type, beneficiary_email, discount_percent,
     setup_commission_percent, commission_percent, duration_months)
    values ('CREADORDEMO', 'Creador Demo', 'creator', 'preview-creador@somos.test', 50, 100, 50, 1)
    on conflict (code) do nothing;
  insert into public.affiliate_codes
    (code, name, partner_type, transport_agency_id, discount_percent,
     setup_commission_percent, commission_percent, duration_months)
    values ('DELIVERYDEMO', 'Delivery Demo', 'delivery', v_agency, 75, 50, 30, 2)
    on conflict (code) do nothing;
end $$;
