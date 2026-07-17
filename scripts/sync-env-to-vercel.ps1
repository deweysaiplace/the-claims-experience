<#
.SYNOPSIS
  Push .env.local into Vercel so the two stop drifting apart.

.DESCRIPTION
  Every environment bug in this project came from the same shape of problem:
  a value that was right in one place and wrong or missing in the other.
  APP_PIN existed nowhere. The Grok key was updated locally but not in Vercel.
  The Gmail app password was pasted with spaces into both, then fixed in only one.

  This reads .env.local and mirrors it to Vercel. Values are never printed, and
  they are piped to stdin rather than passed as arguments, so they stay out of
  your shell history and the process list.

  NOTE: keep this file ASCII-only. Windows PowerShell 5.1 reads .ps1 as
  Windows-1252 unless the file has a UTF-8 BOM, so smart quotes and dashes
  become mojibake and break the parser.

.PARAMETER Target
  production (default), preview, or development.

.PARAMETER Only
  Sync just these keys. Omit to sync everything in the file.

.PARAMETER DryRun
  Show what would change without touching Vercel.

.EXAMPLE
  .\scripts\sync-env-to-vercel.ps1 -DryRun
  .\scripts\sync-env-to-vercel.ps1
  .\scripts\sync-env-to-vercel.ps1 -Only GMAIL_APP_PASSWORD,GROK_API_KEY
#>
param(
  [string]$EnvFile = ".env.local",
  [ValidateSet("production", "preview", "development")]
  [string]$Target = "production",
  [string[]]$Only = @(),
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $EnvFile)) {
  Write-Error "$EnvFile not found. Run this from the project root."
  exit 1
}

# PowerShell's >> and Out-File default to UTF-16, which silently corrupted this
# very file once. Next.js reads UTF-8, so everything after the append point
# loaded as undefined with no error at all. Catch it here, not at 2am.
$resolved = (Resolve-Path $EnvFile).Path
$bytes = [System.IO.File]::ReadAllBytes($resolved)
if ($bytes -contains 0) {
  Write-Error "$EnvFile contains NUL bytes, so it is UTF-16, not UTF-8. Next.js cannot read it. Rewrite it as UTF-8 before syncing."
  exit 1
}

$pairs = [ordered]@{}
$lineNo = 0
$pattern = '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$'

foreach ($line in (Get-Content $EnvFile -Encoding utf8)) {
  $lineNo++
  if ($line -match '^\s*$') { continue }
  if ($line -match '^\s*#') { continue }

  if ($line -notmatch $pattern) {
    Write-Warning "Line ${lineNo}: no KEY= prefix, skipping. (A bare value on its own line is how the Grok key silently stayed on the old one.)"
    continue
  }

  $key = $Matches[1]
  $value = $Matches[2].Trim('"').Trim("'")

  if ($Only.Count -gt 0 -and $Only -notcontains $key) { continue }
  $pairs[$key] = $value
}

if ($pairs.Count -eq 0) {
  Write-Error "Nothing to sync."
  exit 1
}

Write-Host ""
Write-Host "Syncing $($pairs.Count) key(s) from $EnvFile to Vercel [$Target]" -ForegroundColor Cyan
Write-Host ""

# Flag values that look wrong before pushing them. Values are never printed.
$warned = $false
foreach ($key in $pairs.Keys) {
  $v = $pairs[$key]

  if ($v.Length -eq 0) {
    Write-Warning "$key is empty."
    $warned = $true
  }
  if ($v -match '\s') {
    Write-Warning "$key contains a space. Gmail app passwords are 16 chars with no spaces; Google only displays them in groups of four."
    $warned = $true
  }
  if ($key -eq 'APP_PIN' -and $v -notmatch '^\d{6}$') {
    Write-Warning "APP_PIN should be exactly 6 digits. The login page has six inputs and only submits when all six are filled."
    $warned = $true
  }

  Write-Host ("  {0,-30} {1,3} chars" -f $key, $v.Length)
}

if ($DryRun) {
  Write-Host ""
  Write-Host "-DryRun: nothing was changed." -ForegroundColor Yellow
  exit 0
}

if ($warned) {
  Write-Host ""
  $go = Read-Host "Warnings above. Continue anyway? (y/N)"
  if ($go -ne 'y') {
    Write-Host "Aborted."
    exit 0
  }
}

Write-Host ""
foreach ($key in $pairs.Keys) {
  Write-Host ("  {0,-30} " -f $key) -NoNewline

  # rm first: `vercel env add` on an existing key fails rather than replacing it.
  # A missing key makes this fail harmlessly, so swallow the error.
  try { npx vercel env rm $key $Target --yes 2>&1 | Out-Null } catch { }

  # Pipe to stdin so the value never lands in a command line or process list.
  $pairs[$key] | npx vercel env add $key $Target 2>&1 | Out-Null

  if ($LASTEXITCODE -eq 0) {
    Write-Host "ok" -ForegroundColor Green
  } else {
    Write-Host "FAILED" -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "Done. Env changes need a redeploy to take effect:" -ForegroundColor Cyan
Write-Host "  npx vercel --prod" -ForegroundColor White
