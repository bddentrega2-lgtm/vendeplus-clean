param(
    [string]$JavaHome = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot',
    [string]$SigningDirectory = (Join-Path $env:LOCALAPPDATA 'SOMOS/android-signing'),
    [switch]$CreateKey,
    [switch]$Incremental
)
$ErrorActionPreference = 'Stop'
$workspace = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$signingPath = [IO.Path]::GetFullPath($SigningDirectory)
if ($signingPath.StartsWith($workspace, [StringComparison]::OrdinalIgnoreCase)) { throw 'Signing material must stay outside the repository.' }
$keytool = Join-Path $JavaHome 'bin/keytool.exe'
if (-not (Test-Path -LiteralPath $keytool)) { throw 'Java keytool was not found.' }
$keystore = Join-Path $signingPath 'somos-app-signing.p12'
$credentialPath = Join-Path $signingPath 'signing-credential.windows.xml'
$certificatePath = Join-Path $signingPath 'somos-app-signing-public.pem'
$keyAlias = 'somos-app-signing'
$old = @{}
foreach ($name in @('SOMOS_ANDROID_KEYSTORE_PATH','SOMOS_ANDROID_KEY_ALIAS','SOMOS_ANDROID_STORE_PASSWORD','SOMOS_ANDROID_KEY_PASSWORD')) {
    $old[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
try {
    if (-not (Test-Path -LiteralPath $keystore)) {
        if (-not $CreateKey) { throw 'No signing key exists. Initial creation requires -CreateKey.' }
        if (Test-Path -LiteralPath $credentialPath) { throw 'Incomplete signing directory. Inspect it before creating any key.' }
        [void][IO.Directory]::CreateDirectory($signingPath)
        $acl = New-Object Security.AccessControl.DirectorySecurity
        $acl.SetAccessRuleProtection($true, $false)
        $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
        $acl.SetOwner($sid)
        $rule = New-Object Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
        $acl.AddAccessRule($rule)
        Set-Acl -LiteralPath $signingPath -AclObject $acl
        $bytes = New-Object byte[] 36
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
        $password = [Convert]::ToBase64String($bytes)
        $securePassword = ConvertTo-SecureString $password -AsPlainText -Force
        $credential = New-Object Management.Automation.PSCredential($keyAlias, $securePassword)
        $credential | Export-Clixml -LiteralPath $credentialPath
        $env:SOMOS_ANDROID_STORE_PASSWORD = $password
        $env:SOMOS_ANDROID_KEY_PASSWORD = $password
        $password = $null
        & $keytool -genkeypair -alias $keyAlias -keystore $keystore -storetype PKCS12 -storepass:env SOMOS_ANDROID_STORE_PASSWORD -keypass:env SOMOS_ANDROID_KEY_PASSWORD -keyalg RSA -keysize 3072 -sigalg SHA256withRSA -validity 10000 -dname 'CN=SOMOS Android, OU=Mobile' -noprompt
        if ($LASTEXITCODE -ne 0) { throw 'Signing key creation failed. Keep the encrypted credential for recovery.' }
    }
    if (-not (Test-Path -LiteralPath $credentialPath)) { throw 'The protected credential is missing. Do not replace the existing key.' }
    $credential = Import-Clixml -LiteralPath $credentialPath
    if ($credential.UserName -ne $keyAlias) { throw 'Unexpected signing identity.' }
    $env:SOMOS_ANDROID_KEYSTORE_PATH = $keystore
    $env:SOMOS_ANDROID_KEY_ALIAS = $keyAlias
    $env:SOMOS_ANDROID_STORE_PASSWORD = $credential.GetNetworkCredential().Password
    $env:SOMOS_ANDROID_KEY_PASSWORD = $env:SOMOS_ANDROID_STORE_PASSWORD
    & $keytool -exportcert -rfc -alias $keyAlias -keystore $keystore -storepass:env SOMOS_ANDROID_STORE_PASSWORD -file $certificatePath
    if ($LASTEXITCODE -ne 0) { throw 'Signing key verification failed.' }
    & (Join-Path $PSScriptRoot 'build-play-internal-aab.ps1') -JavaHome $JavaHome -Incremental:$Incremental
    if (-not $?) { throw 'Signed build failed.' }
} finally {
    $credential = $null
    $securePassword = $null
    foreach ($name in $old.Keys) { [Environment]::SetEnvironmentVariable($name, $old[$name], 'Process') }
}
