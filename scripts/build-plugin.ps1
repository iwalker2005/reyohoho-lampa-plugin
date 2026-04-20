param(
  [switch]$CheckOnly
)

$root = Split-Path -Parent $PSScriptRoot
$srcDir = Join-Path $root 'src'
$srcBundle = Join-Path $srcDir 'lordfilm.js'
$srcReyoBundle = Join-Path $srcDir 'reyohoho.js'
$distBundle = Join-Path $root 'lordfilm.js'
$distReyoBundle = Join-Path $root 'reyohoho.js'

$parts = @(
  'core/utils.js',
  'core/network.js',
  'core/reyohoho_catalog.js',
  'providers/reyohoho.js',
  'providers/lordfilm.js',
  'providers/collaps.js',
  'providers/alloha.js',
  'providers/kodik.js',
  'providers/cdnvideohub.js',
  'providers/rezka.js',
  'providers/filmix.js',
  'providers/kinobase.js',
  'core/providers.js',
  'index.js'
)

$resolved = @()
foreach ($part in $parts) {
  $file = Join-Path $srcDir $part
  if (-not (Test-Path $file)) {
    throw "Missing source module: $file"
  }
  $resolved += $file
}

$temp = Join-Path $env:TEMP ('lordfilm-agg-build-' + [Guid]::NewGuid().ToString() + '.js')

try {
  $content = @()
  foreach ($file in $resolved) {
    $content += "// ---- $([IO.Path]::GetFileName($file)) ----"
    $content += (Get-Content -Raw $file)
    $content += ""
  }
  Set-Content -Path $temp -Value ($content -join [Environment]::NewLine) -NoNewline

  if ($CheckOnly) {
    if (-not (Test-Path $srcBundle) -or -not (Test-Path $distBundle) -or -not (Test-Path $srcReyoBundle) -or -not (Test-Path $distReyoBundle)) {
      Write-Error 'Bundle files are missing'
      exit 1
    }

    $tmpHash = (Get-FileHash -Algorithm SHA256 $temp).Hash
    $srcHash = (Get-FileHash -Algorithm SHA256 $srcBundle).Hash
    $distHash = (Get-FileHash -Algorithm SHA256 $distBundle).Hash
    $srcReyoHash = (Get-FileHash -Algorithm SHA256 $srcReyoBundle).Hash
    $distReyoHash = (Get-FileHash -Algorithm SHA256 $distReyoBundle).Hash

    if ($tmpHash -ne $srcHash -or $tmpHash -ne $distHash -or $tmpHash -ne $srcReyoHash -or $tmpHash -ne $distReyoHash) {
      Write-Error 'Bundle is out of date. Run scripts/build-plugin.ps1'
      exit 1
    }

    Write-Output 'OK: bundle is up to date'
    exit 0
  }

  Copy-Item -Force $temp $srcBundle
  Copy-Item -Force $temp $srcReyoBundle
  Copy-Item -Force $temp $distBundle
  Copy-Item -Force $temp $distReyoBundle
  Write-Output 'Bundled: src/* -> src/lordfilm.js + lordfilm.js + src/reyohoho.js + reyohoho.js'
}
finally {
  if (Test-Path $temp) { Remove-Item -Force $temp }
}
