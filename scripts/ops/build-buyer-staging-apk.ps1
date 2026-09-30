param([string]$JavaHome = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot')
$ErrorActionPreference = 'Stop'
$workspace = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$mobile = Join-Path $workspace 'mobile/somos-android'
$artifact = Get-Content (Join-Path $workspace 'tmp/buyer-staging/preview-deployment.json') -Raw | ConvertFrom-Json
if ($artifact.projectId -ne 'prj_LPHnsOxowUvGBXYalbdNO3R01PrI' -or $artifact.stage -ne 'xpqmmdmixpyqruykkbkf' -or $artifact.url -notmatch '^https://vendeplus-clean-[a-z0-9]{9}-entrega2-s-projects\.vercel\.app$') { throw 'Not an isolated buyer preview.' }
$response = Invoke-WebRequest -Uri "$($artifact.url)/mi-cuenta" -UseBasicParsing -TimeoutSec 40
$csp = $response.Headers['Content-Security-Policy']
if ($response.StatusCode -ne 200 -or $csp -notmatch 'xpqmmdmixpyqruykkbkf.supabase.co' -or $csp -match 'rvmtjtuztewcrmodrodb') { throw 'Preview is unavailable or its backend is not isolated.' }
if (-not (Test-Path -LiteralPath (Join-Path $JavaHome 'bin/java.exe'))) { throw 'Java 21 not found.' }
$old = @{}
foreach ($name in @('JAVA_HOME','SOMOS_ANDROID_BUYER_STAGING','SOMOS_ANDROID_PREVIEW_URL','SOMOS_ANDROID_LOCAL')) { $old[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
    $env:JAVA_HOME = $JavaHome
    $env:SOMOS_ANDROID_BUYER_STAGING = '1'
    $env:SOMOS_ANDROID_PREVIEW_URL = $artifact.url
    Remove-Item Env:SOMOS_ANDROID_LOCAL -ErrorAction SilentlyContinue
    Push-Location $mobile
    try {
        & npm.cmd run android:sync
        if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed.' }
    } finally { Pop-Location }
    Push-Location (Join-Path $mobile 'android')
    try {
        & .\gradlew.bat clean assembleDebug testDebugUnitTest --console=plain
        if ($LASTEXITCODE -ne 0) { throw 'Android build failed.' }
    } finally { Pop-Location }
    $folder = Join-Path $workspace 'tmp/buyer-staging/android'
    [void][IO.Directory]::CreateDirectory($folder)
    $target = Join-Path $folder 'somos-pruebas-1.4.0-beta3.apk'
    Copy-Item -LiteralPath (Join-Path $mobile 'android/app/build/outputs/apk/debug/app-debug.apk') -Destination $target
    $manifest = [ordered]@{ apk = $target; sha256 = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash; package = 'com.somosve.app.staging'; versionCode = 14; versionName = '1.4.0-buyer-beta.3'; preview = $artifact.url; stage = $artifact.stage; createdAt = [DateTime]::UtcNow.ToString('o'); firebase = 'not configured; production app untouched' }
    [IO.File]::WriteAllText((Join-Path $folder 'artifact.json'), ($manifest | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
    $manifest | ConvertTo-Json
} finally {
    foreach ($name in $old.Keys) { [Environment]::SetEnvironmentVariable($name, $old[$name], 'Process') }
}
