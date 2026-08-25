import { describe, it, expect, beforeEach } from 'vitest';
import { CableTool } from './CableTool';
import { Plan } from '../model/Plan';
import { Vector2 } from '../geometry/Vector2';
import { ThemeManager } from '../editor/ThemeManager';
import { CanvasEngine } from '../engine/CanvasEngine';

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

describe('CableTool', () => {
  let plan: Plan;
  let engine: CanvasEngine;
  let tool: CableTool;

  beforeEach(() => {
    plan = new Plan();
    engine = createEngine(plan);
    tool = new CableTool(engine, plan);
    engine.toolManager.register(tool);
  });

  it('создаёт кабель между двумя устройствами', () => {
    const wall = plan.addWall(new Vector2(-1000, 0), new Vector2(1000, 0));
    const from = plan.addDevice(wall.id, 'socket', 0.25, 0, 1)!;
    const to = plan.addDevice(wall.id, 'socket', 0.75, 0, 1)!;

    engine.setTool('cable');
    const p1 = engine.camera.worldToScreen(plan.deviceWorldPosition(from));
    const p2 = engine.camera.worldToScreen(plan.deviceWorldPosition(to));

    engine.input.dispatchPointerDown({ screenPoint: p1, button: 0, shiftKey: false, ctrlKey: false });
    engine.input.dispatchPointerUp({ screenPoint: p1, button: 0, shiftKey: false, ctrlKey: false });
    engine.input.dispatchPointerDown({ screenPoint: p2, button: 0, shiftKey: false, ctrlKey: false });
    engine.input.dispatchPointerUp({ screenPoint: p2, button: 0, shiftKey: false, ctrlKey: false });

    expect(plan.cables.length).toBe(1);
    const cable = plan.cables[0];
    expect(cable.fromDeviceId).toBe(from.id);
    expect(cable.toDeviceId).toBe(to.id);
    expect(cable.route.length).toBeGreaterThanOrEqual(2);
    expect(cable.length).toBeGreaterThan(0);
  });

  it('создаёт кабель от устройства до точки на стене', () => {
    const wall = plan.addWall(new Vector2(-1000, 0), new Vector2(1000, 0));
    const from = plan.addDevice(wall.id, 'socket', 0.25, 0, 1)!;
    const toPoint = new Vector2(500, 500);

    engine.setTool('cable');
    const p1 = engine.camera.worldToScreen(plan.deviceWorldPosition(from));
    const p2 = engine.camera.worldToScreen(toPoint);

    engine.input.dispatchPointerDown({ screenPoint: p1, button: 0, shiftKey: false, ctrlKey: false });
    engine.input.dispatchPointerUp({ screenPoint: p1, button: 0, shiftKey: false, ctrlKey: false });
    engine.input.dispatchPointerDown({ screenPoint: p2, button: 0, shiftKey: false, ctrlKey: false });
    engine.input.dispatchPointerUp({ screenPoint: p2, button: 0, shiftKey: false, ctrlKey: false });

    expect(plan.cables.length).toBe(1);
    const cable = plan.cables[0];
    expect(cable.fromDeviceId).toBe(from.id);
    expect(cable.toDeviceId).toBeNull();
    expect(cable.toPoint).toBeTruthy();
    expect(cable.route.length).toBeGreaterThanOrEqual(2);
  });

  it('добавляет промежуточные узлы по Shift+клик', () => {
    const wall = plan.addWall(new Vector2(-1000, 0), new Vector2(1000, 0));
    const from = plan.addDevice(wall.id, 'socket', 0.25, 0, 1)!;
    const to = plan.addDevice(wall.id, 'socket', 0.75, 0, 1)!;
    const via = new Vector2(0, 500);

    engine.setTool('cable');
    const p1 = engine.camera.worldToScreen(plan.deviceWorldPosition(from));
    const pVia = engine.camera.worldToScreen(via);
    const p2 = engine.camera.worldToScreen(plan.deviceWorldPosition(to));

    engine.input.dispatchPointerDown({ screenPoint: p1, button: 0, shiftKey: false, ctrlKey: false });
    engine.input.dispatchPointerUp({ screenPoint: p1, button: 0, shiftKey: false, ctrlKey: false });
    // промежуточный узел
    engine.input.dispatchPointerDown({ screenPoint: pVia, button: 0, shiftKey: true, ctrlKey: false });
    engine.input.dispatchPointerUp({ screenPoint: pVia, button: 0, shiftKey: true, ctrlKey: false });
    // завершение
    engine.input.dispatchPointerDown({ screenPoint: p2, button: 0, shiftKey: false, ctrlKey: false });
    engine.input.dispatchPointerUp({ screenPoint: p2, button: 0, shiftKey: false, ctrlKey: false });

    expect(plan.cables.length).toBe(1);
    const cable = plan.cables[0];
    expect(cable.viaPoints?.length).toBe(1);
    expect(cable.route.length).toBeGreaterThanOrEqual(3);
  });

  it('использует snap-привязки при отрисовке', () => {
    const wall = plan.addWall(new Vector2(-1000, 0), new Vector2(1000, 0));
    const from = plan.addDevice(wall.id, 'socket', 0.25, 0, 1)!;

    engine.setTool('cable');
    const p1 = engine.camera.worldToScreen(plan.deviceWorldPosition(from));
    engine.input.dispatchPointerDown({ screenPoint: p1, button: 0, shiftKey: false, ctrlKey: false });
    engine.input.dispatchPointerUp({ screenPoint: p1, button: 0, shiftKey: false, ctrlKey: false });

    // Двигаем курсор — должен обновиться snap.
    const pMove = engine.camera.worldToScreen(new Vector2(0, 500));
    engine.input.dispatchPointerMove({ screenPoint: pMove, button: 0, shiftKey: false, ctrlKey: false });

    expect(engine.snap).toBeTruthy();
    expect(engine.snap!.point).toBeTruthy();
  });
});
