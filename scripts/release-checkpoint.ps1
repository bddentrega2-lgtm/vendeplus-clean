param([Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$destinationPath = [IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $destinationPath) { throw 'Destination must be new; existing snapshots are never overwritten.' }
$scope = 'entrega2-s-projects'
$production = 'dpl_Dd2kESi3Z4K3bDsdprzxU266eJwi'
$preview = 'dpl_2ThqxhG3VSi2VUGmLqAYs7GdQ3h8'
Set-Location -LiteralPath $root

function Get-DeploymentSource([string]$id) {
    $json = & vercel.cmd api "/v6/deployments/$id/files" --scope $scope
    if ($LASTEXITCODE -ne 0) { throw "Cannot read deployment $id" }
    $tree = $json | ConvertFrom-Json
    $source = @($tree | Where-Object name -eq 'src')[0]
    if (!$source.children) { throw 'Source tree unavailable' }
    $result = @{}
    function Walk($nodes, [string]$prefix) {
        foreach ($node in $nodes) {
            $path = "$prefix$($node.name)"
            if ($node.type -eq 'directory') { Walk $node.children "$path/" }
            elseif ($node.type -eq 'file') { $result[$path] = $node.uid }
        }
    }
    Walk $source.children ''
    return $result
}

$prodFiles = Get-DeploymentSource $production
$previewFiles = Get-DeploymentSource $preview
$changes = foreach ($path in @(@($prodFiles.Keys) + @($previewFiles.Keys) | Sort-Object -Unique)) {
    if ($prodFiles[$path] -ne $previewFiles[$path]) {
        [pscustomobject]@{ path=$path; change=$(if (!$prodFiles.ContainsKey($path)) {'added'} elseif (!$previewFiles.ContainsKey($path)) {'removed'} else {'modified'}); productionHash=$prodFiles[$path]; previewHash=$previewFiles[$path] }
    }
}

$stage = Join-Path $destinationPath 'source'
New-Item -ItemType Directory -Path $stage -Force | Out-Null
$paths = @(& git -c core.quotepath=false ls-files --cached --others --exclude-standard | Sort-Object -Unique)
if ($LASTEXITCODE -ne 0) { throw 'Cannot enumerate source files' }
$manifest = foreach ($path in $paths) {
    if ($path -match '(^|/)(\.env[^/]*|node_modules|\.next|\.git|\.vercel|tmp|\.gradle|build)(/|$)' -or $path -match '(google-services\.json|local\.properties|\.jks|\.keystore|\.p12|\.pem|\.tsbuildinfo)$') { continue }
    $original = [IO.Path]::GetFullPath((Join-Path $root $path))
    if (!$original.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw "Out of workspace: $path" }
    if (!(Test-Path -LiteralPath $original -PathType Leaf)) { continue }
    if ((Get-Item -LiteralPath $original).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Link excluded: $path" }
    $target = Join-Path $stage $path
    New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
    Copy-Item -LiteralPath $original -Destination $target
    $hash = (Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash
    if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $hash) { throw "Copy mismatch: $path" }
    [pscustomobject]@{ path=$path; sha256=$hash }
}
$apk = 'tmp/mobile-buyer-alerts/somos-1.3.0-buyer-alerts-preview.apk'
Copy-Item -LiteralPath $apk -Destination $destinationPath
& git bundle create (Join-Path $destinationPath 'git-base.bundle') HEAD
if ($LASTEXITCODE -ne 0) { throw 'Cannot preserve Git base' }
& git bundle verify (Join-Path $destinationPath 'git-base.bundle')
if ($LASTEXITCODE -ne 0) { throw 'Invalid Git bundle' }
$changes | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $destinationPath 'production-vs-preview.json') -Encoding UTF8
[pscustomobject]@{ createdAt=(Get-Date).ToString('o'); sourceRoot=$root; gitHead=(& git rev-parse HEAD); production=$production; preview=$preview; apkSha256=(Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash; excluded='credentials, signing keys, dependencies, build output, database'; files=$manifest } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $destinationPath 'manifest.json') -Encoding UTF8
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = Join-Path $destinationPath 'source.zip'
[IO.Compression.ZipFile]::CreateFromDirectory($stage, $zip)
$archive = [IO.Compression.ZipFile]::OpenRead($zip)
try {
    if ($archive.Entries.Count -ne $manifest.Count) { throw 'Archive entry count mismatch' }
    foreach ($entry in $archive.Entries) {
        $item = $manifest | Where-Object path -eq $entry.FullName.Replace('\','/')
        $stream = $entry.Open()
        $sha = [Security.Cryptography.SHA256]::Create()
        try { $hash = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','') }
        finally { $stream.Dispose(); $sha.Dispose() }
        if ($hash -ne $item.sha256) { throw "Archive mismatch: $($entry.FullName)" }
    }
} finally { $archive.Dispose() }
[pscustomobject]@{ destination=$destinationPath; files=$manifest.Count; changedDeploymentFiles=$changes.Count; archiveSha256=(Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash; archiveBytes=(Get-Item -LiteralPath $zip).Length } | ConvertTo-Json
$changes | Select-Object change,path | Format-Table -AutoSize
