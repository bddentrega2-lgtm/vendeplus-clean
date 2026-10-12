-- Preserve explicitly grandfathered registrations without inventing a payment.
alter table public.commerce_registration_requests
  add constraint commerce_registration_legacy_no_affiliate_check
  check (setup_payment_status <> 'legacy' or affiliate_code_id is null);

create or replace function public.guard_registration_activation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status in ('activating', 'approved') and old.status is distinct from new.status and
     new.setup_payment_status not in ('confirmed', 'waived', 'legacy') then
    raise exception 'Confirma el pago inicial antes de activar el comercio';
  end if;
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
