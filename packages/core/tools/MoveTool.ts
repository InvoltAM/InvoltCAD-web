import { Vector2 } from '../geometry/Vector2';
import { InputEvent } from '../engine/InputManager';
import { Plan } from '../model/Plan';
import { SnapEngine } from '../snap/SnapEngine';
import { CanvasEngine } from '../engine/CanvasEngine';
import { Tool } from './ToolManager';
import { MoveSelectionCommand, MoveSelectionState } from '../editor/ModifyCommands';

type MoveState = 'idle' | 'moving';

interface MoveSelectionSnapshot {
  walls: string[];
  primitives: string[];
  dimensions: string[];
  cables: string[];
  tables: string[];
  freeDevices: string[];
}

/**
 * Инструмент "Перенести".
 * Перемещает текущее выделение (стены, примитивы, размеры, кабели, таблицы,
 * свободно размещённые устройства) на заданный вектор.
 * Первый клик — базовая точка, drag / второй клик — фиксация, Esc — отмена.
 */
export class MoveTool implements Tool {
  readonly name = 'move' as const;

  private state: MoveState = 'idle';
  private base = new Vector2(0, 0);
  private delta = new Vector2(0, 0);
  private selection: MoveSelectionSnapshot = {
    walls: [],
    primitives: [],
    dimensions: [],
    cables: [],
    tables: [],
    freeDevices: [],
  };
  private originalState: MoveSelectionState | null = null;

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
    if (this.state === 'moving') {
      this.cancelPreview();
    }
    this.canvas.setGhost(null);
    this.canvas.setSnap(null);
    this.snapEngine.clearTracking();
  }

  onPointerDown(e: InputEvent): void {
    if (this.state === 'idle') {
      const snap = this.snapEngine.snap(e.screenPoint);
      this.base = snap.point.clone();
      this.delta = new Vector2(0, 0);
      this.state = 'moving';
      this.originalState = this.collectState();
      this.canvas.setSnap(snap);
      return;
    }

    if (this.state === 'moving') {
      this.apply(this.delta);
      this.state = 'idle';
      this.canvas.setGhost(null);
      this.canvas.setSnap(null);
      this.snapEngine.clearTracking();
    }
  }

  onPointerMove(e: InputEvent): void {
    if (this.state !== 'moving') return;
    const snap = this.snapEngine.snap(e.screenPoint);
    this.canvas.setSnap(snap);
    this.delta = snap.point.sub(this.base);
    this.applyPreview(this.delta);
  }

  onPointerUp(e: InputEvent): void {
    // Завершение по отпусканию не используем — только по второму клику или Enter.
  }

  onKeyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') {
      if (this.state === 'moving') {
        this.cancelPreview();
        this.state = 'idle';
        this.canvas.setGhost(null);
        this.canvas.setSnap(null);
        this.snapEngine.clearTracking();
        return true;
      }
    }
    if (e.key === 'Enter') {
      if (this.state === 'moving') {
        this.apply(this.delta);
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

  private collectState(): any {
    return {
      walls: this.selection.walls.map(id => {
        const wall = this.plan.findWall(id);
        return wall ? { id, a: wall.a.clone(), b: wall.b.clone() } : null;
      }).filter(Boolean),
      primitives: this.selection.primitives.map(id => {
        const primitive = this.plan.findPrimitive(id);
        return primitive ? { id, points: primitive.points.map(p => p.clone()) } : null;
      }).filter(Boolean),
      dimensions: this.selection.dimensions.map(id => {
        const dim = this.plan.dimensions.find(d => d.id === id);
        return dim ? { id, a: dim.a.clone(), b: dim.b.clone() } : null;
      }).filter(Boolean),
      cables: this.selection.cables.map(id => {
        const cable = this.plan.findCable(id);
        return cable ? { id, route: cable.route.map(p => p.clone()) } : null;
      }).filter(Boolean),
      tables: this.selection.tables.map(id => {
        const table = this.plan.findSheetTable(id);
        return table ? { id, position: { ...table.position } } : null;
      }).filter(Boolean),
      freeDevices: this.selection.freeDevices.map(id => {
        const device = this.plan.findDevice(id);
        return device && device.position
          ? { id, position: { ...device.position }, rotation: device.rotation }
          : null;
      }).filter(Boolean),
    };
  }

  private applyPreview(delta: Vector2): void {
    if (!this.originalState) return;
    const state = this.originalState;

    for (const w of state.walls) {
      const wall = this.plan.findWall(w.id);
      if (!wall) continue;
      wall.a = w.a.add(delta);
      wall.b = w.b.add(delta);
      if (wall.arc) wall.arc = undefined;
    }
    for (const p of state.primitives) {
      const primitive = this.plan.findPrimitive(p.id);
      if (!primitive) continue;
      primitive.points = p.points.map((pt: Vector2) => pt.add(delta));
    }
    for (const d of state.dimensions) {
      const dim = this.plan.dimensions.find((x: any) => x.id === d.id);
      if (!dim) continue;
      dim.a = d.a.add(delta);
      dim.b = d.b.add(delta);
    }
    for (const c of state.cables) {
      const cable = this.plan.findCable(c.id);
      if (!cable) continue;
      cable.route = c.route.map((pt: Vector2) => pt.add(delta));
    }
    for (const t of state.tables) {
      this.plan.moveSheetTable(t.id, new Vector2(t.position.x + delta.x, t.position.y + delta.y));
    }
    for (const d of state.freeDevices) {
      const device = this.plan.findDevice(d.id);
      if (!device) continue;
      device.position = { x: d.position.x + delta.x, y: d.position.y + delta.y };
    }

    this.plan.invalidateRooms();
    this.plan.recalcCableRoutes();
    this.canvas.notifyChanged();
  }

  private apply(delta: Vector2): void {
    if (!this.originalState) return;
    this.applyPreview(delta);
    this.canvas.commandManager.execute(new MoveSelectionCommand(this.plan, this.originalState, delta));
    this.originalState = null;
  }

  private cancelPreview(): void {
    if (!this.originalState) return;
    // Восстанавливаем оригинальные позиции
    const state = this.originalState;
    for (const w of state.walls) {
      const wall = this.plan.findWall(w.id);
      if (!wall) continue;
      wall.a = w.a.clone();
      wall.b = w.b.clone();
      if (wall.arc) wall.arc = undefined;
    }
    for (const p of state.primitives) {
      const primitive = this.plan.findPrimitive(p.id);
      if (!primitive) continue;
      primitive.points = p.points.map((pt: Vector2) => pt.clone());
    }
    for (const d of state.dimensions) {
      const dim = this.plan.dimensions.find((x: any) => x.id === d.id);
      if (!dim) continue;
      dim.a = d.a.clone();
      dim.b = d.b.clone();
    }
    for (const c of state.cables) {
      const cable = this.plan.findCable(c.id);
      if (!cable) continue;
      cable.route = c.route.map((pt: Vector2) => pt.clone());
    }
    for (const t of state.tables) {
      this.plan.moveSheetTable(t.id, new Vector2(t.position.x, t.position.y));
    }
    for (const d of state.freeDevices) {
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
