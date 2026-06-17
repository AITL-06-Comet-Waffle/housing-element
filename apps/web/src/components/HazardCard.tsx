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
  /** Optional leading emoji/icon for quick recognition. */
  icon?: string;
}

const TONE: Record<Severity, { ring: string; text: string; badge: string }> = {
  'very-high': { ring: 'border-red-500/40', text: 'text-red-300', badge: 'bg-red-500/15' },
  high: { ring: 'border-orange-500/40', text: 'text-orange-300', badge: 'bg-orange-500/15' },
  moderate: { ring: 'border-amber-500/40', text: 'text-amber-200', badge: 'bg-amber-500/15' },
  low: { ring: 'border-lime-500/40', text: 'text-lime-200', badge: 'bg-lime-500/15' },
  none: { ring: 'border-emerald-500/40', text: 'text-emerald-300', badge: 'bg-emerald-500/15' },
  unknown: { ring: 'border-slate-600', text: 'text-slate-300', badge: 'bg-slate-500/15' },
};

/** One hazard as its own section: icon + name + supporting detail, and a bold rating badge. */
export function HazardCard({ title, rating, severity, detail, icon }: HazardCardProps) {
  const tone = TONE[severity];
  return (
    <section
      className={`flex items-center justify-between gap-4 rounded-2xl border ${tone.ring} bg-white/5 p-5`}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <span className="text-2xl" aria-hidden>
            {icon}
          </span>
        )}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">{title}</h3>
          {detail && <p className="mt-1 text-sm text-slate-400">{detail}</p>}
        </div>
      </div>
      <span
        className={`shrink-0 rounded-full px-4 py-1.5 text-xl font-bold ${tone.badge} ${tone.text}`}
      >
        {rating}
      </span>
    </section>
  );
}
