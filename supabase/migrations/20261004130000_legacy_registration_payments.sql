alter table public.commerce_registration_requests
  drop constraint commerce_registration_setup_payment_status_check;
alter table public.commerce_registration_requests
  add constraint commerce_registration_setup_payment_status_check
  check (setup_payment_status in ('pending', 'reported', 'confirmed', 'waived', 'legacy'));

update public.commerce_registration_requests
set setup_payment_status = 'legacy', updated_at = now()
where status = 'approved' and setup_payment_status = 'pending';
