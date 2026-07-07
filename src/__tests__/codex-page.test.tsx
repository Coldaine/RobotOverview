import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Codex from '@/app/codex/page';
import { HangarProvider } from '@/lib/store';

function renderCodex() {
  return render(
    <HangarProvider>
      <Codex />
    </HangarProvider>,
  );
}

describe('Codex page', () => {
  it('uses shared insight confidence labels in the filter', () => {
    renderCodex();

    expect(screen.getByRole('option', { name: 'High' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Medium' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Low' })).toBeInTheDocument();
  });

  it('uses shared insight confidence classes on insight chips', () => {
    renderCodex();

    const highChip = screen.getAllByText('high').find((node) => node.classList.contains('chip'));
    expect(highChip).toHaveClass(
      'chip',
      'border-signal-ok/40',
      'bg-signal-ok/10',
      'text-signal-ok',
    );
  });
});
