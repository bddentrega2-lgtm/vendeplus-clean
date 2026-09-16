-- Backwards-compatible RPCs for panel sessions with MFA AAL.
-- The original RPCs remain available for the current production rollback.

create or replace function public.create_panel_session_v2(
  p_user_id uuid,
  p_email text,
  p_secret_hash text,
  p_expires_at timestamptz,
  p_founder boolean default false,
  p_aal text default 'aal1',
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
  v_aal text := case when p_aal = 'aal2' then 'aal2' else 'aal1' end;
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
    aal,
    expires_at,
    user_agent,
    ip
  )
  values (
    p_user_id,
    v_email,
    p_secret_hash,
    coalesce(p_founder, false),
    v_aal,
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

create or replace function public.get_panel_session_v2(
  p_session_id uuid,
  p_secret_hash text
)
returns table (
  user_id uuid,
  email text,
  founder boolean,
  aal text,
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
  returning ps.user_id, ps.email, ps.founder, ps.aal, ps.expires_at;
end;
$$;

revoke all on function public.create_panel_session_v2(uuid, text, text, timestamptz, boolean, text, text, text)
  from public, anon, authenticated;
revoke all on function public.get_panel_session_v2(uuid, text)
  from public, anon, authenticated;

grant execute on function public.create_panel_session_v2(uuid, text, text, timestamptz, boolean, text, text, text)
  to service_role;
grant execute on function public.get_panel_session_v2(uuid, text)
  to service_role;
