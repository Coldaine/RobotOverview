import { sql } from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

/** Drizzle table for the Postgres-first Hangar UI spine. */
export const contentSnapshots = pgTable('content_snapshots', {
  id: text('id').primaryKey(),
  payload: jsonb('payload').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const HANGAR_SPINE_SNAPSHOT_ID = 'hangar';

// ── ENUMS (match db/hangar/schema.sql) ───────────────────────────────────────
export const assetStatus = pgEnum('asset_status', [
  'operational',
  'needs-attention',
  'blocked',
  'inventory',
  'integrating',
  'deployed',
  'owned',
  'on-order',
  'researching',
  'wishlist',
  'watching',
  'planned',
  'buy-next',
  'received',
  'retired',
  'rejected',
]);

export const lifecycleState = pgEnum('lifecycle_state', [
  'inventory',
  'assembled',
  'deployed',
  'wishlist',
  'on-order',
]);

export const assetKind = pgEnum('asset_kind', [
  'system',
  'module',
  'peripheral',
  'accessory',
  'consumable',
  'cable',
  'mount',
  'tooling',
]);

export const groupKind = pgEnum('group_kind', ['bay', 'kit', 'location', 'project']);

export const missionStatus = pgEnum('mission_status', [
  'planning',
  'active',
  'standby',
  'complete',
]);

export const confidenceLevel = pgEnum('confidence_level', ['high', 'medium', 'low']);

export const interfaceKind = pgEnum('interface_kind', [
  'electrical',
  'mechanical',
  'power',
  'data',
]);

export const netKind = pgEnum('net_kind', ['power', 'data', 'mixed', 'mechanical']);

// ── CORE INVENTORY ───────────────────────────────────────────────────────────
export const assets = pgTable(
  'assets',
  {
    id: text('id').primaryKey(),
    kind: assetKind('kind').notNull(),
    name: text('name').notNull(),
    manufacturer: text('manufacturer'),
    model: text('model'),
    callsign: text('callsign'),
    status: assetStatus('status').notNull(),
    lifecycle: lifecycleState('lifecycle'),
    provenance: text('provenance'),
    flagship: boolean('flagship').notNull().default(false),
    summary: text('summary'),
    description: text('description'),
    planningNotes: text('planning_notes'),
    monitoredVia: text('monitored_via'),
    acquired: text('acquired'),
    horizon: text('horizon'),
    quantity: integer('quantity').notNull().default(1),
    powerWatts: numeric('power_watts'),
    powerVolts: numeric('power_volts'),
    powerRail: text('power_rail'),
    massGrams: integer('mass_grams'),
    priceUs: numeric('price_us'),
    priceImport: numeric('price_import'),
    specs: jsonb('specs'),
    links: jsonb('links'),
    limitations: jsonb('limitations'),
    sources: jsonb('sources'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('assets_id_lifecycle_key').on(t.id, t.lifecycle)],
);

export const wishlistMeta = pgTable(
  'wishlist_meta',
  {
    assetId: text('asset_id').primaryKey(),
    assetLifecycle: lifecycleState('asset_lifecycle').notNull().default('wishlist'),
    rationale: text('rationale'),
    unlocksCapabilityId: text('unlocks_capability_id').references(() => capabilities.id, {
      onDelete: 'set null',
    }),
    riskNote: text('risk_note'),
    forAssetId: text('for_asset_id').references(() => assets.id, { onDelete: 'set null' }),
    forMissionId: text('for_mission_id').references(() => missions.id, { onDelete: 'set null' }),
    source: text('source'),
  },
  (t) => [
    foreignKey({
      columns: [t.assetId, t.assetLifecycle],
      foreignColumns: [assets.id, assets.lifecycle],
      name: 'wishlist_meta_asset_id_asset_lifecycle_fkey',
    }).onDelete('cascade'),
  ],
);

export const tags = pgTable(
  'tags',
  {
    id: serial('id').primaryKey(),
    namespace: text('namespace').notNull().default('tag'),
    name: text('name').notNull(),
    label: text('label'),
  },
  (t) => [unique('tags_namespace_name_key').on(t.namespace, t.name)],
);

export const assetTags = pgTable(
  'asset_tags',
  {
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.assetId, t.tagId] })],
);

export const groups = pgTable('groups', {
  id: text('id').primaryKey(),
  kind: groupKind('kind').notNull(),
  name: text('name').notNull(),
  code: text('code'),
  tagline: text('tagline'),
  accent: text('accent'),
});

export const assetGroups = pgTable(
  'asset_groups',
  {
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.assetId, t.groupId] })],
);

// ── LOADOUT / SOCKETS ────────────────────────────────────────────────────────
export const hotspots = pgTable(
  'hotspots',
  {
    id: serial('id').primaryKey(),
    hostAssetId: text('host_asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    label: text('label'),
    x: numeric('x'),
    y: numeric('y'),
  },
  (t) => [unique('hotspots_host_asset_id_code_key').on(t.hostAssetId, t.code)],
);

export const sockets = pgTable(
  'sockets',
  {
    id: serial('id').primaryKey(),
    hostAssetId: text('host_asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    slotGroup: text('slot_group'),
    name: text('name').notNull(),
    hotspotId: integer('hotspot_id').references(() => hotspots.id, { onDelete: 'set null' }),
    capacity: integer('capacity').notNull().default(1),
    note: text('note'),
  },
  (t) => [unique('sockets_host_asset_id_name_key').on(t.hostAssetId, t.name)],
);

export const interfaceTypes = pgTable('interface_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: interfaceKind('kind').notNull(),
  note: text('note'),
});

export const assetInterfaces = pgTable(
  'asset_interfaces',
  {
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    interfaceTypeId: text('interface_type_id')
      .notNull()
      .references(() => interfaceTypes.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.assetId, t.interfaceTypeId] })],
);

export const socketAccepts = pgTable(
  'socket_accepts',
  {
    socketId: integer('socket_id')
      .notNull()
      .references(() => sockets.id, { onDelete: 'cascade' }),
    interfaceTypeId: text('interface_type_id')
      .notNull()
      .references(() => interfaceTypes.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.socketId, t.interfaceTypeId] })],
);

export const loadoutAssignments = pgTable(
  'loadout_assignments',
  {
    socketId: integer('socket_id').primaryKey(),
    assetId: text('asset_id').notNull(),
    interfaceTypeId: text('interface_type_id').notNull(),
    equippedAt: timestamp('equipped_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.socketId, t.interfaceTypeId],
      foreignColumns: [socketAccepts.socketId, socketAccepts.interfaceTypeId],
      name: 'loadout_assignments_socket_id_interface_type_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.assetId, t.interfaceTypeId],
      foreignColumns: [assetInterfaces.assetId, assetInterfaces.interfaceTypeId],
      name: 'loadout_assignments_asset_id_interface_type_id_fkey',
    }).onDelete('cascade'),
  ],
);

// ── MISSIONS ─────────────────────────────────────────────────────────────────
export const missions = pgTable('missions', {
  id: text('id').primaryKey(),
  code: text('code'),
  name: text('name').notNull(),
  status: missionStatus('status').notNull(),
  objective: text('objective'),
  environment: text('environment'),
  requiredLoadout: text('required_loadout').array().notNull().default([]),
});

export const missionRequisitions = pgTable(
  'mission_requisitions',
  {
    missionId: text('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.missionId, t.assetId] })],
);

export const missionObjectives = pgTable('mission_objectives', {
  id: serial('id').primaryKey(),
  missionId: text('mission_id')
    .notNull()
    .references(() => missions.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  done: boolean('done').notNull().default(false),
});

export const missionConstraints = pgTable('mission_constraints', {
  id: serial('id').primaryKey(),
  missionId: text('mission_id')
    .notNull()
    .references(() => missions.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  value: numeric('value').notNull(),
  budget: numeric('budget').notNull(),
  unit: text('unit').notNull(),
});

export const missionAfterActions = pgTable(
  'mission_after_actions',
  {
    id: serial('id').primaryKey(),
    missionId: text('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    text: text('text').notNull(),
  },
  (t) => [unique('mission_after_actions_mission_id_position_key').on(t.missionId, t.position)],
);

// ── CAPABILITIES ─────────────────────────────────────────────────────────────
export const capabilities = pgTable('capabilities', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  unlocked: boolean('unlocked').notNull().default(false),
  bay: text('bay'),
});

export const capabilityDeps = pgTable(
  'capability_deps',
  {
    capabilityId: text('capability_id')
      .notNull()
      .references(() => capabilities.id, { onDelete: 'cascade' }),
    dependsOnId: text('depends_on_id')
      .notNull()
      .references(() => capabilities.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.capabilityId, t.dependsOnId] })],
);

export const assetCapabilities = pgTable(
  'asset_capabilities',
  {
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    capabilityId: text('capability_id')
      .notNull()
      .references(() => capabilities.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.assetId, t.capabilityId] })],
);

// ── KNOWLEDGE / LOG ──────────────────────────────────────────────────────────
export const insights = pgTable('insights', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  body: text('body'),
  confidence: confidenceLevel('confidence'),
  source: text('source'),
  capturedAt: timestamp('captured_at', { withTimezone: true }),
  bay: text('bay'),
});

export const insightAssets = pgTable(
  'insight_assets',
  {
    insightId: text('insight_id')
      .notNull()
      .references(() => insights.id, { onDelete: 'cascade' }),
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.insightId, t.assetId] })],
);

export const insightMissions = pgTable(
  'insight_missions',
  {
    insightId: text('insight_id')
      .notNull()
      .references(() => insights.id, { onDelete: 'cascade' }),
    missionId: text('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.insightId, t.missionId] })],
);

export const insightTags = pgTable(
  'insight_tags',
  {
    insightId: text('insight_id')
      .notNull()
      .references(() => insights.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.insightId, t.tagId] })],
);

export const activityLog = pgTable('activity_log', {
  id: text('id').primaryKey(),
  at: timestamp('at', { withTimezone: true }),
  kind: text('kind'),
  text: text('text'),
  assetId: text('asset_id').references(() => assets.id, { onDelete: 'set null' }),
});

// ── CONNECTED TWIN ───────────────────────────────────────────────────────────
export const terminals = pgTable('terminals', {
  id: text('id').primaryKey(),
  assetId: text('asset_id')
    .notNull()
    .references(() => assets.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  connector: text('connector'),
  role: text('role'),
  note: text('note'),
});

export const nets = pgTable('nets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: netKind('kind').notNull(),
  carries: text('carries'),
  note: text('note'),
});

export const netTerminals = pgTable(
  'net_terminals',
  {
    netId: text('net_id')
      .notNull()
      .references(() => nets.id, { onDelete: 'cascade' }),
    terminalId: text('terminal_id')
      .notNull()
      .references(() => terminals.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.netId, t.terminalId] })],
);

export const documents = pgTable('documents', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  kind: text('kind').notNull(),
  libraryPath: text('library_path').notNull().unique(),
  url: text('url'),
  note: text('note'),
});

export const documentAssets = pgTable(
  'document_assets',
  {
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.assetId] })],
);

export const netDocuments = pgTable(
  'net_documents',
  {
    netId: text('net_id')
      .notNull()
      .references(() => nets.id, { onDelete: 'cascade' }),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.netId, t.documentId] })],
);

// ── CORPUS (Wave 1) ──────────────────────────────────────────────────────────
export const assetShortcuts = pgTable(
  'asset_shortcuts',
  {
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    shortcutId: text('shortcut_id').notNull(),
    position: integer('position').notNull(),
    label: text('label').notNull(),
    type: text('type').notNull(),
    url: text('url'),
    command: text('command'),
    note: text('note'),
  },
  (t) => [
    primaryKey({ columns: [t.assetId, t.position] }),
    unique('asset_shortcuts_id_key').on(t.assetId, t.shortcutId),
  ],
);

export const hangarMeta = pgTable('hangar_meta', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  operator: text('operator').notNull(),
  codename: text('codename').notNull(),
  updated: text('updated').notNull(),
});

// hub_briefing_id FK is declared in SQL (briefing_packs_hub_fk) after both tables
// exist; omitted here to avoid a circular Drizzle/TS initializer with briefings.
export const briefingPacks = pgTable('briefing_packs', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  code: text('code').notNull(),
  summary: text('summary').notNull(),
  hubBriefingId: text('hub_briefing_id'),
  topics: text('topics')
    .array()
    .notNull()
    .default(sql`'{}'`),
});

export const briefings = pgTable('briefings', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  kind: text('kind').notNull(),
  summary: text('summary').notNull(),
  tags: text('tags')
    .array()
    .notNull()
    .default(sql`'{}'`),
  aliases: text('aliases')
    .array()
    .notNull()
    .default(sql`'{}'`),
  packId: text('pack_id').references(() => briefingPacks.id, { onDelete: 'set null' }),
  capturedAt: text('captured_at'),
  href: text('href').notNull(),
  bodyMarkdown: text('body_markdown'),
  repoPath: text('repo_path'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
