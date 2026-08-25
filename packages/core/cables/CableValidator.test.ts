import { describe, it, expect } from 'vitest';
import { Plan } from '../model/Plan';
import { Vector2 } from '../geometry/Vector2';
import { validateCable } from './CableValidator';
import { routeCable } from './cableRouting';

describe('CableValidator', () => {
  it('считает валидным прямой кабель в пустом пространстве', () => {
    const plan = new Plan();
    plan.addCable(null, null, 'power', 2.5, {
      fromPoint: { x: 0, y: 0 },
      toPoint: { x: 1000, y: 0 },
    });
    const cable = plan.cables[0];
    const result = validateCable(plan, cable, 'strict', plan.devices);
    expect(result.valid).toBe(true);
  });

  it('обнаруживает пересечение со стеной вне проёма', () => {
    const plan = new Plan();
    plan.addWall(new Vector2(0, -1000), new Vector2(0, 1000));
    plan.addCable(null, null, 'power', 2.5, {
      fromPoint: { x: -500, y: 0 },
      toPoint: { x: 500, y: 0 },
      route: [new Vector2(-500, 0), new Vector2(500, 0)],
    });
    const cable = plan.cables[0];
    cable.routing = 'manual';
    const result = validateCable(plan, cable, 'strict', plan.devices);
    expect(result.valid).toBe(false);
    expect(result.intersectionViolations.length).toBeGreaterThan(0);
  });

  it('разрешает пересечение через дверной проём', () => {
    const plan = new Plan();
    const wall = plan.addWall(new Vector2(-1000, 0), new Vector2(1000, 0));
    plan.addOpening(wall.id, 'door', 0.5, 600);
    const from = new Vector2(-200, -200);
    const to = new Vector2(200, 200);
    const route = routeCable(plan, from, to, 50);
    expect(route).toBeTruthy();
    plan.addCable(null, null, 'power', 2.5, {
      fromPoint: { x: from.x, y: from.y },
      toPoint: { x: to.x, y: to.y },
      route: route ?? undefined,
    });
    const cable = plan.cables[0];
    const result = validateCable(plan, cable, 'strict', plan.devices);
    expect(result.intersectionViolations.length).toBe(0);
  });

  it('обнаруживает нарушение отступа 400 мм', () => {
    const plan = new Plan();
    plan.addWall(new Vector2(0, -1000), new Vector2(0, 1000));
    plan.addCable(null, null, 'power', 2.5, {
      fromPoint: { x: -300, y: 0 },
      toPoint: { x: -300, y: 2000 },
      route: [
        new Vector2(-300, 0),
        new Vector2(-300, 400),
        new Vector2(-300, 800),
        new Vector2(-300, 1200),
        new Vector2(-300, 1600),
        new Vector2(-300, 2000),
      ],
    });
    const cable = plan.cables[0];
    cable.routing = 'manual';
    const result = validateCable(plan, cable, 'strict', plan.devices);
    expect(result.valid).toBe(false);
    expect(result.clearanceViolations.length).toBeGreaterThan(0);
  });

  it('не проверяет отступ для connector-сегментов (100 мм)', () => {
    const plan = new Plan();
    plan.addWall(new Vector2(0, -1000), new Vector2(0, 1000));
    // Первые два сегмента длиной 100 мм от стены — допустимы.
    plan.addCable(null, null, 'power', 2.5, {
      fromPoint: { x: -100, y: 0 },
      toPoint: { x: 2000, y: 0 },
      route: [new Vector2(-100, 0), new Vector2(100, 0), new Vector2(2000, 0)],
    });
    const cable = plan.cables[0];
    cable.routing = 'manual';
    const result = validateCable(plan, cable, 'strict', plan.devices);
    expect(result.clearanceViolations.length).toBe(0);
  });

  it('пользовательский режим не проверяет нарушения', () => {
    const plan = new Plan();
    plan.addWall(new Vector2(0, -1000), new Vector2(0, 1000));
    plan.addCable(null, null, 'power', 2.5, {
      fromPoint: { x: -100, y: 0 },
      toPoint: { x: 100, y: 0 },
      route: [new Vector2(-100, 0), new Vector2(100, 0)],
    });
    const cable = plan.cables[0];
    cable.routing = 'manual';
    const result = validateCable(plan, cable, 'user', plan.devices);
    expect(result.valid).toBe(true);
  });
});
