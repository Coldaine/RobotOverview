import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hangarData } from '@/data/hangar';

const ROOT = resolve(__dirname, '../..');
const MANIFEST_PATH = resolve(ROOT, 'db/hangar/research-corpus-manifest.json');

type Manifest = {
  briefings: { id: string; kind: string; href: string; repoPath: string | null }[];
  packs: { id: string }[];
};

function loadManifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;
}

describe('research corpus insight pointers', () => {
  const manifest = loadManifest();
  const briefingIds = new Set(manifest.briefings.map((b) => b.id));

  it('every /datacore/briefing/ insight source resolves to a manifest briefing id', () => {
    for (const insight of hangarData.insights) {
      const source = insight.source ?? '';
      if (!source.startsWith('/datacore/briefing/')) continue;
      const id = source.slice('/datacore/briefing/'.length).split(/[?#;]/)[0];
      expect(briefingIds.has(id), `insight ${insight.id} source → unknown briefing '${id}'`).toBe(
        true,
      );
    }
  });

  it('every manifest briefing with repoPath exists on disk', () => {
    for (const b of manifest.briefings) {
      if (!b.repoPath) continue;
      const abs = resolve(ROOT, b.repoPath);
      expect(existsSync(abs), `manifest ${b.id} repoPath missing: ${b.repoPath}`).toBe(true);
    }
  });

  it('no insight source may contain content/datacore/, artifactIntake/, or end with .md', () => {
    for (const insight of hangarData.insights) {
      const source = insight.source ?? '';
      expect(
        source.includes('content/datacore/'),
        `insight ${insight.id} still points at content/datacore/`,
      ).toBe(false);
      expect(
        source.includes('artifactIntake/'),
        `insight ${insight.id} still points at artifactIntake/`,
      ).toBe(false);
      // Corpus cutover: briefing pointers are hrefs. Owner-doc paths that still
      // end in .md (docs/NORTH_STAR.md, keyArtifactstosort/…/INDEX.md) are
      // outside this wave — only flag .md leftovers that look like research paths
      // or briefing hrefs that incorrectly kept a suffix.
      if (
        source.startsWith('/datacore/briefing/') ||
        source.includes('content/datacore') ||
        source.includes('artifactIntake')
      ) {
        expect(source.endsWith('.md'), `insight ${insight.id} source ends with .md`).toBe(false);
      }
    }
  });
});
