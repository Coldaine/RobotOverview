import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BriefingMarkdown } from '@/components/datacore/BriefingMarkdown';

/** Inline fixture — research markdown now lives in Postgres, not content/datacore/. */
const FIXTURE_MARKDOWN = `# Compute Workload Sizing — Orin NX vs AGX Orin

## Start with an objective tree and quantified requirements

Target latency under **29.13 ms** at peak.

## Make a resource-allocation matrix by hardware engine

AGX Orin advertises **275 TOPS**.

## A particularly good Orin NX visualization: OmniNxt

Pipeline diagram placeholder.

## The concrete artifact set I would trust

Benchmark logs and power traces.
`;

describe('BriefingMarkdown', () => {
  it('renders briefing markdown without dropping key sections', () => {
    render(<BriefingMarkdown markdown={FIXTURE_MARKDOWN} />);

    expect(
      screen.getByRole('heading', {
        name: /Compute Workload Sizing — Orin NX vs AGX Orin/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: /Start with an objective tree and quantified requirements/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: /Make a resource-allocation matrix by hardware engine/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: /A particularly good Orin NX visualization: OmniNxt/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /The concrete artifact set I would trust/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/275 TOPS/)).toBeInTheDocument();
    expect(screen.getByText(/29\.13 ms/)).toBeInTheDocument();
  });
});
