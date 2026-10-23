param(
    [ValidateSet('backup','export','rehearse-backup','rehearse-schema','rebuild','configure','qa','verify','preview','access','fixtures','http-qa','matrix')][string]$Action = 'backup',
    [string]$BackupDirectory,
    [string]$ConfirmBranch,
    [ValidateSet('inspect','build','deploy','status','share')][string]$PreviewAction = 'inspect'
)
$ErrorActionPreference = 'Stop'
$workspace = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$root = Split-Path $workspace -Parent
$target = 'nmuypksuaxwyonilzoqs'
$parentRef = 'rvmtjtuztewcrmodrodb'
$branchId = '527921ed-2cd9-4398-b9bd-c9435364f1c7'
$artifacts = Join-Path $workspace 'tmp/audit-staging-recovery'
$bin = Join-Path $root '.fee-billing-prod/tmp/buyer-staging/pgsql/bin'
$utf8 = New-Object Text.UTF8Encoding($false)
[void][IO.Directory]::CreateDirectory($artifacts)

# Reuse the existing credential interop, without running any provisioning action.
$source = Get-Content (Join-Path $PSScriptRoot 'supabase-buyer-staging.ps1') -Raw
$start = $source.IndexOf("if (-not ('SomosSupabaseCredential'")
$end = $source.IndexOf('$pointer = [IntPtr]::Zero')
if ($start -lt 0 -or $end -le $start) { throw 'Credential helper changed; stop for review.' }
& ([scriptblock]::Create($source.Substring($start, $end - $start)))

function Run-PrivateProcess([string]$File, [string]$Arguments, [string]$Directory, [hashtable]$Environment = @{}) {
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName = $File
    $info.Arguments = $Arguments
    $info.WorkingDirectory = $Directory
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.RedirectStandardInput = $true
    foreach ($key in $Environment.Keys) { $info.EnvironmentVariables[$key] = $Environment[$key] }
    $process = [Diagnostics.Process]::Start($info)
    $process.StandardInput.Close()
    $out = $process.StandardOutput.ReadToEndAsync()
    $err = $process.StandardError.ReadToEndAsync()
    $timeout = if ([IO.Path]::GetFileName($File) -eq 'psql.exe') { 600000 } else { 180000 }
    if (-not $process.WaitForExit($timeout)) {
        $process.Kill()
        $process.WaitForExit()
        throw 'Child process timed out; no subsequent action performed.'
    }
    foreach ($key in $Environment.Keys) { $info.EnvironmentVariables.Remove($key) }
    if ($process.ExitCode -ne 0) {
        $safe = $err.Result
        foreach ($key in $Environment.Keys) {
            if ($Environment[$key]) { $safe = $safe.Replace([string]$Environment[$key], '[redacted]') }
        }
        if ($File -eq 'cmd.exe') { $safe = 'CLI failed; raw output suppressed.' }
        throw "Process failed ($($process.ExitCode)): $safe"
    }
    return $out.Result
}

function Read-Query([string]$Ref, [string]$Query) {
    if ($Ref -notin @($target, $parentRef)) { throw 'Unexpected read target.' }
    $body = @{ query = $Query; read_only = $true } | ConvertTo-Json -Compress
    $result = Invoke-RestMethod -Method Post -Uri "https://api.supabase.com/v1/projects/$Ref/database/query" -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 90
    foreach ($row in $result) { Write-Output $row }
}

function Save-Json([string]$Path, $Value) {
    [IO.File]::WriteAllText($Path, ($Value | ConvertTo-Json -Depth 30), $utf8)
}

function Write-BranchQuery([string]$Sql) {
    if ($ConfirmBranch -ne 'nmuypksuaxwyonilzoqs' -or $target -ne $ConfirmBranch) { throw 'Write target is not the approved branch.' }
    $body = @{ query = $Sql; read_only = $false } | ConvertTo-Json -Compress
    $null = Invoke-RestMethod -Method Post -Uri "https://api.supabase.com/v1/projects/$target/database/query" -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 180
}

$pointer = [IntPtr]::Zero
$bytes = $null
$headers = $null
$connection = @{}
try {
    if (-not [SomosSupabaseCredential]::Read('Supabase CLI:supabase', 1, 0, [ref]$pointer)) { throw 'Credential unavailable.' }
    $credential = [Runtime.InteropServices.Marshal]::PtrToStructure($pointer, [type][SomosSupabaseCredential+Credential])
    $bytes = New-Object byte[] $credential.BlobSize
    [Runtime.InteropServices.Marshal]::Copy($credential.Blob, $bytes, 0, $bytes.Length)
    $token = [Text.Encoding]::UTF8.GetString($bytes)
    if ($token.Contains([char]0)) { $token = [Text.Encoding]::Unicode.GetString($bytes) }
    if ($token -notmatch '^sbp_[A-Za-z0-9]+$') { throw 'Invalid credential format.' }
    $headers = @{ Authorization = "Bearer $token" }
    $branches = @(Run-PrivateProcess 'cmd.exe' "/d /s /c npx.cmd supabase branches list --project-ref $parentRef --output json" $workspace | ConvertFrom-Json)
    $branches = @($branches | ForEach-Object { $_ })
    $branch = @($branches | Where-Object { $_.id -eq $branchId -and $_.project_ref -eq $target -and -not $_.is_default })
    if ($branch.Count -ne 1 -or $branch[0].parent_project_ref -ne $parentRef) { throw 'Branch identity mismatch.' }

    if ($Action -ne 'export') {
        $keys = Run-PrivateProcess 'cmd.exe' "/d /s /c npx.cmd supabase branches get $branchId --project-ref $parentRef --output json" $workspace | ConvertFrom-Json
        if ([Uri]$keys.SUPABASE_URL -ne [Uri]"https://$target.supabase.co") { throw 'Unexpected branch URL.' }
        $uri = [Uri]$keys.POSTGRES_URL
        $parts = $uri.UserInfo.Split(':', 2)
        $connection = @{ PGHOST = $uri.Host; PGPORT = [string]$uri.Port; PGUSER = [Uri]::UnescapeDataString($parts[0]); PGPASSWORD = [Uri]::UnescapeDataString($parts[1]); PGDATABASE = 'postgres'; PGSSLMODE = 'require'; PGCONNECT_TIMEOUT = '20'; PGOPTIONS = '-c default_transaction_read_only=on -c statement_timeout=120000' }
        if ($connection.PGHOST -notmatch [regex]::Escape($target) -and $connection.PGUSER -notmatch [regex]::Escape($target)) { throw 'Backup connection is not the branch.' }
    }

    if ($Action -in @('configure','qa','verify','preview','access','fixtures','http-qa','matrix')) {
        if ($ConfirmBranch -ne $target) { throw 'Explicit branch reference required.' }
        $identity = @(Read-Query $target "select exists(select 1 from supabase_migrations.schema_migrations where version='20261021090000' and name='isolated_schema_snapshot_from_production') as recovered")
        if (-not $identity[0].recovered) { throw 'Recovered branch baseline not found.' }
        if ($Action -eq 'fixtures') {
            $policies = @(Read-Query $parentRef "select schemaname,tablename,policyname,permissive,cmd,qual,with_check,to_jsonb(roles) as roles from pg_policies where schemaname in ('storage','realtime') order by schemaname,tablename,policyname")
            $sql = "begin;`n"
            foreach ($policy in $policies) {
                if ($policy.schemaname -notin @('storage','realtime') -or $policy.tablename -notin @('objects','buckets','messages')) { throw 'Unexpected external policy target.' }
                $name = '"' + $policy.policyname.Replace('"','""') + '"'
                $roles = ($policy.roles | ForEach-Object { if ($_ -eq 'public') { 'PUBLIC' } else { '"' + $_.Replace('"','""') + '"' } }) -join ','
                $sql += "drop policy if exists $name on $($policy.schemaname).$($policy.tablename);`ncreate policy $name on $($policy.schemaname).$($policy.tablename) as $($policy.permissive) for $($policy.cmd) to $roles"
                if ($policy.qual) { $sql += " using ($($policy.qual))" }
                if ($policy.with_check) { $sql += " with check ($($policy.with_check))" }
                $sql += ";`n"
            }
            $publications = @(Read-Query $parentRef "select schemaname,tablename from pg_publication_tables where pubname='supabase_realtime' order by schemaname,tablename")
            if ($publications.Count) {
                if (@($publications | Where-Object { $_.schemaname -ne 'public' -or $_.tablename -notmatch '^[a-z_]+$' }).Count) { throw 'Unexpected realtime publication.' }
                $tables = ($publications | ForEach-Object { "public.$($_.tablename)" }) -join ','
                $sql += "alter publication supabase_realtime set table $tables;`n"
            }
            $sql += "commit;`n"
            Write-BranchQuery $sql
            Save-Json (Join-Path $artifacts 'source-external-policies.json') $policies
            $buckets = @(Read-Query $parentRef 'select id,name,public,file_size_limit,allowed_mime_types from storage.buckets order by id')
            $storageHeaders = @{ apikey = $keys.SUPABASE_SERVICE_ROLE_KEY; Authorization = "Bearer $($keys.SUPABASE_SERVICE_ROLE_KEY)" }
            $existing = Invoke-RestMethod "https://$target.supabase.co/storage/v1/bucket" -Headers $storageHeaders
            foreach ($bucket in $buckets) {
                if ($existing.id -contains $bucket.id) { continue }
                $body = @{ id = $bucket.id; name = $bucket.name; public = $bucket.public }
                if ($null -ne $bucket.file_size_limit) { $body.file_size_limit = $bucket.file_size_limit }
                if ($null -ne $bucket.allowed_mime_types) { $body.allowed_mime_types = $bucket.allowed_mime_types }
                $null = Invoke-RestMethod -Method Post "https://$target.supabase.co/storage/v1/bucket" -Headers $storageHeaders -ContentType 'application/json' -Body ($body | ConvertTo-Json -Compress)
            }
            Write-BranchQuery ([IO.File]::ReadAllText((Join-Path $workspace 'supabase/audit_staging_fixtures.sql')))
            Write-BranchQuery ([IO.File]::ReadAllText((Join-Path $workspace 'supabase/kitchen_preview_seed.sql')))
            Write-Output 'Demo delivery/table/kitchen/inventory fixtures and branch-only Storage/Realtime configuration ready. No production rows copied.'
            return
        }
        if ($Action -in @('preview','access','http-qa','matrix')) {
            $child = New-Object Diagnostics.ProcessStartInfo
            $child.FileName = 'node.exe'
            $child.Arguments = if ($Action -eq 'preview') { "scripts/ops/buyer-staging-preview.mjs $PreviewAction" } elseif ($Action -eq 'http-qa') { 'scripts/ops/audit-staging-access.mjs qa' } elseif ($Action -eq 'matrix') { 'scripts/audit-staging-matrix.mjs' } else { 'scripts/ops/audit-staging-access.mjs' }
            $child.WorkingDirectory = $workspace
            $child.UseShellExecute = $false
            $child.CreateNoWindow = $true
            $child.RedirectStandardInput = $true
            $process = [Diagnostics.Process]::Start($child)
            $process.StandardInput.Write((@{ ref = $target; anon = $keys.SUPABASE_ANON_KEY; service = $keys.SUPABASE_SERVICE_ROLE_KEY } | ConvertTo-Json -Compress))
            $process.StandardInput.Close()
            $process.WaitForExit()
            if ($process.ExitCode -ne 0) { throw 'Audit preview action failed; production was not targeted.' }
            return
        }
        if ($Action -eq 'verify') {
            Read-Query $target @'
select jsonb_build_object(
 'tables',(select count(*) from pg_tables where schemaname='public'),
 'stores',(select jsonb_agg(slug order by slug) from public.stores),
 'orders',(select count(*) from public.orders),
 'users',(select count(*) from auth.users),
 'integrations',(select count(*) from public.order_integrations),
 'push_devices',(select count(*) from public.panel_push_devices),
 'receipt_rpc_service',has_function_privilege('service_role','public.create_order_with_receipt_atomic(jsonb,jsonb,uuid,uuid)','execute'),
 'receipt_rpc_anon',has_function_privilege('anon','public.create_order_with_receipt_atomic(jsonb,jsonb,uuid,uuid)','execute'),
 'agency_private_anon',has_column_privilege('anon','public.transport_agencies','admin_notes','select'),
 'migrations',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations)
) as verification;
'@ | ConvertTo-Json -Depth 8
            return
        }
        $connection.PGOPTIONS = '-c statement_timeout=120000'
        if ($Action -eq 'configure') {
            $preflight = @(Read-Query $target "select (select count(*) from public.stores) as stores,(select count(*) from auth.users) as users")
            if ($preflight[0].stores -ne 0 -or $preflight[0].users -ne 0) { throw 'Expected empty recovered branch.' }
            $sql = "begin;`n"
            foreach ($migration in @('20261020120000_restrict_public_transport_agency_reads','20261020121000_create_order_with_receipt_atomic')) {
                $sql += [IO.File]::ReadAllText((Join-Path $workspace "supabase/migrations/$migration.sql")) + "`n"
                $version,$name = $migration -split '_',2
                $sql += "insert into supabase_migrations.schema_migrations(version,name,statements) values ('$version','$name',array['Applied from reviewed local migration']);`n"
            }
            $sql += "notify pgrst, 'reload schema';`ncommit;`n"
            $sql += [IO.File]::ReadAllText((Join-Path $workspace 'supabase/buyer_staging_seed.sql'))
            [IO.File]::WriteAllText((Join-Path $artifacts 'configure.sql'), $sql, $utf8)
            Write-BranchQuery $sql
            # Do not inherit production OAuth or allow public registrations in this isolated QA DB.
            $null = Invoke-RestMethod -Method Patch "https://api.supabase.com/v1/projects/$target/config/auth" -Headers $headers -ContentType 'application/json' -Body '{"external_google_enabled":false,"disable_signup":true}' -TimeoutSec 60
            Write-Output 'Staging migrations and fictional catalog applied. Public signup and Google disabled on branch only.'
            return
        }
        foreach ($test in @('buyer_staging_transaction_test.sql','order_status_consistency_test.sql','audit_remediation_staging_test.sql')) {
            $testPath = Join-Path $workspace "supabase/$test"
            $testSql = [IO.File]::ReadAllText($testPath)
            if ($testSql -notmatch '(?im)^rollback;' -or $testSql -match '(?im)^commit;') { throw 'QA file must roll back.' }
            Write-BranchQuery $testSql
            Write-Output "PASS (rolled back): $test"
        }
        return
    }

    if ($Action -in @('rehearse-backup','rehearse-schema','rebuild')) {
        if ($ConfirmBranch -ne $target) { throw 'Explicit branch reference required for rehearsal/rebuild.' }
        if (-not $BackupDirectory) { throw 'A verified backup directory is required.' }
        $backup = (Resolve-Path -LiteralPath $BackupDirectory).Path
        if (-not $backup.StartsWith($artifacts + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Backup must be inside recovery artifacts.' }
        $manifestPath = Join-Path $backup 'manifest.json'
        $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
        if ($manifest.project_ref -ne $target -or $manifest.branch_id -ne $branchId) { throw 'Backup belongs to another database.' }
        if ((Get-FileHash (Join-Path $backup 'branch.dump')).Hash -ne $manifest.archive_sha256) { throw 'Backup archive hash changed.' }
        if ($manifest.storage_count -ne @($manifest.files).Count) { throw 'Incomplete Storage manifest.' }
        foreach ($file in $manifest.files) {
            if ($file.file -notmatch '^object-\d{4}\.bin$') { throw 'Unexpected backup filename.' }
            $local = Join-Path $backup $file.file
            if ((Get-Item $local).Length -ne $file.bytes -or (Get-FileHash $local).Hash -ne $file.sha256) { throw 'Storage backup verification failed.' }
        }
        $guard = @(Read-Query $target 'select (select count(*) from auth.users) as users, (select count(*) from public.orders) as orders')
        if ($guard[0].users -ne 0 -or $guard[0].orders -ne 0) { throw 'Branch is no longer unused; stop.' }
        $external = @(Read-Query $target @'
select
 (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid join pg_namespace pn on pn.oid=p.pronamespace where not t.tgisinternal and n.nspname not in ('public','private') and pn.nspname in ('public','private')) as triggers,
 (select count(*) from pg_depend d join pg_policy p on d.classid='pg_policy'::regclass and p.oid=d.objid join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname not in ('public','private') and (
  (d.refclassid='pg_class'::regclass and d.refobjid in (select pc.oid from pg_class pc join pg_namespace pn on pn.oid=pc.relnamespace where pn.nspname in ('public','private')))
  or (d.refclassid='pg_proc'::regclass and d.refobjid in (select pp.oid from pg_proc pp join pg_namespace pn on pn.oid=pp.pronamespace where pn.nspname in ('public','private')))
 )) as policies;
'@)
        if ($external[0].triggers -ne 0 -or $external[0].policies -ne 0) { throw 'External schema dependencies need a broader backup before reconstruction.' }
        $countChecks = @()
        foreach ($table in $manifest.table_counts) {
            if ($table.name -notmatch '^(public|private|supabase_migrations)\.[a-z_]+$') { throw 'Unexpected table in manifest.' }
            $current = @(Read-Query $target "select count(*)::int as rows from $($table.name)")
            if ($current[0].rows -ne $table.rows) { throw 'Branch data changed after backup; back up again.' }
            $countChecks += "if (select count(*) from $($table.name)) <> $($table.rows) then raise exception 'Restored count mismatch: $($table.name)'; end if;"
        }
        $connection.PGOPTIONS = '-c statement_timeout=120000'
        $header = "begin;`nset local lock_timeout='10s';`ndrop schema if exists private cascade;`ndrop schema public cascade;`n"
        if ($Action -eq 'rehearse-backup') {
            $null = Run-PrivateProcess (Join-Path $bin 'pg_restore.exe') '--no-owner --file=restore-verified.sql branch.dump' $backup
            $restoreSql = [IO.File]::ReadAllText((Join-Path $backup 'restore-verified.sql'))
            $restoreSql = ($restoreSql -split "`n" | Where-Object { $_ -notmatch '^ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin ' }) -join "`n"
            $sql = $header + "drop schema supabase_migrations cascade;`n" + $restoreSql
            $sql += "`ndo `$verify`$ begin`n" + ($countChecks -join "`n") + "`nend `$verify`$;`nrollback;`n"
        } else {
            if (-not $manifest.restore_rehearsed) { throw 'Restore rehearsal has not passed.' }
            $schemaPath = Join-Path $artifacts 'source-schema.sql'
            $schemaHash = (Get-FileHash $schemaPath).Hash
            if ($Action -eq 'rebuild' -and $manifest.rehearsed_schema_sha256 -ne $schemaHash) { throw 'Rehearse the exact source schema before rebuilding.' }
            $schema = [IO.File]::ReadAllText($schemaPath)
            if ($schema -match '(?im)https?://|dblink|vault\.|net\.http|^CREATE (SERVER|USER MAPPING|SUBSCRIPTION)|^\\connect|sb_secret_|sbp_|gmail\.com') { throw 'Source schema needs sensitive/outbound review.' }
            # The managed supabase_admin role is not ours to alter; explicit object ACLs remain.
            $schema = ($schema -split "`n" | Where-Object { $_ -notmatch '^ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin ' }) -join "`n"
            $metadata = Get-Content (Join-Path $artifacts 'source-metadata.json') -Raw | ConvertFrom-Json
            if ($metadata.metadata.external_triggers) { throw 'External triggers require explicit review.' }
            $sql = $header + "create schema public;`ngrant usage on schema public to anon, authenticated, service_role;`ncreate extension if not exists pg_trgm with schema extensions;`n" + $schema
            $permissionSource = [IO.File]::ReadAllText((Join-Path $workspace 'supabase/buyer_staging_permissions.sql'))
            $permissions = @(Read-Query $parentRef $permissionSource)
            if (-not $permissions[0].permissions_sql) { throw 'Source effective permissions unavailable.' }
            $sql += "`nset local search_path=public,pg_catalog;`n" + $permissions[0].permissions_sql
            $sql += "`ndo `$verify`$ begin if (select count(*) from pg_tables where schemaname='public') <> 69 then raise exception 'Wrong table count'; end if; if exists(select 1 from public.stores) or exists(select 1 from public.orders) then raise exception 'Source rows present'; end if; end `$verify`$;`n"
            if ($Action -eq 'rebuild') {
                $sql += "delete from supabase_migrations.schema_migrations;`ninsert into supabase_migrations.schema_migrations(version,name,statements) values ('20261021090000','isolated_schema_snapshot_from_production',array['Schema-only snapshot; source hash $schemaHash']);`nnotify pgrst, 'reload schema';`ncommit;`n"
            } else { $sql += "rollback;`n" }
        }
        $fileName = "$Action.sql"
        [IO.File]::WriteAllText((Join-Path $artifacts $fileName), $sql, $utf8)
        if ($Action -eq 'rehearse-backup') {
            $null = Run-PrivateProcess (Join-Path $bin 'psql.exe') "-X --no-password --set=ON_ERROR_STOP=1 --file=$fileName" $artifacts $connection
        } else {
            $apiSql = ($sql -split "`n" | Where-Object { $_ -notmatch '^\\(un)?restrict [A-Za-z0-9]+\s*$' }) -join "`n"
            Write-BranchQuery $apiSql
        }
        if ($Action -eq 'rehearse-backup') { $manifest.restore_rehearsed = $true }
        if ($Action -eq 'rehearse-schema') { $manifest | Add-Member -Force -NotePropertyName rehearsed_schema_sha256 -NotePropertyValue $schemaHash }
        if ($Action -eq 'rebuild') { $manifest | Add-Member -Force -NotePropertyName rebuilt_at -NotePropertyValue ([DateTime]::UtcNow.ToString('o')) }
        Save-Json $manifestPath $manifest
        Write-Output "$Action passed on $target only."
        return
    }

    if ($Action -eq 'backup') {
        $backup = Join-Path $artifacts ('backup-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss'))
        [void][IO.Directory]::CreateDirectory($backup)
        $null = Run-PrivateProcess (Join-Path $bin 'pg_dump.exe') '--schema=public --schema=private --schema=supabase_migrations --no-owner --no-comments --no-security-labels --lock-wait-timeout=10s --format=custom --file=branch.dump' $backup $connection
        $null = Run-PrivateProcess (Join-Path $bin 'pg_restore.exe') '--no-owner --file=branch.sql branch.dump' $backup
        $toc = Run-PrivateProcess (Join-Path $bin 'pg_restore.exe') '--list branch.dump' $backup
        [IO.File]::WriteAllText((Join-Path $backup 'branch.toc'), $toc, $utf8)
        $tableNames = @(Read-Query $target "select schemaname,tablename from pg_tables where schemaname in ('public','private','supabase_migrations') order by schemaname,tablename")
        $countSql = ($tableNames | ForEach-Object { 'select ' + "'$($_.schemaname).$($_.tablename)' as name, count(*)::int as rows from " + '"' + $_.schemaname.Replace('"','""') + '"."' + $_.tablename.Replace('"','""') + '"' }) -join ' union all '
        $counts = @(Read-Query $target $countSql)
        Save-Json (Join-Path $backup 'counts.json') $counts
        $buckets = @(Read-Query $target 'select * from storage.buckets order by id')
        $objects = @(Read-Query $target 'select id,bucket_id,name,metadata,created_at,updated_at from storage.objects order by bucket_id,name')
        Save-Json (Join-Path $backup 'storage-buckets.json') $buckets
        Save-Json (Join-Path $backup 'storage-objects.json') $objects
        $files = @()
        $storageHeaders = @{ apikey = $keys.SUPABASE_SERVICE_ROLE_KEY; Authorization = "Bearer $($keys.SUPABASE_SERVICE_ROLE_KEY)" }
        $i = 0
        foreach ($object in $objects) {
            $i++
            $relative = 'object-{0:D4}.bin' -f $i
            $destination = Join-Path $backup $relative
            $encodedPath = (($object.name -split '/' | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/')
            $objectUrl = "https://$target.supabase.co/storage/v1/object/authenticated/$([Uri]::EscapeDataString($object.bucket_id))/$encodedPath"
            Invoke-WebRequest -UseBasicParsing -Uri $objectUrl -Headers $storageHeaders -OutFile $destination -TimeoutSec 60
            $length = (Get-Item -LiteralPath $destination).Length
            if ($null -ne $object.metadata.size -and $length -ne [long]$object.metadata.size) { throw 'Storage object size mismatch.' }
            $files += @{ bucket = $object.bucket_id; name = $object.name; file = $relative; bytes = $length; sha256 = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash }
        }
        $manifest = @{ project_ref = $target; branch_id = $branchId; created_at = [DateTime]::UtcNow.ToString('o'); archive_sha256 = (Get-FileHash (Join-Path $backup 'branch.dump')).Hash; table_counts = $counts; files = $files; storage_count = $objects.Count; archive_readable = $true; restore_rehearsed = $false }
        Save-Json (Join-Path $backup 'manifest.json') $manifest
        Write-Output "Backup complete: $backup; tables=$($counts.Count); storage=$($files.Count). Restore rehearsal still required."
        return
    }

    # Source is linked production, and both the CLI dump and native dump are schema-only.
    $sourceWorkspace = Join-Path $root '.fee-billing-prod'
    if ((Get-Content (Join-Path $sourceWorkspace 'supabase/.temp/project-ref') -Raw).Trim() -ne $parentRef) { throw 'Source link mismatch.' }
    $dry = Run-PrivateProcess 'cmd.exe' '/d /s /c npx.cmd supabase db dump --linked --schema public --dry-run' $sourceWorkspace
    foreach ($line in ($dry -split "`n")) {
        if ($line.Trim() -match '^export (PGHOST|PGPORT|PGUSER|PGPASSWORD|PGDATABASE)="([^"]*)"$') { $connection[$Matches[1]] = $Matches[2] }
    }
    $dry = $null
    if ($connection.Count -ne 5 -or $connection.PGUSER -notmatch $parentRef) { throw 'Unexpected source connection.' }
    $connection.PGSSLMODE = 'require'
    $connection.PGCONNECT_TIMEOUT = '20'
    $connection.PGOPTIONS = '-c default_transaction_read_only=on -c statement_timeout=120000'
    $null = Run-PrivateProcess (Join-Path $bin 'pg_dump.exe') '--role=postgres --schema-only --schema=public --schema=private --no-owner --no-comments --no-security-labels --lock-wait-timeout=10s --format=custom --file=source-schema.dump' $artifacts $connection
    $toc = Run-PrivateProcess (Join-Path $bin 'pg_restore.exe') '--list source-schema.dump' $artifacts
    $selected = ($toc -split "`n") | Where-Object { $_ -notmatch '^\d+; \d+ \d+ SCHEMA - public ' -and $_ -notmatch 'DEFAULT ACL .* supabase_admin$' }
    [IO.File]::WriteAllLines((Join-Path $artifacts 'source-schema.list'), $selected, $utf8)
    $null = Run-PrivateProcess (Join-Path $bin 'pg_restore.exe') '--schema-only --no-owner --no-comments --no-security-labels --use-list=source-schema.list --file=source-schema.sql source-schema.dump' $artifacts
    $meta = Read-Query $parentRef @'
select jsonb_build_object(
 'extensions',(select jsonb_agg(jsonb_build_object('name',e.extname,'schema',n.nspname,'version',e.extversion)) from pg_extension e join pg_namespace n on n.oid=e.extnamespace),
 'external_triggers',(select jsonb_agg(pg_get_triggerdef(t.oid)) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid join pg_namespace pn on pn.oid=p.pronamespace where not t.tgisinternal and n.nspname not in ('public','private') and pn.nspname in ('public','private')),
 'storage_policies',(select jsonb_agg(to_jsonb(p)) from pg_policies p where schemaname='storage'),
 'counts',jsonb_build_object('tables',(select count(*) from pg_tables where schemaname='public'),'functions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'))
) as metadata;
'@
    Save-Json (Join-Path $artifacts 'source-metadata.json') $meta
    Write-Output 'Production schema-only archive exported; no production rows, Auth identities or credentials copied. Review required before restore.'
} finally {
    if ($pointer -ne [IntPtr]::Zero) { [SomosSupabaseCredential]::Free($pointer) }
    if ($bytes) { [Array]::Clear($bytes, 0, $bytes.Length) }
    if ($headers) { $headers.Clear() }
    if ($storageHeaders) { $storageHeaders.Clear() }
    $connection.Clear()
    $token = $null; $keys = $null; $parts = $null; $uri = $null
}
