param([switch]$CreateFreeProject, [switch]$ReadAuthStatus, [switch]$InitializeSchema, [switch]$HardenPermissions, [switch]$Verify, [switch]$SeedCatalog, [switch]$TestBuyerFlow,
    [ValidateSet('inspect','build','deploy','status','share','start')][string]$PreviewAction,
    [switch]$ConfigurePreviewRedirects, [switch]$ReadAuthDiagnostics, [switch]$ApplyReviewObservation, [switch]$ApplyAccountDeletionRequests,
    [ValidateSet('inspect','complete')][string]$DemoOrderAction)

$ErrorActionPreference = 'Stop'

# Use the existing CLI credential only against Supabase. Never print or persist it.
if (-not ('SomosSupabaseCredential' -as [type])) {
    Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class SomosSupabaseCredential {
    [StructLayout(LayoutKind.Sequential)]
    public struct Credential {
        public uint Flags, Type;
        public IntPtr TargetName, Comment;
        public long LastWritten;
        public uint BlobSize;
        public IntPtr Blob;
        public uint Persist, AttributeCount;
        public IntPtr Attributes, TargetAlias, UserName;
    }
    [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
    public static extern bool Read(string target, uint type, uint flags, out IntPtr credential);
    [DllImport("advapi32.dll", EntryPoint="CredFree")]
    public static extern void Free(IntPtr credential);
}
'@
}

$pointer = [IntPtr]::Zero
$bytes = $null
$token = $null
$headers = $null
try {
    if (-not [SomosSupabaseCredential]::Read('Supabase CLI:supabase', 1, 0, [ref]$pointer)) {
        throw 'The existing Supabase CLI credential is unavailable.'
    }
    $credential = [Runtime.InteropServices.Marshal]::PtrToStructure($pointer, [type][SomosSupabaseCredential+Credential])
    $bytes = New-Object byte[] $credential.BlobSize
    [Runtime.InteropServices.Marshal]::Copy($credential.Blob, $bytes, 0, $bytes.Length)
    $token = [Text.Encoding]::UTF8.GetString($bytes)
    if ($token.Contains([char]0)) { $token = [Text.Encoding]::Unicode.GetString($bytes) }
    if ($token -notmatch '^sbp_[A-Za-z0-9]+$') { throw 'Unsupported CLI credential format; no request sent.' }
    $headers = @{ Authorization = "Bearer $token" }
    $workspace = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    foreach ($slug in @('tqkuaohznmpndqxdepdu', 'vercel_icfg_B9hGS5Xag5lYa2DTCwT7IvDi')) {
        try {
            $org = Invoke-RestMethod -Method Get -Uri "https://api.supabase.com/v1/organizations/$slug" -Headers $headers -TimeoutSec 30
            [PSCustomObject]@{ organization = $slug; plan = $org.plan }
        } catch {
            throw "Could not read the plan for organization $slug. No resources created."
        }
    }
    if ($ReadAuthStatus) {
        foreach ($ref in @('rvmtjtuztewcrmodrodb', 'xpqmmdmixpyqruykkbkf')) {
            $auth = Invoke-RestMethod -Method Get -Uri "https://api.supabase.com/v1/projects/$ref/config/auth" -Headers $headers -TimeoutSec 30
            [PSCustomObject]@{
                project_ref = $ref
                google_enabled = $auth.external_google_enabled
                google_client_configured = [bool]$auth.external_google_client_id
                google_secret_configured = [bool]$auth.external_google_secret
                site_url = $auth.site_url
                redirect_allowlist = $auth.uri_allow_list
            } | ConvertTo-Json -Compress
            $auth = $null
        }
    }
    if ($InitializeSchema -or $HardenPermissions -or $Verify -or $SeedCatalog -or $TestBuyerFlow -or $PreviewAction -or $ConfigurePreviewRedirects -or $ReadAuthDiagnostics -or $DemoOrderAction -or $ApplyReviewObservation -or $ApplyAccountDeletionRequests) {
        $stageRef = 'xpqmmdmixpyqruykkbkf'
        $manifest = Get-Content (Join-Path $workspace 'tmp/buyer-staging/provisioning.dpapi.json') -Raw | ConvertFrom-Json
        if ($manifest.project_ref -ne $stageRef -or $manifest.state -ne 'created') { throw 'Staging project identity not confirmed.' }
        $project = Invoke-RestMethod -Method Get -Uri "https://api.supabase.com/v1/projects/$stageRef" -Headers $headers -TimeoutSec 30
        if ($project.name -ne 'somos-buyer-staging' -or $project.organization_id -ne $manifest.organization -or $project.status -ne 'ACTIVE_HEALTHY') { throw 'Unexpected staging project state.' }
        if ($ReadAuthDiagnostics) {
            $sql = "select timestamp, event_message, log_attributes['error'] as error, log_attributes['error_code'] as error_code, log_attributes['path'] as path, log_attributes['status'] as status from logs where source = 'auth_logs' order by timestamp desc limit 40"
            $startTime = [DateTime]::UtcNow.AddHours(-2).ToString('o')
            $endTime = [DateTime]::UtcNow.ToString('o')
            $uri = "https://api.supabase.com/v1/projects/$stageRef/analytics/endpoints/logs?sql=$([Uri]::EscapeDataString($sql))&iso_timestamp_start=$([Uri]::EscapeDataString($startTime))&iso_timestamp_end=$([Uri]::EscapeDataString($endTime))"
            $logs = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers -TimeoutSec 60
            # Output only recognized diagnoses, never raw URLs, identities or tokens.
            $patterns = @('invalid_client','invalid_grant','redirect_uri_mismatch','access_denied','Unable to exchange external code','Database error saving new user','flow_state_not_found','flow_state_expired','bad_code_verifier','invalid request','request completed','Login','signup','email_not_confirmed','provider_email_needs_verification')
            $rows = @($logs.result | ForEach-Object {
                $message = "$($_.event_message) $($_.error) $($_.error_code)"
                $matchesFound = @($patterns | Where-Object { $message -match [regex]::Escape($_) })
                [PSCustomObject]@{ timestamp = $_.timestamp; diagnoses = $matchesFound; has_error = [bool]$_.error; status = if ([string]$_.status -match '^\d{3}$') { $_.status } else { '' }; path = if ($_.path -in @('/authorize','/callback','/token','/user','/logout')) { $_.path } else { '' } }
            })
            [PSCustomObject]@{ project = $stageRef; response_fields = @($logs.PSObject.Properties.Name); rows = $rows } | ConvertTo-Json -Depth 6
            $logs = $null
        }
        if ($ConfigurePreviewRedirects) {
            $deployment = Get-Content (Join-Path $workspace 'tmp/buyer-staging/preview-deployment.json') -Raw | ConvertFrom-Json
            if ($deployment.projectId -ne 'prj_LPHnsOxowUvGBXYalbdNO3R01PrI' -or $deployment.url -notmatch '^https://vendeplus-clean-[a-z0-9]{9}-entrega2-s-projects\.vercel\.app$') { throw 'Unexpected preview identity.' }
            $payload = @{ site_url = $deployment.url; uri_allow_list = "$($deployment.url)/auth/buyer-callback,com.somosve.app://buyer-auth,com.somosve.app.staging://buyer-auth" } | ConvertTo-Json -Compress
            $updated = Invoke-RestMethod -Method Patch -Uri "https://api.supabase.com/v1/projects/$stageRef/config/auth" -Headers $headers -ContentType 'application/json' -Body $payload -TimeoutSec 30
            if ($updated.site_url -ne $deployment.url -or -not $updated.external_google_enabled) { throw 'Staging auth update needs verification.' }
            [PSCustomObject]@{ stage = $stageRef; site_url = $updated.site_url; redirect_allowlist = $updated.uri_allow_list; google_enabled = $updated.external_google_enabled } | ConvertTo-Json -Compress
            $updated = $null
        }
        if ($PreviewAction) {
            $keys = Invoke-RestMethod -Method Get -Uri "https://api.supabase.com/v1/projects/$stageRef/api-keys?reveal=true" -Headers $headers -TimeoutSec 30
            $anon = @($keys | Where-Object { $_.name -eq 'anon' })
            $service = @($keys | Where-Object { $_.name -eq 'service_role' })
            if ($anon.Count -ne 1 -or $service.Count -ne 1) { throw 'Expected staging keys were not found.' }
            $child = New-Object Diagnostics.ProcessStartInfo
            $child.FileName = (Get-Command node.exe).Source
            $child.Arguments = "scripts/ops/buyer-staging-preview.mjs $PreviewAction"
            $child.WorkingDirectory = $workspace
            $child.UseShellExecute = $false
            $child.CreateNoWindow = $true
            $child.RedirectStandardInput = $true
            $process = [Diagnostics.Process]::Start($child)
            try {
                $process.StandardInput.Write((@{ ref = $stageRef; anon = $anon[0].api_key; service = $service[0].api_key } | ConvertTo-Json -Compress))
                $process.StandardInput.Close()
                $process.WaitForExit()
                if ($process.ExitCode -ne 0) { throw "Staging preview action failed ($($process.ExitCode))." }
            } finally { $keys = $null; $anon = $null; $service = $null; $process.Dispose() }
        }
        function Invoke-StagingQuery([string]$Sql) {
            try {
                Invoke-RestMethod -Method Post -Uri "https://api.supabase.com/v1/projects/$stageRef/database/query" -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes((@{ query = $Sql } | ConvertTo-Json -Compress))) -TimeoutSec 90
            } catch {
                $details = $_.ErrorDetails.Message
                if ($details.Length -gt 800) { $details = $details.Substring(0, 800) }
                throw "Staging SQL failed. Production was not targeted. $details"
            }
        }
        if ($ApplyReviewObservation) {
            $null = Invoke-StagingQuery ([IO.File]::ReadAllText((Join-Path $workspace 'supabase/migrations/20260930030000_buyer_review_observation.sql')))
            Invoke-StagingQuery "select column_name, data_type from information_schema.columns where table_schema='public' and table_name='buyer_store_reviews' and column_name='observation'; select has_function_privilege('anon', 'public.save_buyer_store_review_with_observation(uuid,uuid,integer,text)', 'EXECUTE') as anon_execute, has_function_privilege('authenticated', 'public.save_buyer_store_review_with_observation(uuid,uuid,integer,text)', 'EXECUTE') as authenticated_execute, has_function_privilege('service_role', 'public.save_buyer_store_review_with_observation(uuid,uuid,integer,text)', 'EXECUTE') as service_execute;" | ConvertTo-Json -Depth 6
        }
        if ($ApplyAccountDeletionRequests) {
            $null = Invoke-StagingQuery ([IO.File]::ReadAllText((Join-Path $workspace 'supabase/migrations/20261001153000_account_deletion_requests.sql')))
            Invoke-StagingQuery "select c.relrowsecurity as rls_enabled, has_table_privilege('anon','public.account_deletion_requests','SELECT') as anon_select, has_table_privilege('authenticated','public.account_deletion_requests','SELECT') as authenticated_select, has_table_privilege('service_role','public.account_deletion_requests','SELECT') as service_select, (select count(*)::int from public.account_deletion_requests) as rows from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='account_deletion_requests';" | ConvertTo-Json -Depth 6
        }
        if ($DemoOrderAction) {
            if ($DemoOrderAction -eq 'complete') {
                $null = Invoke-StagingQuery ([IO.File]::ReadAllText((Join-Path $workspace 'supabase/buyer_staging_complete_demo_order.sql')))
            }
            $query = @'
select o.public_code, o.status, o.total_usd, o.delivery_type, o.payment_status,
  exists(select 1 from public.buyer_order_accounts b where b.order_id=o.id and b.store_id=o.store_id) as has_buyer_owner,
  (select count(*) from public.order_items i where i.order_id=o.id) as item_count,
  (select jsonb_agg(jsonb_build_object('name',i.product_name,'quantity',i.quantity,'total',i.total_usd)) from public.order_items i where i.order_id=o.id) as items,
  (select r.rating from public.buyer_store_reviews r where r.order_id=o.id and r.store_id=o.store_id) as rating
from public.orders o join public.stores s on s.id=o.store_id
where o.public_code='SO-0929-465966' and s.id='51000000-0000-4000-8000-000000000001' and s.slug='cocina-demo'
'@
            Invoke-StagingQuery $query | ConvertTo-Json -Depth 6
        }
        if ($Verify) {
            Invoke-StagingQuery ([IO.File]::ReadAllText((Join-Path $workspace 'supabase/buyer_accounts_readiness.sql'))) | ConvertTo-Json -Depth 10
        }
        if ($SeedCatalog) {
            Invoke-StagingQuery ([IO.File]::ReadAllText((Join-Path $workspace 'supabase/buyer_staging_seed.sql'))) | ConvertTo-Json -Depth 10
        }
        if ($TestBuyerFlow) {
            Invoke-StagingQuery ([IO.File]::ReadAllText((Join-Path $workspace 'supabase/buyer_staging_transaction_test.sql'))) | ConvertTo-Json -Depth 10
        }
        if ($HardenPermissions) {
            $permissionQuery = [IO.File]::ReadAllText((Join-Path $workspace 'supabase/buyer_staging_permissions.sql'))
            $source = Invoke-RestMethod -Method Post -Uri 'https://api.supabase.com/v1/projects/rvmtjtuztewcrmodrodb/database/query' -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes((@{ query = $permissionQuery; read_only = $true } | ConvertTo-Json -Compress))) -TimeoutSec 60
            if (-not $source.permissions_sql) { throw 'No source permissions returned.' }
            $null = Invoke-StagingQuery ("begin;`n" + $source.permissions_sql + "`ncommit;")
            Invoke-StagingQuery ([IO.File]::ReadAllText((Join-Path $workspace 'supabase/buyer_accounts_readiness.sql'))) | ConvertTo-Json -Depth 10
        }
        if ($InitializeSchema) {
        $empty = Invoke-StagingQuery "select count(*)::int as tables from information_schema.tables where table_schema in ('public','private') and table_type='BASE TABLE'"
        if ($empty.tables -ne 0) { throw 'Staging is not empty. Automatic schema initialization refused.' }
        $lines = [IO.File]::ReadAllLines((Join-Path $workspace 'tmp/buyer-staging/app-schema.sql'))
        $schema = ($lines | Where-Object { $_ -notmatch '^\\(un)?restrict [A-Za-z0-9]+$' }) -join "`n"
        if ($schema -match '(?im)^COPY |^INSERT |https?://|dblink|vault\.') { throw 'Schema needs additional inspection before initialization.' }
        $null = Invoke-StagingQuery ("begin; create extension if not exists pg_trgm with schema extensions;`n" + $schema + "`ncommit;")
        $migration = [IO.File]::ReadAllText((Join-Path $workspace 'supabase/migrations/20260929193000_buyer_accounts_and_reviews.sql'))
        $null = Invoke-StagingQuery $migration
        $readiness = Invoke-StagingQuery ([IO.File]::ReadAllText((Join-Path $workspace 'supabase/buyer_accounts_readiness.sql')))
        $readiness | ConvertTo-Json -Depth 10
        }
    }
    if ($CreateFreeProject) {
        $targetOrg = 'vercel_icfg_B9hGS5Xag5lYa2DTCwT7IvDi'
        $projectName = 'somos-buyer-staging'
        $org = Invoke-RestMethod -Method Get -Uri "https://api.supabase.com/v1/organizations/$targetOrg" -Headers $headers -TimeoutSec 30
        if ($org.plan -ne 'free') { throw 'Creation blocked: target organization is not Free.' }
        $projects = @(Invoke-RestMethod -Method Get -Uri 'https://api.supabase.com/v1/projects' -Headers $headers -TimeoutSec 30)
        if (@($projects | Where-Object { $_.name -eq $projectName }).Count) {
            throw 'A project with this name exists. Reconcile it before any new creation.'
        }
        $workspace = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
        $privateDir = Join-Path $workspace 'tmp/buyer-staging'
        $manifestPath = Join-Path $privateDir 'provisioning.dpapi.json'
        if (Test-Path -LiteralPath $manifestPath) { throw 'A provisioning attempt already exists. Reconcile before retrying.' }
        [void][IO.Directory]::CreateDirectory($privateDir)
        $random = New-Object byte[] 32
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($random) } finally { $rng.Dispose() }
        $password = [Convert]::ToBase64String($random)
        [Array]::Clear($random, 0, $random.Length)
        $manifest = [ordered]@{
            organization = $targetOrg
            project_name = $projectName
            requested_at = [DateTime]::UtcNow.ToString('o')
            password_dpapi = (ConvertFrom-SecureString (ConvertTo-SecureString $password -AsPlainText -Force))
            project_ref = $null
            state = 'planned'
        }
        [IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
        $payload = @{ name = $projectName; organization_slug = $targetOrg; db_pass = $password; region = 'us-east-1'; desired_instance_size = 'nano' } | ConvertTo-Json
        try {
            $created = Invoke-RestMethod -Method Post -Uri 'https://api.supabase.com/v1/projects' -Headers $headers -ContentType 'application/json' -Body $payload -TimeoutSec 90
            $manifest.project_ref = $created.id
            $manifest.state = 'created'
            [IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
            [PSCustomObject]@{ project = $created.name; project_ref = $created.id; status = $created.status; plan = 'free' } | ConvertTo-Json -Compress
        } catch {
            $manifest.state = 'request_failed_reconcile_before_retry'
            [IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
            $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'unknown' }
            throw "Project creation did not complete (HTTP $status). No upgrade or retry performed."
        } finally { $password = $null; $payload = $null }
    }
} finally {
    if ($pointer -ne [IntPtr]::Zero) { [SomosSupabaseCredential]::Free($pointer) }
    if ($bytes) { [Array]::Clear($bytes, 0, $bytes.Length) }
    if ($headers) { $headers.Clear() }
    $token = $null
}
