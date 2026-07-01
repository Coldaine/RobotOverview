# Refresh process PATH from Windows Machine/User env plus common WinGet install locations.
# No-op on non-Windows so bootstrap helpers remain safe under pwsh on Linux/macOS.
function Update-BootstrapPath {
    if (-not $IsWindows) {
        return
    }

    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $extraPaths = @(
        (Join-Path $env:USERPROFILE "bin"),
        (Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links"),
        "C:\Program Files\GitHub CLI",
        "C:\Program Files\Git\cmd",
        "C:\Program Files\nodejs"
    ) | Where-Object { $_ -and (Test-Path $_) }

    $env:Path = (@($machinePath, $userPath, $env:Path) + $extraPaths) -join ";"
}
