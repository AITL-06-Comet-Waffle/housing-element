import { Pinecone } from '@pinecone-database/pinecone';
import type { GeoPoint } from '@/lib/risk/types';
import { countyForPoint } from './county';
import { getHazardColor, type ColorResult } from './hazard-color';
import type { PineconeNamespace } from './pinecone-retriever';

const EMPTY: ColorResult = { items: [], context: '' };

/**
 * Retrieve multi-hazard historical color (fire/flood/quake Pinecone corpora) for a
 * point. Best-effort: returns empty when RAG is disabled, unconfigured, or on any
 * error, so color never blocks or fails the assessment.
 */
export async function retrieveColor(point: GeoPoint, near: string): Promise<ColorResult> {
  if (process.env.RAG_ENABLED !== 'true') return EMPTY;
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) return EMPTY;

  try {
    const pc = new Pinecone({ apiKey });
    const ns = (index: string, namespace: string) =>
      pc.index(index).namespace(namespace) as unknown as PineconeNamespace;

    return await getHazardColor(
      {
        fireNs: ns(
          process.env.PINECONE_INDEX_NAME ?? 'postfire-damage',
          process.env.PINECONE_NAMESPACE ?? 'calfire-dins-summary-v1',
        ),
        floodNs: ns(
          process.env.PINECONE_FLOOD_INDEX_NAME ?? 'flood-risk',
          process.env.PINECONE_FLOOD_NAMESPACE ?? 'noaa-stormevents-ca-floods-v1',
        ),
        quakeNs: ns(
          process.env.PINECONE_EARTHQUAKE_INDEX_NAME ?? 'earthquake-risk',
          process.env.PINECONE_EARTHQUAKE_NAMESPACE ?? 'usgs-comcat-ca-events-v1',
        ),
        countyOf: countyForPoint,
      },
      point,
      near,
    );
  } catch {
    return EMPTY;
  }
}
