alter table public.stores
  add column if not exists checkout_note_placeholder text;

alter table public.stores
  drop constraint if exists stores_checkout_note_placeholder_length_check;

alter table public.stores
  add constraint stores_checkout_note_placeholder_length_check
  check (checkout_note_placeholder is null or char_length(checkout_note_placeholder) <= 180)
  not valid;

comment on column public.stores.checkout_note_placeholder is
  'Ejemplo opcional mostrado como placeholder en la nota adicional del checkout.';
