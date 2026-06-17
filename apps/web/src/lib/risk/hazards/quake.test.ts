// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { getQuake } from './quake';

const fakeQuery = (rows: Record<string, unknown>[]) => vi.fn().mockResolvedValue({ rows });

describe('getQuake', () => {
  it('returns the PGA band and fault-zone flag for a point', async () => {
    const run = fakeQuery([{ pga_band: '0.4-0.6 g', fault_zone: true }]);
    const result = await getQuake({ lat: 37.77, lon: -122.42 }, run);
    expect(result).toEqual({ pgaBand: '0.4-0.6 g', faultZone: true });
  });

  it('queries both the PGA grid and the Alquist-Priolo zones', async () => {
    const run = fakeQuery([{ pga_band: '0.2-0.4 g', fault_zone: false }]);
    await getQuake({ lat: 34, lon: -118 }, run);
    const sql = run.mock.calls[0][0] as string;
    expect(sql).toContain('hazard_pga');
    expect(sql).toContain('hazard_ap_zones');
    expect(run).toHaveBeenCalledWith(expect.any(String), [-118, 34]);
  });

  it('maps a point outside the grid / fault zones to null band + false', async () => {
    const run = fakeQuery([{ pga_band: null, fault_zone: false }]);
    expect(await getQuake({ lat: 41.9, lon: -124.2 }, run)).toEqual({
      pgaBand: null,
      faultZone: false,
    });
  });
});
