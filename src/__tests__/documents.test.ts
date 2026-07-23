import { afterEach, describe, expect, it } from 'vitest';
import type { DocumentRef } from '@/data/types';
import {
  documentSubsystem,
  groupDocumentsBySubsystem,
  resolveDocumentUrl,
  stripLibraryPrefix,
} from '@/lib/documents';

const ENV_KEY = 'NEXT_PUBLIC_DATACORE_LIBRARY_URL';

function doc(partial: Partial<DocumentRef> & Pick<DocumentRef, 'libraryPath'>): DocumentRef {
  return {
    id: partial.id ?? 'doc-x',
    title: partial.title ?? 'Doc',
    kind: partial.kind ?? 'schematic',
    libraryPath: partial.libraryPath,
    url: partial.url,
    units: partial.units,
    note: partial.note,
  };
}

afterEach(() => {
  delete process.env[ENV_KEY];
});

describe('stripLibraryPrefix', () => {
  it('drops the beast/ prefix', () => {
    expect(stripLibraryPrefix('beast/02-Driver-Board/x.pdf')).toBe('02-Driver-Board/x.pdf');
  });
  it('leaves already-relative paths alone', () => {
    expect(stripLibraryPrefix('02-Driver-Board/x.pdf')).toBe('02-Driver-Board/x.pdf');
  });
});

describe('resolveDocumentUrl', () => {
  it('returns null when no url and no base configured', () => {
    delete process.env[ENV_KEY];
    expect(resolveDocumentUrl(doc({ libraryPath: 'beast/02-Driver-Board/x.pdf' }))).toBeNull();
  });

  it('prefers an explicit url', () => {
    process.env[ENV_KEY] = 'https://library.example.com';
    const url = resolveDocumentUrl(
      doc({ libraryPath: 'beast/02-Driver-Board/x.pdf', url: 'https://cdn.example.com/x.pdf' }),
    );
    expect(url).toBe('https://cdn.example.com/x.pdf');
  });

  it('builds a url from base + library key, trimming trailing slashes', () => {
    process.env[ENV_KEY] = 'https://library.example.com/';
    const url = resolveDocumentUrl(doc({ libraryPath: 'beast/02-Driver-Board/x.pdf' }));
    expect(url).toBe('https://library.example.com/02-Driver-Board/x.pdf');
  });

  it('url-encodes path segments with spaces', () => {
    process.env[ENV_KEY] = 'https://library.example.com';
    const url = resolveDocumentUrl(doc({ libraryPath: 'beast/05-Chassis-CAD/UGV Beast PT.step' }));
    expect(url).toBe('https://library.example.com/05-Chassis-CAD/UGV%20Beast%20PT.step');
  });
});

describe('documentSubsystem', () => {
  it('parses the numeric folder into order + human label', () => {
    const s = documentSubsystem(doc({ libraryPath: 'beast/06-Jetson-Orin/x.zip' }));
    expect(s).toEqual({ key: '06-Jetson-Orin', order: 6, label: 'Jetson Orin' });
  });
});

describe('groupDocumentsBySubsystem', () => {
  it('groups and orders by numeric folder prefix', () => {
    const groups = groupDocumentsBySubsystem([
      doc({ id: 'a', libraryPath: 'beast/06-Jetson-Orin/a.zip' }),
      doc({ id: 'b', libraryPath: 'beast/02-Driver-Board/b.pdf' }),
      doc({ id: 'c', libraryPath: 'beast/02-Driver-Board/c.zip' }),
    ]);
    expect(groups.map((g) => g.subsystem.key)).toEqual(['02-Driver-Board', '06-Jetson-Orin']);
    expect(groups[0].documents.map((d) => d.id)).toEqual(['b', 'c']);
  });
});
