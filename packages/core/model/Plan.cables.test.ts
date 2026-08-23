import { describe, it, expect } from 'vitest';
import { Plan } from './Plan';
import { Vector2 } from '../geometry/Vector2';
import { Wall } from './Wall';
import { distPointToSegment } from '../geometry/Geometry';
import { routeCableWithVia } from '../cables/cableRouting';
import {
  UpdateCableRouteCommand,
  AddCableVertexCommand,
  RemoveCableVertexCommand,
} from '../editor/CommandManager';

function routeClearanceToWall(route: Vector2[], wall: Wall): number {
  let min = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const mid = a.add(b).scale(0.5);
    min = Math.min(min, distPointToSegment(mid, wall.a, wall.b));
    min = Math.min(min, distPointToSegment(a, wall.a, wall.b));
    min = Math.min(min, distPointToSegment(b, wall.a, wall.b));
  }
  return min;
}

describe('Plan cable routing', () => {
  it('addCable сохраняет A*-маршрут с обходом стены', () => {
    const plan = new Plan();
    plan.addWall(new Vector2(-1000, 0), new Vector2(1000, 0));

    const from = plan.addFreeDevice('light', new Vector2(-500, -500))!;
    const to = plan.addFreeDevice('light', new Vector2(500, 500))!;

    const routed = routeCableWithVia(plan, [
      plan.deviceWorldPosition(from),
      plan.deviceWorldPosition(to),
    ], 50);
    expect(routed).toBeTruthy();
    expect(routed!.length).toBeGreaterThanOrEqual(3);

    const cable = plan.addCable(from.id, to.id, 'power', 2.5, { route: routed! });
    expect(cable).toBeTruthy();
    expect(cable!.routing).toBe('auto');
    expect(cable!.route.length).toBeGreaterThanOrEqual(3);

    // Маршрут должен обходить стену с запасом
    const wall = plan.walls[0];
    expect(routeClearanceToWall(cable!.route, wall)).toBeGreaterThanOrEqual(90);
  });

  it('recalcCableRoutes сохраняет автотрассированный маршрут', () => {
    const plan = new Plan();
    plan.addWall(new Vector2(-1000, 0), new Vector2(1000, 0));

    const from = plan.addFreeDevice('light', new Vector2(-500, -500))!;
    const to = plan.addFreeDevice('light', new Vector2(500, 500))!;

    const routed = routeCableWithVia(plan, [
      plan.deviceWorldPosition(from),
      plan.deviceWorldPosition(to),
    ], 50);

    const cable = plan.addCable(from.id, to.id, 'power', 2.5, { route: routed! })!;
    const originalRoute = cable.route.map((p) => ({ x: p.x, y: p.y }));

    plan.recalcCableRoutes();

    expect(cable.routing).toBe('auto');
    expect(cable.route.length).toBeGreaterThanOrEqual(3);

    // После пересчёта маршрут всё ещё не должен проходить через стену
    const wall = plan.walls[0];
    expect(routeClearanceToWall(cable.route, wall)).toBeGreaterThanOrEqual(90);

    // Маршрут не должен быть заменён на прямой (Manhattan) из двух точек
    expect(cable.route.length).toBeGreaterThan(2);
  });

  it('recalcCableRoutes пересчитывает Manhattan-маршрут для обычного кабеля', () => {
    const plan = new Plan();

    const from = plan.addFreeDevice('light', new Vector2(-500, -500))!;
    const to = plan.addFreeDevice('light', new Vector2(500, 500))!;

    const cable = plan.addCable(from.id, to.id, 'power', 2.5)!;
    expect(cable.routing).toBe('manual');
    expect(cable.route.length).toBe(3); // Manhattan

    plan.recalcCableRoutes();
    expect(cable.route.length).toBe(3);
  });

  describe('cable editing commands', () => {
    it('UpdateCableRouteCommand перемещает вершину', () => {
      const plan = new Plan();
      const from = plan.addFreeDevice('light', new Vector2(-500, -500))!;
      const to = plan.addFreeDevice('light', new Vector2(500, 500))!;
      const cable = plan.addCable(from.id, to.id, 'power', 2.5, {
        route: [new Vector2(-500, -500), new Vector2(0, 0), new Vector2(500, 500)],
      })!;
      cable.routing = 'manual';

      const newRoute = [new Vector2(-500, -500), new Vector2(0, 100), new Vector2(500, 500)];
      const cmd = new UpdateCableRouteCommand(plan, cable.id, newRoute);
      cmd.execute();

      expect(cable.route[1]).toEqual(new Vector2(0, 100));
      expect(cable.routing).toBe('manual');

      cmd.undo();
      expect(cable.route[1]).toEqual(new Vector2(0, 0));
    });

    it('AddCableVertexCommand добавляет вершину', () => {
      const plan = new Plan();
      const from = plan.addFreeDevice('light', new Vector2(-500, -500))!;
      const to = plan.addFreeDevice('light', new Vector2(500, 500))!;
      const cable = plan.addCable(from.id, to.id, 'power', 2.5, {
        route: [new Vector2(-500, -500), new Vector2(500, 500)],
      })!;
      cable.routing = 'manual';

      const cmd = new AddCableVertexCommand(plan, cable.id, 0, new Vector2(0, 0));
      cmd.execute();

      expect(cable.route.length).toBe(3);
      expect(cable.route[1]).toEqual(new Vector2(0, 0));
      expect(cable.routing).toBe('manual');

      cmd.undo();
      expect(cable.route.length).toBe(2);
    });

    it('RemoveCableVertexCommand удаляет вершину', () => {
      const plan = new Plan();
      const from = plan.addFreeDevice('light', new Vector2(-500, -500))!;
      const to = plan.addFreeDevice('light', new Vector2(500, 500))!;
      const cable = plan.addCable(from.id, to.id, 'power', 2.5, {
        route: [new Vector2(-500, -500), new Vector2(0, 0), new Vector2(500, 500)],
      })!;
      cable.routing = 'manual';

      const cmd = new RemoveCableVertexCommand(plan, cable.id, 1);
      cmd.execute();

      expect(cable.route.length).toBe(2);

      cmd.undo();
      expect(cable.route.length).toBe(3);
      expect(cable.route[1]).toEqual(new Vector2(0, 0));
    });

    it('RemoveCableVertexCommand не удаляет anchor-вершины', () => {
      const plan = new Plan();
      const from = plan.addFreeDevice('light', new Vector2(-500, -500))!;
      const to = plan.addFreeDevice('light', new Vector2(500, 500))!;
      const cable = plan.addCable(from.id, to.id, 'power', 2.5, {
        route: [new Vector2(-500, -500), new Vector2(0, 0), new Vector2(500, 500)],
      })!;

      const cmd0 = new RemoveCableVertexCommand(plan, cable.id, 0);
      cmd0.execute();
      expect(cable.route.length).toBe(3);

      const cmdLast = new RemoveCableVertexCommand(plan, cable.id, 2);
      cmdLast.execute();
      expect(cable.route.length).toBe(3);
    });
  });
});
