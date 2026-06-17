import type { Citation } from '@/lib/risk/types';

/** Authoritative structured layers behind every assessment (always cited). */
export const STRUCTURED_CITATIONS: Citation[] = [
  { source: 'CAL FIRE Fire Hazard Severity Zones', detail: 'SRA effective 2024; LRA recommended 2007–2011' },
  { source: 'FEMA National Flood Hazard Layer', detail: 'flood hazard areas (S_FLD_HAZ_AR)' },
  { source: 'USGS National Seismic Hazard Model (2018)', detail: 'peak ground acceleration, 2% in 50 years' },
  { source: 'California Geological Survey', detail: 'Alquist-Priolo Earthquake Fault Zones' },
];

/** Structured-layer provenance followed by any retrieved color sources (deduped). */
export function buildCitations(colorSources: string[]): Citation[] {
  const seen = new Set<string>();
  const color: Citation[] = [];
  for (const source of colorSources) {
    if (source && !seen.has(source)) {
      seen.add(source);
      color.push({ source });
    }
  }
  return [...STRUCTURED_CITATIONS, ...color];
}
