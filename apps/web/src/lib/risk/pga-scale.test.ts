import { describe, it, expect } from 'vitest';
import { explainPga, PGA_SCALE } from './pga-scale';

// The fixed band set produced by ingest (scripts/ingest/quake_pga.py LABELS).
const BANDS = ['< 0.2 g', '0.2-0.4 g', '0.4-0.6 g', '>= 0.6 g'];

describe('explainPga', () => {
  it('maps the three upper bands 1:1 to the reference scale', () => {
    expect(explainPga('0.2-0.4 g').rating).toBe('High');
    expect(explainPga('0.4-0.6 g').rating).toBe('Very high');
    expect(explainPga('>= 0.6 g').rating).toBe('Severe / extreme');
  });

  it('describes the coarse low band as a range, never a single tier', () => {
    const low = explainPga('< 0.2 g');
    expect(low.rating).toMatch(/very low/i);
    expect(low.rating).toMatch(/moderate/i);
    expect(low.meaning).toMatch(/spans several intensity levels|not pinned/i);
    // Never overstates the lowest band.
    expect(low.meaning).not.toMatch(/\bsevere\b/i);
    expect(low.meaning).not.toMatch(/structural[- ]damage/i);
  });

  it('returns an unavailable explanation for null (outside the grid)', () => {
    expect(explainPga(null).rating).toBe('Unavailable');
    expect(explainPga(null).meaning).toMatch(/unavailable/i);
  });

  it('keeps the existing card colors for every band', () => {
    expect(explainPga('< 0.2 g').severity).toBe('low');
    expect(explainPga('0.2-0.4 g').severity).toBe('moderate');
    expect(explainPga('0.4-0.6 g').severity).toBe('high');
    expect(explainPga('>= 0.6 g').severity).toBe('very-high');
  });

  it('covers exactly the band set produced by ingest', () => {
    expect(Object.keys(PGA_SCALE).sort()).toEqual([...BANDS].sort());
  });
});
