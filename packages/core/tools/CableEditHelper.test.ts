import { describe, it, expect } from 'vitest';
import { Plan } from '../model/Plan';
import { Vector2 } from '../geometry/Vector2';
import { rerouteCableEdgeAroundObstacles } from './CableEditHelper';
import { segmentCrossesWallOutsideOpening, routeCableWithVia } from '../cables/cableRouting';

describe('CableEditHelper', () => {
  it('rerouteCableEdgeAroundObstacles обходит перегородку', () => {
    const plan = new Plan();
    plan.addWall(new Vector2(-2000, -2000), new Vector2(-2000, 2000));
    plan.addWall(new Vector2(-2000, 2000), new Vector2(2000, 2000));
    plan.addWall(new Vector2(2000, 2000), new Vector2(2000, -2000));
    plan.addWall(new Vector2(2000, -2000), new Vector2(-2000, -2000));
    const partition = plan.addWall(new Vector2(300, -1500), new Vector2(300, 500));
    plan.addOpening(partition.id, 'door', 0.75, 600);

    const route = [new Vector2(-500, 400), new Vector2(500, 400)];
    expect(segmentCrossesWallOutsideOpening(route[0], route[1], plan)).toBe(true);

    const via = routeCableWithVia(plan, route, 50);
    expect(via).toBeTruthy();
    expect(via!.length).toBeGreaterThan(2);

    const rerouted = rerouteCableEdgeAroundObstacles(plan, route, 0);
    expect(rerouted.length).toBeGreaterThan(2);
    for (let i = 1; i < rerouted.length; i++) {
      expect(segmentCrossesWallOutsideOpening(rerouted[i - 1], rerouted[i], plan)).toBe(false);
    }
  });
});
