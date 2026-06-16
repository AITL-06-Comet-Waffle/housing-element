import type { ReactNode } from 'react';

interface HazardCardProps {
  /** Hazard name, e.g. "Wildfire". */
  title: string;
  /** Human-readable rating, e.g. "Very High" or "None". */
  rating: string;
  /** Optional supporting line, e.g. "State Responsibility Area (SRA)". */
  detail?: ReactNode;
}

// Tailwind tone per known rating; unknown ratings fall back to neutral gray.
const TONE: Record<string, string> = {
  'Very High': 'border-red-300 bg-red-50 text-red-800',
  High: 'border-orange-300 bg-orange-50 text-orange-800',
  Moderate: 'border-yellow-300 bg-yellow-50 text-yellow-800',
  None: 'border-green-300 bg-green-50 text-green-800',
};

/** One hazard's result: title, rating, and an optional supporting detail line. */
export function HazardCard({ title, rating, detail }: HazardCardProps) {
  const tone = TONE[rating] ?? 'border-gray-300 bg-gray-50 text-gray-800';
  return (
    <div className={`rounded-lg border p-4 ${tone}`}>
      <h3 className="text-sm font-medium uppercase tracking-wide opacity-70">{title}</h3>
      <p className="mt-1 text-2xl font-semibold">{rating}</p>
      {detail && <p className="mt-1 text-sm opacity-80">{detail}</p>}
    </div>
  );
}
