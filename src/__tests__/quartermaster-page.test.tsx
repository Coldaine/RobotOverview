import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { hangarData } from '@/data/hangar';
import Quartermaster from '@/app/quartermaster/page';
import { HangarProvider } from '@/lib/store';
import { ACQUISITION_PIPELINE_STATUSES, money } from '@/lib/format';
import { sourcePriceOrZero, type SourcePreference } from '@/lib/hangar-preferences';

function renderQuartermaster() {
  return render(
    <HangarProvider>
      <Quartermaster />
    </HangarProvider>,
  );
}

function sourceTotal(source: SourcePreference) {
  return hangarData.wishlist.reduce((sum, wish) => {
    return sum + sourcePriceOrZero(wish.price, source);
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

describe('Quartermaster acquisition stepper', () => {
  it('disables stepper buttons at the ends of the acquisition pipeline', () => {
    const first = hangarData.wishlist.find((wish) => wish.status === ACQUISITION_PIPELINE_STATUSES[0]);
    const last = hangarData.wishlist.find((wish) => wish.id !== first?.id);
    expect(first, 'fixture needs a first pipeline item').toBeDefined();
    expect(last, 'fixture needs a second item for the received override').toBeDefined();

    localStorage.setItem('hangar:wishStatus', JSON.stringify({ [last!.id]: 'received' }));

    renderQuartermaster();

    expect(screen.getByRole('button', { name: `Move ${first!.name} back a stage` })).toBeDisabled();
    expect(screen.getByRole('button', { name: `Advance ${first!.name} a stage` })).toBeEnabled();
    expect(screen.getByRole('button', { name: `Move ${last!.name} back a stage` })).toBeEnabled();
    expect(screen.getByRole('button', { name: `Advance ${last!.name} a stage` })).toBeDisabled();
  });
});
