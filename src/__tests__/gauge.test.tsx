import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HangarProvider } from '@/lib/store';
import { Gauge } from '@/components/ui/Gauge';
import type { ConstraintGauge } from '@/data/types';

function renderGauge(gauge: ConstraintGauge) {
  return render(
    <HangarProvider>
      <Gauge gauge={gauge} />
    </HangarProvider>,
  );
}

beforeEach(() => {
  localStorage.clear(); // default theme = blueprint
});

describe('Gauge (blueprint default theme)', () => {
  it('renders the rounded percentage of value/budget', () => {
    renderGauge({ label: 'Power', value: 10, budget: 100, unit: 'W' });
    expect(screen.getByText('10%')).toBeInTheDocument();
    expect(screen.getByText('[SYS_OK]')).toBeInTheDocument();
  });

  it('does not divide by zero when budget is 0 (no NaN)', () => {
    const { container } = renderGauge({ label: 'Power', value: 5, budget: 0, unit: 'W' });
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it.each(['blueprint', 'industrial', 'topology'])(
    'renders non-finite values as unknown without leaking invalid SVG numbers in %s theme',
    (theme) => {
      localStorage.setItem('hangar:theme', theme);

      const { container } = renderGauge({
        label: 'Power',
        value: Number.NaN,
        budget: Number.POSITIVE_INFINITY,
        unit: 'W',
      });

      expect(screen.getByText('—')).toBeInTheDocument();
      expect(screen.getByText(/(?:BUDGET|LIMIT): —/)).toBeInTheDocument();
      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
    },
  );

  it('clamps negative progress to 0%', () => {
    const { container } = renderGauge({ label: 'Power', value: -5, budget: 100, unit: 'W' });

    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/stroke-dasharray="-|strokeDasharray&quot;:&quot;-/);
  });

  it('flags a warning above the 85% threshold', () => {
    renderGauge({ label: 'Payload', value: 90, budget: 100, unit: 'g' });
    expect(screen.getByText('[WARNING]')).toBeInTheDocument();
  });

  it('flags an overload when value exceeds budget', () => {
    renderGauge({ label: 'Power', value: 120, budget: 100, unit: 'W' });
    expect(screen.getByText('[SYS_OVR]')).toBeInTheDocument();
  });

  it('formats a "$" gauge with currency and a unit gauge with its suffix', () => {
    renderGauge({ label: 'Loadout Cost', value: 1234, budget: 5000, unit: '$' });
    expect(screen.getByText(`$${(1234).toLocaleString('en-US')}`)).toBeInTheDocument();
  });

  it('renders a watt value with its unit suffix', () => {
    renderGauge({ label: 'Power', value: 18, budget: 25, unit: 'W' });
    expect(screen.getByText('18W')).toBeInTheDocument();
  });
});
