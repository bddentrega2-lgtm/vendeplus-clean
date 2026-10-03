param([string]$JavaHome = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot')
$ErrorActionPreference = 'Stop'
$workspace = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$mobile = Join-Path $workspace 'mobile/somos-android'
$android = Join-Path $mobile 'android'
$googleServicesPath = Join-Path $android 'app/google-services.json'

if (-not (Test-Path -LiteralPath $googleServicesPath -PathType Leaf)) { throw 'Firebase configuration is missing.' }
$google = Get-Content -LiteralPath $googleServicesPath -Raw | ConvertFrom-Json
$packages = @($google.client.client_info.android_client_info.package_name)
if (@($google.client).Count -ne 1 -or $packages -notcontains 'com.somosve.app') { throw 'Firebase configuration is not exclusive to com.somosve.app.' }
if (-not (Test-Path -LiteralPath (Join-Path $JavaHome 'bin/java.exe'))) { throw 'Java 21 not found.' }

$old = @{}
foreach ($name in @('JAVA_HOME','SOMOS_ANDROID_BUYER_STAGING','SOMOS_ANDROID_PREVIEW_URL','SOMOS_ANDROID_LOCAL')) {
    $old[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
try {
    $env:JAVA_HOME = $JavaHome
    Remove-Item Env:SOMOS_ANDROID_BUYER_STAGING -ErrorAction SilentlyContinue
    Remove-Item Env:SOMOS_ANDROID_PREVIEW_URL -ErrorAction SilentlyContinue
    Remove-Item Env:SOMOS_ANDROID_LOCAL -ErrorAction SilentlyContinue
    Push-Location $mobile
    try {
        & npm.cmd run android:sync
        if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed.' }
    } finally { Pop-Location }
    Push-Location $android
    try {
        & .\gradlew.bat clean lintDebug assembleDebug testDebugUnitTest --console=plain
        if ($LASTEXITCODE -ne 0) { throw 'Android build failed.' }
    } finally { Pop-Location }

    $source = Join-Path $android 'app/build/outputs/apk/debug/app-debug.apk'
    $folder = Join-Path $workspace 'tmp/firebase-pilot'
    [void][IO.Directory]::CreateDirectory($folder)
    $target = Join-Path $folder 'somos-1.5.1-print-candidate.apk'
    Copy-Item -LiteralPath $source -Destination $target -Force
    $manifest = [ordered]@{
        apk = $target
        sha256 = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
        package = 'com.somosve.app'
        versionCode = 15
        versionName = '1.5.1'
        origin = 'https://www.somos-ve.com'
        firebase = 'configured-client'
        createdAt = [DateTime]::UtcNow.ToString('o')
    }
    [IO.File]::WriteAllText((Join-Path $folder 'artifact.json'), ($manifest | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
    $manifest | ConvertTo-Json
} finally {
    foreach ($name in $old.Keys) { [Environment]::SetEnvironmentVariable($name, $old[$name], 'Process') }
}
