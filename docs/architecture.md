# Hangar — Full-Stack Architecture Blueprint
**Stack: Next.js 16.2 · React 19.2 · PostgreSQL 19 · Drizzle ORM · Doppler · Tailwind CSS · TypeScript**

---

## Why Next.js 16 (Not Vite SPA)

The Vite SPA was the right bootstrap choice. It dies the moment you need a real database because you cannot put database credentials in code that runs in a browser. Next.js 16 solves this by fusing the frontend and a secure Node.js backend into a single project. The key primitives are:

- **Server Components:** React components that run exclusively on the server. They can directly query the database. They never ship to the browser bundle.
- **Server Actions:** Async functions marked `"use server"` that execute securely on the server in response to a user interaction (button click, form submit). They replace REST API routes for mutations.
- **`proxy.ts`:** New in Next.js 16, replaces `middleware.ts`. Controls the network boundary — auth checks, redirects, and routing happen here before any page logic runs.

The net result: **the UI and the database speak directly to each other through the server layer, with Doppler injecting secrets at runtime.**

---

## Project Structure

```
hangar/
├── src/
│   ├── app/                        # Next.js App Router (routes = folders)
│   │   ├── layout.tsx              # Root layout (HUD shell, fonts)
│   │   ├── page.tsx                # Hub — Fleet overview
│   │   ├── (hangar)/               # Route group (no URL impact)
│   │   │   ├── units/
│   │   │   │   └── [id]/page.tsx   # Unit detail page
│   │   │   ├── missions/
│   │   │   │   └── [id]/page.tsx   # Mission detail page
│   │   │   ├── tech-tree/page.tsx  # Capabilities graph
│   │   │   └── wishlist/page.tsx   # Upgrade queue
│   │   └── api/                    # ONLY for webhooks/external integrations
│   │
│   ├── db/                         # DATABASE LAYER (server-only)
│   │   ├── index.ts                # Drizzle client (holds DATABASE_URL)
│   │   ├── schema.ts               # Single source of truth for all tables
│   │   └── seed.ts                 # One-time migration from hangar.ts
│   │
│   ├── actions/                    # SERVER ACTIONS (mutations)
│   │   ├── units.ts                # updateLoadoutSlot(), updateUnitStatus()
│   │   ├── missions.ts             # toggleObjective(), updateMissionStatus()
│   │   └── wishlist.ts             # updateWishlistStatus()
│   │
│   ├── components/                 # UI COMPONENTS
│   │   ├── hud/                    # Shell (NavRail, StatusBar, CommandBar)
│   │   ├── units/                  # UnitCard, UnitDetail, LoadoutSlotRow
│   │   ├── missions/               # MissionCard, ConstraintGauge
│   │   └── shared/                 # SectionTitle, StatusBadge, etc.
│   │
│   ├── lib/                        # SHARED UTILITIES (no DB access)
│   │   ├── format.ts               # Currency, mass, power formatters
│   │   └── env.ts                  # Zod-validated environment schema
│   │
│   └── data/
│       └── hangar.ts               # TEMPORARY — removed after DB seeding
│
├── proxy.ts                        # Network boundary (auth, redirects)
├── next.config.ts                  # Next.js config (Turbopack enabled)
├── drizzle.config.ts               # Drizzle Kit config
└── doppler.yaml                    # Doppler project config
```

---

## The Server / Client Component Split

This is the most critical architectural decision. Getting this wrong causes security issues or bloated bundles.

### Rule: Push `"use client"` to the leaves

Everything is a Server Component by default. You only opt into Client Components when you genuinely need browser APIs — state, event listeners, animations.

| Component | Server or Client? | Why |
|---|---|---|
| `page.tsx` (Unit Detail) | **Server** | Fetches unit data directly from Postgres |
| `LoadoutSlotRow` | **Server** | Renders a single slot, no interactivity needed |
| `SlotFillButton` | **Client** | Needs `onClick` + optimistic UI update |
| `ConstraintGauge` | **Client** | `framer-motion` animation requires browser |
| `RoverSchematic` | **Client** | `useState` for active hotspot selection |
| `CommandBar` | **Client** | Search input + keyboard shortcut listeners |
| `HUDShell` (layout) | **Server** | Static wrapper, no interactivity |

### The Pattern in Practice

```tsx
// src/app/(hangar)/units/[id]/page.tsx  — SERVER COMPONENT
import { db } from '@/db';
import { units, unitLoadoutSlots } from '@/db/schema';
import { UnitDetail } from '@/components/units/UnitDetail';
import { eq } from 'drizzle-orm';

export default async function UnitPage({ params }: { params: { id: string } }) {
  // Runs on the server. DATABASE_URL never touches the browser.
  const unit = await db.query.units.findFirst({
    where: eq(units.id, params.id),
    with: { loadoutSlots: true, hotspots: true }
  });

  if (!unit) notFound();

  return <UnitDetail unit={unit} />;
}
```

```tsx
// src/components/units/SlotFillButton.tsx  — CLIENT COMPONENT
'use client';
import { updateLoadoutSlot } from '@/actions/units'; // Server Action
import { useTransition } from 'react';

export function SlotFillButton({ slotId, unitId }: Props) {
  const [isPending, startTransition] = useTransition();

  return (
    <button onClick={() => startTransition(() => updateLoadoutSlot(slotId, unitId))}>
      {isPending ? 'Slotting...' : 'Socket Unit'}
    </button>
  );
}
```

---

## Data Flow: Querying (Server Actions for Reads, Direct in Server Components)

```
Browser → Next.js Server (proxy.ts) → Server Component → Drizzle → PostgreSQL
                                              ↓
                                        Rendered HTML → Browser
```

For mutations (filling a loadout slot, checking off a mission objective):
```
Browser onClick → Server Action (`"use server"`) → Drizzle → PostgreSQL
                                                        ↓
                                               revalidatePath() → Re-render
```

---

## Database: Drizzle ORM Setup

Drizzle is the right ORM for this stack because:
- It is TypeScript-first. The schema **is** the type. No code generation step.
- It is extremely lightweight (~60KB).
- It maps 1:1 with the SQL schema we already designed.
- `drizzle-kit` handles migrations cleanly.

```typescript
// src/db/schema.ts  — maps exactly to our postgres_schema.md
import { pgTable, varchar, boolean, integer, jsonb, text, serial, pgEnum } from 'drizzle-orm/pg-core';

export const unitStatusEnum = pgEnum('unit_status', [
  'operational', 'needs-attention', 'blocked', 'in-mission', 'wishlist', 'on-order', 'researching', 'retired'
]);

export const units = pgTable('units', {
  id: varchar('id', { length: 50 }).primaryKey(),
  bayId: varchar('bay_id', { length: 50 }).references(() => bays.id),
  name: varchar('name', { length: 100 }).notNull(),
  status: unitStatusEnum('status').notNull(),
  flagship: boolean('flagship').default(false),
  massGrams: integer('mass_grams'),
  power: jsonb('power'),   // { watts, volts, rail }
  specs: jsonb('specs'),   // [{ label, value }]
  tags: text('tags').array(),
  // ...
});

export const unitLoadoutSlots = pgTable('unit_loadout_slots', {
  id: serial('id').primaryKey(),
  unitId: varchar('unit_id').references(() => units.id, { onDelete: 'cascade' }),
  slotGroup: varchar('slot_group', { length: 100 }),
  slotName: varchar('slot_name', { length: 100 }).notNull(),
  filledByUnitId: varchar('filled_by_unit_id').references(() => units.id),
  note: text('note'),
});
```

---

## Secrets: Doppler Integration

Doppler injects secrets into `process.env` at runtime. Next.js reads them server-side. They **never** touch the browser.

```yaml
# doppler.yaml (project root)
setup:
  project: hangar
  config: dev
```

```bash
# Development
doppler run -- npm run dev

# Production
doppler run -- npm run build && doppler run -- npm start
```

```typescript
// src/lib/env.ts — validate at startup, fail fast if missing
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']),
});

export const env = envSchema.parse(process.env);
// If DATABASE_URL is missing, the app crashes on boot, not mid-request.
```

```typescript
// src/db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '@/lib/env';
import * as schema from './schema';

const pool = new Pool({ connectionString: env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```

---

## Caching Strategy (`use cache`)

Next.js 16's `use cache` directive lets us cache expensive queries without an external Redis instance.

```typescript
// Cache the full fleet list for 60 seconds
import { unstable_cache as cache } from 'next/cache';

export const getUnits = cache(
  async () => db.query.units.findMany({ with: { loadoutSlots: true } }),
  ['units-list'],
  { revalidate: 60, tags: ['units'] }
);

// When a Server Action mutates a unit, bust the cache:
// revalidateTag('units')  ← UI re-renders with fresh data instantly
```

---

## Migration Plan: hangar.ts → PostgreSQL

This is the exact sequence to move from the current TypeScript file to the live database:

1. **Scaffold Next.js 16** project (`create-next-app@latest` with App Router + Turbopack + TypeScript + Tailwind)
2. **Port components** from Vite (`RoverSchematic`, `UnitDetail`, `MissionCard`, etc.) — they are standard React, no changes needed
3. **Write `src/db/schema.ts`** — already designed in `postgres_schema.md`
4. **Run `drizzle-kit push`** — creates all tables in Postgres
5. **Write `src/db/seed.ts`** — imports `hangar.ts` and inserts all units, missions, and wishlist items into the database as a one-time operation
6. **Run the seed script** — `hangar.ts` is now in Postgres
7. **Wire Doppler** — add `DATABASE_URL` to Doppler, run `doppler run -- npm run dev`
8. **Delete `hangar.ts`** — it is no longer needed

---

## Open Questions for the Hangar

| Question | Decision Needed |
|---|---|
| **Hosting** | Where does the Next.js server run? (Self-hosted on CORE-PRIME, Vercel, Railway, Fly.io?) |
| **DB Host** | Where does Postgres run? (CORE-PRIME local, Neon serverless, Railway, Render?) |
| **Auth** | Is this private (no auth needed) or do you want a login? |
| **LLM Population** | How do I push new data in? (Admin page, API route that accepts JSON payloads, direct DB access?) |
