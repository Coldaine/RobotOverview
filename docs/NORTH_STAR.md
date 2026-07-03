---
title: Hangar North Star
date: 2026-05-31
author: Patrick MacLyman
status: living
last_confirmed: 2026-07-01
---

# Hangar North Star

## Why This Exists

- Knowledge and gear are scattered across chats and devices, and chats are not taggable, so what I own, what it is doing, what to buy next, and what I have learned all live in fragments.
- I want one home for all my physical tech and hobbies that is at once an inventory, a wiki, and a pricing and want list.
- It should feel like the hangar of a base-builder game: acquire parts, build out units, deploy them on missions, so that maintaining it is something I want to do, not a chore.
- The Beast is the first of several units; the system should expect a growing fleet that eventually spans robotics, compute, network, home systems, and audio.

## Goals

Directional, not testable.

- **G1.** Keep one current picture of the fleet across inventory, wiki, and want list, so nothing important lives only in a chat log.
- **G2.** Make adding and maintaining entries cheap enough that an LLM does most of it and I curate.
- **G3.** Make the experience fun enough to sustain, modeled on a base-builder hangar.
- **G4.** Show what to acquire next and why (an upgrade path), and what I already own and where it sits.
- **G5.** Capture lessons learned so knowledge is retrievable by unit and mission, not lost to chat history.
- **G6.** Design primarily for desktop, widescreen, and ultrawide use. Phone layouts must not break or become unusable, but mobile support must not compromise the desktop command-center experience.

## Anti-Goals

- **AG1.** Not a flat inventory list. It refuses to be a catalog of disconnected possessions; the reason it exists is the connected model where units, missions, and lessons relate to one another.
- **AG2.** Not an *autonomous* system. The Hangar SHOULD host a live portal to a running unit — telemetry, video, and supervised teleop controls in the app itself (decided 2026-07-02) — but a human stays in the loop for every action it surfaces. It never operates the systems it catalogs unattended or autonomously. Operating detail for a unit lives in its runbook (see `docs/beast-ops.md`), not here.
- **AG3.** Undercroft, and any mission, is content inside the system, never the system's identity.

## Pillars

**The substance is content; the spine is data, not UI.** I accept a less flashy build in exchange for something cheap to maintain and extend, because at the end of the day this is information, notes, and a want list. The reasonable opposite, leading with the visualization, looks impressive but makes the thing expensive to build and brittle as it grows.

**The presentation is load-bearing, not decoration.** I accept spending real effort on the hangar feel, because an inventory no one enjoys maintaining goes stale, and a stale inventory is worthless. The reasonable opposite, a plain asset tracker, is cheaper to build and dies from neglect.

**Do not prescribe before populating.** I accept structural ambiguity now in exchange for a shape that fits real content, because the schema should emerge as entries go in. The reasonable opposite, designing the full structure up front, feels rigorous but has repeatedly drifted across my projects and wastes effort on guesses.

**The LLM populates; I own.** I accept rougher, machine-drafted entries in exchange for low enough activation energy that the thing actually gets populated. The reasonable opposite, hand-authoring everything, yields cleaner entries but reintroduces the friction that kills personal knowledge bases.

## Resolved Questions

- **In what form is the content stored?** In a strict data spine for topology (Units socketed into Loadout Slots, Mission Requisitions) with room for flexible, localized metadata (power budgets, pricing, specs). `src/data/hangar.ts` bootstraps that model and remains the authoring surface; Postgres follows it (current read-path truth lives in `src/server/hangar/`, deployment truth in `docs/deploy.md`).
- **What is the model for what I own and its state?** Inventory is tracked as `Units`. Assembly is modeled via grouped `Loadout Slots` (e.g. Chassis Mounts, Driver Board Interfaces), allowing any unit to act as a parent chassis that other units plug into, replicating a base-builder upgrade tree.
- **Where does it live (hosting)?** `hangar.moosegoose.xyz` on the personal Kubernetes cluster (`coldaine-k8cluster` owns runtime manifests; see `docs/deploy.md`). Content authored in this repo ships inside the image on every deploy.

## Open Questions

- How does population actually work, given it is mostly LLM-driven: what is the intake from a chat or a research run into an entry?
- How do I add to the want list and turn it into an upgrade plan that says what to buy next?
