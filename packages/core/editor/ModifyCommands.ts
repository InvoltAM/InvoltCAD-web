import { Vector2 } from '../geometry/Vector2';
import { Plan } from '../model/Plan';
import { Command } from './CommandManager';

interface MovedWall {
  id: string;
  a: Vector2;
  b: Vector2;
}

interface MovedPrimitive {
  id: string;
  points: Vector2[];
}

interface MovedDimension {
  id: string;
  a: Vector2;
  b: Vector2;
}

interface MovedCable {
  id: string;
  route: Vector2[];
}

interface MovedTable {
  id: string;
  position: { x: number; y: number };
}

interface MovedDevice {
  id: string;
  position: { x: number; y: number };
  rotation: number;
}

export interface MoveSelectionState {
  walls: MovedWall[];
  primitives: MovedPrimitive[];
  dimensions: MovedDimension[];
  cables: MovedCable[];
  tables: MovedTable[];
  freeDevices: MovedDevice[];
}

function cloneMoveState(state: MoveSelectionState): MoveSelectionState {
  return {
    walls: state.walls.map(w => ({ id: w.id, a: w.a.clone(), b: w.b.clone() })),
    primitives: state.primitives.map(p => ({ id: p.id, points: p.points.map(pt => pt.clone()) })),
    dimensions: state.dimensions.map(d => ({ id: d.id, a: d.a.clone(), b: d.b.clone() })),
    cables: state.cables.map(c => ({ id: c.id, route: c.route.map(pt => pt.clone()) })),
    tables: state.tables.map(t => ({ id: t.id, position: { ...t.position } })),
    freeDevices: state.freeDevices.map(d => ({ id: d.id, position: { ...d.position }, rotation: d.rotation })),
  };
}

function applyMoveState(plan: Plan, state: MoveSelectionState): void {
  for (const w of state.walls) {
    const wall = plan.findWall(w.id);
    if (!wall) continue;
    wall.a = w.a.clone();
    wall.b = w.b.clone();
    if (wall.arc) {
      wall.arc = undefined;
    }
  }
  for (const p of state.primitives) {
    const primitive = plan.findPrimitive(p.id);
    if (!primitive) continue;
    primitive.points = p.points.map(pt => pt.clone());
  }
  for (const d of state.dimensions) {
    const dim = plan.dimensions.find(x => x.id === d.id);
    if (!dim) continue;
    dim.a = d.a.clone();
    dim.b = d.b.clone();
  }
  for (const c of state.cables) {
    const cable = plan.findCable(c.id);
    if (!cable) continue;
    cable.route = c.route.map(pt => pt.clone());
  }
  for (const t of state.tables) {
    plan.moveSheetTable(t.id, new Vector2(t.position.x, t.position.y));
  }
  for (const d of state.freeDevices) {
    const device = plan.findDevice(d.id);
    if (!device) continue;
    device.position = { ...d.position };
    device.rotation = d.rotation;
  }
  plan.invalidateRooms();
  plan.recalcCableRoutes();
}

/** Перемещение выделенных объектов на заданный вектор. */
export class MoveSelectionCommand implements Command {
  private oldState: MoveSelectionState;

  constructor(
    private plan: Plan,
    oldState: MoveSelectionState,
    private delta: Vector2,
  ) {
    this.oldState = cloneMoveState(oldState);
  }

  execute(): void {
    const newState: MoveSelectionState = {
      walls: this.oldState.walls.map(w => ({
        id: w.id,
        a: w.a.add(this.delta),
        b: w.b.add(this.delta),
      })),
      primitives: this.oldState.primitives.map(p => ({
        id: p.id,
        points: p.points.map(pt => pt.add(this.delta)),
      })),
      dimensions: this.oldState.dimensions.map(d => ({
        id: d.id,
        a: d.a.add(this.delta),
        b: d.b.add(this.delta),
      })),
      cables: this.oldState.cables.map(c => ({
        id: c.id,
        route: c.route.map(pt => pt.add(this.delta)),
      })),
      tables: this.oldState.tables.map(t => ({
        id: t.id,
        position: { x: t.position.x + this.delta.x, y: t.position.y + this.delta.y },
      })),
      freeDevices: this.oldState.freeDevices.map(d => ({
        id: d.id,
        position: { x: d.position.x + this.delta.x, y: d.position.y + this.delta.y },
        rotation: d.rotation,
      })),
    };
    applyMoveState(this.plan, newState);
  }

  undo(): void {
    applyMoveState(this.plan, this.oldState);
  }
}

/** Поворот выделенных объектов вокруг базовой точки на заданный угол. */
export class RotateSelectionCommand implements Command {
  private oldState: MoveSelectionState;

  constructor(
    private plan: Plan,
    oldState: MoveSelectionState,
    private center: Vector2,
    private angle: number,
  ) {
    this.oldState = cloneMoveState(oldState);
  }

  execute(): void {
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    const rotate = (p: Vector2) => this.center.add(p.sub(this.center).rotate(this.angle));

    const newState: MoveSelectionState = {
      walls: this.oldState.walls.map(w => ({
        id: w.id,
        a: rotate(w.a),
        b: rotate(w.b),
      })),
      primitives: this.oldState.primitives.map(p => ({
        id: p.id,
        points: p.points.map(rotate),
      })),
      dimensions: this.oldState.dimensions.map(d => ({
        id: d.id,
        a: rotate(d.a),
        b: rotate(d.b),
      })),
      cables: this.oldState.cables.map(c => ({
        id: c.id,
        route: c.route.map(rotate),
      })),
      tables: this.oldState.tables.map(t => {
        const pos = rotate(new Vector2(t.position.x, t.position.y));
        return { id: t.id, position: { x: pos.x, y: pos.y } };
      }),
      freeDevices: this.oldState.freeDevices.map(d => ({
        id: d.id,
        position: { x: d.position.x, y: d.position.y },
        rotation: d.rotation,
      })),
    };

    // Свободные устройства поворачиваем вокруг центра и меняем их rotation
    for (const d of this.oldState.freeDevices) {
      const pos = rotate(new Vector2(d.position.x, d.position.y));
      const idx = newState.freeDevices.findIndex(x => x.id === d.id);
      if (idx >= 0) {
        newState.freeDevices[idx].position = { x: pos.x, y: pos.y };
        newState.freeDevices[idx].rotation = d.rotation + this.angle;
      }
    }

    applyMoveState(this.plan, newState);
  }

  undo(): void {
    applyMoveState(this.plan, this.oldState);
  }
}

interface TrimmedPrimitive {
  id: string;
  oldPoints: Vector2[];
  newPoints: Vector2[];
}

/** Обрезка/удлинение примитива: замена точек на новый набор. */
export class UpdatePrimitiveCommand implements Command {
  private oldPoints: Vector2[] = [];

  constructor(
    private plan: Plan,
    private primitiveId: string,
    private newPoints: Vector2[],
  ) {}

  execute(): void {
    const primitive = this.plan.findPrimitive(this.primitiveId);
    if (!primitive) return;
    this.oldPoints = primitive.points.map(p => p.clone());
    primitive.points = this.newPoints.map(p => p.clone());
    this.plan.invalidateRooms();
  }

  undo(): void {
    const primitive = this.plan.findPrimitive(this.primitiveId);
    if (!primitive) return;
    primitive.points = this.oldPoints.map(p => p.clone());
    this.plan.invalidateRooms();
  }
}
