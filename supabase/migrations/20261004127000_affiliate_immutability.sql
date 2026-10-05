create or replace function public.guard_affiliate_referral_terms()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.registration_request_id is distinct from new.registration_request_id or
     old.affiliate_code_id is distinct from new.affiliate_code_id or
     old.beneficiary_user_id is distinct from new.beneficiary_user_id or
     old.discount_percent is distinct from new.discount_percent or
     old.commission_percent is distinct from new.commission_percent or
     old.duration_months is distinct from new.duration_months or
     old.timezone is distinct from new.timezone or
     (old.store_id is not null and old.store_id is distinct from new.store_id) or
     (old.activated_at is not null and old.activated_at is distinct from new.activated_at) or
     (old.ends_at is not null and old.ends_at is distinct from new.ends_at)
  then raise exception 'Los terminos del referido no pueden modificarse'; end if;
  return new;
end;
$$;
create trigger guard_affiliate_referral_terms_before_update
before update on public.affiliate_referrals
for each row execute function public.guard_affiliate_referral_terms();

create or replace function public.guard_registration_terms()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.affiliate_code_id is distinct from new.affiliate_code_id or
     old.setup_base_usd is distinct from new.setup_base_usd or
     old.setup_discount_percent is distinct from new.setup_discount_percent or
     old.setup_due_usd is distinct from new.setup_due_usd
  then raise exception 'La atribucion y el precio inicial no pueden cambiarse'; end if;
  if old.setup_payment_status in ('confirmed', 'waived') and
    (old.setup_payment_status is distinct from new.setup_payment_status or
     old.setup_paid_usd is distinct from new.setup_paid_usd or
     old.setup_payment_confirmed_by is distinct from new.setup_payment_confirmed_by or
     old.setup_payment_confirmed_at is distinct from new.setup_payment_confirmed_at)
  then raise exception 'La confirmacion del pago inicial no puede reescribirse'; end if;
  return new;
end;
$$;
create trigger guard_registration_terms_before_update
before update on public.commerce_registration_requests
for each row execute function public.guard_registration_terms();
