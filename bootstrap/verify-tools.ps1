# Verify local tooling expected by Hangar agents and deployment workflows.
#Requires -Version 7.0
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "refresh-windows-path.ps1")
Update-BootstrapPath

$requiredCommands = @(
    "git",
    "node",
    "npm",
    "pwsh",
    "task",
    "gh",
    "kubectl",
    "gitleaks"
)

$missingCommands = @()
foreach ($cmd in $requiredCommands) {
    $found = Get-Command $cmd -ErrorAction SilentlyContinue
    if ($found) {
        Write-Host "OK: $cmd -> $($found.Source)" -ForegroundColor Green
    } else {
        Write-Host "MISSING: $cmd" -ForegroundColor Red
        $missingCommands += $cmd
    }
}

if ($missingCommands.Count -gt 0) {
    throw "Missing required command(s): $($missingCommands -join ', ')"
}
