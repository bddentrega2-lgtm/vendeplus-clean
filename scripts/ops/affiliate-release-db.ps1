param(
    [Parameter(Mandatory)][ValidateSet('inspect','rehearse','apply','verify','stage-legacy','payment-inspect','payment-rehearse','payment-apply','allies-audit')][string]$Action,
    [Parameter(Mandatory)][hashtable]$Headers,
    [Parameter(Mandatory)][string]$Workspace,
    [switch]$PreserveLegacyRegistrations
)
$ErrorActionPreference = 'Stop'
$ref = if ($Action -eq 'stage-legacy') { 'xpqmmdmixpyqruykkbkf' } else { 'rvmtjtuztewcrmodrodb' }
function Query([string]$Sql) {
    $body = @{ query = $Sql } | ConvertTo-Json -Compress
    try {
        Invoke-RestMethod -Method Post -Uri "https://api.supabase.com/v1/projects/$ref/database/query" -Headers $Headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 90
    } catch {
        throw "Release SQL failed; reconcile state before retrying. $($_.ErrorDetails.Message)"
    }
}
if ($Action -eq 'allies-audit') {
    Query @'
begin transaction read only;
select jsonb_build_object(
  'codes', (select coalesce(jsonb_agg(jsonb_build_object(
    'code', c.code, 'name', c.name, 'category', c.partner_type, 'status', c.status,
    'discountPercent', c.discount_percent, 'setupCommissionPercent', c.setup_commission_percent,
    'feeCommissionPercent', c.commission_percent, 'months', c.duration_months,
    'dueUsd', round(20 * (100-c.discount_percent)/100,2),
    'setupEarningUsd', round(round(20*(100-c.discount_percent)/100,2)*c.setup_commission_percent/100,2),
    'startsAt', c.starts_at, 'expiresAt', c.expires_at, 'maxUses', c.max_uses, 'usedCount', c.used_count,
    'emailConfigured', nullif(trim(c.beneficiary_email),'') is not null,
    'emailNormalized', c.beneficiary_email = lower(trim(c.beneficiary_email)),
    'authAccountExists', exists(select 1 from auth.users u where lower(u.email)=c.beneficiary_email),
    'authEmailConfirmed', exists(select 1 from auth.users u where lower(u.email)=c.beneficiary_email and u.email_confirmed_at is not null),
    'agencyName', a.name, 'agencyActive', a.is_active,
    'agencyManagers', (select count(*) from public.transport_agency_users m where m.agency_id=c.transport_agency_id and m.role in ('owner','admin')),
    'sameBeneficiaryCodes', (select count(*) from public.affiliate_codes x where (c.beneficiary_email is not null and x.beneficiary_email=c.beneficiary_email) or (c.transport_agency_id is not null and x.transport_agency_id=c.transport_agency_id)),
    'storeSlugCollision', exists(select 1 from public.stores s where s.slug=lower(c.code)),
    'referrals', (select count(*) from public.affiliate_referrals r where r.affiliate_code_id=c.id)
  ) order by c.created_at),'[]'::jsonb) from public.affiliate_codes c left join public.transport_agencies a on a.id=c.transport_agency_id),
  'balances', (select coalesce(jsonb_agg(x - 'beneficiaryEmail' - 'transportAgencyId' - 'allyKey'),'[]'::jsonb) from jsonb_array_elements(public.affiliate_admin_list()) x),
  'commissions', (select count(*) from public.affiliate_commissions),
  'settlements', (select count(*) from public.affiliate_settlements)
) as audit;
commit;
'@ | ConvertTo-Json -Depth 14
    return
}
$files = @(
    '20261004120000_affiliate_registration.sql', '20261004121000_affiliate_commissions.sql',
    '20261004123000_affiliate_pending.sql', '20261004124000_affiliate_refund_adjustments.sql',
    '20261004125000_affiliate_local_window.sql', '20261004126000_registration_payment_proofs.sql',
    '20261004127000_affiliate_immutability.sql', '20261004128000_affiliate_fee_immutability.sql',
    '20261004129000_release_rejected_affiliate_code.sql', '20261004130000_legacy_registration_payments.sql',
    '20261011120000_affiliate_v2_terms.sql', '20261011121000_affiliate_v2_security.sql',
    '20261011122000_affiliate_monthly_snapshot.sql', '20261011123000_affiliate_earnings_payout.sql',
    '20261012120000_affiliate_admin_balances.sql', '20261012121000_affiliate_admin_list.sql',
    '20261012130000_affiliate_legacy_activation.sql'
)
if ($Action -eq 'stage-legacy') {
    $exists = @(Query "select exists(select 1 from pg_constraint where conname='commerce_registration_legacy_no_affiliate_check') as installed;")
    if ($exists[0].installed) { throw 'Legacy compatibility is already installed in staging.' }
    $sql = [IO.File]::ReadAllText((Join-Path $Workspace "supabase/migrations/$($files[-1])"))
    $null = Query ("begin; set local lock_timeout='3s';`n" + $sql + "`ncommit;")
    [PSCustomObject]@{ stage = $ref; migration = $files[-1]; applied = $true } | ConvertTo-Json -Compress
    return
}
$versions = ($files | ForEach-Object { "'" + $_.Split('_')[0] + "'" }) -join ','
$preflight = @(Query @"
select to_regclass('public.affiliate_codes') is not null as installed,
  (select count(*) from public.stores) as stores,
  (select count(*) from public.orders) as orders,
  (select count(*) from public.commerce_registration_requests where status in ('pending','activation_error')) as pending_registrations,
  (select count(*) from public.commerce_registration_requests where status='activating') as activating_registrations,
  (select count(*) from supabase_migrations.schema_migrations where version in ($versions)) as applied_count,
  (select coalesce(jsonb_agg(version), '[]'::jsonb) from supabase_migrations.schema_migrations where version in ($versions)) as applied_versions;
"@)
if ($Action -eq 'inspect') { $preflight | ConvertTo-Json -Depth 5; return }
if ($Action -in @('payment-inspect','payment-rehearse','payment-apply')) {
    $state = @(Query @'
select
  exists(select 1 from supabase_migrations.schema_migrations where version='20261012180000') as installed,
  exists(select 1 from pg_trigger where tgrelid='public.commerce_registration_requests'::regclass
    and tgname='recognize_affiliate_setup_on_approval'
    and pg_get_triggerdef(oid) like '%UPDATE OF status, setup_payment_status%') as payment_trigger,
  position('Confirma el pago inicial' in pg_get_functiondef('public.guard_registration_activation()'::regprocedure)) > 0 as approval_requires_payment,
  (select count(*) from public.commerce_registration_requests) as registrations,
  (select count(*) from public.commerce_registration_requests where setup_payment_status='legacy') as legacy_registrations,
  (select coalesce(sum(setup_paid_usd),0) from public.commerce_registration_requests where setup_payment_status='confirmed') as confirmed_income,
  (select count(*) from public.affiliate_commissions where kind='setup') as setup_commissions,
  exists(select 1 from pg_constraint where conrelid='public.commerce_registration_requests'::regclass and conname='commerce_registration_legacy_no_affiliate_check') as legacy_guard;
'@)
    $state | ConvertTo-Json -Depth 4
    if ($Action -eq 'payment-inspect') { return }
    if ($preflight.Count -ne 1 -or $preflight[0].applied_count -ne 17 -or $preflight[0].activating_registrations -gt 0 -or
        $state.Count -ne 1 -or $state[0].installed -or $state[0].payment_trigger -or -not $state[0].approval_requires_payment -or -not $state[0].legacy_guard) {
        throw 'Unexpected payment rollout state. No SQL sent; inspect before retrying.'
    }
    $migration = [IO.File]::ReadAllText((Join-Path $Workspace 'supabase/migrations/20261012180000_registration_independent_payment.sql'))
    $sql = @'
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
select pg_advisory_xact_lock(20261012,1800);
lock table public.commerce_registration_requests in share row exclusive mode;
create temporary table registration_before_payment_release on commit drop as
  select id, to_jsonb(r) as contents from public.commerce_registration_requests r;
'@
    $sql += "`n$migration`ninsert into supabase_migrations.schema_migrations(version,name,statements) values ('20261012180000','registration_independent_payment',array[`$migration`$$migration`$migration`$]);`n"
    $sql += @'
do $$ begin
  if exists(select 1 from registration_before_payment_release b full join public.commerce_registration_requests r using(id)
    where b.contents is distinct from to_jsonb(r)) then raise exception 'Registration data changed during rollout'; end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.commerce_registration_requests'::regclass
    and tgname='recognize_affiliate_setup_on_approval' and pg_get_triggerdef(oid) like '%UPDATE OF status, setup_payment_status%') then
    raise exception 'Payment trigger missing'; end if;
  if has_function_privilege('authenticated','public.affiliate_admin_list()','execute') then raise exception 'Unexpected client access'; end if;
end $$;
'@
    $sql += if ($Action -eq 'payment-rehearse') { "`nrollback;" } else { "`ncommit;" }
    $null = Query $sql
    [PSCustomObject]@{ project = $ref; migration = '20261012180000'; committed = ($Action -eq 'payment-apply'); registration_data_preserved = $true } | ConvertTo-Json -Compress
    return
}
if ($Action -eq 'verify') {
    Query @"
select
  (select count(*) from supabase_migrations.schema_migrations where version in ($versions)) as release_migrations,
  (select count(*) from public.affiliate_codes) as affiliate_codes,
  (select count(*) from public.affiliate_commissions) as commissions,
  (select jsonb_agg(jsonb_build_object('status',status,'payment',setup_payment_status,'count',n)) from (select status,setup_payment_status,count(*) n from public.commerce_registration_requests group by status,setup_payment_status) x) as registrations,
  has_function_privilege('authenticated','public.affiliate_admin_list()','execute') as client_can_read_allies,
  has_function_privilege('service_role','public.affiliate_admin_list()','execute') as server_can_read_allies,
  (select bool_and(relrowsecurity) from pg_class where relnamespace='public'::regnamespace and relname like 'affiliate_%' and relkind='r') as all_affiliate_rls,
  (select jsonb_agg(jsonb_build_object('id',id,'public',public,'file_size_limit',file_size_limit)) from storage.buckets where id in ('product-images','commerce-registration-assets','subscription-receipts')) as buckets;
"@ | ConvertTo-Json -Depth 8
    return
}
if ($preflight.Count -ne 1 -or $preflight[0].installed -or $preflight[0].applied_count -gt 0) { throw 'Unexpected existing referral schema/history. No migration sent.' }
if ($preflight[0].activating_registrations -gt 0) { throw 'A registration is being approved. Wait before rollout.' }
if (-not $PreserveLegacyRegistrations) { throw 'This rollout requires explicit preservation of pre-launch registrations.' }
$sql = "begin; set local lock_timeout='3s'; set local statement_timeout='60s';`nselect pg_advisory_xact_lock(20261012,1300);`nlock table public.commerce_registration_requests in share row exclusive mode;`n"
$sql += "create temporary table affiliate_release_prior_registrations on commit drop as select id,status from public.commerce_registration_requests;`n"
foreach ($file in $files) {
    $content = [IO.File]::ReadAllText((Join-Path $Workspace "supabase/migrations/$file"))
    $version, $name = $file -split '_', 2
    $name = $name.Replace('.sql','')
    $sql += "$content`ninsert into supabase_migrations.schema_migrations(version,name,statements) values ('$version','$name',array[`$migration`$$content`$migration`$]);`n"
}
$sql += @'
update public.commerce_registration_requests r
set setup_payment_status='legacy',updated_at=now()
from affiliate_release_prior_registrations old
where r.id=old.id and r.affiliate_code_id is null and r.setup_payment_status='pending';
do $$ begin
  if exists(select 1 from affiliate_release_prior_registrations old join public.commerce_registration_requests r using(id) where old.status is distinct from r.status or r.setup_payment_status <> 'legacy') then
    raise exception 'Existing registration compatibility failed';
  end if;
  if has_table_privilege('anon','public.affiliate_codes','select') or has_function_privilege('authenticated','public.affiliate_admin_list()','execute') then
    raise exception 'Referral privacy check failed';
  end if;
end $$;
'@
$sql += if ($Action -eq 'rehearse') { "`nrollback;" } else { "`ncommit;" }
$null = Query $sql
[PSCustomObject]@{ project = $ref; action = $Action; migrations = $files.Count; preserved_prior_registrations = $true; committed = ($Action -eq 'apply') } | ConvertTo-Json -Compress
