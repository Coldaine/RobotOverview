import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { hangarData } from '@/data/hangar';
import Quartermaster from '@/app/quartermaster/page';
import { HangarProvider } from '@/lib/store';
import { money } from '@/lib/format';
import type { SourcePreference } from '@/lib/hangar-preferences';

function renderQuartermaster() {
  return render(
    <HangarProvider>
      <Quartermaster />
    </HangarProvider>,
  );
}

function sourceTotal(source: SourcePreference) {
  return hangarData.wishlist.reduce((sum, wish) => {
    const price = source === 'us' ? wish.price.us : wish.price.import ?? wish.price.us;
    return sum + (price ?? 0);
  }, 0);
}

beforeEach(() => {
  localStorage.clear();
});

describe('Quartermaster source preference', () => {
  it('shows the US tab total by default', () => {
    renderQuartermaster();

    const tab = screen.getByText('Tab (US)').parentElement;

    expect(tab).toHaveTextContent(money(sourceTotal('us')));
  });

  it('switches the tab total and active styling for import sourcing', () => {
    renderQuartermaster();

    const importButton = screen.getByRole('button', { name: 'Import' });
    fireEvent.click(importButton);

    const tab = screen.getByText('Tab (IMP)').parentElement;
    expect(tab).toHaveTextContent(money(sourceTotal('import')));
    expect(importButton).toHaveClass('bg-amber/15', 'text-amber', 'shadow-hud-amber');
  });
});
