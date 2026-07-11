/**
 * Seed generator — transforms the static `src/data/hangar.ts` roster into the
 * normalized `hangar` Postgres schema and emits SQL on stdout, or to --out.
 *
 *   npx tsx db/hangar/gen-seed.ts --out db/hangar/seed.sql
 *
 * Faithful + defensive: every junction row is filtered to references that
 * actually resolve to a seeded row, so the seed cannot violate a foreign key.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hangarData as H } from '../../src/data/hangar';

const out: string[] = [];
const w = (s: string) => out.push(s);

// ── SQL escapers ────────────────────────────────────────────────────────────
const stripNul = (value: string) => value.replace(/\0/g, '');
const sanitizeJson = (value: unknown): unknown => {
  if (typeof value === 'string') return stripNul(value);
  if (Array.isArray(value)) return value.map(sanitizeJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [stripNul(key), sanitizeJson(nested)]),
    );
  }
  return value;
};
const S = (v: unknown) =>
  v === null || v === undefined ? 'NULL' : `'${stripNul(String(v)).replace(/'/g, "''")}'`;
const N = (v: unknown) => {
  if (v === null || v === undefined || v === '') return 'NULL';
  const number = Number(v);
  if (!Number.isFinite(number)) {
    throw new Error(`Cannot emit non-finite numeric SQL literal from value: ${String(v)}`);
  }
  return String(number);
};
const B = (v: unknown) => (v ? 'true' : 'false');
const J = (v: unknown) =>
  v === null || v === undefined ? 'NULL' : `'${JSON.stringify(sanitizeJson(v)).replace(/'/g, "''")}'::jsonb`;

// ── id registries (for defensive filtering) ─────────────────────────────────
const assetIds = new Set<string>([
  ...H.units.map((u) => u.id),
  ...H.items.map((i) => i.id),
  ...H.wishlist.map((wi) => wi.id),
]);
const missionIds = new Set(H.missions.map((m) => m.id));
const capIds = new Set(H.capabilities.map((c) => c.id));
const insightIds = new Set(H.insights.map((i) => i.id));
const bayIds = new Set(H.bays.map((b) => b.id));
const A = (id: string) => assetIds.has(id);

w('BEGIN;');
w('SET client_min_messages = warning;');

// ── GROUPS (bays) ───────────────────────────────────────────────────────────
w('\n-- groups (bays)');
for (const b of H.bays)
  w(
    `INSERT INTO groups(id,kind,name,code,tagline,accent) VALUES (${S(b.id)},'bay',${S(b.name)},${S(b.code)},${S(b.tagline)},${S(b.accent)});`,
  );

// ── TAGS registry (collected, then asset_tags via (namespace,name) subselect) ─
const keySeparator = '\x1f';
const tagSet = new Set<string>(); // "namespace\\x1fname"
const addTag = (ns: string, name: string) => tagSet.add(`${ns}${keySeparator}${name}`);
for (const u of H.units) {
  (u.tags ?? []).forEach((t) => addTag('tag', t));
  if (u.class) addTag('class', u.class);
}
for (const i of H.items) {
  (i.tags ?? []).forEach((t) => addTag('tag', t));
  if (i.category) addTag('category', i.category);
}
for (const wi of H.wishlist) if (wi.category) addTag('category', wi.category);
for (const ins of H.insights) (ins.tags ?? []).forEach((t) => addTag('tag', t));

w('\n-- tags');
for (const key of tagSet) {
  const [ns, name] = key.split(keySeparator);
  w(`INSERT INTO tags(namespace,name,label) VALUES (${S(ns)},${S(name)},${S(name)}) ON CONFLICT (namespace,name) DO NOTHING;`);
}
const tagRef = (ns: string, name: string, col: 'asset' | 'insight', id: string) =>
  `INSERT INTO ${col}_tags(${col}_id,tag_id) SELECT ${S(id)},id FROM tags WHERE namespace=${S(ns)} AND name=${S(name)} ON CONFLICT DO NOTHING;`;

// ── ASSETS ──────────────────────────────────────────────────────────────────
const assetCols =
  'id,kind,name,manufacturer,model,callsign,status,lifecycle,provenance,flagship,summary,description,planning_notes,monitored_via,acquired,horizon,quantity,power_watts,power_volts,power_rail,mass_grams,price_us,price_import,specs,links,limitations,sources';

w('\n-- assets: units');
for (const u of H.units) {
  const kind = u.loadout && u.loadout.length ? 'system' : 'module';
  w(
    `INSERT INTO assets(${assetCols}) VALUES (${S(u.id)},${S(kind)},${S(u.name)},NULL,NULL,${S(u.callsign)},${S(u.status)},${S(u.lifecycle)},${S(u.provenance)},${B(u.flagship)},${S(u.summary)},NULL,NULL,${S(u.monitoredVia)},${S(u.acquired)},${S(u.horizon)},1,${N(u.power?.watts)},${N(u.power?.volts)},${S(u.power?.rail)},${N(u.massGrams)},${N(u.price?.us)},${N(u.price?.import)},${J(u.specs)},${J(u.links)},NULL,NULL);`,
  );
}

w('\n-- assets: inventory items');
for (const i of H.items) {
  const life = i.status === 'on-order' ? 'on-order' : i.status === 'owned' ? 'inventory' : null;
  w(
    `INSERT INTO assets(${assetCols}) VALUES (${S(i.id)},'peripheral',${S(i.name)},${S(i.manufacturer)},${S(i.model)},NULL,${S(i.status)},${S(life)},${S(i.provenance)},false,${S(i.summary)},${S(i.description)},${S(i.planningNotes)},NULL,${S(i.acquired)},${S(i.horizon)},${N(i.quantity)},NULL,NULL,NULL,NULL,${N(i.price?.us)},${N(i.price?.import)},${J(i.specs)},NULL,${J(i.limitations)},${J(i.sources)});`,
  );
}

w('\n-- assets: wishlist (folded in, lifecycle=wishlist). wishlist_meta deferred (needs caps/missions).');
for (const wi of H.wishlist) {
  w(
    `INSERT INTO assets(${assetCols}) VALUES (${S(wi.id)},'module',${S(wi.name)},NULL,NULL,NULL,${S(wi.status)},'wishlist','inferred',false,${S(wi.rationale)},NULL,NULL,NULL,NULL,${S(wi.horizon)},1,${N(wi.power?.watts)},${N(wi.power?.volts)},${S(wi.power?.rail)},${N(wi.massGrams)},${N(wi.price?.us)},${N(wi.price?.import)},NULL,NULL,NULL,NULL);`,
  );
}

// ── ASSET → GROUP (bay) + ASSET → TAGS ──────────────────────────────────────
w('\n-- asset_groups (bay membership) + asset_tags');
for (const u of H.units) {
  if (bayIds.has(u.bay)) w(`INSERT INTO asset_groups(asset_id,group_id) VALUES (${S(u.id)},${S(u.bay)}) ON CONFLICT DO NOTHING;`);
  (u.tags ?? []).forEach((t) => w(tagRef('tag', t, 'asset', u.id)));
  if (u.class) w(tagRef('class', u.class, 'asset', u.id));
}
for (const i of H.items) {
  if (bayIds.has(i.bay)) w(`INSERT INTO asset_groups(asset_id,group_id) VALUES (${S(i.id)},${S(i.bay)}) ON CONFLICT DO NOTHING;`);
  (i.tags ?? []).forEach((t) => w(tagRef('tag', t, 'asset', i.id)));
  if (i.category) w(tagRef('category', i.category, 'asset', i.id));
}
for (const wi of H.wishlist) if (wi.category) w(tagRef('category', wi.category, 'asset', wi.id));

// ── LOADOUT: hotspots + sockets (assignments deferred until interfaces exist)
const pendingAssignments: { host: string; slot: string; asset: string }[] = [];
w('\n-- hotspots + sockets');
for (const u of H.units) {
  for (const h of u.hotspots ?? [])
    w(`INSERT INTO hotspots(host_asset_id,code,label,x,y) VALUES (${S(u.id)},${S(h.id)},${S(h.label)},${N(h.x)},${N(h.y)});`);
  for (const sl of u.loadout ?? []) {
    const hs = sl.hotspotId
      ? `(SELECT id FROM hotspots WHERE host_asset_id=${S(u.id)} AND code=${S(sl.hotspotId)})`
      : 'NULL';
    w(`INSERT INTO sockets(host_asset_id,slot_group,name,hotspot_id,note) VALUES (${S(u.id)},${S(sl.group)},${S(sl.slot)},${hs},${S(sl.note)});`);
    if (sl.filledBy && A(sl.filledBy))
      pendingAssignments.push({ host: u.id, slot: sl.slot, asset: sl.filledBy });
  }
}

// ── INTERFACE TAXONOMY (new dimension — seed enough to prove candidacy) ──────
// Demonstrates the video-game loadout on real data, incl. the Pi→Orin swap path.
w('\n-- interface_types + socket_accepts + asset_interfaces (loadout candidacy demo)');
const ifaces: [string, string, string, string][] = [
  ['host-mount', 'Host Controller Mount', 'mechanical', 'SBC/edge host carrier mount'],
  ['serial-bus-servo', 'Serial Bus Servo', 'data', 'ST3215/ST3235 daisy-chain'],
  ['ups-bay', 'Undercarriage UPS Bay', 'power', '3x18650 / 3S pack bay'],
  ['i2c-display', 'I²C Display Header', 'data', '0.91/0.96in OLED'],
  ['sensor-rail', 'Sensor Rail Mount', 'mechanical', 'Top-deck accessory rail'],
  ['sensor-deck', 'Sensor Deck Mount', 'mechanical', 'Middle-deck sensor plate'],
  ['lidar-uart', 'LiDAR UART', 'data', 'LiDAR UART routed to host USB'],
];
for (const [id, name, kind, note] of ifaces)
  w(`INSERT INTO interface_types(id,name,kind,note) VALUES (${S(id)},${S(name)},${S(kind)},${S(note)});`);
const socketInterfaceIds = new Map<string, Set<string>>();
const assetInterfaceIds = new Map<string, Set<string>>();
const socketKey = (host: string, slot: string) => `${host}${keySeparator}${slot}`;
const addToSetMap = (map: Map<string, Set<string>>, key: string, value: string) => {
  const set = map.get(key) ?? new Set<string>();
  set.add(value);
  map.set(key, set);
};
const accept = (host: string, slot: string, iface: string) => {
  addToSetMap(socketInterfaceIds, socketKey(host, slot), iface);
  w(`INSERT INTO socket_accepts(socket_id,interface_type_id) SELECT id,${S(iface)} FROM sockets WHERE host_asset_id=${S(host)} AND name=${S(slot)} ON CONFLICT DO NOTHING;`);
};
accept('beast', 'Host Controller Mount', 'host-mount');
accept('beast', 'Serial Bus Servo', 'serial-bus-servo');
accept('beast', 'Undercarriage Bay', 'ups-bay');
accept('beast', 'Display Header', 'i2c-display');
accept('beast', '21mm Picatinny Rail', 'sensor-rail');
accept('beast', 'Middle Deck', 'sensor-deck');
accept('beast', 'LiDAR UART Port', 'lidar-uart');
const expose = (asset: string, iface: string) => {
  if (A(asset)) {
    addToSetMap(assetInterfaceIds, asset, iface);
    w(`INSERT INTO asset_interfaces(asset_id,interface_type_id) VALUES (${S(asset)},${S(iface)}) ON CONFLICT DO NOTHING;`);
  }
};
expose('pi5', 'host-mount');
expose('orin-nano', 'host-mount'); // the upgrade-path candidate for the same socket
expose('stock-ups', 'ups-bay');
expose('oak-d-lite', 'sensor-rail');
expose('d500-lidar', 'sensor-deck');
expose('d500-lidar', 'lidar-uart');

const compatibleInterface = (host: string, slot: string, asset: string) => {
  const socketInterfaces = socketInterfaceIds.get(socketKey(host, slot)) ?? new Set<string>();
  const assetInterfaces = assetInterfaceIds.get(asset) ?? new Set<string>();
  const matches = [...socketInterfaces].filter((iface) => assetInterfaces.has(iface)).sort();
  if (matches.length !== 1) {
    const detail = matches.length ? matches.join(', ') : 'none';
    throw new Error(`Expected exactly one compatible interface for ${asset} in ${host}/${slot}; got ${detail}`);
  }
  return matches[0];
};

w('\n-- loadout_assignments');
for (const assignment of pendingAssignments) {
  const iface = compatibleInterface(assignment.host, assignment.slot, assignment.asset);
  w(
    `INSERT INTO loadout_assignments(socket_id,asset_id,interface_type_id) SELECT id,${S(assignment.asset)},${S(iface)} FROM sockets WHERE host_asset_id=${S(assignment.host)} AND name=${S(assignment.slot)} ON CONFLICT DO NOTHING;`,
  );
}

// ── MISSIONS ────────────────────────────────────────────────────────────────
w('\n-- missions + requisitions + objectives + constraints');
for (const m of H.missions) {
  w(`INSERT INTO missions(id,code,name,status,objective,environment) VALUES (${S(m.id)},${S(m.code)},${S(m.name)},${S(m.status)},${S(m.objective)},${S(m.environment)});`);
  for (const aid of m.requisitionedUnits ?? [])
    if (A(aid)) w(`INSERT INTO mission_requisitions(mission_id,asset_id) VALUES (${S(m.id)},${S(aid)}) ON CONFLICT DO NOTHING;`);
  for (const o of m.objectives ?? [])
    w(`INSERT INTO mission_objectives(mission_id,text,done) VALUES (${S(m.id)},${S(o.text)},${B(o.done)});`);
  for (const c of m.constraints ?? [])
    w(`INSERT INTO mission_constraints(mission_id,label,value,budget,unit) VALUES (${S(m.id)},${S(c.label)},${N(c.value)},${N(c.budget)},${S(c.unit)});`);
  (m.afterAction ?? []).forEach((text, index) =>
    w(`INSERT INTO mission_after_actions(mission_id,position,text) VALUES (${S(m.id)},${index},${S(text)}) ON CONFLICT DO NOTHING;`),
  );
}

// ── CAPABILITIES ────────────────────────────────────────────────────────────
w('\n-- capabilities + deps + asset_capabilities');
for (const c of H.capabilities)
  w(`INSERT INTO capabilities(id,name,description,unlocked) VALUES (${S(c.id)},${S(c.name)},${S(c.description)},${B(c.unlocked)});`);
const seenAssetCaps = new Set<string>();
for (const c of H.capabilities) {
  for (const dep of c.dependsOn ?? [])
    if (capIds.has(dep)) w(`INSERT INTO capability_deps(capability_id,depends_on_id) VALUES (${S(c.id)},${S(dep)}) ON CONFLICT DO NOTHING;`);
  for (const aid of c.unlockedBy ?? []) {
    const key = `${aid}:${c.id}`;
    if (A(aid) && !seenAssetCaps.has(key)) {
      seenAssetCaps.add(key);
      w(`INSERT INTO asset_capabilities(asset_id,capability_id) VALUES (${S(aid)},${S(c.id)}) ON CONFLICT DO NOTHING;`);
    }
  }
}
for (const u of H.units)
  for (const cid of u.capabilities ?? []) {
    const key = `${u.id}:${cid}`;
    if (capIds.has(cid) && !seenAssetCaps.has(key)) {
      seenAssetCaps.add(key);
      w(`INSERT INTO asset_capabilities(asset_id,capability_id) VALUES (${S(u.id)},${S(cid)}) ON CONFLICT DO NOTHING;`);
    }
  }

// ── WISHLIST_META (deferred — capabilities + missions now exist) ────────────
w('\n-- wishlist_meta');
for (const wi of H.wishlist) {
  const cap = wi.unlocks && capIds.has(wi.unlocks) ? S(wi.unlocks) : 'NULL';
  const fu = wi.forUnit && A(wi.forUnit) ? S(wi.forUnit) : 'NULL';
  const fm = wi.forMission && missionIds.has(wi.forMission) ? S(wi.forMission) : 'NULL';
  w(`INSERT INTO wishlist_meta(asset_id,asset_lifecycle,rationale,unlocks_capability_id,risk_note,for_asset_id,for_mission_id) VALUES (${S(wi.id)},'wishlist',${S(wi.rationale)},${cap},${S(wi.riskNote)},${fu},${fm});`);
}

// ── INSIGHTS ────────────────────────────────────────────────────────────────
w('\n-- insights + junctions');
const seenInsightAssets = new Set<string>();
const seenInsightMissions = new Set<string>();
for (const ins of H.insights) {
  w(`INSERT INTO insights(id,title,body,confidence,source,captured_at) VALUES (${S(ins.id)},${S(ins.title)},${S(ins.body)},${S(ins.confidence)},${S(ins.source)},${ins.capturedAt ? S(ins.capturedAt) : 'NULL'});`);
  for (const aid of ins.units ?? []) {
    const key = `${ins.id}:${aid}`;
    if (A(aid) && !seenInsightAssets.has(key)) {
      seenInsightAssets.add(key);
      w(`INSERT INTO insight_assets(insight_id,asset_id) VALUES (${S(ins.id)},${S(aid)}) ON CONFLICT DO NOTHING;`);
    }
  }
  for (const mid of ins.missions ?? []) {
    const key = `${ins.id}:${mid}`;
    if (missionIds.has(mid) && !seenInsightMissions.has(key)) {
      seenInsightMissions.add(key);
      w(`INSERT INTO insight_missions(insight_id,mission_id) VALUES (${S(ins.id)},${S(mid)}) ON CONFLICT DO NOTHING;`);
    }
  }
  (ins.tags ?? []).forEach((t) => w(tagRef('tag', t, 'insight', ins.id)));
}
// reverse: unit.insights[]
for (const u of H.units)
  for (const iid of u.insights ?? []) {
    const key = `${iid}:${u.id}`;
    if (insightIds.has(iid) && !seenInsightAssets.has(key)) {
      seenInsightAssets.add(key);
      w(`INSERT INTO insight_assets(insight_id,asset_id) VALUES (${S(iid)},${S(u.id)}) ON CONFLICT DO NOTHING;`);
    }
  }
// reverse: mission.insights[]
for (const m of H.missions)
  for (const iid of m.insights ?? []) {
    const key = `${iid}:${m.id}`;
    if (insightIds.has(iid) && !seenInsightMissions.has(key)) {
      seenInsightMissions.add(key);
      w(`INSERT INTO insight_missions(insight_id,mission_id) VALUES (${S(iid)},${S(m.id)}) ON CONFLICT DO NOTHING;`);
    }
  }

// ── ACTIVITY ────────────────────────────────────────────────────────────────
w('\n-- activity_log');
for (const ev of H.activity ?? [])
  w(`INSERT INTO activity_log(id,at,kind,text) VALUES (${S(ev.id)},${S(ev.at)},${S(ev.kind)},${S(ev.text)});`);

// ── CONNECTED TWIN: terminals + nets + documents ────────────────────────────
// terminalIds holds only terminals actually emitted, so net_terminals junction
// rows can never reference a terminal that was skipped for an unresolvable unit.
const terminalIds = new Set<string>();
const documentIds = new Set((H.documents ?? []).map((d) => d.id));

w('\n-- terminals');
for (const t of H.terminals ?? []) {
  if (!A(t.unitId)) continue;
  terminalIds.add(t.id);
  w(`INSERT INTO terminals(id,asset_id,name,connector,role,note) VALUES (${S(t.id)},${S(t.unitId)},${S(t.name)},${S(t.connector)},${S(t.role)},${S(t.note)});`);
}

w('\n-- documents + document_assets');
for (const d of H.documents ?? []) {
  w(`INSERT INTO documents(id,title,kind,archive_path,url,note) VALUES (${S(d.id)},${S(d.title)},${S(d.kind)},${S(d.archivePath)},${S(d.url)},${S(d.note)});`);
  for (const uid of d.units ?? [])
    if (A(uid)) w(`INSERT INTO document_assets(document_id,asset_id) VALUES (${S(d.id)},${S(uid)}) ON CONFLICT DO NOTHING;`);
}

w('\n-- nets + net_terminals + net_documents');
for (const n of H.nets ?? []) {
  w(`INSERT INTO nets(id,name,kind,carries,note) VALUES (${S(n.id)},${S(n.name)},${S(n.kind)},${S(n.carries)},${S(n.note)});`);
  for (const tid of n.terminals)
    if (terminalIds.has(tid)) w(`INSERT INTO net_terminals(net_id,terminal_id) VALUES (${S(n.id)},${S(tid)}) ON CONFLICT DO NOTHING;`);
  for (const did of n.documents ?? [])
    if (documentIds.has(did)) w(`INSERT INTO net_documents(net_id,document_id) VALUES (${S(n.id)},${S(did)}) ON CONFLICT DO NOTHING;`);
}

w('\nCOMMIT;');
export const seedSql = out.join('\n') + '\n';

function isCliInvocation() {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint) && resolve(entrypoint) === fileURLToPath(import.meta.url);
}

function writeSeedSqlFromCli() {
  const outIndex = process.argv.indexOf('--out');
  if (outIndex === -1) {
    process.stdout.write(seedSql);
    return;
  }

  const outputPath = process.argv[outIndex + 1];
  if (!outputPath) throw new Error('--out requires a path');
  writeFileSync(outputPath, seedSql, 'utf8');
}

if (isCliInvocation()) {
  writeSeedSqlFromCli();
}
