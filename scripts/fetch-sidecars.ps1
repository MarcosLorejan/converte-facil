# Fetch Windows sidecars for Converte Fácil
#
# Pinned versions (update these together with docs/sidecars.md):
#   ImageMagick 7.1.2-27 portable Q16-HDRI x64 (.7z from GitHub Releases)
#   Ghostscript 10.05.1 Windows x64 (Artifex installer)
#
# Usage (repo root, PowerShell):
#   .\scripts\fetch-sidecars.ps1
#   .\scripts\fetch-sidecars.ps1 -Force
#
# Requires network access. ImageMagick portable archives are .7z — this script
# uses 7-Zip if installed, otherwise downloads the small 7zr.exe helper once.
# Downloaded Magick/GS archives are verified against pinned SHA256 digests.

[CmdletBinding()]
param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$ImageMagickVersion = "7.1.2-27"
$GhostscriptVersion = "10.05.1"
$GhostscriptTag = "gs10051"

# SHA256 of the remote archives (not the extracted trees). Update when bumping versions.
$ImageMagickSha256 = "C7D6F13B3021DB5D2E23876D85F06D6039A9A345236F0D32CDB73886DDFE70ED"
$GhostscriptSha256 = "A0E49D912D21D8193FF0CB89EF741A47B21286FBB0A0E35DD0192B0097D35766"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$MagickDir = Join-Path $RepoRoot "src-tauri\sidecars\imagemagick"
$GsDir = Join-Path $RepoRoot "src-tauri\sidecars\ghostscript"
$TempRoot = Join-Path $env:TEMP "converte-facil-sidecars"
$ToolsDir = Join-Path $TempRoot "tools"

$MagickUrl = "https://github.com/ImageMagick/ImageMagick/releases/download/$ImageMagickVersion/ImageMagick-$ImageMagickVersion-portable-Q16-HDRI-x64.7z"
$GsUrl = "https://github.com/ArtifexSoftware/ghostpdl-downloads/releases/download/$GhostscriptTag/gs10051w64.exe"
$SevenZrUrl = "https://github.com/ip7z/7zip/releases/download/26.02/7zr.exe"
$SevenMsiUrl = "https://github.com/ip7z/7zip/releases/download/26.02/7z2602-x64.msi"

New-Item -ItemType Directory -Force -Path $MagickDir, $GsDir, $TempRoot, $ToolsDir | Out-Null

function Write-Info([string]$Message) {
  Write-Host $Message
}

function Assert-FileSha256([string]$Path, [string]$ExpectedSha256, [string]$Label) {
  $actual = (Get-FileHash -Path $Path -Algorithm SHA256).Hash.ToUpperInvariant()
  $expected = $ExpectedSha256.ToUpperInvariant()
  if ($actual -ne $expected) {
    throw @"
SHA256 mismatch for $Label.
  Expected: $expected
  Actual:   $actual
  File:     $Path

Refuse to unpack. If you intentionally bumped the download URL/version, update the
pinned digest in scripts/fetch-sidecars.ps1 and document it in docs/sidecars.md.
"@
  }
  Write-Info "SHA256 OK for $Label"
}

function Test-MagickPresent {
  Test-Path (Join-Path $MagickDir "magick.exe")
}

function Test-GhostscriptPresent {
  Test-Path (Join-Path $GsDir "gswin64c.exe")
}

function Clear-DirContents([string]$Dir) {
  Get-ChildItem -Force -Path $Dir |
    Where-Object { $_.Name -notin @("README.md", ".gitkeep") } |
    Remove-Item -Recurse -Force
}

function Get-SevenZipReduced {
  $local = Join-Path $ToolsDir "7zr.exe"
  if (-not (Test-Path $local)) {
    Write-Info "Downloading 7zr.exe helper..."
    Invoke-WebRequest -Uri $SevenZrUrl -OutFile $local
  }
  return $local
}

function Get-SevenZipFull {
  foreach ($candidate in @(
      (Get-Command "7z.exe" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source),
      "${env:ProgramFiles}\7-Zip\7z.exe",
      "${env:ProgramFiles(x86)}\7-Zip\7z.exe",
      (Join-Path $ToolsDir "7z-msi\Files\7-Zip\7z.exe")
    )) {
    if ($candidate -and (Test-Path $candidate)) { return $candidate }
  }

  # Full 7z.exe (with NSIS support). Administrative MSI extract needs no UAC.
  $msi = Join-Path $ToolsDir "7z.msi"
  $msiOut = Join-Path $ToolsDir "7z-msi"
  Write-Info "Downloading full 7-Zip (needed to unpack the Ghostscript NSIS installer)..."
  Invoke-WebRequest -Uri $SevenMsiUrl -OutFile $msi
  if (Test-Path $msiOut) { Remove-Item -Recurse -Force $msiOut }
  New-Item -ItemType Directory -Force -Path $msiOut | Out-Null
  $proc = Start-Process -FilePath "msiexec.exe" -ArgumentList @(
    "/a", "`"$msi`"", "/qn", "TARGETDIR=`"$msiOut`""
  ) -Wait -PassThru
  if ($proc.ExitCode -ne 0) {
    throw "msiexec failed to extract 7-Zip (exit $($proc.ExitCode))"
  }

  $sevenZ = Get-ChildItem -Path $msiOut -Recurse -Filter "7z.exe" | Select-Object -First 1
  if (-not $sevenZ) {
    throw "7z.exe not found after MSI extract."
  }
  return $sevenZ.FullName
}

function Expand-SevenZip([string]$Archive, [string]$Destination, [switch]$AllowNsis) {
  $sevenZip = if ($AllowNsis) { Get-SevenZipFull } else { Get-SevenZipReduced }
  New-Item -ItemType Directory -Force -Path $Destination | Out-Null
  & $sevenZip x -y "-o$Destination" $Archive | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "7-Zip extraction failed for $Archive (exit $LASTEXITCODE)"
  }
}

if ((Test-MagickPresent) -and -not $Force) {
  Write-Info "ImageMagick already present in $MagickDir (use -Force to re-download)."
} else {
  Write-Info "Downloading ImageMagick $ImageMagickVersion portable x64..."
  $magickArchive = Join-Path $TempRoot "imagemagick.7z"
  $magickExtract = Join-Path $TempRoot "imagemagick-extract"
  if (Test-Path $magickExtract) { Remove-Item -Recurse -Force $magickExtract }

  Invoke-WebRequest -Uri $MagickUrl -OutFile $magickArchive
  Assert-FileSha256 $magickArchive $ImageMagickSha256 "ImageMagick $ImageMagickVersion archive"
  Expand-SevenZip $magickArchive $magickExtract

  Clear-DirContents $MagickDir

  $magickExe = Get-ChildItem -Path $magickExtract -Recurse -Filter "magick.exe" | Select-Object -First 1
  if (-not $magickExe) {
    throw "magick.exe not found inside ImageMagick archive."
  }
  $sourceDir = $magickExe.Directory.FullName
  Copy-Item -Path (Join-Path $sourceDir "*") -Destination $MagickDir -Recurse -Force

  if (Test-Path (Join-Path $MagickDir "convert.exe")) {
    Remove-Item -Force (Join-Path $MagickDir "convert.exe")
    Write-Info "Removed convert.exe from sidecar (Windows System32 collision)."
  }

  Write-Info "ImageMagick installed to $MagickDir"
}

if ((Test-GhostscriptPresent) -and -not $Force) {
  Write-Info "Ghostscript already present in $GsDir (use -Force to re-download)."
} else {
  Write-Info "Downloading Ghostscript $GhostscriptVersion Windows package..."
  $gsInstaller = Join-Path $TempRoot "ghostscript-setup.exe"
  $gsExtract = Join-Path $TempRoot "ghostscript-extract"
  if (Test-Path $gsExtract) { Remove-Item -Recurse -Force $gsExtract }

  Invoke-WebRequest -Uri $GsUrl -OutFile $gsInstaller
  Assert-FileSha256 $gsInstaller $GhostscriptSha256 "Ghostscript $GhostscriptVersion installer"

  # Unpack the Windows installer payload with full 7za (NSIS). Avoids UAC.
  try {
    Expand-SevenZip $gsInstaller $gsExtract -AllowNsis
  } catch {
    throw @"
Failed to unpack Ghostscript installer: $($_.Exception.Message)

Manual fallback:
  1. Install Ghostscript $GhostscriptVersion from Artifex, or open gs10051w64.exe with 7-Zip
  2. Copy gswin64c.exe, gsdll64.dll, and Resource/ into:
     $GsDir
"@
  }

  $gsExe = Get-ChildItem -Path $gsExtract -Recurse -Filter "gswin64c.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $gsExe) {
    throw @"
gswin64c.exe not found after Ghostscript unpack.

Manual fallback:
  1. Install Ghostscript $GhostscriptVersion from Artifex (or unpack gs10051w64.exe with 7-Zip)
  2. Copy gswin64c.exe, gsdll64.dll, and Resource/ into:
     $GsDir
"@
  }

  Clear-DirContents $GsDir

  $binDir = $gsExe.Directory.FullName
  Copy-Item -Path (Join-Path $binDir "*") -Destination $GsDir -Recurse -Force

  $gsRoot = $gsExe.Directory.Parent
  if ($gsRoot) {
    foreach ($extra in @("Resource", "lib", "iccprofiles")) {
      $src = Join-Path $gsRoot.FullName $extra
      if (Test-Path $src) {
        Copy-Item -Path $src -Destination (Join-Path $GsDir $extra) -Recurse -Force
      }
    }
  }

  if (-not (Test-Path (Join-Path $GsDir "gswin64c.exe"))) {
    Copy-Item -Path $gsExe.FullName -Destination (Join-Path $GsDir "gswin64c.exe") -Force
  }

  Write-Info "Ghostscript installed to $GsDir"
}

Write-Info ""
Write-Info "Verify:"
Write-Info "  & `"$MagickDir\magick.exe`" -version"
Write-Info "  & `"$GsDir\gswin64c.exe`" -version"
Write-Info "Then run: npm run tauri:build"
