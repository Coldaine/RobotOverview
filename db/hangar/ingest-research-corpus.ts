/**
 * One-time (replayable, idempotent) migration: land the Datacore research corpus
 * into Postgres via ingest op verbs, then write research-corpus-manifest.json.
 *
 *   npx tsx db/hangar/ingest-research-corpus.ts [--dry-run]
 *
 * This file is the durable corpus record after Wave 3 deletes
 * `src/data/datacore-briefings.ts` and the research markdown. Bodies are read
 * from disk when present, otherwise from `git show HEAD:<path>`.
 *
 * Live run expects HANGAR_DB_* (or HANGAR_DATABASE_URL) from the orchestrator.
 * --dry-run validates sources and prints the plan; no DB connection.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeHangarPoolForTests } from '../../src/server/hangar/db';
import { getHangarDrizzle, type HangarDrizzle } from '../../src/server/hangar/drizzle';
import { opLandBriefing, opLandPack } from '../../src/server/hangar/ingest';
import { briefings } from '../../src/server/hangar/schema';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST_PATH = path.join(ROOT, 'db/hangar/research-corpus-manifest.json');

type BriefingKind = 'research' | 'plan';

type CorpusBriefing = {
  id: string;
  title: string;
  href: string;
  source: string;
  kind: BriefingKind;
  summary: string;
  tags: string[];
  aliases?: string[];
  packId?: string;
  capturedAt: string;
};

type CorpusPack = {
  id: string;
  title: string;
  code: string;
  summary: string;
  hubBriefingId: string;
  topics: string[];
};

/**
 * Snapshot of DATACORE_PACKS + DATACORE_BRIEFINGS (plus evidence extra;
 * cad-assets overridden to plan → docs/hardware-library.md).
 * Kept inline so this script remains runnable after the TS registry is deleted.
 */
const CORPUS_PACKS: CorpusPack[] = [
  {
    id: 'beast-vision',
    title: 'Beast Vision & Capture',
    code: 'RND-BEAST-VISION',
    summary:
      'Non-definitive research pack: offline splat architecture, servo-head camera candidate, killed paths, open LiDAR choice, and the method post-mortem.',
    hubBriefingId: 'beast-vision',
    topics: [
      'vision',
      'splat',
      'gaussian',
      'colmap',
      'arducam',
      'imx678',
      'livox',
      'mid-360',
      'airy',
      'rejected',
      'thermal',
      'fpv',
    ],
  },
];

const CORPUS_BRIEFINGS: CorpusBriefing[] = [
  {
    id: 'robot-control-llms',
    title: 'Robot Control LLMs — Hangar Briefing',
    href: '/datacore/briefing/robot-control-llms',
    source: 'content/datacore/robot-control-llms.md',
    kind: 'research',
    summary:
      'Three-lane taxonomy for LLM robot control (orchestrator / VLA / world-action model), Cosmos 3 Edge analysis, Orin Nano fit matrices, and the recommended Hangar progression. Codename RND-ROBOT-LLM; insights persisted in hangar.ts.',
    tags: ['llm', 'vla', 'autonomy', 'orin', 'control', 'research'],
    aliases: ['rnd-robot-llm', 'cosmos', 'world action model', 'orchestrator'],
    capturedAt: '2026-07-22',
  },
  {
    id: 'compute-workload',
    title: 'Compute Workload Sizing — Orin NX vs AGX Orin',
    href: '/datacore/briefing/compute-workload',
    source: 'content/datacore/compute-workload.md',
    kind: 'research',
    summary:
      'How engineers formally represent the workload that leads to Orin NX versus AGX Orin: linked views from requirements through measured runtime — not a single TOPS diagram.',
    tags: ['compute', 'jetson', 'orin', 'sizing'],
    aliases: ['tops', 'agx', 'orin nx', 'workload', 'pipeline'],
    capturedAt: '2026-07-23',
  },
  {
    id: 'artifact-intake',
    title: 'BEAST-01 Source Artifacts — Intake Register',
    href: '/datacore/briefing/artifact-intake',
    source: 'keyArtifactstosort/INTAKE-REGISTER.md',
    kind: 'research',
    summary:
      'Every source artifact verified by hash and opened: what each file actually is, what each image actually depicts, eleven anomalies where the filename lies about the contents, and five things the files cannot establish.',
    tags: ['artifacts', 'beast', 'provenance', 'schematic'],
    aliases: ['keyartifacts', 'hash', 'intake register', 'filename lies'],
    capturedAt: '2026-07-27',
  },
  {
    id: 'wiring-model-completion',
    title: 'Finish the Wiring Model — One Spine, Two Eyes',
    href: '/datacore/briefing/wiring-model-completion',
    source: 'docs/plans/2026-07-30-wiring-model-completion.md',
    kind: 'plan',
    summary:
      'The single wiring work order: close the half-fed spine so The Board and the console project from wiring.ts, extract the corpus (schematics, firmware, photos, CAD), land facts with zone citations, and put operator-critical answers on screen.',
    tags: ['architecture', 'wiring', 'beast', 'schematic', 'cad'],
    aliases: ['join key', 'the board', 'wiring spine', 'netlist', 'grain', 'x1'],
    capturedAt: '2026-07-30',
  },
  {
    // Owner doc stays in repo — land as plan with repo_path (no body ingest).
    id: 'cad-assets',
    title: 'CAD Assets — Where They Live and What They Are For',
    href: '/datacore/briefing/cad-assets',
    source: 'docs/hardware-library.md',
    kind: 'plan',
    summary:
      'Seven Waveshare CAD archives on the data/hardware-cad-assets LFS branch, three filename traps that send agents to the wrong file, and fetch commands. The X1–X6 exploration work moved into the wiring-model plan.',
    tags: ['cad', 'beast', 'mounting', 'jetson'],
    aliases: ['step', 'stl', 'mounting pattern', 'x1'],
    capturedAt: '2026-07-27',
  },
  {
    id: 'beast-vision',
    title: 'Beast Vision and Capture — Research Index',
    href: '/datacore/briefing/beast-vision',
    source: 'artifactIntake/00-MASTER-beast-vision.md',
    kind: 'research',
    summary:
      'Research index (non-definitive): Build A offline splat vs Build B live nav, current open questions, and reading order for the vision pack.',
    tags: ['vision', 'beast', 'research', 'splat', 'camera', 'lidar'],
    aliases: [
      'rnd-beast-vision',
      'build a',
      'build b',
      'gaussian splat',
      '3dgs',
      'appearance capture',
      'stop-and-shoot',
      'servo head',
      'pan-tilt camera',
    ],
    packId: 'beast-vision',
    capturedAt: '2026-07-28',
  },
  {
    id: 'beast-splat-architecture',
    title: 'Splatting Architecture — Images Carry Poses',
    href: '/datacore/briefing/beast-splat-architecture',
    source: 'artifactIntake/01-splatting-architecture.md',
    kind: 'research',
    summary:
      'Research ruling (non-definitive): Architecture B for Build A — COLMAP/SfM poses from parked stop-and-shoot images; LiDAR as geometry enrichment, not pose master.',
    tags: ['vision', 'beast', 'research', 'splat', 'architecture'],
    aliases: [
      'gaussian',
      '3dgs',
      'colmap',
      'sfm',
      'dn-splatter',
      'lidar-gsplat',
      'splatfacto',
      'nerfstudio',
      'architecture a',
      'architecture b',
      'depth supervision',
      'pose',
      'parked capture',
    ],
    packId: 'beast-vision',
    capturedAt: '2026-07-28',
  },
  {
    id: 'beast-servo-camera',
    title: 'Servo-Head Camera — Research Candidate',
    href: '/datacore/briefing/beast-servo-camera',
    source: 'artifactIntake/02-camera-decision.md',
    kind: 'research',
    summary:
      'Research candidate (not purchased): Arducam B0497 IMX678 for the pan-tilt head, pending focus / IR-cut / fps flags. Fixed slot stays owned OAK-D Lite.',
    tags: ['vision', 'beast', 'research', 'camera'],
    aliases: [
      'arducam',
      'b0497',
      'imx678',
      'starvis',
      'imx585',
      'uvc',
      'm12',
      'servo camera',
      'pan tilt',
      'oak-d',
      'rolling shutter',
    ],
    packId: 'beast-vision',
    capturedAt: '2026-07-28',
  },
  {
    id: 'beast-rejected-paths',
    title: 'Vision Paths Rejected — Do Not Re-Propose Blindly',
    href: '/datacore/briefing/beast-rejected-paths',
    source: 'artifactIntake/03-rejected-paths.md',
    kind: 'research',
    summary:
      'Research kill list: FPV chains, Insta360, IP PTZ, thermal, optical zoom, and machine-vision cameras killed under the current premise — read before reopening.',
    tags: ['vision', 'beast', 'research', 'rejected', 'camera'],
    aliases: [
      'killed',
      'kill list',
      'fpv',
      'dji',
      'walksnail',
      'o3',
      'insta360',
      'ptz',
      'thermal',
      'lepton',
      'infiray',
      'zoom',
      'blackfly',
      'lucid',
      'triton',
    ],
    packId: 'beast-vision',
    capturedAt: '2026-07-28',
  },
  {
    id: 'beast-lidar-open',
    title: 'LiDAR Upgrade — Still Open',
    href: '/datacore/briefing/beast-lidar-open',
    source: 'artifactIntake/04-lidar-open-decision.md',
    kind: 'research',
    summary:
      'Open research (not a ruling): Livox Mid-360S vs RoboSense Airy 96, plus unresolved servo-vs-rigid mounting for navigation SLAM.',
    tags: ['vision', 'beast', 'research', 'lidar'],
    aliases: [
      'livox',
      'mid-360',
      'mid360',
      'mid-360s',
      'robosense',
      'airy',
      'airy 96',
      'fast-lio',
      'fast-livo',
      'slam',
      'point rate',
    ],
    packId: 'beast-vision',
    capturedAt: '2026-07-28',
  },
  {
    id: 'beast-research-method',
    title: 'Vision Research Method Post-Mortem',
    href: '/datacore/briefing/beast-research-method',
    source: 'artifactIntake/05-research-method.md',
    kind: 'research',
    summary:
      'How the vision exploration went wrong (spec-sheet queries, self-citation) and which communities actually answer failure modes.',
    tags: ['vision', 'beast', 'research', 'method'],
    aliases: [
      'post-mortem',
      'spec sheet',
      'self-citation',
      'nvidia forums',
      'ros discourse',
      'radiancefields',
      'koide',
      'calibration toolbox',
      'hku-mars',
    ],
    packId: 'beast-vision',
    capturedAt: '2026-07-28',
  },
  {
    id: 'beast-evidence-manifest',
    title: 'BEAST-01 Source Evidence Manifest',
    href: '/datacore/briefing/beast-evidence-manifest',
    source: 'keyArtifactstosort/reference/EVIDENCE-MANIFEST.md',
    kind: 'research',
    summary:
      'Historical SHA256 manifest of BEAST-01 source evidence cached under UGV-Beast-Archive/ on 2026-07-01; verify local cache and upstream before migrating payloads.',
    tags: ['artifacts', 'beast', 'provenance', 'evidence'],
    packId: 'beast-vision',
    capturedAt: '2026-07-27',
  },
];

type ManifestBriefing = {
  id: string;
  kind: BriefingKind;
  href: string;
  repoPath: string | null;
};

type Manifest = {
  briefings: ManifestBriefing[];
  packs: { id: string }[];
};

type LandPlan = {
  id: string;
  title: string;
  kind: BriefingKind;
  summary: string;
  tags: string[];
  aliases?: string[];
  packId?: string;
  capturedAt: string;
  href: string;
  bodyMarkdown: string | null;
  repoPath: string | null;
  sourcePath: string;
  bytes: number;
};

/** Read repo-relative path from disk, or from git HEAD if already deleted. */
// Files deleted from the working tree AND from HEAD (Wave 3) still exist in
// history — resolve the last commit that contained the path.
function gitRevWithFile(rel: string): string | null {
  const p = rel.replace(/\\/g, '/');
  try {
    execFileSync('git', ['cat-file', '-e', `HEAD:${p}`], { cwd: ROOT, stdio: 'ignore' });
    return 'HEAD';
  } catch {
    // not at HEAD — fall through to history search
  }
  try {
    // Most recent commit touching the path may be its deletion — walk history
    // until a commit where the file actually exists.
    const shas = execFileSync('git', ['log', '--format=%H', '--', p], {
      cwd: ROOT,
      encoding: 'utf8',
    })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const sha of shas) {
      try {
        execFileSync('git', ['cat-file', '-e', `${sha}:${p}`], { cwd: ROOT, stdio: 'ignore' });
        return sha;
      } catch {
        // deleted/absent in this commit — keep walking
      }
    }
    return null;
  } catch {
    return null;
  }
}

function readRepoText(rel: string): string {
  const abs = path.resolve(ROOT, rel);
  if (existsSync(abs)) return readFileSync(abs, 'utf8');
  const rev = gitRevWithFile(rel);
  if (!rev) throw new Error(`Missing source file (disk + git history): ${rel}`);
  return execFileSync('git', ['show', `${rev}:${rel.replace(/\\/g, '/')}`], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
}

function sourceExists(rel: string): boolean {
  if (existsSync(path.resolve(ROOT, rel))) return true;
  return gitRevWithFile(rel) !== null;
}

function buildLandPlans(): LandPlan[] {
  const plans: LandPlan[] = [];
  for (const b of CORPUS_BRIEFINGS) {
    if (!sourceExists(b.source)) {
      throw new Error(`Missing source file for briefing '${b.id}': ${b.source}`);
    }
    const isPlan = b.kind === 'plan';
    const body = isPlan ? null : readRepoText(b.source);
    const bytes = isPlan ? 0 : Buffer.byteLength(body!, 'utf8');
    plans.push({
      id: b.id,
      title: b.title,
      kind: b.kind,
      summary: b.summary,
      tags: b.tags,
      aliases: b.aliases,
      packId: b.packId,
      capturedAt: b.capturedAt,
      href: b.href,
      bodyMarkdown: body,
      repoPath: isPlan ? b.source : null,
      sourcePath: b.source,
      bytes,
    });
  }
  return plans;
}

/**
 * SA-4 `opLandBriefing` only accepts kind:'research' + bodyMarkdown.
 * Plan rows need repo_path and null body — equivalent upsert until the op grows.
 */
async function landPlanBriefing(
  db: HangarDrizzle,
  input: {
    id: string;
    title: string;
    summary: string;
    tags: string[];
    aliases?: string[];
    packId?: string;
    capturedAt?: string;
    href: string;
    repoPath: string;
  },
): Promise<string> {
  await db
    .insert(briefings)
    .values({
      id: input.id,
      title: input.title,
      kind: 'plan',
      summary: input.summary,
      tags: input.tags,
      aliases: input.aliases ?? [],
      packId: input.packId ?? null,
      capturedAt: input.capturedAt ?? null,
      href: input.href,
      bodyMarkdown: null,
      repoPath: input.repoPath,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: briefings.id,
      set: {
        title: input.title,
        kind: 'plan',
        summary: input.summary,
        tags: input.tags,
        aliases: input.aliases ?? [],
        packId: input.packId ?? null,
        capturedAt: input.capturedAt ?? null,
        href: input.href,
        bodyMarkdown: null,
        repoPath: input.repoPath,
        updatedAt: new Date(),
      },
    });
  return input.id;
}

function writeManifest(landPlans: LandPlan[]): Manifest {
  const manifest: Manifest = {
    briefings: landPlans.map((p) => ({
      id: p.id,
      kind: p.kind,
      href: p.href,
      repoPath: p.repoPath,
    })),
    packs: CORPUS_PACKS.map((p) => ({ id: p.id })),
  };
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

async function landAll(db: HangarDrizzle, landPlans: LandPlan[]): Promise<void> {
  // 1) Packs without hub (SQL FK briefing_packs_hub_fk → briefings).
  for (const pack of CORPUS_PACKS) {
    await opLandPack(db, {
      id: pack.id,
      title: pack.title,
      code: pack.code,
      summary: pack.summary,
      topics: pack.topics,
    });
  }

  // 2) Briefings (pack_id FK → packs already present).
  for (const plan of landPlans) {
    if (plan.kind === 'research') {
      if (!plan.bodyMarkdown) {
        throw new Error(`Research briefing '${plan.id}' has empty body`);
      }
      await opLandBriefing(db, {
        id: plan.id,
        title: plan.title,
        kind: 'research',
        summary: plan.summary,
        tags: plan.tags,
        aliases: plan.aliases,
        packId: plan.packId,
        capturedAt: plan.capturedAt,
        href: plan.href,
        bodyMarkdown: plan.bodyMarkdown,
      });
    } else {
      if (!plan.repoPath) {
        throw new Error(`Plan briefing '${plan.id}' missing repoPath`);
      }
      await landPlanBriefing(db, {
        id: plan.id,
        title: plan.title,
        summary: plan.summary,
        tags: plan.tags,
        aliases: plan.aliases,
        packId: plan.packId,
        capturedAt: plan.capturedAt,
        href: plan.href,
        repoPath: plan.repoPath,
      });
    }
  }

  // 3) Link pack hubs now that briefings exist.
  for (const pack of CORPUS_PACKS) {
    await opLandPack(db, {
      id: pack.id,
      title: pack.title,
      code: pack.code,
      summary: pack.summary,
      topics: pack.topics,
      hubBriefingId: pack.hubBriefingId,
    });
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const landPlans = buildLandPlans();
  const bytes = landPlans.reduce((n, p) => n + p.bytes, 0);
  writeManifest(landPlans);

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          packs: CORPUS_PACKS.length,
          briefings: landPlans.length,
          bytes,
          dryRun: true,
          briefingsDetail: landPlans.map((p) => ({
            id: p.id,
            kind: p.kind,
            sourcePath: p.sourcePath,
            bytes: p.bytes,
            repoPath: p.repoPath,
          })),
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({
        packs: CORPUS_PACKS.length,
        briefings: landPlans.length,
        bytes,
      }),
    );
    return;
  }

  const db = await getHangarDrizzle();
  if (!db) {
    throw new Error(
      'Hangar database is not configured (set HANGAR_DB_HOST… or HANGAR_DATABASE_URL)',
    );
  }

  try {
    await landAll(db, landPlans);
  } finally {
    await closeHangarPoolForTests();
  }

  console.log(
    JSON.stringify({
      packs: CORPUS_PACKS.length,
      briefings: landPlans.length,
      bytes,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
