import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { HangarProvider } from '@/lib/store';
import { hangarData } from '@/data/hangar';
import { ITEM_STATUS_META } from '@/lib/format';
import Items from '@/app/items/page';

function renderItems() {
  return render(
    <HangarProvider>
      <Items />
    </HangarProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('Items station', () => {
  it('renders every seeded inventory item by name', () => {
    renderItems();
    hangarData.items.forEach((it) => {
      expect(screen.getByText(it.name)).toBeInTheDocument();
    });
  });

  it('shows the cataloged count matching the data', () => {
    renderItems();
    // The "Cataloged" stat readout reflects the number of items in the spine.
    const cataloged = screen.getByText('Cataloged').parentElement;
    expect(cataloged).toHaveTextContent(String(hangarData.items.length));
  });

  it('renders the human-readable status label for each item', () => {
    renderItems();
    hangarData.items.forEach((it) => {
      const label = ITEM_STATUS_META[it.status].label;
      // At least one element should carry the status label text.
      expect(screen.getAllByText((_, el) => el?.textContent === label).length).toBeGreaterThan(0);
    });
  });

  it('links a related unit to its detail page', () => {
    renderItems();
    const itemWithUnit = hangarData.items.find((it) => (it.relatedUnits ?? []).length > 0);
    if (!itemWithUnit) return; // no related units in seed data → nothing to assert
    const unitId = itemWithUnit.relatedUnits![0];
    const unitName = hangarData.units.find((u) => u.id === unitId)?.name;
    if (!unitName) return;
    const link = screen
      .getAllByRole('link')
      .find((a) => a.getAttribute('href') === `/unit/${unitId}`);
    expect(link).toBeDefined();
  });

  it('shows an empty-state hint only when there are no items', () => {
    renderItems();
    // Seed data has items, so the empty-state copy must NOT be present.
    expect(screen.queryByText(/No inventory items cataloged yet/i)).not.toBeInTheDocument();
  });
});
