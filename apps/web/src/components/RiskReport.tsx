import type { FloodLevel, RiskApiResponse } from '@/lib/risk/types';
import { explainPga } from '@/lib/risk/pga-scale';
import { HazardCard, type Severity } from './HazardCard';

interface RiskReportProps {
  /** A lookup is in flight. */
  loading?: boolean;
  /** The request itself failed (network / 4xx / 5xx). */
  error?: boolean;
  /** The latest assessment, or `null` before the first lookup. */
  result?: RiskApiResponse | null;
}

const FIRE_SEVERITY: Record<string, Severity> = {
  'Very High': 'very-high',
  High: 'high',
  Moderate: 'moderate',
  None: 'none',
};
const FLOOD_SEVERITY: Record<FloodLevel, Severity> = {
  High: 'high',
  Moderate: 'moderate',
  Minimal: 'low',
  Undetermined: 'unknown',
  None: 'none',
};
const RA_LABEL: Record<string, string> = {
  SRA: 'State Responsibility Area (SRA)',
  LRA: 'Local Responsibility Area (LRA)',
};
const MISS_MESSAGE: Record<string, string> = {
  no_match: "We couldn't find that address. Check the spelling, or include the city and ZIP.",
  out_of_state: 'This tool currently covers California addresses only.',
};

/** Renders the risk assessment: loading/error/miss states, or per-hazard sections + narrative. */
export function RiskReport({ loading = false, error = false, result = null }: RiskReportProps) {
  if (loading) {
    return (
      <p role="status" className="text-lg text-slate-400">
        Assessing risk…
      </p>
    );
  }
  if (error) {
    return (
      <p role="alert" className="text-lg text-red-400">
        Something went wrong. Please try again.
      </p>
    );
  }
  if (!result) return null;
  if (!result.ok) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-base text-amber-200"
      >
        {MISS_MESSAGE[result.reason]}
      </p>
    );
  }

  const { fire, flood, quake } = result.riskProfile;
  const pga = explainPga(quake.pgaBand);
  return (
    <section className="flex flex-col gap-6" aria-label="Risk report">
      <p className="text-sm text-slate-400">
        Showing risk for <span className="font-semibold text-slate-200">{result.matched}</span>
      </p>

      <div className="flex flex-col gap-4">
        <HazardCard
          title="Wildfire"
          icon="🔥"
          rating={fire.hazardClass}
          severity={FIRE_SEVERITY[fire.hazardClass] ?? 'unknown'}
          detail={
            fire.responsibilityArea
              ? RA_LABEL[fire.responsibilityArea]
              : 'Not in a mapped FHSZ zone'
          }
        />
        <HazardCard
          title="Flood"
          icon="🌊"
          rating={flood.level}
          severity={FLOOD_SEVERITY[flood.level] ?? 'unknown'}
          detail={flood.zone ? `FEMA Zone ${flood.zone}` : 'No mapped FEMA flood panel'}
        />
        <HazardCard
          title="Earthquake"
          icon="🏚️"
          rating={quake.pgaBand ? `${quake.pgaBand} PGA` : 'No data'}
          severity={pga.severity}
          detail={
            <>
              <span className="block">Shaking: {pga.rating}</span>
              <span className="block">
                {quake.faultZone
                  ? 'In an Alquist-Priolo fault-rupture zone'
                  : 'Not in a mapped fault-rupture zone'}
              </span>
            </>
          }
        />
      </div>

      {result.narrative && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Overall evaluation
          </h2>
          <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-slate-200">
            {result.narrative}
          </p>
        </div>
      )}

      {result.citations.length > 0 && (
        <div className="border-t border-white/10 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Sources</h3>
          <ul className="mt-2 space-y-1 text-xs text-slate-500">
            {result.citations.map((citation, i) => (
              <li key={i}>
                {citation.source}
                {citation.detail ? ` — ${citation.detail}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
