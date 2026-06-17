import type { RiskApiResponse } from '@/lib/risk/types';

// In-memory cache of assessments keyed by normalized address. The hazard layers and
// historical corpora are effectively static, so a repeat lookup of the same address
// can skip the geocode, reverse-geocode, Pinecone queries, and the LLM call entirely.
// Per-process (cleared on restart), bounded with simple FIFO eviction.
const MAX_ENTRIES = 500;
const cache = new Map<string, RiskApiResponse>();

/** Normalize an address into a cache key: trim, lowercase, collapse whitespace. */
export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function getCachedAssessment(address: string): RiskApiResponse | undefined {
  return cache.get(normalizeAddress(address));
}

export function setCachedAssessment(address: string, response: RiskApiResponse): void {
  const key = normalizeAddress(address);
  if (!cache.has(key) && cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, response);
}

/** Test-only: reset the cache between cases. */
export function clearAssessmentCache(): void {
  cache.clear();
}
