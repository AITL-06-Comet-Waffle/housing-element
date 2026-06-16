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
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Housing Element</h1>
        <p className="text-gray-500">
          Enter a California street address to see its forward-looking climate-risk profile.
        </p>
      </header>
      <AddressForm onSubmit={handleSubmit} disabled={loading} />
      <RiskReport loading={loading} error={error} result={result} />
    </main>
  );
}
