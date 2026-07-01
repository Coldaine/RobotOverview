set shell := ["pwsh.exe", "-NoLogo", "-NoProfile", "-Command"]

# Optional sugar only. Taskfile.yml is the canonical agent/operator command surface.

default:
    task --list

bootstrap:
    task bootstrap:core

bootstrap-tools:
    task bootstrap:tools

doctor:
    task bootstrap:verify-tools

check:
    task check
