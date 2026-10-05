alter table public.affiliate_referrals
  add column timezone text not null default 'America/Caracas';

create or replace function public.guard_registration_activation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_start timestamptz := now();
begin
  if new.status in ('activating', 'approved') and old.status is distinct from new.status then
    if new.setup_payment_status not in ('confirmed', 'waived') then
      raise exception 'Confirma el pago inicial antes de activar el comercio';
    end if;
  end if;
  if old.status = 'approved' and new.status <> 'approved' then
    raise exception 'Una solicitud aprobada no puede revertirse';
  end if;
  if new.status = 'approved' and old.status <> 'approved' and new.affiliate_code_id is not null then
    update public.affiliate_referrals
      set store_id = new.store_id,
          activated_at = coalesce(activated_at, v_start),
          ends_at = coalesce(ends_at, ((v_start at time zone timezone) + make_interval(months => duration_months)) at time zone timezone)
      where registration_request_id = new.id and store_id is null;
  end if;
  return new;
end;
$$;
