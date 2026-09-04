alter table public.store_print_settings
  add column if not exists connection_type text not null default 'windows_printer',
  add column if not exists baud_rate integer not null default 9600;

alter table public.store_print_settings
  drop constraint if exists store_print_settings_connection_type_check;
alter table public.store_print_settings
  add constraint store_print_settings_connection_type_check
  check (connection_type in ('windows_printer', 'serial'));

alter table public.store_print_settings
  drop constraint if exists store_print_settings_baud_rate_check;
alter table public.store_print_settings
  add constraint store_print_settings_baud_rate_check
  check (baud_rate in (9600, 19200, 38400, 57600, 115200));
