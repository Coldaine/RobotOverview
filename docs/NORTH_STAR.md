---
title: Hangar North Star
date: 2026-05-31
author: Patrick MacLyman
status: living
last_confirmed: 2026-07-27
---

# Hangar North Star

## Why This Exists

- Knowledge and gear are scattered across chats and devices, and chats are not taggable, so what I own, what it is doing, what to buy next, and what I have learned all live in fragments.
- I want one home for all my physical tech and hobbies that is at once an inventory, a wiki, and a pricing and want list.
- It should feel like the hangar of a base-builder game: acquire parts, build out units, deploy them on missions, so that maintaining it is something I want to do, not a chore.
- The Beast is the first of several units; the system should expect a growing fleet that eventually spans robotics, compute, network, home systems, and audio.

## Goals

Directional, not testable. Each one should change a decision; if it only describes a feature,
it does not belong here.

- **G1. A fact is written once.** One current picture of the fleet, and nothing important living
  only in a chat log. When a fact would have to be written in two places to stay true, that is the
  signal to change the structure — not to write it twice.
- **G2. The LLM populates; I own.** Accept rougher machine-drafted entries in exchange for
  activation energy low enough that the thing actually gets populated. Hand-authoring everything
  yields cleaner entries and reintroduces the friction that kills personal knowledge bases.
- **G3. Make it worth maintaining.** Modeled on a base-builder hangar, because an inventory nobody
  enjoys maintaining goes stale and a stale inventory is worthless. Presentation is load-bearing,
  not decoration.
- **G4. Work that does not reach the screen is not finished.** Data models, tooling, and docs exist
  to serve what is visible. A change that improves only the repo is unfinished work, not done work.
- **G5. Let structure follow content.** The schema emerges as entries go in; designing it up front
  feels rigorous and has repeatedly drifted. Bounded by G1 — deferral ends the moment ambiguity
  would force a fact into two places.
- **G6.** Design primarily for desktop, widescreen, and ultrawide use. Phone layouts must not break or become unusable, but mobile support must not compromise the desktop command-center experience.
- **G7.** Host a live command portal to running units — telemetry, video, teleop, and autonomous / learned policies. Autonomy is in scope. Safety reflexes (watchdog, e-stop, motor PID) stay on the robot; operating detail lives in each unit's runbook (see `docs/beast-ops.md`), not here.

## Anti-Goals

- **AG1.** Not a flat inventory list. It refuses to be a catalog of disconnected possessions; the reason it exists is the connected model where units, missions, and lessons relate to one another.
- **AG2.** Undercroft, and any mission, is content inside the system, never the system's identity.

## Open Questions

- How does population actually work, given it is mostly LLM-driven: what is the intake from a chat or a research run into an entry?
- How do I add to the want list and turn it into an upgrade plan that says what to buy next?
