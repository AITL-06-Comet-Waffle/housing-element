// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { getFireZone } from './fire';

const fakeQuery = (rows: Record<string, unknown>[]) => vi.fn().mockResolvedValue({ rows });

describe('getFireZone', () => {
  it('returns the zone class + responsibility area for a contained point', async () => {
    const run = fakeQuery([{ hazard_class: 'Very High', responsibility_area: 'LRA' }]);
    const result = await getFireZone({ lat: 34.02, lon: -118.49 }, run);
    expect(result).toEqual({ hazardClass: 'Very High', responsibilityArea: 'LRA' });
  });

  it('passes lon then lat as the ST_MakePoint params', async () => {
    const run = fakeQuery([{ hazard_class: 'High', responsibility_area: 'SRA' }]);
    await getFireZone({ lat: 38.5, lon: -121.5 }, run);
    expect(run).toHaveBeenCalledWith(expect.stringContaining('ST_Contains'), [-121.5, 38.5]);
  });

  it("returns 'None' with a null responsibility area when no polygon contains the point", async () => {
    const result = await getFireZone({ lat: 37.77, lon: -122.42 }, fakeQuery([]));
    expect(result).toEqual({ hazardClass: 'None', responsibilityArea: null });
  });

  it('orders by severity descending so an overlapping point reports the most severe zone', async () => {
    const run = fakeQuery([{ hazard_class: 'Very High', responsibility_area: 'SRA' }]);
    await getFireZone({ lat: 1, lon: 2 }, run);
    expect(run).toHaveBeenCalledWith(
      expect.stringMatching(/ORDER BY[\s\S]*'Very High'[\s\S]*DESC/),
      expect.anything(),
    );
  });
});
