import { afterEach, describe, expect, it } from 'vitest';
import type { DocumentRef } from '@/data/types';
import {
  documentSubsystem,
  groupDocumentsBySubsystem,
  resolveDocumentUrl,
  stripArchivePrefix,
} from '@/lib/documents';

const ENV_KEY = 'NEXT_PUBLIC_ARCHIVE_BASE_URL';

function doc(partial: Partial<DocumentRef> & Pick<DocumentRef, 'archivePath'>): DocumentRef {
  return {
    id: partial.id ?? 'doc-x',
    title: partial.title ?? 'Doc',
    kind: partial.kind ?? 'schematic',
    archivePath: partial.archivePath,
    url: partial.url,
    units: partial.units,
    note: partial.note,
  };
}

afterEach(() => {
  delete process.env[ENV_KEY];
});

describe('stripArchivePrefix', () => {
  it('drops the UGV-Beast-Archive/ prefix', () => {
    expect(stripArchivePrefix('UGV-Beast-Archive/02-Driver-Board/x.pdf')).toBe('02-Driver-Board/x.pdf');
  });
  it('leaves already-relative paths alone', () => {
    expect(stripArchivePrefix('02-Driver-Board/x.pdf')).toBe('02-Driver-Board/x.pdf');
  });
});

describe('resolveDocumentUrl', () => {
  it('returns null when no url and no base configured', () => {
    delete process.env[ENV_KEY];
    expect(resolveDocumentUrl(doc({ archivePath: 'UGV-Beast-Archive/02-Driver-Board/x.pdf' }))).toBeNull();
  });

  it('prefers an explicit url', () => {
    process.env[ENV_KEY] = 'https://archive.example.com';
    const url = resolveDocumentUrl(
      doc({ archivePath: 'UGV-Beast-Archive/02-Driver-Board/x.pdf', url: 'https://cdn.example.com/x.pdf' }),
    );
    expect(url).toBe('https://cdn.example.com/x.pdf');
  });

  it('builds a url from base + archive key, trimming trailing slashes', () => {
    process.env[ENV_KEY] = 'https://archive.example.com/';
    const url = resolveDocumentUrl(doc({ archivePath: 'UGV-Beast-Archive/02-Driver-Board/x.pdf' }));
    expect(url).toBe('https://archive.example.com/02-Driver-Board/x.pdf');
  });

  it('url-encodes path segments with spaces', () => {
    process.env[ENV_KEY] = 'https://archive.example.com';
    const url = resolveDocumentUrl(doc({ archivePath: 'UGV-Beast-Archive/05-Chassis-CAD/UGV Beast PT.step' }));
    expect(url).toBe('https://archive.example.com/05-Chassis-CAD/UGV%20Beast%20PT.step');
  });
});

describe('documentSubsystem', () => {
  it('parses the numeric folder into order + human label', () => {
    const s = documentSubsystem(doc({ archivePath: 'UGV-Beast-Archive/06-Jetson-Orin/x.zip' }));
    expect(s).toEqual({ key: '06-Jetson-Orin', order: 6, label: 'Jetson Orin' });
  });
});

describe('groupDocumentsBySubsystem', () => {
  it('groups and orders by numeric folder prefix', () => {
    const groups = groupDocumentsBySubsystem([
      doc({ id: 'a', archivePath: 'UGV-Beast-Archive/06-Jetson-Orin/a.zip' }),
      doc({ id: 'b', archivePath: 'UGV-Beast-Archive/02-Driver-Board/b.pdf' }),
      doc({ id: 'c', archivePath: 'UGV-Beast-Archive/02-Driver-Board/c.zip' }),
    ]);
    expect(groups.map((g) => g.subsystem.key)).toEqual(['02-Driver-Board', '06-Jetson-Orin']);
    expect(groups[0].documents.map((d) => d.id)).toEqual(['b', 'c']);
  });
});
