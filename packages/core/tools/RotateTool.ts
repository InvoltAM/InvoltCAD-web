import { Vector2 } from '../geometry/Vector2';
import { InputEvent } from '../engine/InputManager';
import { Plan } from '../model/Plan';
import { SnapEngine } from '../snap/SnapEngine';
import { CanvasEngine } from '../engine/CanvasEngine';
import { Tool } from './ToolManager';
import { RotateSelectionCommand } from '../editor/ModifyCommands';

type RotateState = 'idle' | 'rotating';

interface RotateSelectionSnapshot {
  walls: string[];
  primitives: string[];
  dimensions: string[];
  cables: string[];
  tables: string[];
  freeDevices: string[];
}

interface SelectionState {
  walls: { id: string; a: Vector2; b: Vector2 }[];
  primitives: { id: string; points: Vector2[] }[];
  dimensions: { id: string; a: Vector2; b: Vector2 }[];
  cables: { id: string; route: Vector2[] }[];
  tables: { id: string; position: { x: number; y: number } }[];
  freeDevices: { id: string; position: { x: number; y: number }; rotation: number }[];
}

/**
 * Инструмент "Повернуть".
 * Поворачивает текущее выделение вокруг базовой точки.
 * Первый клик — центр вращения, drag / второй клик — угол, Esc — отмена.
 */
export class RotateTool implements Tool {
  readonly name = 'rotate' as const;

  private state: RotateState = 'idle';
  private center = new Vector2(0, 0);
  private startAngle = 0;
  private currentAngle = 0;
  private selection: RotateSelectionSnapshot = {
    walls: [],
    primitives: [],
    dimensions: [],
    cables: [],
    tables: [],
    freeDevices: [],
  };
  private originalState: SelectionState | null = null;

  constructor(
    private canvas: CanvasEngine,
    private plan: Plan,
    private snapEngine: SnapEngine,
  ) {}

  onActivate(): void {
    this.state = 'idle';
    this.captureSelection();
    this.canvas.setGhost(null);
    this.canvas.setSnap(null);
  }

  onDeactivate(): void {
    if (this.state === 'rotating') {
      this.cancelPreview();
    }
    this.canvas.setGhost(null);
    this.canvas.setSnap(null);
    this.snapEngine.clearTracking();
  }

  onPointerDown(e: InputEvent): void {
    if (this.state === 'idle') {
      const snap = this.snapEngine.snap(e.screenPoint);
      this.center = snap.point.clone();
      this.startAngle = this.computeAngle(e.worldPoint);
      this.currentAngle = 0;
      this.state = 'rotating';
      this.originalState = this.collectState();
      this.canvas.setSnap(snap);
      return;
    }

    if (this.state === 'rotating') {
      this.apply(this.currentAngle);
      this.state = 'idle';
      this.canvas.setGhost(null);
      this.canvas.setSnap(null);
      this.snapEngine.clearTracking();
    }
  }

  onPointerMove(e: InputEvent): void {
    if (this.state !== 'rotating') return;
    const snap = this.snapEngine.snap(e.screenPoint);
    this.canvas.setSnap(snap);
    this.currentAngle = this.computeAngle(snap.point) - this.startAngle;
    this.applyPreview(this.currentAngle);
  }

  onPointerUp(e: InputEvent): void {
    // Фиксация по второму клику или Enter, не по отпусканию.
  }

  onKeyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') {
      if (this.state === 'rotating') {
        this.cancelPreview();
        this.state = 'idle';
        this.canvas.setGhost(null);
        this.canvas.setSnap(null);
        this.snapEngine.clearTracking();
        return true;
      }
    }
    if (e.key === 'Enter') {
      if (this.state === 'rotating') {
        this.apply(this.currentAngle);
        this.state = 'idle';
        this.canvas.setGhost(null);
        this.canvas.setSnap(null);
        this.snapEngine.clearTracking();
        return true;
      }
    }
    return false;
  }

  private captureSelection(): void {
    const walls = this.canvas.getSelectedWalls();
    const primitives = this.canvas.getSelectedPrimitives();
    const dimensions = this.canvas.getSelectedDimensions();
    const cables = this.canvas.getSelectedCables();
    const tables = this.canvas.getSelectedSheetTables();
    const devices = this.canvas.getSelectedDevices();
    const freeDevices = devices.filter(id => {
      const device = this.plan.findDevice(id);
      return device && !device.wallId;
    });

    this.selection = {
      walls,
      primitives,
      dimensions,
      cables,
      tables,
      freeDevices,
    };
  }

  private collectState(): SelectionState {
    return {
      walls: this.selection.walls.map(id => {
        const wall = this.plan.findWall(id);
        return wall ? { id, a: wall.a.clone(), b: wall.b.clone() } : null;
      }).filter((x): x is { id: string; a: Vector2; b: Vector2 } => !!x),
      primitives: this.selection.primitives.map(id => {
        const primitive = this.plan.findPrimitive(id);
        return primitive ? { id, points: primitive.points.map(p => p.clone()) } : null;
      }).filter((x): x is { id: string; points: Vector2[] } => !!x),
      dimensions: this.selection.dimensions.map(id => {
        const dim = this.plan.dimensions.find(d => d.id === id);
        return dim ? { id, a: dim.a.clone(), b: dim.b.clone() } : null;
      }).filter((x): x is { id: string; a: Vector2; b: Vector2 } => !!x),
      cables: this.selection.cables.map(id => {
        const cable = this.plan.findCable(id);
        return cable ? { id, route: cable.route.map(p => p.clone()) } : null;
      }).filter((x): x is { id: string; route: Vector2[] } => !!x),
      tables: this.selection.tables.map(id => {
        const table = this.plan.findSheetTable(id);
        return table ? { id, position: { ...table.position } } : null;
      }).filter((x): x is { id: string; position: { x: number; y: number } } => !!x),
      freeDevices: this.selection.freeDevices.map(id => {
        const device = this.plan.findDevice(id);
        return device && device.position
          ? { id, position: { ...device.position }, rotation: device.rotation }
          : null;
      }).filter((x): x is { id: string; position: { x: number; y: number }; rotation: number } => !!x),
    };
  }

  private computeAngle(point: Vector2): number {
    return Math.atan2(point.y - this.center.y, point.x - this.center.x);
  }

  private applyPreview(angle: number): void {
    if (!this.originalState) return;
    this.applyAngle(angle, false);
  }

  private apply(angle: number): void {
    if (!this.originalState) return;
    this.applyAngle(angle, true);
    this.canvas.commandManager.execute(new RotateSelectionCommand(this.plan, this.originalState, this.center, angle));
    this.originalState = null;
  }

  private applyAngle(angle: number, notify: boolean): void {
    if (!this.originalState) return;
    const rotate = (p: Vector2) => this.center.add(p.sub(this.center).rotate(angle));

    for (const w of this.originalState.walls) {
      const wall = this.plan.findWall(w.id);
      if (!wall) continue;
      wall.a = rotate(w.a);
      wall.b = rotate(w.b);
      if (wall.arc) wall.arc = undefined;
    }
    for (const p of this.originalState.primitives) {
      const primitive = this.plan.findPrimitive(p.id);
      if (!primitive) continue;
      primitive.points = p.points.map(rotate);
    }
    for (const d of this.originalState.dimensions) {
      const dim = this.plan.dimensions.find(x => x.id === d.id);
      if (!dim) continue;
      dim.a = rotate(d.a);
      dim.b = rotate(d.b);
    }
    for (const c of this.originalState.cables) {
      const cable = this.plan.findCable(c.id);
      if (!cable) continue;
      cable.route = c.route.map(rotate);
    }
    for (const t of this.originalState.tables) {
      const pos = rotate(new Vector2(t.position.x, t.position.y));
      this.plan.moveSheetTable(t.id, pos);
    }
    for (const d of this.originalState.freeDevices) {
      const device = this.plan.findDevice(d.id);
      if (!device) continue;
      const pos = rotate(new Vector2(d.position.x, d.position.y));
      device.position = { x: pos.x, y: pos.y };
      device.rotation = d.rotation + angle;
    }

    this.plan.invalidateRooms();
    this.plan.recalcCableRoutes();
    if (notify) this.canvas.notifyChanged();
  }

  private cancelPreview(): void {
    if (!this.originalState) return;
    for (const w of this.originalState.walls) {
      const wall = this.plan.findWall(w.id);
      if (!wall) continue;
      wall.a = w.a.clone();
      wall.b = w.b.clone();
      if (wall.arc) wall.arc = undefined;
    }
    for (const p of this.originalState.primitives) {
      const primitive = this.plan.findPrimitive(p.id);
      if (!primitive) continue;
      primitive.points = p.points.map(pt => pt.clone());
    }
    for (const d of this.originalState.dimensions) {
      const dim = this.plan.dimensions.find(x => x.id === d.id);
      if (!dim) continue;
      dim.a = d.a.clone();
      dim.b = d.b.clone();
    }
    for (const c of this.originalState.cables) {
      const cable = this.plan.findCable(c.id);
      if (!cable) continue;
      cable.route = c.route.map(pt => pt.clone());
    }
    for (const t of this.originalState.tables) {
      this.plan.moveSheetTable(t.id, new Vector2(t.position.x, t.position.y));
    }
    for (const d of this.originalState.freeDevices) {
      const device = this.plan.findDevice(d.id);
      if (!device) continue;
      device.position = { ...d.position };
      device.rotation = d.rotation;
    }

    this.plan.invalidateRooms();
    this.plan.recalcCableRoutes();
    this.canvas.notifyChanged();
    this.originalState = null;
  }
}
