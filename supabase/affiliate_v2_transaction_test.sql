begin;
do $$
declare v_user uuid;
declare v_email text;
declare v_city uuid;
declare v_agency uuid;
declare v_store uuid;
declare v_code uuid;
declare v_delivery_code uuid;
declare v_request uuid;
declare v_start timestamptz;
declare v_cancelled uuid;
declare v_manual uuid;
declare v_payment uuid;
declare v_ids uuid[];
declare v_settlement uuid;
declare v_adjustment uuid;
declare v_amount numeric;
declare v_monthly jsonb;
declare v_earnings jsonb;
declare v_admin jsonb;
begin
  select id, lower(email) into v_user, v_email from auth.users where email_confirmed_at is not null limit 1;
  v_email := 'affiliate-smoke-' || substr(md5(gen_random_uuid()::text), 1, 10) || '@example.invalid';
  select id into v_city from public.service_cities limit 1;
  if v_user is null or v_city is null then raise exception 'Missing staging fixture'; end if;
  insert into public.transport_agencies(name, slug, contact_name, contact_email, contact_phone)
    values ('V2 Delivery Smoke', 'v2-delivery-smoke-' || substr(md5(gen_random_uuid()::text), 1, 8),
      'Smoke Operator', 'v2-delivery@example.invalid', '584241234567') returning id into v_agency;

  insert into public.stores(slug, name, marketplace_visible, plan_type, subscription_status)
    values ('affiliate-v2-smoke-' || substr(md5(gen_random_uuid()::text), 1, 8), 'Affiliate V2 Smoke', false, 'trial', 'trial')
    returning id into v_store;
  insert into public.affiliate_codes(code, name, partner_type, beneficiary_email,
    discount_percent, setup_commission_percent, commission_percent, duration_months)
    values ('V' || upper(substr(md5(gen_random_uuid()::text), 1, 8)), 'V2 seller', 'seller', v_email,
      50, 100, 50, 3) returning id into v_code;
  insert into public.affiliate_codes(code, name, partner_type, transport_agency_id,
    discount_percent, setup_commission_percent, commission_percent, duration_months)
    values ('D' || upper(substr(md5(gen_random_uuid()::text), 1, 8)), 'V2 delivery', 'delivery', v_agency,
      75, 50, 30, 2) returning id into v_delivery_code;
  if (select transport_agency_id from public.affiliate_codes where id = v_delivery_code) <> v_agency then
    raise exception 'Delivery code lost agency identity'; end if;

  insert into public.commerce_registration_requests
    (request_code, store_name, representative_name, representative_id_number, email, whatsapp,
     business_type, city_id, weekly_order_volume, logo_path, logo_mime_type, affiliate_code_id)
    values ('SOL-' || upper(substr(md5(gen_random_uuid()::text), 1, 6)), 'V2 Smoke', 'Smoke Operator',
      'V-12345678', 'v2-smoke@example.invalid', '584241234567', 'food', v_city, 'starting',
      'smoke/logo.png', 'image/png', v_code) returning id into v_request;
  if (select setup_due_usd from public.commerce_registration_requests where id = v_request) <> 10 then
    raise exception 'Initial discount incorrect'; end if;
  update public.commerce_registration_requests set setup_payment_status = 'confirmed',
    setup_payment_reference = 'V2-SMOKE', setup_payment_confirmed_at = now(),
    setup_payment_confirmed_by = v_user, setup_paid_usd = 10 where id = v_request;
  update public.commerce_registration_requests set status = 'activating' where id = v_request;
  update public.commerce_registration_requests set status = 'approved', store_id = v_store where id = v_request;
  if (select fee_started_at from public.affiliate_referrals where registration_request_id = v_request) is not null then
    raise exception 'Fee window started during trial'; end if;
  if (select amount_usd from public.affiliate_commissions where registration_request_id = v_request) <> 10 then
    raise exception 'Initial commission must use collected USD 10'; end if;
  update public.affiliate_codes set discount_percent = 80, setup_commission_percent = 10 where id = v_code;
  if (select setup_commission_percent from public.affiliate_referrals where registration_request_id = v_request) <> 100 then
    raise exception 'Referral terms changed after registration'; end if;

  update public.stores set plan_type = 'per_service', subscription_status = 'active' where id = v_store;
  select fee_started_at into v_start from public.affiliate_referrals where registration_request_id = v_request;
  if v_start is null then raise exception 'Fee window did not start at fee activation'; end if;
  if (select fee_ends_at from public.affiliate_referrals where registration_request_id = v_request) <= v_start then
    raise exception 'Fee window invalid'; end if;
  update public.stores set next_payment_due_at = now() + interval '30 days' where id = v_store;
  if (select fee_started_at from public.affiliate_referrals where registration_request_id = v_request) <> v_start then
    raise exception 'Fee window restarted on subscription update'; end if;

  insert into public.orders(public_code, store_id, customer_name, customer_phone, delivery_type,
    payment_method, status, platform_service_fee_usd, created_at)
    values ('V2-BEFORE', v_store, 'Smoke', '584241234567', 'pickup', 'Efectivo', 'completed', 0.10,
      now() - interval '1 day');
  insert into public.orders(public_code, store_id, customer_name, customer_phone, delivery_type,
    payment_method, status, platform_service_fee_usd)
    values ('V2-CANCEL', v_store, 'Smoke', '584241234567', 'pickup', 'Efectivo', 'cancelled', 0.10)
    returning id into v_cancelled;
  insert into public.orders(public_code, store_id, customer_name, customer_phone, delivery_type,
    payment_method, status, platform_service_fee_usd)
    values ('V2-COMPLETE', v_store, 'Smoke', '584241234567', 'pickup', 'Efectivo', 'completed', 0.20);
  insert into public.orders(public_code, store_id, customer_name, customer_phone, delivery_type,
    payment_method, status, platform_service_fee_usd)
    values ('V2-MANUAL', v_store, 'Smoke', '584241234567', 'pickup', 'Efectivo', 'completed', 0)
    returning id into v_manual;

  insert into public.store_subscription_payments(store_id, plan_type, amount_usd, status)
    values (v_store, 'per_service', 0.40, 'pending') returning id into v_payment;
  update public.store_subscription_payments set status = 'approved' where id = v_payment;
  select coalesce(sum(amount_usd), 0) into v_amount from public.affiliate_commissions
    where store_id = v_store and kind = 'fee';
  if v_amount <> 0.15 then raise exception 'Fee commissions incorrect: %', v_amount; end if;
  if not exists (select 1 from public.affiliate_commissions where order_id = v_cancelled and amount_usd = 0.05) then
    raise exception 'Charged cancelled order did not earn commission'; end if;
  if exists (select 1 from public.affiliate_commissions where order_id = v_manual) then
    raise exception 'Manual zero-fee order earned commission'; end if;
  if public.affiliate_pending_commission_by_codes(array[v_code]) <> 0 then
    raise exception 'Paid fees still show as pending'; end if;
  v_monthly := public.affiliate_monthly_snapshot_by_codes(array[v_code]);
  if jsonb_array_length(v_monthly->'stores') <> 1 or
     (v_monthly->'stores'->0->>'orderCount')::integer <> 2 or
     (v_monthly->'stores'->0->>'feeGeneratedUsd')::numeric <> 0.30 or
     (v_monthly->'stores'->0->>'feeCollectedUsd')::numeric <> 0.30 or
     (v_monthly->'stores'->0->>'commissionAvailableUsd')::numeric <> 0.15 then
    raise exception 'Monthly affiliate snapshot incorrect: %', v_monthly;
  end if;
  insert into public.orders(public_code, store_id, customer_name, customer_phone, delivery_type,
    payment_method, status, platform_service_fee_usd)
    values ('V2-UNPAID', v_store, 'Smoke', '584241234567', 'pickup', 'Efectivo', 'completed', 0.10);
  v_earnings := public.affiliate_earnings_by_codes(array[v_code]);
  if jsonb_array_length(v_earnings) <> 1 or
     (v_earnings->0->>'setupPendingUsd')::numeric <> 10 or
     (v_earnings->0->>'feePendingUsd')::numeric <> 0.15 or
     (v_earnings->0->>'setupPaidUsd')::numeric <> 0 or
     (v_earnings->0->>'feePaidUsd')::numeric <> 0 then
    raise exception 'Uncollected fee entered affiliate earnings: %', v_earnings;
  end if;
  select value into v_admin from jsonb_array_elements(public.affiliate_admin_list()) value
    where (value->'codes') ? (select code from public.affiliate_codes where id = v_code);
  if (v_admin->>'setupPendingUsd')::numeric <> 10 or (v_admin->>'feePendingUsd')::numeric <> 0.15 or
     (v_admin->>'setupPaidUsd')::numeric <> 0 or (v_admin->>'feePaidUsd')::numeric <> 0 or
     (v_admin->>'commerceCount')::integer <> 1 or
     (v_admin->>'setupPendingCount')::integer <> 1 or
     (v_admin->>'feePendingCount')::integer <> 2 or
     (v_admin->>'setupPaidCount')::integer <> 0 or
     (v_admin->>'feePaidCount')::integer <> 0 or
     not (v_admin->'partnerTypes') ? 'seller' then
    raise exception 'Admin pending balance includes uncollected fee or misses setup: %', v_admin;
  end if;

  select public.adjust_affiliate_setup_refund(id, 2, 'V2-SETUP-REFUND', v_user) into v_adjustment
    from public.affiliate_commissions where registration_request_id = v_request;
  if (select amount_usd from public.affiliate_commission_adjustments where id = v_adjustment) <> -2 then
    raise exception 'Setup refund incorrect'; end if;
  if (select public.adjust_affiliate_setup_refund(id, 2, 'V2-SETUP-REFUND', v_user)
      from public.affiliate_commissions where registration_request_id = v_request) <> v_adjustment then
    raise exception 'Setup refund was duplicated'; end if;
  select public.adjust_affiliate_commission_for_fee_refund(id, 0.10, 'V2-FEE-REFUND', v_user) into v_adjustment
    from public.affiliate_commissions where order_id = v_cancelled;
  if (select amount_usd from public.affiliate_commission_adjustments where id = v_adjustment) <> -0.05 then
    raise exception 'Fee refund incorrect'; end if;
  select array_agg(id) into v_ids from public.affiliate_commissions where store_id = v_store and status = 'available';
  select public.settle_affiliate_commissions(v_ids, now(), 'Transferencia', 'V2-SETTLEMENT', v_user) into v_settlement;
  if (select amount_usd from public.affiliate_settlements where id = v_settlement) <> 8.10 then
    raise exception 'Net settlement incorrect'; end if;
  if (select affiliate_code_id from public.affiliate_settlements where id = v_settlement) <> v_code then
    raise exception 'Settlement attributed to wrong code'; end if;
  v_earnings := public.affiliate_earnings_by_codes(array[v_code]);
  if (v_earnings->0->>'setupPendingUsd')::numeric <> 0 or
     (v_earnings->0->>'feePendingUsd')::numeric <> 0 or
     (v_earnings->0->>'setupPaidUsd')::numeric <> 8 or
     (v_earnings->0->>'feePaidUsd')::numeric <> 0.10 then
    raise exception 'Settled affiliate earnings incorrect: %', v_earnings;
  end if;
  select value into v_admin from jsonb_array_elements(public.affiliate_admin_list()) value
    where (value->'codes') ? (select code from public.affiliate_codes where id = v_code);
  if (v_admin->>'setupPendingUsd')::numeric <> 0 or (v_admin->>'feePendingUsd')::numeric <> 0 or
     (v_admin->>'setupPaidUsd')::numeric <> 8 or (v_admin->>'feePaidUsd')::numeric <> 0.10 or
     (v_admin->>'setupPendingCount')::integer <> 0 or
     (v_admin->>'feePendingCount')::integer <> 0 or
     (v_admin->>'setupPaidCount')::integer <> 1 or
     (v_admin->>'feePaidCount')::integer <> 1 or
     has_function_privilege('authenticated', 'public.affiliate_admin_list()', 'execute') then
    raise exception 'Admin paid balance or permission incorrect: %', v_admin;
  end if;
  insert into public.affiliate_payout_accounts(beneficiary_email, holder_name, bank_name, document_number, phone)
    values (v_email, 'Smoke Operator', 'Banco Demo', 'V12345678', '04121234567')
    on conflict (beneficiary_email) do update set bank_name = excluded.bank_name;
  if (select bank_name from public.affiliate_payout_accounts where beneficiary_email = v_email) <> 'Banco Demo' or
     has_table_privilege('authenticated', 'public.affiliate_payout_accounts', 'select') then
    raise exception 'Affiliate payout privacy/storage incorrect';
  end if;
end $$;
select 'affiliate v2 transaction smoke passed' as result;
rollback;
