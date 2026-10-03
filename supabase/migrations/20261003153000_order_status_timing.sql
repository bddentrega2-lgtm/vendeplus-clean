-- No historical backfill: the start of a legacy order's current phase is unknown.
alter table public.orders
  add column if not exists status_entered_at timestamptz,
  add column if not exists status_elapsed_ms jsonb not null default '{}'::jsonb;

create or replace function public.track_order_status_timing()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_elapsed numeric;
begin
  if tg_op = 'INSERT' then
    new.status_entered_at := v_now;
    new.status_elapsed_ms := '{}'::jsonb;
  else
    -- Only a real status transition changes timing, never payment edits or retries.
    new.status_entered_at := old.status_entered_at;
    new.status_elapsed_ms := old.status_elapsed_ms;
    if new.status is distinct from old.status then
      if old.status_entered_at is not null
        and old.status in ('received','accepted','preparing','ready','delivering') then
        v_elapsed := greatest(0, floor(extract(epoch from (v_now - old.status_entered_at)) * 1000));
        new.status_elapsed_ms := jsonb_set(old.status_elapsed_ms, array[old.status],
          to_jsonb(coalesce((old.status_elapsed_ms ->> old.status)::numeric, 0) + v_elapsed));
      end if;
      new.status_entered_at := v_now;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.track_order_status_timing() from public, anon, authenticated;
drop trigger if exists orders_track_status_timing on public.orders;
create trigger orders_track_status_timing
before insert or update on public.orders
for each row execute function public.track_order_status_timing();

notify pgrst, 'reload schema';
