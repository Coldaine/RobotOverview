// ─────────────────────────────────────────────────────────────────────────────
// The Hangar — data spine types.
// Per the North Star: the data is the source of truth; the UI is a projection.
// Everything scales by adding records, not screens.
// ─────────────────────────────────────────────────────────────────────────────

export type UnitStatus =
  | 'operational'
  | 'needs-attention'
  | 'blocked'
  | 'in-mission'
  | 'wishlist'
  | 'on-order'
  | 'researching'
  | 'retired';

export type LifecycleState = 'inventory' | 'assembled' | 'deployed' | 'wishlist' | 'on-order';

export type BayId = 'robotics' | 'compute' | 'network' | 'home' | 'audio';

export interface Bay {
  id: BayId;
  name: string;
  code: string; // short HUD code, e.g. "RBT"
  tagline: string;
  accent: 'cyan' | 'amber';
}

export interface Price {
  us: number | null; // domestic distributor price (USD)
  import: number | null; // overseas import (AliExpress) landed-ish price (USD)
  currency?: string;
}

export interface SpecRow {
  label: string;
  value: string;
}

export type InventoryItemStatus =
  | 'owned'
  | 'on-order'
  | 'wishlist'
  | 'researching'
  | 'deployed'
  | 'retired'
  | 'rejected';

export interface SourceRecord {
  label: string;
  url: string;
  accessedAt: string;
  kind: 'official' | 'certification' | 'review' | 'community' | 'research';
}

export interface InventoryItem {
  id: string;
  name: string;
  manufacturer?: string;
  model?: string;
  bay: BayId;
  category: string;
  status: InventoryItemStatus;
  summary: string;
  description: string;
  planningNotes?: string;
  limitations?: string[];
  specs: SpecRow[];
  price?: Price;
  quantity?: number;
  relatedUnits?: string[];
  relatedMissions?: string[];
  relatedCapabilities?: string[];
  relatedInsights?: string[];
  tags?: string[];
  sources?: SourceRecord[];
  acquired?: string;
  horizon?: string;
  provenance?: 'owner' | 'inferred' | 'open';
}

export interface LoadoutSlot {
  group?: string; // e.g. "Chassis Mounts", "Driver Board"
  slot: string; // e.g. "Lighting", "Compute", "Sensing"
  filledBy: string | null; // unit id currently slotted, or null if empty
  note?: string;
  hotspotId?: string; // Links this structural slot to a visual region on the schematic
}

export interface PowerProfile {
  watts: number | null;
  volts?: number | null;
  rail?: '5V' | '12V' | 'battery' | 'mains' | null;
}

export interface Hotspot {
  id: string;
  label: string;
  x: number; // % of viewBox 0-100
  y: number;
  // detail and status are now derived dynamically from the LoadoutSlots mapped to this hotspotId!
}

export type UnitShortcut =
  | {
      id: string;
      label: string;
      type: 'url';
      url: string;
      note?: string;
    }
  | {
      id: string;
      label: string;
      type: 'command';
      command: string;
      note?: string;
    };

export interface Unit {
  id: string;
  name: string;
  callsign?: string;
  bay: BayId;
  class: string; // e.g. "Tracked Rover", "Workstation", "Gateway"
  status: UnitStatus;
  lifecycle: LifecycleState;
  flagship?: boolean;
  summary: string;
  specs: SpecRow[];
  price?: Price;
  power?: PowerProfile;
  massGrams?: number | null;
  loadout?: LoadoutSlot[];
  hotspots?: Hotspot[];
  capabilities?: string[]; // capability ids this unit grants/enables
  missions?: string[]; // mission ids
  insights?: string[]; // insight ids
  tags?: string[];
  shortcuts?: UnitShortcut[];
  links?: { label: string; url: string }[];
  acquired?: string; // ISO date or "—"
  horizon?: string; // for future items: when it's expected
  provenance?: 'owner' | 'inferred' | 'open';
  // External system this unit's live status is *referenced* from (e.g. "Home Assistant").
  // Catalog reference only — the Hangar never controls the system (North Star AG2).
  monitoredVia?: string;
}

export interface MissionObjective {
  text: string;
  done: boolean;
}

export interface ConstraintGauge {
  label: string;
  value: number;
  budget: number;
  unit: string; // "W", "g", "$"
}

export interface Mission {
  id: string;
  code: string; // "MSN-01"
  name: string;
  status: 'planning' | 'active' | 'standby' | 'complete';
  objective: string;
  environment?: string;
  requisitionedUnits: string[]; // unit ids
  requiredLoadout: string[]; // capability ids / part descriptions
  wishlist: string[]; // wishlist item ids
  objectives: MissionObjective[];
  constraints: ConstraintGauge[];
  afterAction?: string[];
  insights?: string[];
}

export interface WishlistItem {
  id: string;
  name: string;
  category: string;
  forUnit?: string; // unit id
  forMission?: string; // mission id
  rationale: string; // why it matters
  price: Price;
  power?: PowerProfile;
  massGrams?: number | null;
  status: 'watching' | 'researching' | 'planned' | 'buy-next' | 'on-order' | 'received' | 'rejected';
  unlocks?: string; // capability id
  riskNote?: string; // import / counterfeit / warranty risk
  horizon?: string; // "next 6 months" etc.
  source?: string;
}

export interface Capability {
  id: string;
  name: string;
  description: string;
  unlockedBy: string[]; // unit ids or wishlist item ids required
  dependsOn?: string[]; // capability ids
  bay?: BayId;
  unlocked: boolean;
}

export interface Insight {
  id: string;
  title: string;
  body: string;
  tags: string[];
  bay?: BayId;
  units?: string[];
  missions?: string[];
  confidence: 'high' | 'medium' | 'low';
  source?: string;
  capturedAt: string;
}

export interface ActivityEvent {
  id: string;
  at: string; // ISO
  kind: 'acquired' | 'price-drop' | 'shipped' | 'insight' | 'mission' | 'researched';
  text: string;
}

// ── Connected twin: terminals + nets ─────────────────────────────────────────
// A Terminal is a physical connector/port on a unit (a driver-board socket, a
// UPS output, a Pi header). A Net joins terminals that are electrically or
// logically wired together (a power rail, a UART link, a servo daisy-chain).
// This is the data the wiring view renders; documents prove each net.

export type NetKind = 'power' | 'data' | 'mixed' | 'mechanical';

export interface Terminal {
  id: string; // e.g. 'gdb-servo-bus'
  unitId: string; // unit that physically carries the connector
  name: string; // 'Serial Bus Servo Port'
  connector?: string; // 'XH2.54-2P' | 'PH2.0-6P' | '40-pin header' | 'USB-C' ...
  role?: 'input' | 'output' | 'bidirectional';
  note?: string;
}

export interface Net {
  id: string; // e.g. 'net-servo-bus'
  name: string; // 'ST3215 Serial Servo Bus'
  kind: NetKind;
  carries?: string; // '11.1V pack rail' | 'UART 115200 8N1' | 'I²C' ...
  terminals: string[]; // terminal ids joined by this net (≥2)
  documents?: string[]; // document ids that prove this wiring
  note?: string;
}

// ── Documents: the downloaded source-of-truth library ────────────────────────
// References into the UGV-Beast-Archive (and, later, object storage). The
// archivePath is the stable key; url is filled once files live in storage.

export interface DocumentRef {
  id: string;
  title: string;
  kind: 'schematic' | 'manual' | 'cad' | 'firmware' | 'wiki' | 'datasheet' | 'image';
  archivePath: string; // path under UGV-Beast-Archive/
  url?: string; // public/object-storage URL once uploaded
  units?: string[]; // related unit ids
  note?: string;
}

export interface HangarData {
  meta: {
    title: string;
    operator: string;
    codename: string;
    updated: string;
  };
  bays: Bay[];
  items: InventoryItem[];
  units: Unit[];
  missions: Mission[];
  wishlist: WishlistItem[];
  capabilities: Capability[];
  insights: Insight[];
  activity: ActivityEvent[];
  terminals: Terminal[];
  nets: Net[];
  documents: DocumentRef[];
}
