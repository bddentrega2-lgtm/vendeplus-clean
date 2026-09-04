-- Permite reimpresiones manuales con la automatizacion apagada sin reclamar eventos automaticos.
drop function if exists public.claim_store_print_jobs(uuid, text, integer);

create or replace function public.claim_store_print_jobs(
  p_store_id uuid,
  p_device_id text,
  p_limit integer default 3,
  p_manual_only boolean default false
)
returns setof public.order_print_jobs
language sql
security invoker
set search_path = public
as $$
  with claimable as (
    select id
    from public.order_print_jobs
    where store_id = p_store_id
      and attempts < 5
      and (not p_manual_only or event_type = 'manual')
      and (
        status = 'pending'
        or status = 'failed'
        or (status = 'processing' and locked_until < now())
      )
    order by created_at asc
    for update skip locked
    limit least(greatest(coalesce(p_limit, 1), 1), 10)
  )
  update public.order_print_jobs jobs
  set status = 'processing',
      attempts = jobs.attempts + 1,
      claimed_by = left(p_device_id, 120),
      locked_until = now() + interval '2 minutes',
      last_error = null,
      updated_at = now()
  from claimable
  where jobs.id = claimable.id
  returning jobs.*;
$$;

revoke all on function public.claim_store_print_jobs(uuid, text, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.claim_store_print_jobs(uuid, text, integer, boolean)
  to service_role;

