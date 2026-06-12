import type { FireIncident } from './pinecone-retriever';

export function formatFireContext(incidents: FireIncident[]): string {
  if (incidents.length === 0) return '';

  const lines = [
    '[CAL FIRE post-fire inspection data retrieved for this location:',
    ...incidents.map((inc) =>
      `- ${inc.incident_name} (${inc.incident_year}) — ${inc.city}, ${inc.county} County\n` +
      `  Inspected: ${inc.inspection_count} | Destroyed: ${inc.destroyed_count} | Major: ${inc.major_count} | Minor: ${inc.minor_count} | No damage: ${inc.no_damage_count}\n` +
      `  ${inc.chunk_text}`,
    ),
    ']',
  ];

  return lines.join('\n');
}
