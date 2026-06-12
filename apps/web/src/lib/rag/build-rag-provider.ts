import { Pinecone } from '@pinecone-database/pinecone';
import type { LLMProvider } from '@/lib/llm/types';
import { geocodeAddress } from './geocode';
import type { PineconeNamespace } from './pinecone-retriever';
import { RagProvider } from './rag-provider';

export function buildRagProvider(inner: LLMProvider): LLMProvider | null {
  if (process.env.RAG_ENABLED !== 'true') return null;

  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) throw new Error('PINECONE_API_KEY is required when RAG_ENABLED=true.');

  const userAgent = process.env.NOMINATIM_USER_AGENT;
  if (!userAgent) throw new Error('NOMINATIM_USER_AGENT is required when RAG_ENABLED=true.');

  const indexName = process.env.PINECONE_INDEX_NAME ?? 'postfire-damage';
  const namespace = process.env.PINECONE_NAMESPACE ?? 'calfire-dins-summary-v1';

  const pc = new Pinecone({ apiKey });
  const ns = pc.index(indexName).namespace(namespace) as unknown as PineconeNamespace;

  return new RagProvider(inner, geocodeAddress, ns, userAgent);
}
