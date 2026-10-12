param([Parameter(Mandatory=$true)][string]$ExtensionId)
$ErrorActionPreference = 'Stop'
if ($ExtensionId -notmatch '^[a-p]{32}$') { throw 'Pass the 32-character Chrome/Edge extension ID.' }
$source = Join-Path $PSScriptRoot 'host.ps1'
$launcherSource = Join-Path $PSScriptRoot 'launcher.cs'
$installDir = Join-Path $env:LOCALAPPDATA 'P2PMeet\RemoteControlHost'
New-Item -ItemType Directory -Path $installDir -Force | Out-Null
Copy-Item -LiteralPath $source -Destination (Join-Path $installDir 'host.ps1') -Force
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $csc)) { $csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }
if (-not (Test-Path -LiteralPath $csc)) { throw 'The Windows .NET Framework C# compiler is required to build the native message launcher.' }
$launcherPath = Join-Path $installDir 'P2PMeetNativeHost.exe'
& $csc /nologo /target:exe "/out:$launcherPath" $launcherSource
if ($LASTEXITCODE -ne 0) { throw 'Could not build the native message launcher.' }
$manifest = @{
  name = 'com.p2pmeet.remote_control'
  description = 'Consent-gated P2PMeet Windows desktop input helper'
  path = $launcherPath
  type = 'stdio'
  allowed_origins = @("chrome-extension://$ExtensionId/")
} | ConvertTo-Json -Depth 4
$manifestPath = Join-Path $installDir 'manifest.json'
[IO.File]::WriteAllText($manifestPath, $manifest, [Text.UTF8Encoding]::new($false))
$key = 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.p2pmeet.remote_control'
New-Item -Path $key -Force | Out-Null
Set-Item -Path $key -Value $manifestPath
$edgeKey = 'HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\com.p2pmeet.remote_control'
New-Item -Path $edgeKey -Force | Out-Null
Set-Item -Path $edgeKey -Value $manifestPath
Write-Host "Installed P2PMeet native host for extension $ExtensionId. Restart the browser."
