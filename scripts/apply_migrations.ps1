param(
  [string]$DatabaseUrl = $env:DATABASE_URL
)

if (-not $DatabaseUrl) {
  Write-Error "Please set the DATABASE_URL environment variable or pass -DatabaseUrl '<connection_string>'"
  exit 1
}

$migrationsPath = Join-Path $PSScriptRoot "..\migrations"
$files = Get-ChildItem -Path $migrationsPath -Filter '*.sql' | Sort-Object Name

foreach ($file in $files) {
  Write-Host "Applying $($file.Name)..."
  & psql $DatabaseUrl -f $file.FullName
  if ($LASTEXITCODE -ne 0) {
    Write-Error "psql failed applying $($file.Name)"
    exit $LASTEXITCODE
  }
}

Write-Host "All migrations applied successfully."
