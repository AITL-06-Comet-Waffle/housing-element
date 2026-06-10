import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  // Pin the workspace root to this monorepo. Without this, Turbopack walks up the
  // tree, finds a stray lockfile in $HOME, and treats that as the root — which
  // breaks module resolution and file-system tracing. Resolves to the repo root
  // (two levels up from apps/web), where the lockfile and hoisted node_modules live.
  turbopack: {
    root: path.resolve(import.meta.dirname, '../..'),
  },
};

export default nextConfig;
