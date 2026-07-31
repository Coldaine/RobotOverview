/**
 * Resolve research/plan markdown bodies from disk or git history.
 * Used by gen-datacore-corpus and ingest-research-corpus — not by the app runtime.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CORPUS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function gitRevWithFile(rel: string, root = CORPUS_ROOT): string | null {
  const p = rel.replace(/\\/g, '/');
  try {
    execFileSync('git', ['cat-file', '-e', `HEAD:${p}`], { cwd: root, stdio: 'ignore' });
    return 'HEAD';
  } catch {
    // not at HEAD
  }
  try {
    const shas = execFileSync('git', ['log', '--follow', '--format=%H', '--', p], {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const sha of shas) {
      try {
        execFileSync('git', ['cat-file', '-e', `${sha}:${p}`], { cwd: root, stdio: 'ignore' });
        return sha;
      } catch {
        // keep walking
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function corpusSourceExists(rel: string, root = CORPUS_ROOT): boolean {
  if (existsSync(path.resolve(root, rel))) return true;
  return gitRevWithFile(rel, root) !== null;
}

/** Read repo-relative path from disk, or from git history if already deleted. */
export function readCorpusText(rel: string, root = CORPUS_ROOT): string {
  const abs = path.resolve(root, rel);
  if (existsSync(abs)) return readFileSync(abs, 'utf8');
  const rev = gitRevWithFile(rel, root);
  if (!rev) throw new Error(`Missing source file (disk + git history): ${rel}`);
  return execFileSync('git', ['show', `${rev}:${rel.replace(/\\/g, '/')}`], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
}
