alter table public.transport_particular_requests
  add column if not exists payment_reference text;

alter table public.transport_particular_requests
  drop constraint if exists transport_particular_payment_reference_length_check;

alter table public.transport_particular_requests
  add constraint transport_particular_payment_reference_length_check
  check (payment_reference is null or char_length(payment_reference) between 1 and 40);

comment on column public.transport_particular_requests.payment_reference is
  'Referencia indicada por el cliente cuando paga una solicitud particular.';
