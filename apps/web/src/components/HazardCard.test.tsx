import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HazardCard } from './HazardCard';

describe('HazardCard', () => {
  it('renders the title, rating, and detail', () => {
    render(
      <HazardCard
        title="Wildfire"
        rating="Very High"
        severity="very-high"
        detail="State Responsibility Area (SRA)"
      />,
    );
    expect(screen.getByRole('heading', { name: 'Wildfire' })).toBeInTheDocument();
    expect(screen.getByText('Very High')).toBeInTheDocument();
    expect(screen.getByText('State Responsibility Area (SRA)')).toBeInTheDocument();
  });

  it('omits the detail line when none is given', () => {
    render(<HazardCard title="Flood" rating="None" severity="none" />);
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.queryByText(/Responsibility Area/)).not.toBeInTheDocument();
  });

  it('applies a tone derived from severity (very-high → red)', () => {
    const { container } = render(
      <HazardCard title="Earthquake" rating=">= 0.6 g" severity="very-high" />,
    );
    expect((container.firstChild as HTMLElement).className).toContain('red');
  });
});
