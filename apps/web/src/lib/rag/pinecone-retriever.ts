export type FireIncident = {
  incident_name: string;
  county: string;
  city: string;
  incident_year: number;
  inspection_count: number;
  destroyed_count: number;
  major_count: number;
  minor_count: number;
  no_damage_count: number;
  chunk_text: string;
};

export type PineconeNamespace = {
  searchRecords(options: unknown): Promise<{ result: { hits: Array<{ fields: unknown }> } }>;
};

const FIELDS = [
  'chunk_text', 'incident_name', 'county', 'city', 'incident_year',
  'inspection_count', 'destroyed_count', 'major_count', 'minor_count', 'no_damage_count',
];

export async function searchFireIncidents(
  ns: PineconeNamespace,
  queryText: string,
  county: string,
  topK = 5,
): Promise<FireIncident[]> {
  try {
    const response = await ns.searchRecords({
      query: { inputs: { text: queryText }, topK, filter: { county: { $eq: county } } },
      fields: FIELDS,
    });
    return response.result.hits.map((hit) => hit.fields as FireIncident);
  } catch {
    return [];
  }
}
