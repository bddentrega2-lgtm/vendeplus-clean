-- Track Supabase authenticator assurance level for panel sessions.

alter table private.panel_sessions
  add column if not exists aal text not null default 'aal1';

alter table private.panel_sessions
  drop constraint if exists panel_sessions_aal_check;

alter table private.panel_sessions
  add constraint panel_sessions_aal_check
    check (aal in ('aal1', 'aal2'));

comment on column private.panel_sessions.aal is
  'Supabase authenticator assurance level captured from the access token. Admin founder access requires aal2.';
