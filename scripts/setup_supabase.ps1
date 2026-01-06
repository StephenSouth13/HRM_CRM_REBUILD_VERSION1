#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Setup Supabase database schema via REST API (requires superuser/manager access)
.NOTES
  This script requires that you manually run the setup_supabase.sql in Supabase SQL Editor
  OR provide database credentials (not recommended for client-side)
#>

param(
  [string]$ProjectRef = "arpfgeyugjvubpbcfzgn",
  [string]$AnonKey = $env:VITE_SUPABASE_ANON_KEY
)

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "Supabase Schema Setup Helper" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "To set up your Supabase database schema:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Go to: https://app.supabase.com/project/$ProjectRef/sql/editor" -ForegroundColor Green
Write-Host ""
Write-Host "2. Open the file: scripts/setup_supabase.sql" -ForegroundColor Green
Write-Host ""
Write-Host "3. Copy the entire SQL content and paste it into the SQL Editor" -ForegroundColor Green
Write-Host ""
Write-Host "4. Click 'Run' to execute the setup" -ForegroundColor Green
Write-Host ""
Write-Host "5. Once complete, run the following to apply messaging migrations:" -ForegroundColor Yellow
Write-Host "   supabase db push" -ForegroundColor Cyan
Write-Host ""

# Read setup file and display it
$setupFile = "scripts/setup_supabase.sql"
if (Test-Path $setupFile) {
  $content = Get-Content $setupFile -Raw
  Write-Host "Setup SQL file size: $($content.Length) bytes" -ForegroundColor Green
  Write-Host ""
  Write-Host "Schema includes:" -ForegroundColor Yellow
  Write-Host "  • profiles" -ForegroundColor Gray
  Write-Host "  • user_roles" -ForegroundColor Gray
  Write-Host "  • teams & shifts" -ForegroundColor Gray
  Write-Host "  • leave_types & leave_requests" -ForegroundColor Gray
  Write-Host "  • attendance" -ForegroundColor Gray
  Write-Host "  • conversations & messages" -ForegroundColor Gray
  Write-Host "  • message_reactions & message_attachments" -ForegroundColor Gray
  Write-Host ""
} else {
  Write-Host "ERROR: $setupFile not found!" -ForegroundColor Red
  exit 1
}

Write-Host "After schema setup, messaging migrations in 'migrations/' will apply:" -ForegroundColor Yellow
Get-ChildItem -Path "migrations" -Filter "*messages*.sql" | ForEach-Object {
  Write-Host "  • $($_.Name)" -ForegroundColor Gray
}
