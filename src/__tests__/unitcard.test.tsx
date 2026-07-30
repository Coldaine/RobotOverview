import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HangarProvider } from '@/lib/store';
import { UnitCard } from '@/components/UnitCard';
import type { Mission, Unit } from '@/data/types';

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 'test-unit',
    name: 'Test Unit',
    bay: 'robotics',
    class: 'Test Class',
    status: 'operational',
    summary: 'A unit under test.',
    specs: [],
    ...overrides,
  };
}

function makeMission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: 'test-mission',
    code: 'MSN-T',
    name: 'Test Mission',
    status: 'planning',
    objective: '',
    requisitionedUnits: ['test-unit'],
    requiredLoadout: [],
    wishlist: [],
    objectives: [],
    constraints: [],
    ...overrides,
  };
}

function renderCard(ui: React.ReactNode) {
  return render(<HangarProvider>{ui}</HangarProvider>);
}

beforeEach(() => {
  localStorage.clear();
});

describe('UnitCard requirement & draw flags', () => {
  it('shows "High Draw" for a robotics unit drawing >=25W', () => {
    renderCard(<UnitCard unit={makeUnit({ bay: 'robotics', power: { watts: 25, rail: '5V' } })} />);
    expect(screen.getByText('High Draw')).toBeInTheDocument();
  });

  it('does NOT show "High Draw" for a high-watt unit outside the robotics bay', () => {
    renderCard(<UnitCard unit={makeUnit({ bay: 'compute', power: { watts: 600, rail: 'mains' } })} />);
    expect(screen.queryByText('High Draw')).not.toBeInTheDocument();
  });

  it('shows "Req Missing" when a required loadout maps to an empty slot', () => {
    const unit = makeUnit({
      loadout: [{ slot: 'Lighting', filledBy: null }],
    });
    const mission = makeMission({ requiredLoadout: ['Lighting'] });
    renderCard(<UnitCard unit={unit} mission={mission} />);
    expect(screen.getByText('Req Missing')).toBeInTheDocument();
  });

  it('does NOT show "Req Missing" when the required slot is filled', () => {
    const unit = makeUnit({
      loadout: [{ slot: 'Lighting', filledBy: 'some-light' }],
    });
    const mission = makeMission({ requiredLoadout: ['Lighting'] });
    renderCard(<UnitCard unit={unit} mission={mission} />);
    expect(screen.queryByText('Req Missing')).not.toBeInTheDocument();
  });

  it('shows neither flag for a low-draw unit with no mission context', () => {
    renderCard(<UnitCard unit={makeUnit({ bay: 'robotics', power: { watts: 5, rail: '5V' } })} />);
    expect(screen.queryByText('High Draw')).not.toBeInTheDocument();
    expect(screen.queryByText('Req Missing')).not.toBeInTheDocument();
  });

  it('renders the unit name as a link to its detail page', () => {
    renderCard(<UnitCard unit={makeUnit({ id: 'beast', name: 'UGV Beast' })} />);
    const link = screen.getAllByRole('link').find((a) => a.getAttribute('href') === '/unit/beast');
    expect(link).toBeDefined();
  });
});
