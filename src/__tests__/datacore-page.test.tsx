import { render, screen } from '@testing-library/react';
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
});
