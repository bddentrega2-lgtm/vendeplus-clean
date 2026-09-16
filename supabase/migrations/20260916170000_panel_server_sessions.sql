-- Revocable server-side sessions for HttpOnly panel cookies.

create schema if not exists private;

create table if not exists private.panel_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text not null,
  secret_hash text not null,
  founder boolean not null default false,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  user_agent text,
  ip text,
  constraint panel_sessions_email_check
    check (email = lower(trim(email)) and position('@' in email) > 1),
  constraint panel_sessions_secret_hash_check
    check (secret_hash ~ '^[a-f0-9]{64}$')
);

create index if not exists panel_sessions_user_id_idx
  on private.panel_sessions(user_id);

create index if not exists panel_sessions_active_idx
  on private.panel_sessions(expires_at)
  where revoked_at is null;

alter table private.panel_sessions enable row level security;

revoke all on table private.panel_sessions from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update, delete on table private.panel_sessions to service_role;

create or replace function public.create_panel_session(
  p_user_id uuid,
  p_email text,
  p_secret_hash text,
  p_expires_at timestamptz,
  p_founder boolean default false,
  p_user_agent text default null,
  p_ip text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if p_user_id is null then
    raise exception 'invalid panel session user';
  end if;

  if v_email = '' or position('@' in v_email) <= 1 then
    raise exception 'invalid panel session email';
  end if;

  if p_secret_hash is null or p_secret_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid panel session secret';
  end if;

  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'invalid panel session expiration';
  end if;

  insert into private.panel_sessions (
    user_id,
    email,
    secret_hash,
    founder,
    expires_at,
    user_agent,
    ip
  )
  values (
    p_user_id,
    v_email,
    p_secret_hash,
    coalesce(p_founder, false),
    p_expires_at,
    nullif(left(coalesce(p_user_agent, ''), 240), ''),
    nullif(left(coalesce(p_ip, ''), 80), '')
  )
  returning id into v_id;

  delete from private.panel_sessions
  where expires_at < now() - interval '1 day';

  return v_id;
end;
$$;

create or replace function public.get_panel_session(
  p_session_id uuid,
  p_secret_hash text
)
returns table (
  user_id uuid,
  email text,
  founder boolean,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_session_id is null then
    return;
  end if;

  if p_secret_hash is null or p_secret_hash !~ '^[a-f0-9]{64}$' then
    return;
  end if;

  return query
  update private.panel_sessions as ps
     set last_seen_at = now()
   where ps.id = p_session_id
     and ps.secret_hash = p_secret_hash
     and ps.revoked_at is null
     and ps.expires_at > now()
  returning ps.user_id, ps.email, ps.founder, ps.expires_at;
end;
$$;

create or replace function public.revoke_panel_session(
  p_session_id uuid,
  p_secret_hash text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_session_id is null then
    return;
  end if;

  if p_secret_hash is null or p_secret_hash !~ '^[a-f0-9]{64}$' then
    return;
  end if;

  update private.panel_sessions
     set revoked_at = coalesce(revoked_at, now())
   where id = p_session_id
     and secret_hash = p_secret_hash;
end;
$$;

revoke all on function public.create_panel_session(uuid, text, text, timestamptz, boolean, text, text) from public, anon, authenticated;
revoke all on function public.get_panel_session(uuid, text) from public, anon, authenticated;
revoke all on function public.revoke_panel_session(uuid, text) from public, anon, authenticated;

grant execute on function public.create_panel_session(uuid, text, text, timestamptz, boolean, text, text) to service_role;
grant execute on function public.get_panel_session(uuid, text) to service_role;
grant execute on function public.revoke_panel_session(uuid, text) to service_role;
