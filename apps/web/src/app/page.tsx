'use client';

import { useState } from 'react';
import { AddressForm } from '@/components/AddressForm';
import { RiskReport } from '@/components/RiskReport';
import type { RiskApiResponse } from '@/lib/risk/types';

/** Address-risk assessment surface: enter a CA address, see its per-hazard profile. */
export default function Home() {
  const [result, setResult] = useState<RiskApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(address: string) {
    setLoading(true);
    setError(false);
    setResult(null);
    try {
      const response = await fetch('/api/risk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
      setResult((await response.json()) as RiskApiResponse);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-5 py-12 sm:py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Housing Element</h1>
        <p className="text-base text-slate-400 sm:text-lg">
          Enter a California address to see its wildfire, flood, and earthquake risk — with a
          grounded safety read.
        </p>
      </header>
      <AddressForm onSubmit={handleSubmit} disabled={loading} />
      <RiskReport loading={loading} error={error} result={result} />
    </main>
  );
}
