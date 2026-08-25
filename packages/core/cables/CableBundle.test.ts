import { describe, it, expect } from 'vitest';
import { Vector2 } from '../geometry/Vector2';
import { calculateParallelOffsets, createParallelBundle, offsetRoute } from './CableBundle';
import { Cable } from '../model/Cable';

function createCable(route: Vector2[]): Cable {
  return {
    id: crypto.randomUUID(),
    fromDeviceId: null,
    toDeviceId: null,
    type: 'power',
    crossSection: 2.5,
    length: 0,
    route: route.map((p) => p.clone()),
  } as Cable;
}

describe('CableBundle', () => {
  it('calculateParallelOffsets центрирует смещения', () => {
    const offsets = calculateParallelOffsets(3, 50);
    expect(offsets).toEqual([-50, 0, 50]);
  });

  it('offsetRoute смещает маршрут', () => {
    const route = [new Vector2(0, 0), new Vector2(1000, 0)];
    const shifted = offsetRoute(route, new Vector2(0, 50));
    expect(shifted[0]).toEqual(new Vector2(0, 50));
    expect(shifted[1]).toEqual(new Vector2(1000, 50));
  });

  it('createParallelBundle задаёт bundleMode и group', () => {
    const c1 = createCable([new Vector2(0, 0), new Vector2(1000, 0)]);
    const c2 = createCable([new Vector2(0, 0), new Vector2(1000, 0)]);
    const base = [new Vector2(0, 0), new Vector2(1000, 0)];
    createParallelBundle([c1, c2], base, 50);

    expect(c1.bundleMode).toBe('parallel');
    expect(c2.bundleMode).toBe('parallel');
    expect(c1.bundleGroup).toBeTruthy();
    expect(c1.bundleGroup).toBe(c2.bundleGroup);
  });
});
