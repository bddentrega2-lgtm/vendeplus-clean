alter table public.stores
  add column if not exists table_waiter_call_label text not null default 'Pedir asistencia'
  constraint stores_table_waiter_call_label_length check (char_length(btrim(table_waiter_call_label)) between 3 and 40);
