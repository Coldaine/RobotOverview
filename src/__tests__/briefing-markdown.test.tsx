import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BriefingMarkdown } from '@/components/datacore/BriefingMarkdown';

describe('BriefingMarkdown', () => {
  it('renders the compute-workload briefing without dropping key sections', () => {
    const markdown = readFileSync(
      path.join(process.cwd(), 'content/datacore/compute-workload.md'),
      'utf8',
    );

    render(<BriefingMarkdown markdown={markdown} />);

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
