#Requires -Version 5.1
<#
.SYNOPSIS
  Download a pinned LibreOffice MSI, verify SHA256, and silent-install it.
  Used by the Converte Facil NSIS POSTINSTALL hook (and safe to run manually).

.NOTES
  Does not remove LibreOffice on Converte Facil uninstall (shared dependency).
  Exit codes: 0 = ready (already present, declined, or installed), 1 = failed (app fallback still works).
  Log: %TEMP%\converte-facil-libreoffice-setup.log
  Keep this file ASCII-only (or UTF-8 with BOM). Windows PowerShell 5.1 parses
  BOM-less UTF-8 as system ANSI; bytes like em-dash 0x94 become a quote and break the script.
#>
param(
  [switch]$Silent
)

$ErrorActionPreference = "Stop"

# Pin - keep in sync with winget TheDocumentFoundation.LibreOffice when bumping.
$LibreOfficeVersion = "26.2.4"
$MsiFileName = "LibreOffice_26.2.4_Win_x86-64.msi"
$MsiUrl = "https://download.documentfoundation.org/libreoffice/stable/$LibreOfficeVersion/win/x86_64/$MsiFileName"
$MsiSha256 = "202f26cda071c5aa4996a5a28412fddceb3891dceb0366982c62650456c0730f"

$LogPath = Join-Path $env:TEMP "converte-facil-libreoffice-setup.log"

function Write-SetupLog([string]$Message) {
  $line = "[{0:u}] {1}" -f (Get-Date).ToUniversalTime(), $Message
  Write-Host $line
  try {
    Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
  } catch {
    # ignore log I/O failures
  }
}

function Test-LibreOfficePresent {
  $candidates = @(
    "${env:ProgramFiles}\LibreOffice\program\soffice.exe",
    "${env:ProgramFiles(x86)}\LibreOffice\program\soffice.exe"
  )
  if ($env:ProgramW6432) {
    $candidates += "$env:ProgramW6432\LibreOffice\program\soffice.exe"
  }
  if ($env:LOCALAPPDATA) {
    $candidates += "$env:LOCALAPPDATA\converte-facil\LibreOffice\program\soffice.exe"
  }
  if (Get-ChildItem "${env:ProgramFiles}\LibreOffice*\program\soffice.exe" -ErrorAction SilentlyContinue) {
    return $true
  }
  foreach ($path in $candidates) {
    if ($path -and (Test-Path -LiteralPath $path)) {
      return $true
    }
  }
  return $false
}

function Get-IsAdministrator {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($id)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

try {
  Set-Content -LiteralPath $LogPath -Value "" -Encoding UTF8 -ErrorAction SilentlyContinue
} catch { }

Write-SetupLog "LibreOffice setup helper starting (Silent=$Silent, STA=$([System.Threading.Thread]::CurrentThread.GetApartmentState()))"

if (Test-LibreOfficePresent) {
  Write-SetupLog "LibreOffice already present - skipping download."
  exit 0
}

if (-not $Silent) {
  Add-Type -AssemblyName System.Windows.Forms | Out-Null
  $isPt = (Get-Culture).Name -like "pt*"
  if ($isPt) {
    $title = "Converte Facil - LibreOffice"
    $body = "O Converte Facil precisa do LibreOffice para converter Word e Excel.`n`nBaixar e instalar o LibreOffice agora? (~350 MB). O Windows pode pedir permissao."
  } else {
    $title = "Converte Facil - LibreOffice"
    $body = "Converte Facil needs LibreOffice to convert Word and Excel.`n`nDownload and install LibreOffice now? (~350 MB). Windows may ask for permission."
  }
  $answer = [System.Windows.Forms.MessageBox]::Show(
    $body,
    $title,
    [System.Windows.Forms.MessageBoxButtons]::YesNo,
    [System.Windows.Forms.MessageBoxIcon]::Question
  )
  if ($answer -ne [System.Windows.Forms.DialogResult]::Yes) {
    Write-SetupLog "User declined LibreOffice install."
    exit 0
  }
}

$workDir = Join-Path $env:TEMP "converte-facil-libreoffice-setup"
New-Item -ItemType Directory -Force -Path $workDir | Out-Null
$msiPath = Join-Path $workDir $MsiFileName

try {
  Write-SetupLog "Downloading LibreOffice $LibreOfficeVersion from $MsiUrl"
  # Prefer WebClient for large files (IWR can time out; BITS often fails under NSIS).
  try {
    $wc = New-Object System.Net.WebClient
    $wc.DownloadFile($MsiUrl, $msiPath)
    $wc.Dispose()
  } catch {
    Write-SetupLog "WebClient failed ($($_.Exception.Message)) - trying BITS."
    Start-BitsTransfer -Source $MsiUrl -Destination $msiPath -ErrorAction Stop
  }

  if (-not (Test-Path -LiteralPath $msiPath)) {
    throw "Download finished but MSI file is missing at $msiPath"
  }
  $size = (Get-Item -LiteralPath $msiPath).Length
  Write-SetupLog "Downloaded $size bytes"

  Write-SetupLog "Verifying SHA256..."
  $actual = (Get-FileHash -LiteralPath $msiPath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $MsiSha256.ToLowerInvariant()) {
    throw "SHA256 mismatch for LibreOffice MSI. expected=$MsiSha256 actual=$actual"
  }

  Write-SetupLog "Installing LibreOffice (may prompt for administrator permission)..."
  # Do not use $args - it is a PowerShell automatic variable.
  # ADDLOCAL=ALL is required: a default silent MSI can omit OOXML (docx/xlsx) filters.
  $msiexecArgs = @(
    "/i", $msiPath,
    "/qn",
    "/norestart",
    "ALLUSERS=1",
    "ADDLOCAL=ALL",
    "CREATEDESKTOPLINK=0",
    "REGISTER_ALL_MSO_TYPES=0",
    "ISCHECKFORPRODUCTUPDATES=0",
    "RebootYesNo=No"
  )

  $elevated = Get-IsAdministrator
  Write-SetupLog "Current process elevated=$elevated"
  try {
    if ($elevated) {
      $proc = Start-Process -FilePath "msiexec.exe" -ArgumentList $msiexecArgs -Wait -PassThru
    } else {
      $proc = Start-Process -FilePath "msiexec.exe" -ArgumentList $msiexecArgs -Verb RunAs -Wait -PassThru
    }
  } catch {
    $msg = $_.Exception.Message
    if ($msg -match "canceled|cancelled|recusad|cancelad") {
      throw "Administrator permission was cancelled. Install LibreOffice later from Documents mode."
    }
    throw "Failed to start msiexec: $msg"
  }

  $code = $proc.ExitCode
  Write-SetupLog "msiexec exit code=$code"
  # 0 = success, 3010 = success reboot required (treat as OK)
  if ($null -eq $code -or ($code -ne 0 -and $code -ne 3010)) {
    throw "msiexec exited with code $code"
  }

  if (-not (Test-LibreOfficePresent)) {
    throw "msiexec finished but soffice.exe was not found"
  }

  # Incomplete silent installs can ship Writer without MS Office filters.
  $programDir = "${env:ProgramFiles}\LibreOffice\program"
  $wordFilter = Join-Path $programDir "mswordlo.dll"
  if (-not (Test-Path -LiteralPath $wordFilter)) {
    throw "LibreOffice installed but Word filter (mswordlo.dll) is missing - try reinstalling with ADDLOCAL=ALL"
  }

  Write-SetupLog "LibreOffice installed successfully."
  exit 0
} catch {
  Write-SetupLog "LibreOffice setup failed: $_"
  Write-SetupLog "You can install it later from Documents mode inside Converte Facil."
  exit 1
} finally {
  Remove-Item -LiteralPath $workDir -Recurse -Force -ErrorAction SilentlyContinue
}
