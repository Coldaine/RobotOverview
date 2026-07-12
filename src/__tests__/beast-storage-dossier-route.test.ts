import { describe, expect, it } from 'vitest';
import { GET } from '@/app/design/beast-storage/[asset]/route';

describe('BEAST storage dossier route', () => {
  it('serves the canonical dossier HTML from the production route', async () => {
    const response = await GET(new Request('http://hangar.test/design/beast-storage/index.html'), {
      params: Promise.resolve({ asset: 'index.html' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    await expect(response.text()).resolves.toContain('2 TB NVMe dossier');
  });

  it('rejects paths outside the dossier allowlist', async () => {
    const response = await GET(new Request('http://hangar.test/design/beast-storage/../../package.json'), {
      params: Promise.resolve({ asset: '../../package.json' }),
    });

    expect(response.status).toBe(404);
  });
});
