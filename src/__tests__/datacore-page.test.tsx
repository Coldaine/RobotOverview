import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Datacore from '@/app/datacore/page';
import { HangarProvider } from '@/lib/store';

function renderDatacore() {
  return render(
    <HangarProvider>
      <Datacore />
    </HangarProvider>,
  );
}

describe('Datacore page', () => {
  it('uses shared insight confidence labels in the filter', () => {
    renderDatacore();

    expect(screen.getByRole('option', { name: 'High' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Medium' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Low' })).toBeInTheDocument();
  });

  it('uses shared insight confidence classes on insight chips', () => {
    renderDatacore();

    const highChip = screen.getAllByText('high').find((node) => node.classList.contains('chip'));
    expect(highChip).toHaveClass(
      'chip',
      'border-signal-ok/40',
      'bg-signal-ok/10',
      'text-signal-ok',
    );
  });

  it('surfaces research briefings including compute-workload', () => {
    renderDatacore();

    expect(screen.getByRole('heading', { name: 'Datacore' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Compute Workload Sizing/i })).toHaveAttribute(
      'href',
      '/datacore/compute-workload',
    );
  });

  it('switches to the Hardware Library tab and lists documents linking to detail pages', () => {
    renderDatacore();

    fireEvent.click(screen.getByRole('button', { name: /Hardware Library/i }));

    // A known seeded document surfaces, linking to its detail route.
    const link = screen.getByRole('link', { name: /General Driver for Robots — Schematic/i });
    expect(link).toHaveAttribute('href', '/datacore/doc-gdb-schematic');

    // The knowledge-only confidence filter is not shown on the library tab.
    expect(screen.queryByRole('option', { name: 'High' })).not.toBeInTheDocument();
  });
});
