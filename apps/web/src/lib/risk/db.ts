import { Pool } from 'pg';

let pool: Pool | undefined;

/** Lazily-created singleton connection pool to the PostGIS risk database. */
export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for risk lookups.');
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

export type QueryRow = Record<string, unknown>;

/** A parameterized SQL executor returning rows. Injectable so hazard adapters are
 *  unit-testable with a fake (no database). */
export type QueryFn = (text: string, params: unknown[]) => Promise<{ rows: QueryRow[] }>;

/** Default executor: runs against the singleton pool. */
export const query: QueryFn = (text, params) => getPool().query(text, params);
