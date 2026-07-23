import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HangarProvider } from '@/lib/store';

// The detail page reads the route param via next/navigation; drive it per test.
const holder = vi.hoisted(() => ({ docId: 'doc-gdb-schematic' }));
vi.mock('next/navigation', () => ({
  useParams: () => ({ docId: holder.docId }),
}));

import DatacoreDocumentPage from '@/app/datacore/[docId]/page';
import { DriverBoardSchematic } from '@/components/datacore/DriverBoardSchematic';

function renderDoc() {
  return render(
    <HangarProvider>
      <DatacoreDocumentPage />
    </HangarProvider>,
  );
}

describe('Datacore document detail page', () => {
  it('renders a known document with its title and embeds the pinout explorer for the driver board', () => {
    holder.docId = 'doc-gdb-schematic';
    renderDoc();

    expect(
      screen.getByRole('heading', { name: /General Driver for Robots — Schematic/i }),
    ).toBeInTheDocument();
    // driver-board schematic doc embeds the interactive board explorer
    expect(screen.getByText(/Board I\/O Map/i)).toBeInTheDocument();
  });

  it('shows a not-found state for an unknown document id', () => {
    holder.docId = 'doc-does-not-exist';
    renderDoc();

    expect(screen.getByRole('heading', { name: /Document not found/i })).toBeInTheDocument();
  });
});

describe('DriverBoardSchematic', () => {
  it('renders the driver-board interface ports', () => {
    render(
      <HangarProvider>
        <DriverBoardSchematic />
      </HangarProvider>,
    );
    // A sampling of the 11 board ports (each label appears in the SVG and the list)
    expect(screen.getAllByText('BUS SERVO').length).toBeGreaterThan(0);
    expect(screen.getAllByText('40-PIN GPIO').length).toBeGreaterThan(0);
    expect(screen.getAllByText('BATT IN').length).toBeGreaterThan(0);
  });
});
