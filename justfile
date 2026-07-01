set shell := ["pwsh.exe", "-NoLogo", "-NoProfile", "-Command"]

default:
    task --list

bootstrap:
    pwsh -NoProfile -ExecutionPolicy Bypass -File bootstrap/install-tools.ps1

doctor:
    pwsh -NoProfile -ExecutionPolicy Bypass -File bootstrap/verify-tools.ps1

check:
    task check
