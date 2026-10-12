-- Approval grants access; payment confirmation independently records the receipt.
create or replace function public.guard_registration_activation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.status = 'approved' and new.status <> 'approved' then
    raise exception 'Una solicitud aprobada no puede revertirse';
  end if;
  if new.status = 'approved' and old.status <> 'approved' and new.affiliate_code_id is not null then
    update public.affiliate_referrals set store_id = new.store_id
      where registration_request_id = new.id and store_id is null;
  end if;
  return new;
end;
$$;

create or replace function public.recognize_affiliate_setup_commission()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ref public.affiliate_referrals%rowtype;
declare v_amount numeric(10,2);
begin
  if new.status <> 'approved' or new.setup_payment_status <> 'confirmed'
     or coalesce(new.setup_paid_usd, 0) <= 0 then return new; end if;
  select * into v_ref from public.affiliate_referrals where registration_request_id = new.id;
  if not found or v_ref.store_id is null or v_ref.setup_commission_percent <= 0 then return new; end if;
  v_amount := round(new.setup_paid_usd * v_ref.setup_commission_percent / 100, 2);
  if v_amount <= 0 then return new; end if;
  insert into public.affiliate_commissions
    (referral_id, store_id, kind, registration_request_id, setup_paid_usd,
     commission_percent, amount_usd, eligible_at)
  values (v_ref.id, v_ref.store_id, 'setup', new.id, new.setup_paid_usd,
    v_ref.setup_commission_percent, v_amount, new.setup_payment_confirmed_at)
  on conflict (registration_request_id) do nothing;
  return new;
end;
$$;

drop trigger recognize_affiliate_setup_on_approval on public.commerce_registration_requests;
create trigger recognize_affiliate_setup_on_approval
after update of status, setup_payment_status on public.commerce_registration_requests
for each row execute function public.recognize_affiliate_setup_commission();
