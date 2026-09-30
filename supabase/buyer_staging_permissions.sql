-- Read-only export of effective application-role grants, without table data.
with roles(name) as (values ('anon'), ('authenticated'), ('service_role')),
objects as (
  select 'FUNCTION'::text as kind, p.oid, p.oid::regprocedure::text as identifier
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','private') and p.prokind='f'
  union all
  select case when c.relkind='S' then 'SEQUENCE' else 'TABLE' end, c.oid,
    format('%I.%I', n.nspname, c.relname)
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('public','private') and c.relkind in ('r','p','v','m','S')
), grants as (
  select o.kind, o.identifier, format('REVOKE ALL ON %s %s FROM PUBLIC, anon, authenticated, service_role;', o.kind,o.identifier) as command, 0 as ordering
  from objects o
  union all
  select o.kind, o.identifier, format('GRANT %s ON %s %s TO %I;', privilege,o.kind,o.identifier,r.name), 1
  from objects o cross join roles r
  cross join lateral unnest(case o.kind
    when 'FUNCTION' then array['EXECUTE']
    when 'SEQUENCE' then array['SELECT','UPDATE','USAGE']
    else array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] end) as privilege
  where case o.kind
    when 'FUNCTION' then has_function_privilege(r.name,o.oid,privilege)
    when 'SEQUENCE' then has_sequence_privilege(r.name,o.oid,privilege)
    else has_table_privilege(r.name,o.oid,privilege) end
)
select string_agg(command,E'\n' order by kind,identifier,ordering,command) as permissions_sql from grants;
