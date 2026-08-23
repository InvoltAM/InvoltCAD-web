import { Plan } from '../model/Plan';
import { DrawingPrimitive, DrawingPrimitiveType, DrawingTable, DrawingTableCell } from '../model/DrawingPrimitive';
import { Wall, WallArc, DEFAULT_WALL_THICKNESS, updateWallArcEndpoints } from '../model/Wall';
import { Opening, OpeningType } from '../model/Opening';
import { Device, DeviceType } from '../model/Device';
import { Cable, CableType, DEFAULT_CABLE } from '../model/Cable';
import { Dimension } from '../model/Dimension';
import { Vector2 } from '../geometry/Vector2';
import { SheetTable, SheetTableType } from '../model/SheetTable';
import { autoDesign } from '../ai/autoDesign';

export interface Command {
  execute(): void;
  undo(): void;
}

/**
 * Command Pattern для Undo/Redo.
 */
export class CommandManager {
  private history: Command[] = [];
  private index = -1;
  private maxHistory = 50;

  constructor(private onChange?: () => void) {}

  execute(cmd: Command): void {
    cmd.execute();
    // Удаляем будущие команды после текущей позиции
    if (this.index < this.history.length - 1) {
      this.history = this.history.slice(0, this.index + 1);
    }
    this.history.push(cmd);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.index++;
    }
    this.onChange?.();
  }

  undo(): void {
    if (this.index < 0) return;
    this.history[this.index].undo();
    this.index--;
    this.onChange?.();
  }

  redo(): void {
    if (this.index >= this.history.length - 1) return;
    this.index++;
    this.history[this.index].execute();
    this.onChange?.();
  }

  canUndo(): boolean {
    return this.index >= 0;
  }

  canRedo(): boolean {
    return this.index < this.history.length - 1;
  }

  /** Сбросить историю undo/redo (например, при переключении листа). */
  clear(): void {
    this.history = [];
    this.index = -1;
  }
}

/** Команда добавления стены. */
export class AddWallCommand implements Command {
  private wallId = '';

  constructor(
    private plan: Plan,
    private a: Vector2,
    private b: Vector2,
    private thickness = DEFAULT_WALL_THICKNESS,
  ) {}

  execute(): void {
    const wall = this.plan.addWall(this.a, this.b, this.thickness);
    this.wallId = wall.id;
  }

  undo(): void {
    this.plan.removeWall(this.wallId);
  }
}

/** Команда изменения дуги стены. */
export class UpdateWallArcCommand implements Command {
  private previousArc: WallArc | undefined = undefined;
  private previousA = new Vector2(0, 0);
  private previousB = new Vector2(0, 0);

  constructor(
    private plan: Plan,
    private wallId: string,
    private arc: WallArc | undefined,
  ) {}

  execute(): void {
    const wall = this.plan.findWall(this.wallId);
    if (!wall) return;
    this.previousArc = wall.arc ? { ...wall.arc, center: wall.arc.center.clone() } : undefined;
    this.previousA = wall.a.clone();
    this.previousB = wall.b.clone();
    wall.arc = this.arc ? { ...this.arc, center: this.arc.center.clone() } : undefined;
    if (wall.arc) {
      updateWallArcEndpoints(wall);
    } else {
      wall.a = this.previousA.clone();
      wall.b = this.previousB.clone();
    }
    this.plan.invalidateRooms();
  }

  undo(): void {
    const wall = this.plan.findWall(this.wallId);
    if (!wall) return;
    wall.arc = this.previousArc ? { ...this.previousArc, center: this.previousArc.center.clone() } : undefined;
    wall.a = this.previousA.clone();
    wall.b = this.previousB.clone();
    this.plan.invalidateRooms();
  }
}

/** Команда перемещения концов стен (для редактирования формы комнаты). */
export class MoveWallEndpointsCommand implements Command {
  private moves: Array<{
    wallId: string;
    endpoint: 'a' | 'b';
    oldPos: Vector2;
    newPos: Vector2;
  }> = [];

  constructor(
    private plan: Plan,
    moves: Array<{ wallId: string; endpoint: 'a' | 'b'; oldPos: Vector2; newPos: Vector2 }>,
  ) {
    this.moves = moves.map(m => ({
      wallId: m.wallId,
      endpoint: m.endpoint,
      oldPos: m.oldPos.clone(),
      newPos: m.newPos.clone(),
    }));
  }

  execute(): void {
    for (const m of this.moves) {
      const wall = this.plan.findWall(m.wallId);
      if (!wall) continue;
      wall[m.endpoint] = m.newPos.clone();
      if (wall.arc) {
        // После ручного сдвига конца дугу сбрасываем в прямую стену.
        wall.arc = undefined;
      }
    }
    this.plan.invalidateRooms();
  }

  undo(): void {
    for (const m of this.moves) {
      const wall = this.plan.findWall(m.wallId);
      if (!wall) continue;
      wall[m.endpoint] = m.oldPos.clone();
    }
    this.plan.invalidateRooms();
  }
}

/** Команда разбиения стены в заданной точке. */
export class SplitWallCommand implements Command {
  private newWallIds: [string, string] = ['', ''];
  private originalWallData: any = null;
  private originalDeviceTs = new Map<string, number>();

  constructor(
    private plan: Plan,
    private wallId: string,
    private point: Vector2,
  ) {}

  execute(): void {
    const wall = this.plan.findWall(this.wallId);
    if (!wall) return;

    this.originalWallData = JSON.parse(JSON.stringify(wall));
    this.originalDeviceTs.clear();
    for (const device of this.plan.devices) {
      if (device.wallId === this.wallId) {
        this.originalDeviceTs.set(device.id, device.t);
      }
    }

    const { w1, w2 } = this.plan.splitWallAtPoint(wall, this.point);
    this.newWallIds = [w1.id, w2.id];

    // Удаляем исходную стену без удаления устройств (splitWallAtPoint уже перенесла их)
    this.plan.walls = this.plan.walls.filter(w => w.id !== this.wallId);
    this.plan.walls.push(w1, w2);
    this.plan.invalidateRooms();
  }

  undo(): void {
    this.plan.walls = this.plan.walls.filter(w => w.id !== this.newWallIds[0] && w.id !== this.newWallIds[1]);

    if (!this.originalWallData) return;
    const w = this.originalWallData;
    const restored: Wall = {
      id: w.id,
      a: new Vector2(w.a.x, w.a.y),
      b: new Vector2(w.b.x, w.b.y),
      thickness: w.thickness,
      openings: w.openings.map((o: any) => ({ ...o })),
    };
    if (w.arc) {
      restored.arc = {
        center: new Vector2(w.arc.center.x, w.arc.center.y),
        radius: w.arc.radius,
        startAngle: w.arc.startAngle,
        endAngle: w.arc.endAngle,
        clockwise: w.arc.clockwise,
      };
    }
    this.plan.walls.push(restored);

    for (const device of this.plan.devices) {
      if (device.wallId === this.newWallIds[0] || device.wallId === this.newWallIds[1]) {
        device.wallId = w.id;
        const originalT = this.originalDeviceTs.get(device.id);
        if (originalT !== undefined) device.t = originalT;
      }
    }

    this.plan.invalidateRooms();
  }
}

/** Команда объединения двух коллинеарных стен. */
export class MergeWallsCommand implements Command {
  private mergedWallId = '';
  private originalWallsData: any[] = [];
  private originalDeviceTs = new Map<string, { wallId: string; t: number }>();

  constructor(
    private plan: Plan,
    private wallId1: string,
    private wallId2: string,
  ) {}

  execute(): void {
    const w1 = this.plan.findWall(this.wallId1);
    const w2 = this.plan.findWall(this.wallId2);
    if (!w1 || !w2) return;

    this.originalWallsData = [JSON.parse(JSON.stringify(w1)), JSON.parse(JSON.stringify(w2))];
    this.originalDeviceTs.clear();
    for (const device of this.plan.devices) {
      if (device.wallId === this.wallId1 || device.wallId === this.wallId2) {
        this.originalDeviceTs.set(device.id, { wallId: device.wallId, t: device.t });
      }
    }

    const merged = this.plan.mergeWalls(w1, w2);
    if (!merged) return;
    this.mergedWallId = merged.id;

    this.plan.walls = this.plan.walls.filter(w => w.id !== this.wallId1 && w.id !== this.wallId2);
    this.plan.walls.push(merged);
    this.plan.invalidateRooms();
  }

  undo(): void {
    this.plan.walls = this.plan.walls.filter(w => w.id !== this.mergedWallId);

    for (const w of this.originalWallsData) {
      const restored: Wall = {
        id: w.id,
        a: new Vector2(w.a.x, w.a.y),
        b: new Vector2(w.b.x, w.b.y),
        thickness: w.thickness,
        openings: w.openings.map((o: any) => ({ ...o })),
      };
      if (w.arc) {
        restored.arc = {
          center: new Vector2(w.arc.center.x, w.arc.center.y),
          radius: w.arc.radius,
          startAngle: w.arc.startAngle,
          endAngle: w.arc.endAngle,
          clockwise: w.arc.clockwise,
        };
      }
      this.plan.walls.push(restored);
    }

    for (const device of this.plan.devices) {
      const original = this.originalDeviceTs.get(device.id);
      if (original) {
        device.wallId = original.wallId;
        device.t = original.t;
      }
    }

    this.plan.invalidateRooms();
  }
}

/** Команда удаления стены. */
export class RemoveWallCommand implements Command {
  private wallData: Wall | null = null;

  constructor(private plan: Plan, private wallId: string) {}

  execute(): void {
    const wall = this.plan.findWall(this.wallId);
    if (wall) {
      this.wallData = JSON.parse(JSON.stringify(wall));
      this.plan.removeWall(this.wallId);
    }
  }

  undo(): void {
    if (!this.wallData) return;
    const w = this.wallData;
    this.plan.walls.push({
      id: w.id,
      a: new Vector2(w.a.x, w.a.y),
      b: new Vector2(w.b.x, w.b.y),
      thickness: w.thickness,
      openings: w.openings.map(o => ({ ...o })),
    });
  }
}

/** Команда добавления проема. */
export class AddOpeningCommand implements Command {
  private openingId = '';

  constructor(
    private plan: Plan,
    private wallId: string,
    private type: OpeningType,
    private t: number,
    private width: number,
  ) {}

  execute(): void {
    const opening = this.plan.addOpening(this.wallId, this.type, this.t, this.width);
    if (opening) this.openingId = opening.id;
  }

  undo(): void {
    this.plan.removeOpening(this.openingId);
  }
}

/** Команда удаления проема. */
export class RemoveOpeningCommand implements Command {
  private openingData: Opening | null = null;
  private wallId = '';

  constructor(private plan: Plan, private openingId: string) {}

  execute(): void {
    const found = this.plan.findOpening(this.openingId);
    if (found) {
      this.openingData = { ...found.opening };
      this.wallId = found.wall.id;
      this.plan.removeOpening(this.openingId);
    }
  }

  undo(): void {
    if (!this.openingData) return;
    this.plan.addOpening(
      this.wallId,
      this.openingData.type,
      this.openingData.t,
      this.openingData.width,
    );
  }
}

/** Команда добавления устройства. */
export class AddDeviceCommand implements Command {
  private deviceId = '';

  constructor(
    private plan: Plan,
    private wallId: string,
    private type: DeviceType,
    private t: number,
    private offset: number,
    private side: 1 | -1 = 1,
    private iconScale = 1,
  ) {}

  execute(): void {
    const device = this.plan.addDevice(this.wallId, this.type, this.t, this.offset, this.side, undefined, this.iconScale);
    if (device) this.deviceId = device.id;
  }

  undo(): void {
    this.plan.removeDevice(this.deviceId);
  }
}

/** Команда добавления свободно размещённого устройства (светильник на потолке). */
export class AddFreeDeviceCommand implements Command {
  private deviceId = '';

  constructor(
    private plan: Plan,
    private type: DeviceType,
    private position: Vector2,
    private iconScale = 1,
  ) {}

  execute(): void {
    const device = this.plan.addFreeDevice(this.type, this.position, undefined, this.iconScale);
    if (device) {
      this.deviceId = device.id;
    }
  }

  undo(): void {
    this.plan.removeDevice(this.deviceId);
  }
}

/** Команда перемещения свободно размещённого устройства. */
export class MoveFreeDeviceCommand implements Command {
  constructor(
    private plan: Plan,
    private deviceId: string,
    private oldPos: { x: number; y: number },
    private newPos: { x: number; y: number },
  ) {}

  execute(): void {
    const device = this.plan.findDevice(this.deviceId);
    if (device) {
      device.position = { ...this.newPos };
      this.plan.recalcCableRoutes();
    }
  }

  undo(): void {
    const device = this.plan.findDevice(this.deviceId);
    if (device) {
      device.position = { ...this.oldPos };
      this.plan.recalcCableRoutes();
    }
  }
}

/** Команда удаления устройства. */
export class RemoveDeviceCommand implements Command {
  private deviceData: Device | null = null;

  constructor(private plan: Plan, private deviceId: string) {}

  execute(): void {
    const device = this.plan.findDevice(this.deviceId);
    if (device) {
      this.deviceData = { ...device };
      this.plan.removeDevice(this.deviceId);
    }
  }

  undo(): void {
    if (!this.deviceData) return;
    this.plan.devices.push({ ...this.deviceData });
  }
}

/** Команда добавления размера. */
export class AddDimensionCommand implements Command {
  private dimensionId = '';

  constructor(private plan: Plan, private a: Vector2, private b: Vector2) {}

  execute(): void {
    const dim = this.plan.addDimension(this.a, this.b);
    this.dimensionId = dim.id;
  }

  undo(): void {
    this.plan.removeDimension(this.dimensionId);
  }
}

/** Команда удаления размера. */
export class RemoveDimensionCommand implements Command {
  private dimensionData: Dimension | null = null;

  constructor(private plan: Plan, private dimensionId: string) {}

  execute(): void {
    const dim = this.plan.dimensions.find(d => d.id === this.dimensionId);
    if (dim) {
      this.dimensionData = {
        id: dim.id,
        a: dim.a.clone(),
        b: dim.b.clone(),
        length: dim.length,
      };
      this.plan.removeDimension(this.dimensionId);
    }
  }

  undo(): void {
    if (!this.dimensionData) return;
    this.plan.dimensions.push({
      id: this.dimensionData.id,
      a: this.dimensionData.a.clone(),
      b: this.dimensionData.b.clone(),
      length: this.dimensionData.length,
    });
  }
}

/** Команда добавления кабеля. */
export class AddCableCommand implements Command {
  private cableId = '';

  constructor(
    private plan: Plan,
    private fromDeviceId: string | null,
    private toDeviceId: string | null,
    private type: CableType = DEFAULT_CABLE.type,
    private crossSection = DEFAULT_CABLE.crossSection,
    private options?: {
      fromPoint?: { x: number; y: number };
      toPoint?: { x: number; y: number };
      viaPoints?: Vector2[];
      circuitId?: string;
      route?: Vector2[];
    },
  ) {}

  execute(): void {
    const cable = this.plan.addCable(
      this.fromDeviceId,
      this.toDeviceId,
      this.type,
      this.crossSection,
      this.options,
    );
    if (cable) this.cableId = cable.id;
  }

  undo(): void {
    this.plan.removeCable(this.cableId);
  }
}

/** Обновляет длину кабеля после изменения маршрута. */
function updateCableLength(cable: Cable): void {
  cable.length = Plan.routeLength(cable.route);
  cable.spareLength = Math.max(cable.length * 0.1, 500);
  cable.totalLength = cable.length + cable.spareLength;
}

/** Команда изменения маршрута кабеля (перемещение вершин/граней). */
export class UpdateCableRouteCommand implements Command {
  private oldRoute: Vector2[] = [];
  private oldViaPoints: Vector2[] = [];

  constructor(
    private plan: Plan,
    private cableId: string,
    private newRoute: Vector2[],
  ) {}

  execute(): void {
    const cable = this.plan.findCable(this.cableId);
    if (!cable) return;
    this.oldRoute = cable.route.map(p => p.clone());
    this.oldViaPoints = cable.viaPoints?.map(p => p.clone()) ?? [];
    cable.route = this.newRoute.map(p => p.clone());
    // Синхронизируем промежуточные точки, чтобы recalcCableRoutes не сбросил маршрут
    cable.viaPoints = this.newRoute.length > 2
      ? this.newRoute.slice(1, -1).map(p => p.clone())
      : undefined;
    cable.routing = 'manual';
    updateCableLength(cable);
  }

  undo(): void {
    const cable = this.plan.findCable(this.cableId);
    if (!cable) return;
    cable.route = this.oldRoute.map(p => p.clone());
    cable.viaPoints = this.oldViaPoints.length > 0
      ? this.oldViaPoints.map(p => p.clone())
      : undefined;
    updateCableLength(cable);
  }
}

/** Команда добавления промежуточной вершины к кабелю. */
export class AddCableVertexCommand implements Command {
  private addedIndex = -1;

  constructor(
    private plan: Plan,
    private cableId: string,
    private edgeIndex: number,
    private point: Vector2,
  ) {}

  execute(): void {
    const cable = this.plan.findCable(this.cableId);
    if (!cable) return;
    this.addedIndex = this.edgeIndex + 1;
    cable.route.splice(this.addedIndex, 0, this.point.clone());
    cable.routing = 'manual';
    updateCableLength(cable);
  }

  undo(): void {
    const cable = this.plan.findCable(this.cableId);
    if (!cable || this.addedIndex < 0) return;
    cable.route.splice(this.addedIndex, 1);
    updateCableLength(cable);
  }
}

/** Команда удаления промежуточной вершины кабеля. */
export class RemoveCableVertexCommand implements Command {
  private removedPoint: Vector2 | null = null;

  constructor(
    private plan: Plan,
    private cableId: string,
    private vertexIndex: number,
  ) {}

  execute(): void {
    const cable = this.plan.findCable(this.cableId);
    if (!cable || this.vertexIndex <= 0 || this.vertexIndex >= cable.route.length - 1) return;
    this.removedPoint = cable.route[this.vertexIndex].clone();
    cable.route.splice(this.vertexIndex, 1);
    cable.routing = 'manual';
    updateCableLength(cable);
  }

  undo(): void {
    const cable = this.plan.findCable(this.cableId);
    if (!cable || !this.removedPoint) return;
    cable.route.splice(this.vertexIndex, 0, this.removedPoint.clone());
    updateCableLength(cable);
  }
}

/** Команда импорта набора стен (например, из DXF) — откатывается целиком. */
export class ImportWallsCommand implements Command {
  private wallIds: string[] = [];

  constructor(
    private plan: Plan,
    private segments: Array<{ a: Vector2; b: Vector2 }>,
    private thickness = DEFAULT_WALL_THICKNESS,
  ) {}

  execute(): void {
    this.wallIds = this.segments.map(
      s => this.plan.addWall(s.a, s.b, this.thickness).id,
    );
  }

  undo(): void {
    for (const id of this.wallIds) {
      this.plan.removeWall(id);
    }
  }
}

/** Команда перемещения подписи (атрибута) устройства. */
export class MoveDeviceNameCommand implements Command {
  constructor(
    private plan: Plan,
    private deviceId: string,
    private oldOffset: { x: number; y: number } | undefined,
    private newOffset: { x: number; y: number } | undefined,
  ) {}

  execute(): void {
    const device = this.plan.findDevice(this.deviceId);
    if (device) {
      device.nameOffset = this.newOffset ? { ...this.newOffset } : undefined;
    }
  }

  undo(): void {
    const device = this.plan.findDevice(this.deviceId);
    if (device) {
      device.nameOffset = this.oldOffset ? { ...this.oldOffset } : undefined;
    }
  }
}

/** Команда перемещения устройства вдоль стены или на другую стену. */
export class MoveDeviceCommand implements Command {
  constructor(
    private plan: Plan,
    private deviceId: string,
    private oldWallId: string,
    private oldT: number,
    private oldSide: 1 | -1,
    private oldPosition: { x: number; y: number } | undefined,
    private newWallId: string,
    private newT: number,
    private newSide: 1 | -1,
    private newPosition: { x: number; y: number } | undefined,
  ) {}

  execute(): void {
    const device = this.plan.findDevice(this.deviceId);
    if (device) {
      device.wallId = this.newWallId;
      device.t = this.newT;
      device.side = this.newSide;
      device.position = this.newPosition ? { ...this.newPosition } : undefined;
      this.plan.recalcCableRoutes();
    }
  }

  undo(): void {
    const device = this.plan.findDevice(this.deviceId);
    if (device) {
      device.wallId = this.oldWallId;
      device.t = this.oldT;
      device.side = this.oldSide;
      device.position = this.oldPosition ? { ...this.oldPosition } : undefined;
      this.plan.recalcCableRoutes();
    }
  }
}

/** Команда добавления таблицы на лист. */
export class AddSheetTableCommand implements Command {
  private tableId = '';

  constructor(
    private plan: Plan,
    private type: SheetTableType,
    private position: Vector2,
    private width = 300,
    private height = 200,
    private scale = 1,
  ) {}

  execute(): void {
    const table = this.plan.addSheetTable(this.type, this.position, this.width, this.height, this.scale);
    this.tableId = table.id;
  }

  undo(): void {
    this.plan.removeSheetTable(this.tableId);
  }
}

/** Команда удаления таблицы с листа. */
export class RemoveSheetTableCommand implements Command {
  private tableData: SheetTable | null = null;

  constructor(private plan: Plan, private tableId: string) {}

  execute(): void {
    const table = this.plan.findSheetTable(this.tableId);
    if (table) {
      this.tableData = { ...table };
      this.plan.removeSheetTable(this.tableId);
    }
  }

  undo(): void {
    if (!this.tableData) return;
    this.plan.tables.push({ ...this.tableData });
  }
}

/** Команда перемещения таблицы на листе. */
export class MoveSheetTableCommand implements Command {
  constructor(
    private plan: Plan,
    private tableId: string,
    private oldPosition: { x: number; y: number },
    private newPosition: { x: number; y: number },
  ) {}

  execute(): void {
    this.plan.moveSheetTable(this.tableId, new Vector2(this.newPosition.x, this.newPosition.y));
  }

  undo(): void {
    this.plan.moveSheetTable(this.tableId, new Vector2(this.oldPosition.x, this.oldPosition.y));
  }
}

/** Команда изменения масштаба таблицы на листе. */
export class ResizeSheetTableCommand implements Command {
  constructor(
    private plan: Plan,
    private tableId: string,
    private oldScale: number,
    private newScale: number,
    private oldPosition: { x: number; y: number },
    private newPosition: { x: number; y: number },
  ) {}

  execute(): void {
    this.plan.resizeSheetTable(this.tableId, this.newScale, new Vector2(this.newPosition.x, this.newPosition.y));
  }

  undo(): void {
    this.plan.resizeSheetTable(this.tableId, this.oldScale, new Vector2(this.oldPosition.x, this.oldPosition.y));
  }
}

/** Команда удаления примитива рисования. */
export class RemovePrimitiveCommand implements Command {
  private primitive: DrawingPrimitive | null = null;

  constructor(
    private plan: Plan,
    private primitiveId: string,
  ) {}

  execute(): void {
    const idx = this.plan.primitives.findIndex(p => p.id === this.primitiveId);
    if (idx === -1) return;
    this.primitive = this.plan.primitives[idx];
    this.plan.primitives.splice(idx, 1);
  }

  undo(): void {
    if (this.primitive) {
      this.plan.primitives.push(this.primitive);
    }
  }
}

/** Команда добавления примитива рисования. */
export class AddPrimitiveCommand implements Command {
  private primitiveId = '';

  constructor(
    private plan: Plan,
    private type: DrawingPrimitiveType,
    private points: Vector2[],
    private text?: string,
    private fontSize?: number,
    private fontFamily?: string,
    private color?: string,
    private italic?: boolean,
    private textAlign?: 'left' | 'center' | 'right',
    private tableData?: Partial<DrawingTable>,
    private lineWidth?: number,
    private lineColor?: string,
    private lineStyle?: import('../model/DrawingPrimitive').LineStyle,
    private fillColor?: string,
  ) {}

  execute(): void {
    const primitive = this.plan.addPrimitive(
      this.type,
      this.points,
      this.text,
      this.fontSize,
      this.fontFamily,
      this.color,
      this.italic,
      this.textAlign,
      this.lineWidth,
      this.lineColor,
      this.lineStyle,
      this.fillColor,
    );
    if (this.tableData && primitive.type === 'table') {
      const rows = this.tableData.rows ?? 3;
      const cols = this.tableData.cols ?? 3;
      const columnWidths = this.tableData.columnWidths?.length === cols
        ? this.tableData.columnWidths
        : Array(cols).fill(600);
      const rowHeights = this.tableData.rowHeights?.length === rows
        ? this.tableData.rowHeights
        : Array(rows).fill(300);
      const existingCells = new Map<string, DrawingTableCell>(
        (this.tableData.cells ?? []).map((c: DrawingTableCell) => [`${c.row},${c.col}`, c]),
      );
      const cells: DrawingTableCell[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const existing = existingCells.get(`${r},${c}`);
          cells.push(existing ?? { row: r, col: c });
        }
      }
      primitive.table = {
        rows,
        cols,
        cells,
        columnWidths,
        rowHeights,
        fontSize: this.tableData.fontSize ?? this.fontSize ?? 140,
      };
    }
    this.primitiveId = primitive.id;
  }

  undo(): void {
    this.plan.removePrimitive(this.primitiveId);
  }
}

/** Команда автоматической расстановки устройств (AI-анализ плана). */
export class AiAutoDesignCommand implements Command {
  private previousDevices: Device[] = [];
  private previousCables: Cable[] = [];
  private addedDeviceIds: string[] = [];
  private addedCableIds: string[] = [];

  constructor(private plan: Plan) {}

  execute(): void {
    this.previousDevices = this.plan.devices.map(d => ({ ...d }));
    this.previousCables = this.plan.cables.map(c => ({ ...c }));

    const beforeDeviceIds = new Set(this.plan.devices.map(d => d.id));
    const beforeCableIds = new Set(this.plan.cables.map(c => c.id));

    autoDesign(this.plan);

    this.addedDeviceIds = this.plan.devices.map(d => d.id).filter(id => !beforeDeviceIds.has(id));
    this.addedCableIds = this.plan.cables.map(c => c.id).filter(id => !beforeCableIds.has(id));
  }

  undo(): void {
    this.plan.devices = this.previousDevices.filter(d => !this.addedDeviceIds.includes(d.id));
    this.plan.cables = this.previousCables.filter(c => !this.addedCableIds.includes(c.id));
    this.plan.recalcCableRoutes();
  }
}
