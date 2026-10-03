alter table public.store_kitchen_settings
  add column if not exists delay_received_minutes smallint not null default 10
    check (delay_received_minutes between 1 and 240),
  add column if not exists delay_accepted_minutes smallint not null default 10
    check (delay_accepted_minutes between 1 and 240),
  add column if not exists delay_preparing_minutes smallint not null default 20
    check (delay_preparing_minutes between 1 and 240),
  add column if not exists delay_ready_minutes smallint not null default 10
    check (delay_ready_minutes between 1 and 240),
  add column if not exists delay_delivering_minutes smallint not null default 30
    check (delay_delivering_minutes between 1 and 240);

notify pgrst, 'reload schema';
