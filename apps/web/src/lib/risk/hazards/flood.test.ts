// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { getFloodZone } from './flood';

const fakeQuery = (rows: Record<string, unknown>[]) => vi.fn().mockResolvedValue({ rows });

describe('getFloodZone', () => {
  it('returns the flood level + raw FEMA zone for a contained point', async () => {
    const run = fakeQuery([{ fld_zone: 'AE', flood_level: 'High' }]);
    const result = await getFloodZone({ lat: 38.58, lon: -121.49 }, run);
    expect(result).toEqual({ level: 'High', zone: 'AE' });
  });

  it('passes lon then lat as the ST_MakePoint params', async () => {
    const run = fakeQuery([{ fld_zone: 'X', flood_level: 'Minimal' }]);
    await getFloodZone({ lat: 37.77, lon: -122.42 }, run);
    expect(run).toHaveBeenCalledWith(expect.stringContaining('ST_Contains'), [-122.42, 37.77]);
  });

  it("returns 'None' with a null zone when no panel contains the point", async () => {
    expect(await getFloodZone({ lat: 39, lon: -120 }, fakeQuery([]))).toEqual({
      level: 'None',
      zone: null,
    });
  });

  it('orders by flood level descending so overlaps report the highest level', async () => {
    const run = fakeQuery([{ fld_zone: 'VE', flood_level: 'High' }]);
    await getFloodZone({ lat: 1, lon: 2 }, run);
    expect(run).toHaveBeenCalledWith(
      expect.stringMatching(/ORDER BY[\s\S]*'High'[\s\S]*DESC/),
      expect.anything(),
    );
  });
});
