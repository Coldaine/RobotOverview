---
title: Item Inventory Data Model
date: 2026-06-16
author: Patrick MacLyman
status: drafted
last_confirmed: 2026-06-16
---

# Item Inventory Data Model

## Objective

Add a neutral item-inventory concept to the Hangar without turning the current alpha into a generic CRUD app.

The immediate use case is the GL.iNet Kickstarter pledge:

- Comet Q (`GL-RMQ1`)
- Comet X (`GL-RM4PE`)
- LWR02 wireless presence sensor

These are not quite units, not just wishlist entries, and not merely insights. They are products or possessions with rich descriptions, specs, limitations, acquisition state, and source evidence.

## Current Fit

The current system already has these concepts:

- `Unit`: assembled or meaningful systems, such as BEAST-01, CORE-PRIME, Home Assistant, and network gear.
- `WishlistItem`: buying decisions and upgrade-path candidates.
- `Insight`: reusable lessons, decisions, and research findings.
- `Mission`: jobs that use units, capabilities, wishlist items, and insights.

The missing concept is `InventoryItem`: a product, part, sensor, KVM, add-on, accessory, or standalone possession that may later become part of a unit, satisfy a mission requirement, unlock a capability, or remain a cataloged item.

## Recommended V0

Keep this slice in the typed data spine for now:

- Add `InventoryItem` to `src/data/types.ts`.
- Add `items` to `HangarData`.
- Seed durable item records inside `src/data/hangar.ts`.
- Do not add API routes, migrations, or a write workflow in this slice.

This matches the current implementation: the content spine is still static TypeScript data, the UI is a projection, and the schema should emerge from real entries. The three GL.iNet items are enough to prove the record shape without forcing a backend migration into the inventory patch.

## Backend Direction

`docs/NORTH_STAR.md` now names PostgreSQL as the resolved future backend. This plan should not reopen that decision. The V0 static data model should be treated as the seed shape for a later PostgreSQL migration, not as a competing SQLite plan.

Static TypeScript data still has advantages at this phase:

- It is LLM-editable.
- It is reviewable in git.
- It gives TypeScript validation.
- It preserves the current app surface while the stack PRs settle.
- It lets the first real entries expose schema pressure before migrations are written.

The tradeoff is that user-driven edits are not first-class yet. That is acceptable while the LLM is the main population engine and Patrick curates changes through git.

## Record Shape

An `InventoryItem` should support:

- Identity: `id`, `name`, `manufacturer`, `model`, `category`, `bay`.
- Ownership state: `status`, `quantity`, `acquired`, `horizon`, `price`.
- Description: `summary`, `description`, `planningNotes`, `limitations`.
- Specifications: flexible key-value `specs` rows.
- Relationships: `relatedUnits`, `relatedMissions`, `relatedCapabilities`, `relatedInsights`.
- Retrieval: `tags`.
- Evidence: `sources` with label, URL, access date, and source kind.
- Provenance: owner-confirmed, inferred, or open.

This keeps items from becoming either bloated units or one-off notes. A KVM can stay an item until it is assigned to a rack. A sensor can stay an item until it becomes part of a Home Systems automation or a mission reference.

## Later PostgreSQL Shape

When the backend migration reaches inventory, use normalized tables for searchable, linkable records:

```sql
items (
  id text primary key,
  name text not null,
  manufacturer text,
  model text,
  bay text not null,
  category text not null,
  status text not null,
  summary text not null,
  description text not null,
  planning_notes text,
  provenance text not null,
  quantity integer default 1,
  price_us numeric,
  price_import numeric,
  acquired text,
  horizon text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

item_specs (
  item_id text not null references items(id),
  label text not null,
  value text not null,
  sort_order integer not null default 0,
  primary key (item_id, label)
);

item_sources (
  id text primary key,
  item_id text not null references items(id),
  label text not null,
  url text not null,
  accessed_at date not null,
  kind text not null
);

item_relationships (
  item_id text not null references items(id),
  target_type text not null,
  target_id text not null,
  relationship text not null,
  primary key (item_id, target_type, target_id, relationship)
);

item_events (
  id text primary key,
  item_id text not null references items(id),
  at timestamptz not null,
  kind text not null,
  text text not null
);
```

Keep `specs` and `sources` separate instead of packing everything into one JSON blob once this becomes a database. The Hangar will need to query by manufacturer, protocol, power requirement, price, capability, and evidence quality.

## Intake Workflow

The LLM-assisted population path should be:

1. Research product details and source URLs.
2. Draft an `InventoryItem` with confirmed specs, inferred planning notes, and explicit limitations.
3. Mark provenance per record where possible; do not hide uncertainty.
4. Link the item to units, missions, capabilities, or insights only when the relationship is real.
5. Run build/typecheck after changing typed data.
6. Later, use an importer to convert drafted Markdown/JSON into typed records or PostgreSQL rows.

## UI Implication

Do not build a generic inventory table first. The next useful surface is probably a narrow "Items" projection:

- grouped by bay,
- filterable by status and category,
- searchable across specs and sources,
- linked into Unit Detail, Quartermaster, Missions, and Codex.

Quartermaster should remain about purchase decisions. Items should be about what the thing is, what is known about it, where it is, and what it relates to.

## Validation For This Slice

- `InventoryItem` type added.
- `HangarData.items` added.
- Comet Q, Comet X, and LWR02 seeded as item records.
- No database, API route, or UI behavior introduced.
