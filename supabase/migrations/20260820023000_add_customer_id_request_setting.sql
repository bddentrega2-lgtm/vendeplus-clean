alter table public.stores
  add column if not exists request_customer_id_number boolean not null default false;

comment on column public.stores.request_customer_id_number is
  'Controls whether checkout requires the customer ID number for this store.';
