---
title: Bootstrap And Command Surface
audience: AI agents and operators setting up or running RobotOverview locally
status: historical
last_updated: 2026-07-01
---

# Bootstrap And Command Surface

> This document owns RobotOverview local tooling setup, command surface boundaries, and
> postinstall behavior. `AGENTS.md` should route here instead of carrying detailed bootstrap
> policy.

## Command Ownership

RobotOverview uses three command layers:

| Layer | Owns | Notes |
|---|---|---|
| `npm` scripts | App/package commands (`dev`, `build`, `lint`, `test`, `check`) and explicit bootstrap escape hatches | Use these when the command is naturally tied to `package.json` or CI. |
| `Taskfile.yml` | Agent/operator workflow entrypoint | Prefer `task` for setup, verification, and repeated operator flows. |
| `justfile` | Optional local sugar | It delegates to `task`; do not add new canonical behavior here. |

Do not run Docker, Podman, or local containerized services on `icarus-laptop`. Any command that needs
container infrastructure belongs on remote infrastructure or the Kubernetes path documented in the
deploy docs.

## Bootstrap Profiles

The bootstrap scripts are profile-based so agents can verify or install only the tooling needed for a
task:

| Profile | Commands verified | Install task | Verify task |
|---|---|---|---|
| `core` | `git`, `node`, `npm`, `pwsh`, `task` | `task bootstrap:core` | `task bootstrap:verify-core` |
| `dev` | `gh`, `gitleaks` | `task bootstrap:dev` | `task bootstrap:verify-dev` |
| `deploy` | `kubectl` | `task bootstrap:deploy` | `task bootstrap:verify-deploy` |
| `all` | all profiles | `task bootstrap:tools` | `task bootstrap:verify-tools` |

`bootstrap/install-tools.ps1` installs missing Windows packages through WinGet where wired, then
delegates to `bootstrap/verify-tools.ps1`. `bootstrap/verify-tools.ps1` only checks command
availability.

## Postinstall Behavior

`npm install` runs `tools/postinstall-bootstrap.mjs`, but that script is intentionally light:

- it exits without action in CI, on non-Windows hosts, or when `HANGAR_SKIP_BOOTSTRAP=1`;
- it verifies only the `core` profile;
- it does not install workstation tools implicitly;
- when core tooling is missing, it prints the explicit repair commands instead of mutating the
  workstation.

Use `task bootstrap:core` or `task bootstrap:tools` when an explicit install/repair is wanted.

## Project Dependencies

`task bootstrap:core` and `task bootstrap:tools` may run `npm ci` when `node_modules` is absent.
Profile-specific dev/deploy setup skips project dependency installation because those profiles are
about external CLIs, not package dependencies.

## Change Rules

- Add new recurring operator workflows to `Taskfile.yml` first.
- Add package-bound app commands to `package.json`.
- Keep `justfile` as thin aliases only.
- Keep postinstall verify-only unless there is an explicit project decision to make installs
  automatic again.
- Update this document when changing bootstrap profiles, postinstall behavior, or command ownership.
