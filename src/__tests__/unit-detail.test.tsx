import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HangarProvider } from '@/lib/store';
import UnitDetail from '@/app/unit/[id]/page';

const { useParamsMock } = vi.hoisted(() => ({
  useParamsMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useParams: useParamsMock,
}));

function renderUnitDetail(unitId: string) {
  useParamsMock.mockReturnValue({ id: unitId });
  return render(
    <HangarProvider>
      <UnitDetail />
    </HangarProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  useParamsMock.mockReset();
});

describe('Unit detail command shortcuts', () => {
  it('shows one combined integration state for unverified BEAST sensors', () => {
    renderUnitDetail('oak-d-lite');

    expect(screen.getByText('Integrating').closest('.chip')).toHaveAttribute(
      'title',
      'Installed or being configured; acceptance checks are incomplete.',
    );
    expect(screen.queryByText('Assembled')).not.toBeInTheDocument();
  });

  it('renders BEAST command shortcuts', () => {
    renderUnitDetail('beast');

    expect(screen.getByText('Command Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('SSH')).toBeInTheDocument();
    expect(screen.getByText('ssh beast-01')).toBeInTheDocument();
    expect(screen.queryByText('Control UI')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Open Control UI/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy SSH' })).toBeInTheDocument();
  });

  it('opens unit reference links with tabnabbing protections', () => {
    renderUnitDetail('beast');
    const unitLink = screen.getByRole('link', { name: 'Waveshare UGV Beast' });

    expect(unitLink).toHaveAttribute('target', '_blank');
    expect(unitLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('does not render command shortcuts for units without shortcuts', () => {
    renderUnitDetail('pi5');

    expect(screen.queryByText('Command Shortcuts')).not.toBeInTheDocument();
    expect(screen.queryByText('Control UI')).not.toBeInTheDocument();
    expect(screen.queryByText('ssh beast-01')).not.toBeInTheDocument();
  });

  it('does not render BEAST-only system surfaces for other flagship units', () => {
    renderUnitDetail('workstation');

    expect(screen.getByRole('heading', { name: 'Threadripper / RTX 5090' })).toBeInTheDocument();
    expect(screen.queryByText('Subsystem Map')).not.toBeInTheDocument();
    expect(screen.queryByText('Connected Twin')).not.toBeInTheDocument();
  });
});
