#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Execute setup SQL directly on Supabase via REST API
#>

param(
  [string]$ProjectRef = "arpfgeyugjvubpbcfzgn",
  [string]$ServiceRole = $env:SUPABASE_SERVICE_ROLE
)

# Read the setup SQL file
$setupFile = "scripts/setup_supabase.sql"
$sqlContent = Get-Content $setupFile -Raw

if (-not $ServiceRole) {
  Write-Host "ERROR: SUPABASE_SERVICE_ROLE environment variable not set!" -ForegroundColor Red
  Write-Host "Please ensure .env file contains SUPABASE_SERVICE_ROLE" -ForegroundColor Yellow
  exit 1
}

if (-not (Test-Path $setupFile)) {
  Write-Host "ERROR: $setupFile not found!" -ForegroundColor Red
  exit 1
}

Write-Host "Executing database setup via Supabase REST API..." -ForegroundColor Cyan
Write-Host "Project: $ProjectRef" -ForegroundColor Gray

# Use REST API to execute SQL
$url = "https://$ProjectRef.supabase.co/rest/v1/rpc/sql"

$headers = @{
  "apikey" = $ServiceRole
  "Authorization" = "Bearer $ServiceRole"
  "Content-Type" = "application/json"
}

# Build request payload
$payload = @{
  query = $sqlContent
} | ConvertTo-Json

Write-Host "Sending SQL payload ($($sqlContent.Length) bytes)..." -ForegroundColor Yellow

try {
  $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $payload
  Write-Host "SUCCESS: Schema created!" -ForegroundColor Green
  Write-Host ""
  Write-Host "Next: Apply messaging migrations" -ForegroundColor Cyan
  Write-Host "  supabase db push" -ForegroundColor Gray
}
catch {
  Write-Host "REST API attempt failed, trying direct psql approach..." -ForegroundColor Yellow
  $errMsg = $_.Exception.Message
  Write-Host "Error: $errMsg" -ForegroundColor Red
  exit 1
}
