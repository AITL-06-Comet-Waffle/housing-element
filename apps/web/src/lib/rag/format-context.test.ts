import { describe, it, expect } from 'vitest';
import { formatFireContext } from './format-context';
import type { FireIncident } from './pinecone-retriever';

const incident: FireIncident = {
  incident_name: 'WOOLSEY FIRE',
  county: 'Los Angeles',
  city: 'Malibu',
  incident_year: 2018,
  inspection_count: 1203,
  destroyed_count: 843,
  major_count: 87,
  minor_count: 41,
  no_damage_count: 232,
  chunk_text: 'The Woolsey Fire caused widespread destruction in the Malibu area.',
};

describe('formatFireContext', () => {
  it('returns empty string for an empty array', () => {
    expect(formatFireContext([])).toBe('');
  });

  it('includes incident name and year', () => {
    const out = formatFireContext([incident]);
    expect(out).toContain('WOOLSEY FIRE');
    expect(out).toContain('2018');
  });

  it('includes county and city', () => {
    const out = formatFireContext([incident]);
    expect(out).toContain('Los Angeles');
    expect(out).toContain('Malibu');
  });

  it('includes damage statistics', () => {
    const out = formatFireContext([incident]);
    expect(out).toContain('1203');
    expect(out).toContain('843');
  });

  it('includes chunk_text', () => {
    const out = formatFireContext([incident]);
    expect(out).toContain('The Woolsey Fire caused widespread destruction');
  });

  it('formats multiple incidents', () => {
    const second = { ...incident, incident_name: 'CAMP FIRE', city: 'Paradise', incident_year: 2018 };
    const out = formatFireContext([incident, second]);
    expect(out).toContain('WOOLSEY FIRE');
    expect(out).toContain('CAMP FIRE');
  });
});
