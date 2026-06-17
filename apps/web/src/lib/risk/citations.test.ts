import { describe, it, expect } from 'vitest';
import { buildCitations, STRUCTURED_CITATIONS } from './citations';

describe('buildCitations', () => {
  it('always includes the four structured-layer provenance entries', () => {
    const c = buildCitations([]);
    expect(c).toEqual(STRUCTURED_CITATIONS);
    const text = c.map((x) => `${x.source} ${x.detail ?? ''}`).join(' | ');
    expect(text).toContain('CAL FIRE');
    expect(text).toContain('FEMA');
    expect(text).toContain('USGS');
    expect(text).toContain('Alquist-Priolo');
  });

  it('appends deduped color sources after the structured ones', () => {
    const c = buildCitations(['USGS — M6.1 (1905)', 'USGS — M6.1 (1905)', 'NOAA — Sonoma (2021)']);
    const colorSources = c.slice(STRUCTURED_CITATIONS.length).map((x) => x.source);
    expect(colorSources).toEqual(['USGS — M6.1 (1905)', 'NOAA — Sonoma (2021)']);
  });
});
