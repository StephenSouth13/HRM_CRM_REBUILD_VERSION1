#!/usr/bin/env pwsh

# Auto-push migrations by simulating "Y" response
Write-Host "Starting migration push..." -ForegroundColor Green

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "supabase"
$psi.Arguments = "db push"
$psi.UseShellExecute = $false
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true

$process = [System.Diagnostics.Process]::Start($psi)

# Send "Y\n" to stdin after a short delay (wait for prompt)
Start-Sleep -Milliseconds 500
$process.StandardInput.WriteLine("Y")
$process.StandardInput.Flush()
$process.StandardInput.Close()

# Read output
$output = $process.StandardOutput.ReadToEnd()
$error = $process.StandardError.ReadToEnd()

$process.WaitForExit()
$exitCode = $process.ExitCode

Write-Host "`n=== STDOUT ===" -ForegroundColor Yellow
Write-Host $output

if ($error) {
    Write-Host "`n=== STDERR ===" -ForegroundColor Red
    Write-Host $error
}

if ($exitCode -eq 0) {
    Write-Host "`nMigrations pushed successfully!" -ForegroundColor Green
}
else {
    Write-Host "`nMigration push failed with exit code: $exitCode" -ForegroundColor Red
}

exit $exitCode
