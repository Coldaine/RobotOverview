# Install/verify local workstation tooling for Hangar agents and deploy-adjacent work.
# This intentionally does not install or run Docker/Podman/container tooling.
#Requires -Version 7.0
[CmdletBinding()]
param(
    [switch]$VerifyOnly,
    [switch]$SkipProjectDependencies
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "refresh-windows-path.ps1")
Update-BootstrapPath

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$packages = @(
    @{ Command = "git"; Id = "Git.Git" },
    @{ Command = "gh"; Id = "GitHub.cli" },
    @{ Command = "kubectl"; Id = "Kubernetes.kubectl" },
    @{ Command = "task"; Id = "Task.Task" },
    @{ Command = "gitleaks"; Id = "Gitleaks.Gitleaks" }
)

function Install-WingetPackageIfMissing([string]$Command, [string]$PackageId) {
    if (Get-Command $Command -ErrorAction SilentlyContinue) {
        Write-Host "OK: $Command already installed." -ForegroundColor Green
        return
    }

    if (-not $IsWindows) {
        throw "$Command is missing. Automatic install is only wired for Windows; install package '$PackageId' with your OS package manager."
    }

    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "$Command is missing and winget is not available to install '$PackageId'."
    }

    Write-Host "Installing $PackageId for missing command '$Command'..." -ForegroundColor Cyan
    winget install --id $PackageId --silent --accept-source-agreements --accept-package-agreements
    Update-BootstrapPath

    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
        throw "Installed '$PackageId', but '$Command' is still not visible on PATH."
    }
}

if (-not $VerifyOnly) {
    foreach ($pkg in $packages) {
        Install-WingetPackageIfMissing -Command $pkg.Command -PackageId $pkg.Id
    }

    if (-not $SkipProjectDependencies) {
        Push-Location $repoRoot
        try {
            if (-not (Test-Path "node_modules")) {
                Write-Host "Installing project dependencies with npm ci..." -ForegroundColor Cyan
                npm ci
            } else {
                Write-Host "OK: node_modules already present." -ForegroundColor Green
            }
        } finally {
            Pop-Location
        }
    }
}

& (Join-Path $PSScriptRoot "verify-tools.ps1")
