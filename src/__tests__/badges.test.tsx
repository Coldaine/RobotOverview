import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProvenanceTag } from '@/components/ui/Badges';

describe('ProvenanceTag', () => {
  it('renders the mapped provenance label and classes', () => {
    const { container } = render(<ProvenanceTag provenance="owner" />);

    expect(screen.getByText('OWNER')).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass(
      'chip',
      'text-signal-ok',
      'border-signal-ok/30',
      'bg-signal-ok/5',
    );
  });

  it('renders nothing when provenance is absent', () => {
    const { container } = render(<ProvenanceTag />);

    expect(container).toBeEmptyDOMElement();
  });
});
