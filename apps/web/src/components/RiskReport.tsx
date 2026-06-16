import type { FloodLevel, RiskApiResponse } from '@/lib/risk/types';
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
const PGA_SEVERITY: Record<string, Severity> = {
  '>= 0.6 g': 'very-high',
  '0.4-0.6 g': 'high',
  '0.2-0.4 g': 'moderate',
  '< 0.2 g': 'low',
};
const RA_LABEL: Record<string, string> = {
  SRA: 'State Responsibility Area (SRA)',
  LRA: 'Local Responsibility Area (LRA)',
};
const MISS_MESSAGE: Record<string, string> = {
  no_match: "We couldn't find that address. Check the spelling, or include the city and ZIP.",
  out_of_state: 'This tool currently covers California addresses only.',
};

/** Renders the risk assessment: loading/error/miss states, or the per-hazard cards. */
export function RiskReport({ loading = false, error = false, result = null }: RiskReportProps) {
  if (loading) {
    return (
      <p role="status" className="text-gray-500">
        Assessing risk…
      </p>
    );
  }
  if (error) {
    return (
      <p role="alert" className="text-red-600">
        Something went wrong. Please try again.
      </p>
    );
  }
  if (!result) return null;
  if (!result.ok) {
    return (
      <p role="alert" className="text-amber-700">
        {MISS_MESSAGE[result.reason]}
      </p>
    );
  }

  const { fire, flood, quake } = result.riskProfile;
  return (
    <section className="flex flex-col gap-4" aria-label="Risk report">
      <p className="text-sm text-gray-500">
        Showing risk for: <span className="font-medium text-gray-700">{result.matched}</span>
      </p>
      {result.narrative && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
          {result.narrative}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <HazardCard
          title="Wildfire"
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
          rating={flood.level}
          severity={FLOOD_SEVERITY[flood.level] ?? 'unknown'}
          detail={flood.zone ? `FEMA Zone ${flood.zone}` : 'No mapped FEMA flood panel'}
        />
        <HazardCard
          title="Earthquake"
          rating={quake.pgaBand ? `${quake.pgaBand} PGA` : 'No data'}
          severity={quake.pgaBand ? (PGA_SEVERITY[quake.pgaBand] ?? 'unknown') : 'unknown'}
          detail={
            quake.faultZone
              ? 'In an Alquist-Priolo fault-rupture zone'
              : 'Not in a mapped fault-rupture zone'
          }
        />
      </div>
    </section>
  );
}
