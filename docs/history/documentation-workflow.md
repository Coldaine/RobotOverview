---
title: Hangar Documentation Workflow
audience: AI agents and operators updating RobotOverview docs
status: historical
last_updated: 2026-07-07
---

# Hangar Documentation Workflow

> Historical/superseded. The current workflow lives directly in `AGENTS.md` under
> "Documentation workflow." Keep this file only as evidence of the older, more detailed
> documentation process.

## Goal

Keep current state from spreading everywhere. A status change should update the one document that
owns that status, then add only short summaries and links where another document needs context.

RobotOverview does not currently have a central `STATUS.md` or `PROGRESS.md`. Status is distributed
by subsystem owner: data state in `docs/components/data-backend.md`, deployment state in
`docs/deploy/deployment.md`, schema/seed proof in `db/hangar/standup.md`, and active migration plans
in their plan documents. Add a central status/progress doc only as an explicit project decision.

## Mandatory Read

Read this workflow before any documentation update, including small edits. For typo-only or formatting-only
changes, the full workflow may reduce to "confirmed no ownership or status impact," but the role map still
applies.

Use the full workflow before:

- moving or consolidating docs;
- updating status after code, cluster, deploy, schema, seed, or runtime behavior changes;
- reconciling RobotOverview docs with another repo such as `coldaine-k8cluster`;
- touching a doc that already says "source of truth," "current direction," "status," "superseded,"
  or "last confirmed."

## Role Map

| Document | Owns | Does not own |
|---|---|---|
| `AGENTS.md` | Agent routing, hard working rules, command list, durable invariants | Detailed project status, implementation walkthroughs, historical evidence |
| `docs/NORTH_STAR.md` | Intent, goals, anti-goals, product philosophy | Implementation progress, provider details, deployment mechanics |
| `docs/USABILITY_WORKFLOWS.md` | Primary UI journeys, usability regression expectations, navigation workflow guardrails | Implementation details, feature backlog, runtime/deploy status |
| `docs/architecture.md` | Durable approach, rationale, system boundaries | Current cutover status, command procedures, provider catalogs |
| `docs/components/data-backend.md` | Data-model current state, `hangar.ts` fallback/cutover status, schema/seed, Hangar DB target summary | Next.js runtime behavior beyond the data boundary, cluster provisioning truth |
| `docs/components/web-app.md` | Next.js server/runtime behavior, app-side DB config, credential boundaries, routes/actions/caching | Full schema shape, cluster ownership, deployment mechanism |
| `docs/components/connected-twin.md` | BEAST twin/wiring model and how it extends the data spine | BEAST operating procedure, bulk archive contents, cluster provisioning |
| `docs/components/bootstrap.md` | Local tooling setup, command-surface boundaries, bootstrap profiles, postinstall behavior | Product intent, deployment status, app runtime/data behavior |
| `docs/deploy/deployment.md` | Live deployment status and current deployment direction | Service identity rationale, detailed app schema, old GitOps mechanics |
| `docs/deploy/hangar-service-boundary.md` | Stable service boundary, subdomain choice, cross-repo ownership | Live deployment mechanism details, superseded pipeline steps |
| `docs/deploy/storage-and-twin-pivot-plan.md` | Open migration plan for object storage and twin pivot | Normative architecture after the plan is complete |
| `db/hangar/standup.md` | Schema/seed verification commands, rebuild proof, operator cautions | Product intent, broad app architecture |
| `docs/beast-ops.md` | BEAST operation and safety runbook | App architecture, database status |
| `docs/reference/ugv-beast-source-archive.md` | Curated source-archive digest and provenance | Bulk source files, live app status |
| `docs/history/` | Superseded evidence and review artifacts | Current truth unless another current doc explicitly points to one fact |

## Update Workflow

1. **Classify the change.** Decide whether it is intent, architecture, current status, subsystem reference, runbook procedure, migration plan, or historical evidence.
2. **Pick the owner before editing.** Use the role map above. If the change has two jobs, split it.
3. **Update the owner first.** Put the full fact, status, or procedure in the owning document.
4. **Update dependents lightly.** Other docs may get a one-line summary plus a link. Do not copy the full status paragraph.
5. **Resolve conflicts immediately.** If two docs disagree, nominate the owner, update it, and reduce the other doc to a summary/link or mark it historical.
6. **Check for drift.** Search for repeated status phrases before finishing, especially `hangar.ts`, `pg18`, `Shipwright`, `superseded`, `current state`, and `source of truth`.
7. **Validate the edit.** Run `git diff --check`. Run code checks only when code, generated data, or executable docs changed.

## PR Template Purpose

The pull request template is a behavioral checkpoint, not just a formatting artifact. Required
questions make agents rehearse the work they are most likely to forget: reviewing the whole branch,
considering whether the PR should be split, accounting for independent/subagent review, documenting
docs updates, checking superseded guidance, and recording validation. A valid answer can be "not
needed for this narrow change," but the decision must be explicit.

## Status Ownership Examples

| Change | Update here first | Only summarize/link from |
|---|---|---|
| DB schema, seed, `hangar.ts` fallback, or read-cutover status changes | `docs/components/data-backend.md`; `db/hangar/standup.md` if commands/proof changed | `AGENTS.md`, `docs/NORTH_STAR.md`, `docs/architecture.md` |
| Primary navigation, workflow, or usability expectations change | `docs/USABILITY_WORKFLOWS.md`; component/page docs only if implementation details changed | `AGENTS.md`, `docs/architecture.md` |
| Next.js route, Server Component, runtime config, or credential behavior changes | `docs/components/web-app.md` | `docs/architecture.md`, `docs/components/data-backend.md` |
| Local command surface, bootstrap profile, postinstall, or workstation-tooling changes | `docs/components/bootstrap.md`; `AGENTS.md` only for short routing/command summaries | `docs/architecture.md`, `docs/deploy/deployment.md` |
| Cluster provisioning, role/secret, connection registry, backup, or restore status changes | `coldaine-k8cluster`; summarize the app-facing impact in `docs/components/data-backend.md` or `docs/deploy/deployment.md` | `AGENTS.md`, `docs/NORTH_STAR.md`, `docs/architecture.md` |
| Deployment pipeline direction or live deploy status changes | `docs/deploy/deployment.md` | `docs/architecture.md`, `docs/deploy/hangar-service-boundary.md` |
| Stable service/subdomain/cross-repo boundary changes | `docs/deploy/hangar-service-boundary.md` | `docs/deploy/deployment.md` |
| Object storage or twin migration plan changes | `docs/deploy/storage-and-twin-pivot-plan.md` until implemented, then move durable results to the owning component/deploy doc | `docs/architecture.md`, `docs/components/connected-twin.md` |
| BEAST operating steps or safety constraints change | `docs/beast-ops.md` | `docs/components/connected-twin.md` |
| BEAST source archive findings change | `docs/reference/ugv-beast-source-archive.md` | `docs/deploy/storage-and-twin-pivot-plan.md`, `docs/components/connected-twin.md` |

## Ambiguity Rules

- **Current state vs durable decision:** current state is what is true on a date or branch; durable decisions explain why the system is shaped that way. Put state in component/deploy docs, and decisions in North Star or architecture.
- **RobotOverview vs cluster truth:** RobotOverview can summarize the Hangar app's DB target, schema, and runtime expectations. `coldaine-k8cluster` owns Kubernetes provisioning, roles/secrets, backups, restore gates, and connection registry truth.
- **Plan vs architecture:** a plan is not normative architecture until implemented and accepted. When a plan lands, move the durable result into the owning component/deploy doc and mark the plan complete or historical.
- **History vs current truth:** `docs/history/` preserves evidence. If historical body text says "source of truth," prefer its frontmatter and any current doc that supersedes it.
- **Archive/vendor markdown:** exclude `node_modules/`, generated dependency docs, and bulk archive material from normal RobotOverview documentation audits. Use only curated repo docs such as `docs/reference/ugv-beast-source-archive.md`.
- **Frontmatter dates:** update `last_updated` or `last_confirmed` only for files whose content you actually reviewed or changed.

## Quick Checks

Before committing a docs-ownership change, run:

```powershell
rg -n "current state|source of truth|hangar.ts|pg18|Shipwright|superseded" AGENTS.md docs db\hangar
git diff --check
```

The search is not a failure by itself. It is a prompt to confirm that repeated wording is intentional
and that the owning document carries the full detail.
