import type { LLMProvider, Message } from '@/lib/llm/types';
import { geocodeAddress, type GeoResult, type FetchFn } from './geocode';
import { searchFireIncidents, type PineconeNamespace } from './pinecone-retriever';
import { formatFireContext } from './format-context';

export class RagProvider implements LLMProvider {
  constructor(
    private readonly inner: LLMProvider,
    private readonly geocodeFn: (query: string, userAgent: string, fetchFn?: FetchFn) => Promise<GeoResult | null>,
    private readonly ns: PineconeNamespace,
    private readonly userAgent: string,
  ) {}

  async generate(messages: Message[]): Promise<string> {
    try {
      const lastUser = [...messages].reverse().find((m) => m.role === 'user');
      if (!lastUser) return this.inner.generate(messages);

      const geo = await this.geocodeFn(lastUser.content, this.userAgent);
      if (!geo) {
        console.warn('[RagProvider] Geocoding returned no result — proceeding without RAG context');
        return this.inner.generate(messages);
      }

      const incidents = await searchFireIncidents(this.ns, lastUser.content, geo.county);
      const contextText = formatFireContext(incidents);
      if (!contextText) {
        console.warn(`[RagProvider] No fire incidents found for county="${geo.county}" — proceeding without RAG context`);
        return this.inner.generate(messages);
      }

      const idx = messages.lastIndexOf(lastUser);
      const augmented: Message[] = [
        ...messages.slice(0, idx),
        { role: 'user', content: contextText },
        lastUser,
      ];
      return this.inner.generate(augmented);
    } catch (err) {
      console.warn('[RagProvider] Unexpected error — proceeding without RAG context', err);
      return this.inner.generate(messages);
    }
  }
}
