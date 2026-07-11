-- Distributed rate limits for server-side abuse control.
-- API routes call public.check_rate_limit with the Supabase service role only.

create schema if not exists private;

create table if not exists private.rate_limit_buckets (
  key_hash text primary key,
  window_start timestamptz not null,
  reset_at timestamptz not null,
  count integer not null default 0,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint rate_limit_buckets_key_hash_check
    check (key_hash ~ '^[a-f0-9]{64}$'),
  constraint rate_limit_buckets_count_check
    check (count >= 0)
);

create index if not exists rate_limit_buckets_reset_at_idx
  on private.rate_limit_buckets(reset_at);

alter table private.rate_limit_buckets enable row level security;

revoke all on table private.rate_limit_buckets from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update, delete on table private.rate_limit_buckets to service_role;

create or replace function public.check_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz,
  current_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_bucket private.rate_limit_buckets%rowtype;
  v_next_count integer;
begin
  if p_key_hash is null or p_key_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid rate limit key';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 100000 then
    raise exception 'invalid rate limit limit';
  end if;

  if p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit window';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('vendemas-rate-limit:' || p_key_hash, 0));

  if random() < 0.01 then
    delete from private.rate_limit_buckets
    where reset_at < v_now - interval '1 hour';
  end if;

  select *
    into v_bucket
  from private.rate_limit_buckets
  where key_hash = p_key_hash
  for update;

  if not found or v_bucket.reset_at <= v_now then
    reset_at := v_now + make_interval(secs => p_window_seconds);
    current_count := 1;
    allowed := true;
    remaining := greatest(0, p_limit - 1);

    insert into private.rate_limit_buckets (
      key_hash,
      window_start,
      reset_at,
      count,
      last_seen_at
    )
    values (
      p_key_hash,
      v_now,
      reset_at,
      current_count,
      v_now
    )
    on conflict (key_hash) do update
      set window_start = excluded.window_start,
          reset_at = excluded.reset_at,
          count = excluded.count,
          last_seen_at = excluded.last_seen_at;

    return next;
    return;
  end if;

  if v_bucket.count >= p_limit then
    update private.rate_limit_buckets
      set last_seen_at = v_now
    where key_hash = p_key_hash;

    allowed := false;
    remaining := 0;
    reset_at := v_bucket.reset_at;
    current_count := v_bucket.count;
    return next;
    return;
  end if;

  v_next_count := v_bucket.count + 1;

  update private.rate_limit_buckets
    set count = v_next_count,
        last_seen_at = v_now
  where key_hash = p_key_hash;

  allowed := true;
  remaining := greatest(0, p_limit - v_next_count);
  reset_at := v_bucket.reset_at;
  current_count := v_next_count;
  return next;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer)
  to service_role;
