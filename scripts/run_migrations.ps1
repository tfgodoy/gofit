# Run SQL migrations in supabase/migrations in alphabetical order
# Usage: pwsh ./scripts/run_migrations.ps1
# Requires: `psql` in PATH or provide `DATABASE_URL` and psql available

param(
  [string]$DatabaseUrl = $env:DATABASE_URL
)

function Build-ConnStringFromEnv {
  $host = $env:PGHOST
  $port = $env:PGPORT
  $user = $env:PGUSER
  $pass = $env:PGPASSWORD
  $db = $env:PGDATABASE

  if (-not $host -or -not $user -or -not $db) { return $null }
  if (-not $port) { $port = 5432 }
  if ($pass) {
    return "postgresql://$($user):$($pass)@$($host):$($port)/$($db)"
  }
  else {
    return "postgresql://$($user)@$($host):$($port)/$($db)"
  }
}

if (-not $DatabaseUrl) {
  $DatabaseUrl = Build-ConnStringFromEnv
}

if (-not $DatabaseUrl) {
  Write-Error "DATABASE_URL or PGHOST/PGUSER/PGDATABASE (and optional PGPASSWORD/PGPORT) must be set."
  exit 2
}

# Ensure psql exists
$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
  Write-Error "psql not found in PATH. Install PostgreSQL client or use Docker."
  exit 3
}

$migrationsDir = Join-Path $PSScriptRoot "..\supabase\migrations"
$migrations = Get-ChildItem -Path $migrationsDir -Filter "*.sql" | Sort-Object Name

if ($migrations.Count -eq 0) {
  Write-Host "No migration files found in $migrationsDir"
  exit 0
}

foreach ($m in $migrations) {
  Write-Host "Applying $($m.Name) ..."
  & psql $DatabaseUrl -v ON_ERROR_STOP=1 -f $m.FullName
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Migration $($m.Name) failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
  }
}

Write-Host "All migrations applied successfully."