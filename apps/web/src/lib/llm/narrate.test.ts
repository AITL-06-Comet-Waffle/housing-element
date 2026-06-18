import { describe, it, expect, vi } from 'vitest';
import { buildNarrationMessages, narrate, templateNarrative } from './narrate';
import type { LLMProvider } from '@/lib/llm/types';
import type { RiskProfile } from '@/lib/risk/types';

const PROFILE: RiskProfile = {
  fire: { hazardClass: 'Very High', responsibilityArea: 'SRA' },
  flood: { level: 'High', zone: 'AE' },
  quake: { pgaBand: '0.4-0.6 g', faultZone: true },
};
const MATCHED = '1 TEST ST, MALIBU, CA';

const fakeLLM = (generate: ReturnType<typeof vi.fn>): LLMProvider =>
  ({ generate }) as unknown as LLMProvider;

describe('templateNarrative', () => {
  it('grounds the prose in the computed values only', () => {
    const text = templateNarrative(PROFILE, MATCHED);
    expect(text).toContain(MATCHED);
    expect(text).toContain('Very High');
    expect(text).toContain('Zone AE');
    expect(text).toContain('0.4-0.6 g');
    expect(text).toContain('Alquist-Priolo');
    // Weaves in the plain-English shaking rating + meaning alongside the band.
    expect(text).toMatch(/very strong shaking/i);
    expect(text).toMatch(/structural[- ]damage/i);
  });

  it("describes 'None' / 'Minimal' without overstating risk", () => {
    const low: RiskProfile = {
      fire: { hazardClass: 'None', responsibilityArea: null },
      flood: { level: 'Minimal', zone: 'X' },
      quake: { pgaBand: '< 0.2 g', faultZone: false },
    };
    const text = templateNarrative(low, MATCHED);
    expect(text).toMatch(/not within a mapped/i);
    expect(text).toMatch(/minimal flood risk/i);
    expect(text).toMatch(/not within a mapped Alquist-Priolo/i);
    // The coarse '< 0.2 g' band reads as a range and never overstates the shaking.
    expect(text).toMatch(/very low to moderate/i);
    expect(text).not.toMatch(/\bsevere\b/i);
    expect(text).not.toMatch(/structural[- ]damage/i);
  });
});

describe('buildNarrationMessages', () => {
  it('is a single user message with the facts and a no-invention instruction', () => {
    const msgs = buildNarrationMessages(PROFILE, MATCHED);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe('user');
    expect(msgs[0].content).toContain('0.4-0.6 g');
    expect(msgs[0].content).toMatch(/never invent/i);
  });

  it('appends the historical color block (framed as history, not a rating) when provided', () => {
    const msgs = buildNarrationMessages(PROFILE, MATCHED, '- [fire] Camp Fire (Butte County, 2018): ...');
    expect(msgs[0].content).toContain('Camp Fire');
    expect(msgs[0].content).toMatch(/NOT the current rating/i);
  });
});

describe('narrate', () => {
  it('returns the template when no LLM is configured', async () => {
    expect(await narrate(PROFILE, MATCHED, null)).toBe(templateNarrative(PROFILE, MATCHED));
  });

  it('returns the trimmed LLM narrative when a provider succeeds', async () => {
    const llm = fakeLLM(vi.fn().mockResolvedValue('  A rich grounded narrative.  '));
    expect(await narrate(PROFILE, MATCHED, llm)).toBe('A rich grounded narrative.');
    expect(llm.generate).toHaveBeenCalledOnce();
  });

  it('falls back to the template when the LLM throws', async () => {
    const llm = fakeLLM(vi.fn().mockRejectedValue(new Error('rate limited')));
    expect(await narrate(PROFILE, MATCHED, llm)).toBe(templateNarrative(PROFILE, MATCHED));
  });

  it('falls back to the template when the LLM returns blank', async () => {
    const llm = fakeLLM(vi.fn().mockResolvedValue('   '));
    expect(await narrate(PROFILE, MATCHED, llm)).toBe(templateNarrative(PROFILE, MATCHED));
  });

  it('passes the historical color context through to the LLM', async () => {
    const gen = vi.fn().mockResolvedValue('ok');
    await narrate(PROFILE, MATCHED, fakeLLM(gen), 'HISTORICAL-COLOR-CTX');
    expect(gen.mock.calls[0][0][0].content).toContain('HISTORICAL-COLOR-CTX');
  });
});
