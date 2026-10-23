param(
    [ValidateSet('preflight','backup','rehearse','apply','verify')][string]$Action = 'preflight',
    [string]$ReleaseDirectory,
    [string]$ConfirmProduction
)

$ErrorActionPreference = 'Stop'
$workspace = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$root = Split-Path $workspace -Parent
$productionRef = 'rvmtjtuztewcrmodrodb'
$sourceWorkspace = Join-Path $root '.fee-billing-prod'
$artifacts = if ($ReleaseDirectory) { $ReleaseDirectory } else { Join-Path $workspace ('tmp/audit-production-release-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')) }
$bin = Join-Path $sourceWorkspace 'tmp/buyer-staging/pgsql/bin'
$utf8 = New-Object Text.UTF8Encoding($false)
[void][IO.Directory]::CreateDirectory($artifacts)

if ((Get-Content (Join-Path $sourceWorkspace 'supabase/.temp/project-ref') -Raw).Trim() -ne $productionRef) { throw 'Production workspace link mismatch.' }
if (-not (Test-Path (Join-Path $bin 'pg_dump.exe'))) { throw 'PostgreSQL backup tools are unavailable.' }

$source = Get-Content (Join-Path $sourceWorkspace 'scripts/ops/supabase-buyer-staging.ps1') -Raw
$start = $source.IndexOf("if (-not ('SomosSupabaseCredential'")
$end = $source.IndexOf('$pointer = [IntPtr]::Zero')
if ($start -lt 0 -or $end -le $start) { throw 'Credential helper changed; stop for review.' }
& ([scriptblock]::Create($source.Substring($start, $end - $start)))

function Run-PrivateProcess([string]$File, [string]$Arguments, [string]$Directory, [hashtable]$Environment = @{}) {
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName = $File; $info.Arguments = $Arguments; $info.WorkingDirectory = $Directory
    $info.UseShellExecute = $false; $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true; $info.RedirectStandardError = $true; $info.RedirectStandardInput = $true
    foreach ($key in $Environment.Keys) { $info.EnvironmentVariables[$key] = $Environment[$key] }
    $process = [Diagnostics.Process]::Start($info)
    $process.StandardInput.Close()
    $out = $process.StandardOutput.ReadToEndAsync(); $err = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit(600000)) { $process.Kill(); $process.WaitForExit(); throw 'Child process timed out.' }
    foreach ($key in $Environment.Keys) { $info.EnvironmentVariables.Remove($key) }
    if ($process.ExitCode -ne 0) {
        $safe = $err.Result
        foreach ($key in $Environment.Keys) { if ($Environment[$key]) { $safe = $safe.Replace([string]$Environment[$key], '[redacted]') } }
        if ($File -eq 'cmd.exe') { $safe = 'Supabase CLI failed; output suppressed.' }
        throw "Process failed ($($process.ExitCode)): $safe"
    }
    return $out.Result
}

function Read-Query([string]$Sql) {
    $body = @{ query = $Sql; read_only = $true } | ConvertTo-Json -Compress
    @(Invoke-RestMethod -Method Post -Uri "https://api.supabase.com/v1/projects/$productionRef/database/query" -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 90)
}

function Write-Query([string]$Sql) {
    if ($ConfirmProduction -ne $productionRef) { throw 'Explicit production confirmation is required.' }
    $body = @{ query = $Sql; read_only = $false } | ConvertTo-Json -Compress
    $null = Invoke-RestMethod -Method Post -Uri "https://api.supabase.com/v1/projects/$productionRef/database/query" -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 180
}

function Save-Json([string]$Path, $Value) { [IO.File]::WriteAllText($Path, ($Value | ConvertTo-Json -Depth 30), $utf8) }

function Get-MigrationSql {
    $migrations = @(
        @{ version = '20261020120000'; name = 'restrict_public_transport_agency_reads'; file = '20261020120000_restrict_public_transport_agency_reads.sql' },
        @{ version = '20261020121000'; name = 'create_order_with_receipt_atomic'; file = '20261020121000_create_order_with_receipt_atomic.sql' }
    )
    $chunks = @('set lock_timeout = ''3s'';', 'set statement_timeout = ''60s'';', 'begin;')
    foreach ($migration in $migrations) {
        $chunks += [IO.File]::ReadAllText((Join-Path $workspace ('supabase/migrations/' + $migration.file)))
        $safeName = $migration.name.Replace("'", "''")
        $chunks += "insert into supabase_migrations.schema_migrations(version,name,statements) values ('$($migration.version)','$safeName',array['Applied by guarded audit remediation release']) on conflict (version) do nothing;"
    }
    $chunks += @("notify pgrst, 'reload schema';", 'commit;')
    $chunks -join "`n"
}

function Assert-Preflight([bool]$AllowApplied = $false) {
    $result = Read-Query @'
select jsonb_build_object(
  'project', current_setting('app.settings.project_ref', true),
  'migrations', (select coalesce(jsonb_agg(version order by version), '[]'::jsonb) from supabase_migrations.schema_migrations where version in ('20261020120000','20261020121000')),
  'agency_columns', (select jsonb_agg(attname order by attnum) from pg_attribute where attrelid='public.transport_agencies'::regclass and attnum > 0 and not attisdropped),
  'policies', (select jsonb_agg(jsonb_build_object('table',tablename,'name',policyname,'definition',qual) order by tablename,policyname) from pg_policies where schemaname='public' and tablename in ('transport_agency_rates','transport_agency_zones','transport_agency_distance_rates')),
  'orders', (select count(*) from public.orders),
  'stores', (select count(*) from public.stores)
) as result;
'@
    if ($result.Count -ne 1 -or $null -eq $result[0].result) { throw 'Production preflight returned an unexpected result.' }
    $migrations = @($result[0].result.migrations)
    if (-not $AllowApplied -and $migrations.Count -ne 0) { throw 'One or more target migrations are already recorded; stop for review.' }
    if ($AllowApplied -and $migrations.Count -ne 2) { throw 'Expected both target migrations to be recorded.' }
    $required = @('id','name','slug','city','state','coverage_notes','logo_url','banner_image_url','marketplace_primary_color','marketplace_accent_color','status','is_active','rates_visibility')
    $available = @($result[0].result.agency_columns)
    if (@($required | Where-Object { $_ -notin $available }).Count) { throw 'Production transport agency schema does not match the reviewed migration.' }
    return $result[0].result
}

$pointer = [IntPtr]::Zero; $bytes = $null; $headers = $null; $connection = @{}
try {
    if (-not [SomosSupabaseCredential]::Read('Supabase CLI:supabase', 1, 0, [ref]$pointer)) { throw 'Credential unavailable.' }
    $credential = [Runtime.InteropServices.Marshal]::PtrToStructure($pointer, [type][SomosSupabaseCredential+Credential])
    $bytes = New-Object byte[] $credential.BlobSize
    [Runtime.InteropServices.Marshal]::Copy($credential.Blob, $bytes, 0, $bytes.Length)
    $token = [Text.Encoding]::UTF8.GetString($bytes)
    if ($token.Contains([char]0)) { $token = [Text.Encoding]::Unicode.GetString($bytes) }
    if ($token -notmatch '^sbp_[A-Za-z0-9]+$') { throw 'Invalid CLI credential.' }
    $headers = @{ Authorization = "Bearer $token" }

    $preflight = Assert-Preflight ($Action -eq 'verify')
    Save-Json (Join-Path $artifacts 'preflight.json') $preflight
    if ($Action -eq 'preflight') { Write-Output "Preflight passed: $artifacts"; return }

    $dry = Run-PrivateProcess 'cmd.exe' '/d /s /c npx.cmd supabase db dump --linked --schema public --dry-run' $sourceWorkspace
    foreach ($line in ($dry -split "`n")) {
        if ($line.Trim() -match '^export (PGHOST|PGPORT|PGUSER|PGPASSWORD|PGDATABASE)="([^"]*)"$') { $connection[$Matches[1]] = $Matches[2] }
    }
    if ($connection.Count -ne 5 -or $connection.PGUSER -notmatch $productionRef) { throw 'Production database connection mismatch.' }
    $connection.PGSSLMODE = 'require'; $connection.PGCONNECT_TIMEOUT = '20'

    if ($Action -eq 'backup') {
        $backup = Join-Path $artifacts 'production.dump'
        $connection.PGOPTIONS = '-c default_transaction_read_only=on -c statement_timeout=120000'
        $null = Run-PrivateProcess (Join-Path $bin 'pg_dump.exe') '--role=postgres --format=custom --no-owner --no-comments --no-security-labels --lock-wait-timeout=10s --file=production.dump' $artifacts $connection
        $toc = Run-PrivateProcess (Join-Path $bin 'pg_restore.exe') '--list production.dump' $artifacts
        [IO.File]::WriteAllText((Join-Path $artifacts 'production.toc'), $toc, $utf8)
        Save-Json (Join-Path $artifacts 'backup.json') @{ project_ref = $productionRef; created_at = [DateTime]::UtcNow.ToString('o'); sha256 = (Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash; readable = ($toc.Length -gt 0) }
        Write-Output "Backup complete: $artifacts"
        return
    }

    $sql = Get-MigrationSql
    [IO.File]::WriteAllText((Join-Path $artifacts 'apply.sql'), $sql, $utf8)
    if ($Action -eq 'rehearse') {
        if ($ConfirmProduction -ne $productionRef) { throw 'Explicit production confirmation is required for the transactional rehearsal.' }
        $rehearsal = $sql -replace '(?ms)\ncommit;\s*$', "`nrollback;"
        [IO.File]::WriteAllText((Join-Path $artifacts 'rehearse.sql'), $rehearsal, $utf8)
        Write-Query $rehearsal
        $post = Assert-Preflight
        Save-Json (Join-Path $artifacts 'rehearse-postcheck.json') $post
        Write-Output "Rehearsal rolled back successfully: $artifacts"
        return
    }

    if ($Action -eq 'apply') {
        if (-not (Test-Path (Join-Path $artifacts 'production.dump'))) { throw 'A verified backup must exist in the selected release directory.' }
        Write-Query $sql
        Write-Output "Migrations committed: $artifacts"
        return
    }

    if ($Action -eq 'verify') {
        $verification = Read-Query @'
select jsonb_build_object(
  'migrations', (select jsonb_agg(version order by version) from supabase_migrations.schema_migrations where version in ('20261020120000','20261020121000')),
  'receipt_rpc_service', has_function_privilege('service_role','public.create_order_with_receipt_atomic(jsonb,jsonb,uuid,uuid)','execute'),
  'receipt_rpc_anon', has_function_privilege('anon','public.create_order_with_receipt_atomic(jsonb,jsonb,uuid,uuid)','execute'),
  'private_agency_column_anon', has_column_privilege('anon','public.transport_agencies','admin_notes','select'),
  'public_agency_column_anon', has_column_privilege('anon','public.transport_agencies','name','select')
) as result;
'@
        Save-Json (Join-Path $artifacts 'verify.json') $verification
        $value = $verification[0].result
        if (@($value.migrations).Count -ne 2 -or -not $value.receipt_rpc_service -or $value.receipt_rpc_anon -or $value.private_agency_column_anon -or -not $value.public_agency_column_anon) { throw 'Verification failed; do not deploy application code.' }
        Write-Output "Verification passed: $artifacts"
    }
} finally {
    if ($pointer -ne [IntPtr]::Zero) { [SomosSupabaseCredential]::Free($pointer) }
    if ($bytes) { [Array]::Clear($bytes, 0, $bytes.Length) }
    if ($headers) { $headers.Clear() }; $connection.Clear()
    $token = $null
}
