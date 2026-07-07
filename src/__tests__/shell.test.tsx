import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HangarProvider } from '@/lib/store';
import { Shell } from '@/components/Shell';

vi.mock('next/navigation', () => ({
  usePathname: () => '/items',
}));

describe('Shell inventory fallback status', () => {
  it('shows Postgres read fallback as a visible warning, not silent fallback', () => {
    render(
      <HangarProvider initialInventoryRead={{ source: 'static', fallbackReason: 'postgres-error' }}>
        <Shell>
          <div>Items content</div>
        </Shell>
      </HangarProvider>,
    );

    const banner = screen.getByRole('status');

    expect(banner).toHaveTextContent('STATIC DATA');
    expect(banner).toHaveTextContent(
      'Postgres read FAILED — serving the hangar.ts spine with this visible warning.',
    );
    expect(banner).not.toHaveTextContent(/silently/i);
  });

  it('does not show the static-data banner for Postgres-backed reads', () => {
    render(
      <HangarProvider initialInventoryRead={{ source: 'postgres' }}>
        <Shell>
          <div>Items content</div>
        </Shell>
      </HangarProvider>,
    );

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
