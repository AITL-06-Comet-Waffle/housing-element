import type { ReactNode } from 'react';

/** Visual severity tier — drives the card color, decoupled from the display text. */
export type Severity = 'very-high' | 'high' | 'moderate' | 'low' | 'none' | 'unknown';

interface HazardCardProps {
  /** Hazard name, e.g. "Wildfire". */
  title: string;
  /** Human-readable rating to display, e.g. "Very High", "Zone AE", "0.4-0.6 g". */
  rating: string;
  /** Severity tier for coloring (each hazard maps its value to this). */
  severity: Severity;
  /** Optional supporting line, e.g. "State Responsibility Area (SRA)". */
  detail?: ReactNode;
}

const TONE: Record<Severity, string> = {
  'very-high': 'border-red-300 bg-red-50 text-red-800',
  high: 'border-orange-300 bg-orange-50 text-orange-800',
  moderate: 'border-amber-300 bg-amber-50 text-amber-800',
  low: 'border-lime-300 bg-lime-50 text-lime-800',
  none: 'border-green-300 bg-green-50 text-green-800',
  unknown: 'border-gray-300 bg-gray-50 text-gray-700',
};

/** One hazard's result: title, rating, and an optional supporting detail line. */
export function HazardCard({ title, rating, severity, detail }: HazardCardProps) {
  return (
    <div className={`rounded-lg border p-4 ${TONE[severity]}`}>
      <h3 className="text-sm font-medium uppercase tracking-wide opacity-70">{title}</h3>
      <p className="mt-1 text-2xl font-semibold">{rating}</p>
      {detail && <p className="mt-1 text-sm opacity-80">{detail}</p>}
    </div>
  );
}
