import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeAddress,
  getCachedAssessment,
  setCachedAssessment,
  clearAssessmentCache,
} from './cache';
import type { RiskApiResponse } from './types';

const RESPONSE: RiskApiResponse = { ok: false, reason: 'no_match' };

describe('normalizeAddress', () => {
  it('trims, lowercases, and collapses internal whitespace', () => {
    expect(normalizeAddress('  123  Main   St ')).toBe('123 main st');
  });
});

describe('assessment cache', () => {
  beforeEach(() => clearAssessmentCache());

  it('returns undefined on a miss', () => {
    expect(getCachedAssessment('1 A St')).toBeUndefined();
  });

  it('stores and retrieves by normalized address', () => {
    setCachedAssessment('1 A St, LA CA', RESPONSE);
    expect(getCachedAssessment('  1   a st,  la ca ')).toBe(RESPONSE);
  });

  it('clears all entries', () => {
    setCachedAssessment('1 A St', RESPONSE);
    clearAssessmentCache();
    expect(getCachedAssessment('1 A St')).toBeUndefined();
  });
});
