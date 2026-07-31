/** Client-safe Datacore briefing/pack shapes and collection-first search helpers. */

export type BriefingKind = 'research' | 'plan';

export type DatacoreBriefing = {
  id: string;
  title: string;
  href: string;
  /**
   * Domain `source`: trusted repo-relative path when known (from `repo_path`),
   * otherwise empty for research rows that live only as inlined markdown.
   */
  source: string;
  kind: BriefingKind;
  summary: string;
  tags: string[];
  aliases?: string[];
  packId?: string;
  capturedAt: string;
};

export type DatacorePack = {
  id: string;
  title: string;
  code: string;
  summary: string;
  hubBriefingId: string;
  topics: string[];
};

export type DatacoreBriefingRow = DatacoreBriefing & {
  bodyMarkdown: string | null;
  repoPath: string | null;
};

export function briefingById(
  allBriefings: DatacoreBriefingRow[],
  id: string,
): DatacoreBriefingRow | undefined {
  return allBriefings.find((b) => b.id === id);
}

export function packById(allPacks: DatacorePack[], id: string): DatacorePack | undefined {
  return allPacks.find((p) => p.id === id);
}

export function briefingsInPack(
  allBriefings: DatacoreBriefingRow[],
  packId: string,
): DatacoreBriefingRow[] {
  return allBriefings.filter((b) => b.packId === packId);
}

/** Lowercased haystack for Datacore Knowledge Core search. */
export function briefingSearchHaystack(b: DatacoreBriefingRow): string {
  return [
    b.id,
    b.title,
    b.summary,
    b.kind,
    b.tags.join(' '),
    (b.aliases ?? []).join(' '),
    b.packId ?? '',
  ]
    .join(' ')
    .toLowerCase();
}

export function packSearchHaystack(p: DatacorePack): string {
  return [p.id, p.title, p.code, p.summary, p.topics.join(' ')].join(' ').toLowerCase();
}

export function briefingMatchesQuery(b: DatacoreBriefingRow, needle: string): boolean {
  if (!needle) return true;
  return briefingSearchHaystack(b).includes(needle);
}

export function packMatchesQuery(
  p: DatacorePack,
  needle: string,
  allBriefings: DatacoreBriefingRow[],
): boolean {
  if (!needle) return true;
  if (packSearchHaystack(p).includes(needle)) return true;
  return briefingsInPack(allBriefings, p.id).some((b) => briefingMatchesQuery(b, needle));
}
