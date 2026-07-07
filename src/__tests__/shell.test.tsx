import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HangarProvider } from '@/lib/store';
import { Shell } from '@/components/Shell';
import { hangarData } from '@/data/hangar';

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

    expect(banner).toHaveTextContent('STATIC INVENTORY');
    expect(banner).toHaveTextContent(
      'Inventory Postgres read FAILED — serving items from the hangar.ts spine.',
    );
    expect(banner).not.toHaveTextContent(/silently/i);
    expect(screen.getByText(/DATA · STATIC · PG ERR/)).toBeInTheDocument();
  });

  it('does not show the static-data banner for Postgres-backed reads', () => {
    render(
      <HangarProvider initialItems={[hangarData.items[0]]} initialInventoryRead={{ source: 'postgres' }}>
        <Shell>
          <div>Items content</div>
        </Shell>
      </HangarProvider>,
    );

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
