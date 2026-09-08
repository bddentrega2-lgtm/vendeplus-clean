alter table public.transport_particular_requests
  add column if not exists pickup_name text,
  add column if not exists delivery_name text;

alter table public.transport_particular_requests
  drop constraint if exists transport_particular_text_lengths_check;

alter table public.transport_particular_requests
  add constraint transport_particular_text_lengths_check check (
    char_length(requester_name) between 1 and 100 and
    char_length(requester_phone) between 1 and 24 and
    char_length(coalesce(pickup_name, '')) <= 100 and
    char_length(pickup_phone) between 1 and 24 and
    char_length(coalesce(delivery_name, '')) <= 100 and
    char_length(delivery_phone) between 1 and 24 and
    char_length(pickup_address) between 0 and 240 and
    char_length(delivery_address) between 0 and 240 and
    char_length(package_description) between 1 and 300
  );

comment on column public.transport_particular_requests.pickup_name is
  'Nombre de contacto en el punto de retiro/origen para solicitudes particulares.';
comment on column public.transport_particular_requests.delivery_name is
  'Nombre de contacto en el punto de entrega/destino para solicitudes particulares.';
