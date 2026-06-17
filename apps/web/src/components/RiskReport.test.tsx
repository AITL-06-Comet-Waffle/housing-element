import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskReport } from './RiskReport';
import type { RiskApiResponse } from '@/lib/risk/types';

describe('RiskReport', () => {
  it('shows a status while loading', () => {
    render(<RiskReport loading />);
    expect(screen.getByRole('status')).toHaveTextContent(/assessing/i);
  });

  it('shows an alert on request error', () => {
    render(<RiskReport error />);
    expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i);
  });

  it('renders nothing before the first lookup', () => {
    const { container } = render(<RiskReport />);
    expect(container).toBeEmptyDOMElement();
  });

  it('explains a no_match miss', () => {
    render(<RiskReport result={{ ok: false, reason: 'no_match' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't find that address/i);
  });

  it('explains an out_of_state miss as California-only', () => {
    render(<RiskReport result={{ ok: false, reason: 'out_of_state' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/california/i);
  });

  it('renders the matched address and a card per hazard for a successful assessment', () => {
    const result: RiskApiResponse = {
      ok: true,
      matched: '1234 PACIFIC COAST HWY, MALIBU, CA, 90265',
      narrative: 'Grounded summary — verify with a licensed inspector before purchase.',
      citations: [
        { source: 'CAL FIRE Fire Hazard Severity Zones', detail: 'SRA effective 2024' },
        { source: 'USGS — M6.1 near Huron (1905)' },
      ],
      riskProfile: {
        fire: { hazardClass: 'Very High', responsibilityArea: 'LRA' },
        flood: { level: 'Minimal', zone: 'X' },
        quake: { pgaBand: '0.4-0.6 g', faultZone: true },
      },
    };
    render(<RiskReport result={result} />);

    expect(screen.getByText(/1234 PACIFIC COAST HWY/)).toBeInTheDocument();
    expect(screen.getByText(/verify with a licensed inspector/i)).toBeInTheDocument();
    expect(screen.getByText(/CAL FIRE Fire Hazard Severity Zones/)).toBeInTheDocument();
    expect(screen.getByText(/USGS — M6.1 near Huron/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Wildfire' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Flood' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Earthquake' })).toBeInTheDocument();
    expect(screen.getByText('Very High')).toBeInTheDocument(); // fire
    expect(screen.getByText('Minimal')).toBeInTheDocument(); // flood level
    expect(screen.getByText('0.4-0.6 g PGA')).toBeInTheDocument(); // quake band
    expect(screen.getByText(/Alquist-Priolo/)).toBeInTheDocument(); // fault detail
  });
});
