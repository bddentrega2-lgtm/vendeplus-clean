param(
    [string]$ArtifactManifest = 'tmp/play-internal/artifact.json',
    [string]$JavaHome = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot'
)
$ErrorActionPreference = 'Stop'
$manifest = Get-Content -LiteralPath $ArtifactManifest -Raw | ConvertFrom-Json
$apk = $manifest.apk
if (-not (Test-Path -LiteralPath $apk)) { throw 'APK missing.' }
if ((Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash -ne $manifest.apkSha256) { throw 'APK hash mismatch.' }
$tools = Join-Path $env:LOCALAPPDATA 'Android/Sdk/build-tools/36.0.0'
$oldJava = $env:JAVA_HOME
try {
    $env:JAVA_HOME = $JavaHome
    $signature = & (Join-Path $tools 'apksigner.bat') verify --verbose --print-certs $apk
    if ($LASTEXITCODE -ne 0) { throw 'APK signature is invalid.' }
    if (($signature -join "`n") -match 'CN=Android Debug') { throw 'APK is debug-signed.' }
    $badging = & (Join-Path $tools 'aapt.exe') dump badging $apk
    if ($LASTEXITCODE -ne 0) { throw 'APK manifest is unreadable.' }
    $text = $badging -join "`n"
    if ($text -notmatch "package: name='com.somosve.app'" -or
        $text -notmatch ("versionCode='{0}'" -f $manifest.versionCode) -or
        $text -notmatch ("versionName='{0}'" -f [regex]::Escape($manifest.versionName))) { throw 'APK identity mismatch.' }
    if ($text -match 'application-debuggable') { throw 'Release APK is debuggable.' }
    if ($text -notmatch "sdkVersion:'24'" -or $text -notmatch "targetSdkVersion:'36'") { throw 'Unexpected SDK range.' }
    if ($text -match "uses-feature: name='android.hardware.(bluetooth|location)") { throw 'Bluetooth/location must not exclude compatible phones/tablets.' }
    & (Join-Path $tools 'zipalign.exe') -c -P 16 4 $apk
    if ($LASTEXITCODE -ne 0) { throw 'APK ZIP alignment is incompatible with 16 KB pages.' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($apk)
    try {
        $sensitive = @($zip.Entries | Where-Object { $_.FullName -match '(^|/)(\.env[^/]*|google-services\.json|keystore\.properties)$|\.(jks|keystore|p12|pem)$' })
        if ($sensitive.Count -gt 0) { throw 'Private file found in APK.' }
        $entry = $zip.GetEntry('assets/capacitor.config.json')
        if (-not $entry) { throw 'Capacitor configuration missing.' }
        $reader = New-Object IO.StreamReader($entry.Open())
        try { $config = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
        if ($config.appId -ne 'com.somosve.app' -or $config.server.url -ne 'https://www.somos-ve.com' -or $config.server.cleartext -ne $false) { throw 'Invalid APK origin.' }
        $nativeLibraries = @($zip.Entries | Where-Object { $_.FullName -match '^lib/.+\.so$' })
        $elfChecks = @()
        foreach ($library in $nativeLibraries | Where-Object { $_.FullName -match '^lib/(arm64-v8a|x86_64)/' }) {
            $buffer = New-Object IO.MemoryStream
            $stream = $library.Open()
            try { $stream.CopyTo($buffer) } finally { $stream.Dispose() }
            $buffer.Position = 0
            $binary = New-Object IO.BinaryReader($buffer)
            try {
                $identity = $binary.ReadBytes(16)
                if ([BitConverter]::ToUInt32($identity, 0) -ne 0x464c457f -or $identity[4] -ne 2 -or $identity[5] -ne 1) { throw 'Unsupported ELF format.' }
                $buffer.Position = 32
                $programOffset = $binary.ReadUInt64()
                $buffer.Position = 54
                $entrySize = $binary.ReadUInt16()
                $entryCount = $binary.ReadUInt16()
                $loadSegments = 0
                for ($index = 0; $index -lt $entryCount; $index++) {
                    $buffer.Position = $programOffset + ($index * $entrySize)
                    $segmentType = $binary.ReadUInt32()
                    [void]$binary.ReadUInt32()
                    $fileOffset = $binary.ReadUInt64()
                    $virtualAddress = $binary.ReadUInt64()
                    [void]$binary.ReadUInt64()
                    [void]$binary.ReadUInt64()
                    $memorySize = $binary.ReadUInt64()
                    $alignment = $binary.ReadUInt64()
                    if ($segmentType -eq 1) {
                        $loadSegments++
                        if ($alignment -lt 16384 -or ($fileOffset % 16384) -ne ($virtualAddress % 16384)) { throw "ELF LOAD alignment failed: $($library.FullName)" }
                    }
                    if ($segmentType -eq 0x6474e552 -and (($virtualAddress + $memorySize) % 16384) -ne 0) { throw "ELF RELRO alignment failed: $($library.FullName)" }
                }
                if ($loadSegments -eq 0) { throw 'ELF contains no LOAD segments.' }
                $elfChecks += @{ library = $library.FullName; loadSegments = $loadSegments; aligned16KB = $true }
            } finally { $binary.Dispose(); $buffer.Dispose() }
        }
    } finally { $zip.Dispose() }
    $result = [ordered]@{
        verified = $true
        version = $manifest.versionName
        versionCode = $manifest.versionCode
        bytes = (Get-Item -LiteralPath $apk).Length
        sha256 = $manifest.apkSha256
        debuggable = $false
        minAndroid = '7.0'
        targetSdk = 36
        nativeLibraries = $nativeLibraries.Count
        elf16KB = $elfChecks
        origin = $config.server.url
        signingCertificate = @($signature | Where-Object { $_ -match '^Signer #1 certificate (DN|SHA-256 digest):' })
        permissions = @($badging | Where-Object { $_ -match '^uses-permission:' })
        screenSupport = @($badging | Where-Object { $_ -match '^supports-screens:|^supports-any-density:|^uses-feature:' })
    }
    $result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath 'tmp/play-internal/verification.json' -Encoding UTF8
    $result | ConvertTo-Json -Depth 5
} finally { $env:JAVA_HOME = $oldJava }
