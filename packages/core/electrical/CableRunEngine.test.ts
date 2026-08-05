import { describe, it, expect } from 'vitest';
import { buildCableRuns, buildCableSpecification, computeCableSpareM, computeCableTotalM, CableRunData } from './CableRunEngine';
import { Cable } from '../model/Cable';
import { CircuitData } from './RoomConsumerEngine';
import { Vector2 } from '../geometry/Vector2';

describe('CableRunEngine', () => {
  const makeCable = (overrides: Partial<Cable> = {}): Cable => ({
    id: 'c1',
    fromDeviceId: 'd1',
    toDeviceId: 'd2',
    type: 'power',
    crossSection: 2.5,
    length: 5000,
    route: [new Vector2(0, 0), new Vector2(3000, 0), new Vector2(3000, 2000)],
    ...overrides,
  });

  it('computes spare and total length', () => {
    expect(computeCableSpareM(5)).toBe(0.5);
    expect(computeCableTotalM(5)).toBe(5.5);
    expect(computeCableSpareM(3)).toBe(0.5); // min spare
    expect(computeCableTotalM(3)).toBe(3.5);
  });

  it('builds cable runs from cables and circuits', () => {
    const cable = makeCable({ toDeviceId: 'dev-1' });
    const circuit: CircuitData = {
      id: 'circ-1',
      name: 'Розетки кухня',
      type: 'socket',
      ratedCurrentA: 16,
      breakerType: 'C',
      cableType: 'power',
      crossSectionMm2: 2.5,
      lengthM: 0,
      phase: 'L1',
      color: '#ef4444',
      consumers: [
        { id: 'cons-1', name: 'Розетка', category: 'socket', type: 'socket', powerW: 2000, voltage: 220, count: 1, demandRatio: 1, phase: 'L1', deviceId: 'dev-1' },
      ],
    };
    const runs = buildCableRuns([cable], [circuit]);
    expect(runs).toHaveLength(1);
    expect(runs[0].circuitId).toBe('circ-1');
    expect(runs[0].routeM).toBe(5);
    expect(runs[0].spareM).toBe(0.5);
    expect(runs[0].totalM).toBe(5.5);
    expect(runs[0].segments).toHaveLength(2);
  });

  it('builds specification grouped by cable type and section', () => {
    const runs: CableRunData[] = [
      { id: 'r1', cableId: 'c1', fromDeviceId: 'd1', toDeviceId: 'd2', cableType: 'power', crossSectionMm2: 2.5, routeM: 5, spareM: 0.5, totalM: 5.5, segments: [] },
      { id: 'r2', cableId: 'c2', fromDeviceId: 'd3', toDeviceId: 'd4', cableType: 'power', crossSectionMm2: 2.5, routeM: 3, spareM: 0.5, totalM: 3.5, segments: [] },
      { id: 'r3', cableId: 'c3', fromDeviceId: 'd5', toDeviceId: 'd6', cableType: 'lighting', crossSectionMm2: 1.5, routeM: 4, spareM: 0.5, totalM: 4.5, segments: [] },
    ];
    const spec = buildCableSpecification(runs);
    const cableItems = spec.filter((s) => s.category === 'cable');
    expect(cableItems).toHaveLength(2);
    expect(cableItems.find((i) => i.name.includes('2.5 мм²'))?.quantity).toBe(9); // 5.5 + 3.5 = 9 ceil
    expect(cableItems.find((i) => i.name.includes('1.5 мм²'))?.quantity).toBe(5); // 4.5 ceil
    const conduit = spec.find((s) => s.category === 'conduit');
    expect(conduit?.quantity).toBe(14); // 5.5 + 3.5 + 4.5 = 13.5 ceil
  });
});
