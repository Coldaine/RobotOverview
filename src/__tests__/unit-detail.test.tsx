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
  it('renders BEAST supervised command shortcuts', () => {
    renderUnitDetail('beast');

    expect(screen.getByText('Command Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Control UI')).toBeInTheDocument();
    expect(screen.getByText('http://beast.local:5000')).toBeInTheDocument();
    expect(screen.getByText('JupyterLab')).toBeInTheDocument();
    expect(screen.getByText('http://beast.local:8888')).toBeInTheDocument();
    expect(screen.getByText('Camera stream')).toBeInTheDocument();
    expect(screen.getByText('http://beast.local:5000/video_feed')).toBeInTheDocument();
    expect(screen.getByText('SSH')).toBeInTheDocument();
    expect(screen.getByText('ssh ws@192.168.20.184')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Control UI' })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('button', { name: 'Copy SSH' })).toBeInTheDocument();
  });

  it('does not render command shortcuts for units without shortcuts', () => {
    renderUnitDetail('pi5');

    expect(screen.queryByText('Command Shortcuts')).not.toBeInTheDocument();
    expect(screen.queryByText('Control UI')).not.toBeInTheDocument();
    expect(screen.queryByText('ssh ws@192.168.20.184')).not.toBeInTheDocument();
  });
});
