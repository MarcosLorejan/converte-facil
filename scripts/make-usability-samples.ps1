# Generate sample files for a usability session (see docs/usability-test.md)
#
# Creates, in the output folder:
#   foto-1.jpg, foto-2.png        Task A (image convert) and Task C (photos to PDF)
#   documento-3-paginas.pdf       Task B (PDF to images)
#   carta-teste.docx              Task D (Word to PDF)
#   planilha-teste.xlsx           Task D variant (Excel to PDF)
#
# Usage (repo root, PowerShell):
#   .\scripts\make-usability-samples.ps1
#   .\scripts\make-usability-samples.ps1 -OutDir "D:\sessao-03"
#
# Defaults to "converte-facil-teste" on the current user's Desktop, so the
# participant can find the files without being guided there. Re-running
# overwrites the samples in place, so each session starts from the same inputs.
#
# Needs no network and no LibreOffice: the PDF, DOCX, and XLSX are written as
# minimal valid files directly. Content is Portuguese because sessions are run
# with pt-BR participants.

[CmdletBinding()]
param(
  [string]$OutDir
)

$ErrorActionPreference = "Stop"

if (-not $OutDir) {
  $desktop = [Environment]::GetFolderPath("Desktop")
  if (-not $desktop) { throw "Could not resolve the Desktop folder. Pass -OutDir explicitly." }
  $OutDir = Join-Path $desktop "converte-facil-teste"
}

$out = $OutDir
New-Item -ItemType Directory -Force -Path $out | Out-Null

Add-Type -AssemblyName System.Drawing
$font = New-Object System.Drawing.Font "Segoe UI", 28

$bmp = New-Object System.Drawing.Bitmap 640, 400
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::FromArgb(230, 245, 240))
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(15, 107, 92))
$g.DrawString("Foto de teste 1", $font, $brush, 40, 160)
$g.Dispose()
$bmp.Save("$out\foto-1.jpg", [System.Drawing.Imaging.ImageFormat]::Jpeg)
$bmp.Dispose()

$bmp2 = New-Object System.Drawing.Bitmap 640, 400
$g2 = [System.Drawing.Graphics]::FromImage($bmp2)
$g2.Clear([System.Drawing.Color]::FromArgb(255, 248, 235))
$brush2 = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(122, 50, 24))
$g2.DrawString("Foto de teste 2", $font, $brush2, 40, 160)
$g2.Dispose()
$bmp2.Save("$out\foto-2.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp2.Dispose()

function PageContent([string]$text) {
  "BT /F1 24 Tf 72 700 Td ($text) Tj ET"
}
$contents = @(
  (PageContent "Pagina 1 - PDF de teste"),
  (PageContent "Pagina 2 - PDF de teste"),
  (PageContent "Pagina 3 - PDF de teste")
)

$parts = New-Object System.Collections.Generic.List[string]
[void]$parts.Add("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj")
[void]$parts.Add("2 0 obj<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>endobj")
[void]$parts.Add("6 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj")
for ($i = 0; $i -lt 3; $i++) {
  $pageObj = 3 + $i
  $contentObj = 7 + $i
  $stream = $contents[$i]
  [void]$parts.Add("$pageObj 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents $contentObj 0 R /Resources << /Font << /F1 6 0 R >> >> >>endobj")
  [void]$parts.Add("${contentObj} 0 obj<< /Length $($stream.Length) >>stream`n$stream`nendstream`nendobj")
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.Append("%PDF-1.4`n")
$offsets = New-Object System.Collections.Generic.List[int]
foreach ($obj in $parts) {
  [void]$offsets.Add($sb.Length)
  [void]$sb.Append($obj)
  if (-not $obj.EndsWith("`n")) { [void]$sb.Append("`n") }
}
$xrefPos = $sb.Length
[void]$sb.Append("xref`n0 $($offsets.Count + 1)`n0000000000 65535 f `n")
foreach ($off in $offsets) {
  [void]$sb.Append(("{0:D10} 00000 n `n" -f $off))
}
[void]$sb.Append("trailer<< /Size $($offsets.Count + 1) /Root 1 0 R >>`nstartxref`n$xrefPos`n%%EOF`n")
[System.IO.File]::WriteAllBytes("$out\documento-3-paginas.pdf", [System.Text.Encoding]::ASCII.GetBytes($sb.ToString()))

function Write-Utf8File([string]$path, [string]$content) {
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($path, $content, $utf8)
}

# DOCX
$docxDir = "$env:TEMP\cf-docx-build"
Remove-Item $docxDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path "$docxDir\word", "$docxDir\_rels" | Out-Null
Write-Utf8File "$docxDir\[Content_Types].xml" @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
'@
Write-Utf8File "$docxDir\_rels\.rels" @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
'@
Write-Utf8File "$docxDir\word\document.xml" @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Documento Word de teste para o Converte Facil.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Segunda linha - use Documents mode para virar PDF.</w:t></w:r></w:p>
  </w:body>
</w:document>
'@
$docxPath = "$out\carta-teste.docx"
if (Test-Path -LiteralPath $docxPath) { Remove-Item -LiteralPath $docxPath -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path -LiteralPath "$out\carta-teste.zip") { Remove-Item -LiteralPath "$out\carta-teste.zip" -Force }
[System.IO.Compression.ZipFile]::CreateFromDirectory($docxDir, "$out\carta-teste.zip")
Move-Item -LiteralPath "$out\carta-teste.zip" -Destination $docxPath -Force

# XLSX
$xlsxDir = "$env:TEMP\cf-xlsx-build"
Remove-Item $xlsxDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path "$xlsxDir\xl\worksheets", "$xlsxDir\xl\_rels", "$xlsxDir\_rels" | Out-Null
Write-Utf8File "$xlsxDir\[Content_Types].xml" @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>
'@
Write-Utf8File "$xlsxDir\_rels\.rels" @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>
'@
Write-Utf8File "$xlsxDir\xl\workbook.xml" @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Planilha1" sheetId="1" r:id="rId1"/></sheets>
</workbook>
'@
Write-Utf8File "$xlsxDir\xl\_rels\workbook.xml.rels" @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>
'@
Write-Utf8File "$xlsxDir\xl\worksheets\sheet1.xml" @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1"><c r="A1" t="inlineStr"><is><t>Item</t></is></c><c r="B1" t="inlineStr"><is><t>Qtd</t></is></c></row>
    <row r="2"><c r="A2" t="inlineStr"><is><t>Caneta</t></is></c><c r="B2"><v>3</v></c></row>
    <row r="3"><c r="A3" t="inlineStr"><is><t>Caderno</t></is></c><c r="B3"><v>2</v></c></row>
  </sheetData>
</worksheet>
'@
$xlsxPath = "$out\planilha-teste.xlsx"
if (Test-Path -LiteralPath $xlsxPath) { Remove-Item -LiteralPath $xlsxPath -Force }
if (Test-Path -LiteralPath "$out\planilha-teste.zip") { Remove-Item -LiteralPath "$out\planilha-teste.zip" -Force }
[System.IO.Compression.ZipFile]::CreateFromDirectory($xlsxDir, "$out\planilha-teste.zip")
Move-Item -LiteralPath "$out\planilha-teste.zip" -Destination $xlsxPath -Force

Get-ChildItem -LiteralPath $out | Format-Table Name, Length -AutoSize
Write-Output "OK $out"
