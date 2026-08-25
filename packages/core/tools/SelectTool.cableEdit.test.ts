import { describe, it, expect, beforeEach } from 'vitest';
import { Plan } from '../model/Plan';
import { Vector2 } from '../geometry/Vector2';
import { ThemeManager } from '../editor/ThemeManager';
import { CanvasEngine } from '../engine/CanvasEngine';
import { SelectTool } from './SelectTool';
import { segmentCrossesWallOutsideOpening } from '../cables/cableRouting';

function createTestCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  return canvas;
}

function createEngine(plan: Plan): CanvasEngine {
  const canvas = createTestCanvas();
  const themeManager = new ThemeManager();
  return new CanvasEngine(canvas, plan, themeManager);
}

describe('SelectTool cable editing — Visio-like orthogonal', () => {
  let plan: Plan;
  let engine: CanvasEngine;
  let tool: SelectTool;

  beforeEach(() => {
    plan = new Plan();
    engine = createEngine(plan);
    tool = new SelectTool(engine, plan, engine.snapEngine);
    engine.toolManager.register(tool);
    engine.toolManager.setTool('select');
  });

  it('перемещает вертикальную грань только по горизонтали', () => {
    const fromPos = new Vector2(-500, 0);
    const toPos = new Vector2(500, 500);
    plan.addCable(null, null, 'power', 2.5, {
      fromPoint: fromPos,
      toPoint: toPos,
      route: [fromPos, new Vector2(0, 0), new Vector2(0, 500), toPos],
    });
    const cable = plan.cables[0];
    cable.routing = 'manual';

    // Кликаем на середину внутреннего вертикального ребра (0,0)-(0,500).
    const p1 = engine.camera.worldToScreen(new Vector2(0, 250));
    const p2 = engine.camera.worldToScreen(new Vector2(300, 250));
    engine.input.dispatchPointerDown({ screenPoint: p1, button: 0, shiftKey: false, ctrlKey: false });
    engine.input.dispatchPointerMove({ screenPoint: p2, button: 0, shiftKey: false, ctrlKey: false });
    engine.input.dispatchPointerUp({ screenPoint: p2, button: 0, shiftKey: false, ctrlKey: false });

    // Концы грани сместились только по X.
    expect(cable.route[1].y).toBeCloseTo(0, 0);
    expect(cable.route[2].y).toBeCloseTo(500, 0);
    expect(cable.route[1].x).toBeCloseTo(300, 0);
    expect(cable.route[2].x).toBeCloseTo(300, 0);
  });

  it('перемещает горизонтальную грань только по вертикали', () => {
    const fromPos = new Vector2(-500, 0);
    const toPos = new Vector2(500, 0);
    plan.addCable(null, null, 'power', 2.5, {
      fromPoint: fromPos,
      toPoint: toPos,
      route: [fromPos, new Vector2(-500, 500), new Vector2(500, 500), toPos],
    });
    const cable = plan.cables[0];
    cable.routing = 'manual';

    // Внутреннее горизонтальное ребро (-500,500)-(500,500).
    const p1 = engine.camera.worldToScreen(new Vector2(0, 500));
    const p2 = engine.camera.worldToScreen(new Vector2(0, 800));
    engine.input.dispatchPointerDown({ screenPoint: p1, button: 0, shiftKey: false, ctrlKey: false });
    engine.input.dispatchPointerMove({ screenPoint: p2, button: 0, shiftKey: false, ctrlKey: false });
    engine.input.dispatchPointerUp({ screenPoint: p2, button: 0, shiftKey: false, ctrlKey: false });

    expect(cable.route[1].x).toBeCloseTo(-500, 0);
    expect(cable.route[2].x).toBeCloseTo(500, 0);
    expect(cable.route[1].y).toBeCloseTo(800, 0);
    expect(cable.route[2].y).toBeCloseTo(800, 0);
  });

  it('добавляет вершины обхода при столкновении грани со стеной', () => {
    // Комната 4000×4000 с вертикальной перегородкой x=300, не доходящей до потолка.
    plan.addWall(new Vector2(-2000, -2000), new Vector2(-2000, 2000));
    plan.addWall(new Vector2(-2000, 2000), new Vector2(2000, 2000));
    plan.addWall(new Vector2(2000, 2000), new Vector2(2000, -2000));
    plan.addWall(new Vector2(2000, -2000), new Vector2(-2000, -2000));
    const partition = plan.addWall(new Vector2(300, -1500), new Vector2(300, 500));
    plan.addOpening(partition.id, 'door', 0.75, 600);

    const fromPos = new Vector2(-500, 0);
    const toPos = new Vector2(500, 1000);
    plan.addCable(null, null, 'power', 2.5, {
      fromPoint: fromPos,
      toPoint: toPos,
      route: [fromPos, new Vector2(-500, 400), new Vector2(500, 400), new Vector2(500, 1000), toPos],
    });
    const cable = plan.cables[0];
    cable.routing = 'manual';
    const beforeCount = cable.route.length;

    // Внутреннее горизонтальное ребро (-500,400)-(500,400) пересекает перегородку x=300.
    // Тянем его вверх/вниз — ребро остаётся горизонтальным и всё ещё пересекает стену,
    // поэтому должен добавиться обход.
    const p1 = engine.camera.worldToScreen(new Vector2(0, 400));
    const p2 = engine.camera.worldToScreen(new Vector2(0, 600));
    engine.input.dispatchPointerDown({ screenPoint: p1, button: 0, shiftKey: false, ctrlKey: false });
    engine.input.dispatchPointerMove({ screenPoint: p2, button: 0, shiftKey: false, ctrlKey: false });
    engine.input.dispatchPointerUp({ screenPoint: p2, button: 0, shiftKey: false, ctrlKey: false });

    // Должны появиться дополнительные вершины обхода.
    expect(cable.route.length).toBeGreaterThan(beforeCount);
    // Маршрут не должен пересекать перегородку вне проёма.
    for (let i = 1; i < cable.route.length; i++) {
      expect(segmentCrossesWallOutsideOpening(cable.route[i - 1], cable.route[i], plan)).toBe(false);
    }
  });

  it('не позволяет переместить вершину так, чтобы кабель пересёк стену', () => {
    // Комната 2000×2000 с вертикальной перегородкой x=300 без проёма.
    plan.addWall(new Vector2(-1000, -1000), new Vector2(-1000, 1000));
    plan.addWall(new Vector2(-1000, 1000), new Vector2(1000, 1000));
    plan.addWall(new Vector2(1000, 1000), new Vector2(1000, -1000));
    plan.addWall(new Vector2(1000, -1000), new Vector2(-1000, -1000));
    plan.addWall(new Vector2(300, -1000), new Vector2(300, 1000));

    const fromPos = new Vector2(-500, 0);
    const toPos = new Vector2(500, 0);
    plan.addCable(null, null, 'power', 2.5, {
      fromPoint: fromPos,
      toPoint: toPos,
      route: [fromPos, new Vector2(0, 0), toPos],
    });
    const cable = plan.cables[0];
    cable.routing = 'manual';
    const originalRoute = cable.route.map((p) => p.clone());

    // Тянем внутреннюю вершину через перегородку.
    const p1 = engine.camera.worldToScreen(new Vector2(0, 0));
    const p2 = engine.camera.worldToScreen(new Vector2(500, 0));
    engine.input.dispatchPointerDown({ screenPoint: p1, button: 0, shiftKey: false, ctrlKey: false });
    engine.input.dispatchPointerMove({ screenPoint: p2, button: 0, shiftKey: false, ctrlKey: false });
    engine.input.dispatchPointerUp({ screenPoint: p2, button: 0, shiftKey: false, ctrlKey: false });

    // Без проёма обход невозможен — маршрут должен остаться исходным.
    expect(cable.route.length).toBe(originalRoute.length);
    for (let i = 0; i < originalRoute.length; i++) {
      expect(cable.route[i]).toEqual(originalRoute[i]);
    }
  });

  it('автоматически обходит стену при перемещении вершины, если есть проём', () => {
    // Комната 2000×2000 с вертикальной перегородкой x=300 и дверью в центре.
    plan.addWall(new Vector2(-1000, -1000), new Vector2(-1000, 1000));
    plan.addWall(new Vector2(-1000, 1000), new Vector2(1000, 1000));
    plan.addWall(new Vector2(1000, 1000), new Vector2(1000, -1000));
    plan.addWall(new Vector2(1000, -1000), new Vector2(-1000, -1000));
    const partition = plan.addWall(new Vector2(300, -1000), new Vector2(300, 1000));
    plan.addOpening(partition.id, 'door', 0.5, 600);

    const fromPos = new Vector2(-500, 0);
    const toPos = new Vector2(500, 0);
    plan.addCable(null, null, 'power', 2.5, {
      fromPoint: fromPos,
      toPoint: toPos,
      route: [fromPos, new Vector2(0, 0), toPos],
    });
    const cable = plan.cables[0];
    cable.routing = 'manual';

    // Тянем внутреннюю вершину через перегородку — должен появиться обход.
    const p1 = engine.camera.worldToScreen(new Vector2(0, 0));
    const p2 = engine.camera.worldToScreen(new Vector2(500, 0));
    engine.input.dispatchPointerDown({ screenPoint: p1, button: 0, shiftKey: false, ctrlKey: false });
    engine.input.dispatchPointerMove({ screenPoint: p2, button: 0, shiftKey: false, ctrlKey: false });
    engine.input.dispatchPointerUp({ screenPoint: p2, button: 0, shiftKey: false, ctrlKey: false });

    // Маршрут не должен пересекать перегородку вне проёма.
    for (let i = 0; i < cable.route.length - 1; i++) {
      const a = cable.route[i];
      const b = cable.route[i + 1];
      // Проверяем пересечение с перегородкой: пересекает x=300 вне y ∈ [-300, 300].
      if ((a.x < 300 && b.x > 300) || (a.x > 300 && b.x < 300)) {
        const t = (300 - a.x) / (b.x - a.x);
        const y = a.y + (b.y - a.y) * t;
        expect(Math.abs(y)).toBeLessThanOrEqual(300);
      }
    }
  });
});
