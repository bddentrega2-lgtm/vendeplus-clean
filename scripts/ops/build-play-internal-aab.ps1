param([string]$JavaHome = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot', [switch]$Incremental)
$ErrorActionPreference = 'Stop'
$workspace = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$mobile = Join-Path $workspace 'mobile/somos-android'
$android = Join-Path $mobile 'android'
$googleServicesPath = Join-Path $android 'app/google-services.json'
$required = @('SOMOS_ANDROID_KEYSTORE_PATH','SOMOS_ANDROID_KEY_ALIAS','SOMOS_ANDROID_STORE_PASSWORD','SOMOS_ANDROID_KEY_PASSWORD')

foreach ($name in $required) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name, 'Process'))) {
        throw "Missing release variable $name. Configure it only in the current secure shell."
    }
}
$keystore = [Environment]::GetEnvironmentVariable('SOMOS_ANDROID_KEYSTORE_PATH', 'Process')
if (-not (Test-Path -LiteralPath $keystore -PathType Leaf)) { throw 'The configured release keystore does not exist.' }
if ($keystore.StartsWith($workspace, [StringComparison]::OrdinalIgnoreCase)) { throw 'The release keystore must live outside the repository.' }
if (-not (Test-Path -LiteralPath $googleServicesPath -PathType Leaf)) { throw 'Firebase google-services.json for com.somosve.app is missing.' }
$google = Get-Content -LiteralPath $googleServicesPath -Raw | ConvertFrom-Json
$packages = @($google.client.client_info.android_client_info.package_name)
if ($packages -notcontains 'com.somosve.app') { throw 'Firebase configuration does not contain com.somosve.app.' }
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
        $cleanTask = if ($Incremental) { @() } else { @('clean') }
        & .\gradlew.bat @cleanTask lintRelease testReleaseUnitTest bundleRelease assembleRelease --console=plain --no-daemon
        if ($LASTEXITCODE -ne 0) { throw 'Android release build failed.' }
    } finally { Pop-Location }

    $source = Join-Path $android 'app/build/outputs/bundle/release/app-release.aab'
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw 'Signed release AAB was not generated.' }
    $metadataPath = Join-Path $android 'app/build/outputs/bundle/release/somos-release-metadata.json'
    if (-not (Test-Path -LiteralPath $metadataPath -PathType Leaf)) { throw 'Release metadata was not generated.' }
    $releaseMetadata = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
    if ($releaseMetadata.packageName -ne 'com.somosve.app' -or $releaseMetadata.origin -ne 'https://www.somos-ve.com') {
        throw 'Release metadata does not match the official application.'
    }
    $folder = Join-Path $workspace 'tmp/play-internal'
    [void][IO.Directory]::CreateDirectory($folder)
    $target = Join-Path $folder 'somos-internal-release.aab'
    Copy-Item -LiteralPath $source -Destination $target -Force
    $apkSource = Join-Path $android 'app/build/outputs/apk/release/app-release.apk'
    if (-not (Test-Path -LiteralPath $apkSource -PathType Leaf)) { throw 'Signed release APK was not generated.' }
    $apkTarget = Join-Path $folder ("somos-{0}-android.apk" -f $releaseMetadata.versionName)
    Copy-Item -LiteralPath $apkSource -Destination $apkTarget -Force
    $manifest = [ordered]@{
        artifact = $target
        sha256 = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
        apk = $apkTarget
        apkSha256 = (Get-FileHash -LiteralPath $apkTarget -Algorithm SHA256).Hash
        package = $releaseMetadata.packageName
        versionCode = [int]$releaseMetadata.versionCode
        versionName = [string]$releaseMetadata.versionName
        origin = $releaseMetadata.origin
        firebase = 'configured'
        createdAt = [DateTime]::UtcNow.ToString('o')
    }
    [IO.File]::WriteAllText((Join-Path $folder 'artifact.json'), ($manifest | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
    $manifest | ConvertTo-Json
} finally {
    foreach ($name in $old.Keys) { [Environment]::SetEnvironmentVariable($name, $old[$name], 'Process') }
}
