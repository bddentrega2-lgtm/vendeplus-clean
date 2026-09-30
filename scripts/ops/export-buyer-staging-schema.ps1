$ErrorActionPreference = 'Stop'
$workspace = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$privateDir = Join-Path $workspace 'tmp/buyer-staging'
if ((Get-Content (Join-Path $workspace 'supabase/.temp/project-ref') -Raw).Trim() -ne 'rvmtjtuztewcrmodrodb') {
    throw 'Unexpected source project. Export stopped.'
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead((Join-Path $privateDir 'postgresql-17.11.zip'))
try {
    foreach ($entry in $zip.Entries) {
        if ($entry.FullName -notmatch '^pgsql/bin/[^/]+$') { continue }
        $destination = Join-Path $privateDir $entry.FullName
        [void][IO.Directory]::CreateDirectory((Split-Path $destination -Parent))
        if (-not (Test-Path -LiteralPath $destination)) {
            [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destination, $false)
        }
    }
} finally { $zip.Dispose() }

$start = New-Object Diagnostics.ProcessStartInfo
$start.FileName = 'cmd.exe'
$start.Arguments = '/d /s /c "supabase.cmd db dump --linked --schema public --dry-run"'
$start.WorkingDirectory = $workspace
$start.UseShellExecute = $false
$start.CreateNoWindow = $true
$start.RedirectStandardOutput = $true
$start.RedirectStandardError = $true
$process = [Diagnostics.Process]::Start($start)
$stdoutTask = $process.StandardOutput.ReadToEndAsync()
$stderrTask = $process.StandardError.ReadToEndAsync()
$process.WaitForExit()
$script = $stdoutTask.Result
$null = $stderrTask.Result
if ($process.ExitCode -ne 0) { throw 'Could not obtain the schema-only export connection.' }

$connection = @{}
foreach ($line in ($script -split "`n")) {
    if ($line.Trim() -match '^export (PGHOST|PGPORT|PGUSER|PGPASSWORD|PGDATABASE)="([^"]*)"$') {
        $connection[$Matches[1]] = $Matches[2]
    }
}
$script = $null
if ($connection.Count -ne 5 -or $connection.PGDATABASE -ne 'postgres' -or
    $connection.PGUSER -notmatch 'rvmtjtuztewcrmodrodb' -or
    $connection.PGHOST -notmatch '\.supabase\.(com|co)$') {
    throw 'Unexpected export connection. Credentials were not printed.'
}

$dump = New-Object Diagnostics.ProcessStartInfo
$dump.FileName = Join-Path $privateDir 'pgsql/bin/pg_dump.exe'
$dump.Arguments = '--role=postgres --schema-only --schema=public --schema=private --no-owner --no-comments --no-security-labels --lock-wait-timeout=10s --format=custom --file=app-schema.dump'
$dump.WorkingDirectory = $privateDir
$dump.UseShellExecute = $false
$dump.CreateNoWindow = $true
$dump.RedirectStandardError = $true
foreach ($key in $connection.Keys) { $dump.EnvironmentVariables[$key] = $connection[$key] }
$dump.EnvironmentVariables['PGSSLMODE'] = 'require'
$dump.EnvironmentVariables['PGOPTIONS'] = '-c default_transaction_read_only=on -c statement_timeout=60000'
$dump.EnvironmentVariables['PGCONNECT_TIMEOUT'] = '20'
try {
    $process = [Diagnostics.Process]::Start($dump)
    $failure = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) {
        $safeFailure = $failure.Replace($connection.PGPASSWORD, '[redacted]')
        throw "Schema export failed (exit $($process.ExitCode)); no restore performed. $safeFailure"
    }
} finally {
    foreach ($key in $connection.Keys) { $dump.EnvironmentVariables.Remove($key) }
    $connection.Clear()
}

$restore = Join-Path $privateDir 'pgsql/bin/pg_restore.exe'
$archive = Join-Path $privateDir 'app-schema.dump'
$toc = & $restore --list $archive
if ($LASTEXITCODE -ne 0) { throw 'Could not read the archive contents.' }
# Keep Supabase's existing public schema and administrator defaults intact.
$selected = $toc | Where-Object { $_ -notmatch '^\d+; \d+ \d+ SCHEMA - public ' -and $_ -notmatch 'DEFAULT ACL .* supabase_admin$' }
$listPath = Join-Path $privateDir 'schema.list'
[IO.File]::WriteAllLines($listPath, $selected, (New-Object Text.UTF8Encoding($false)))
& $restore --schema-only --no-owner --no-comments --no-security-labels --use-list $listPath --file (Join-Path $privateDir 'app-schema.sql') $archive
if ($LASTEXITCODE -ne 0) { throw 'Could not render the local schema archive.' }
Get-Item $archive, (Join-Path $privateDir 'app-schema.sql') | Select-Object Name, Length
