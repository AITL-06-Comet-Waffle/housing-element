import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HazardCard } from './HazardCard';

describe('HazardCard', () => {
  it('renders the title, rating, and detail', () => {
    render(
      <HazardCard title="Wildfire" rating="Very High" detail="State Responsibility Area (SRA)" />,
    );
    expect(screen.getByRole('heading', { name: 'Wildfire' })).toBeInTheDocument();
    expect(screen.getByText('Very High')).toBeInTheDocument();
    expect(screen.getByText('State Responsibility Area (SRA)')).toBeInTheDocument();
  });

  it('omits the detail line when none is given', () => {
    render(<HazardCard title="Wildfire" rating="None" />);
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.queryByText(/Responsibility Area/)).not.toBeInTheDocument();
  });
});
