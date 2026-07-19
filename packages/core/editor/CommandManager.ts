import { Plan } from '../model/Plan';
import { Wall, WallArc, DEFAULT_WALL_THICKNESS, updateWallArcEndpoints } from '../model/Wall';
import { Opening, OpeningType } from '../model/Opening';
import { Device, DeviceType } from '../model/Device';
import { CableType, DEFAULT_CABLE } from '../model/Cable';
import { Dimension } from '../model/Dimension';
import { Vector2 } from '../geometry/Vector2';

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
  private originalWallData: Wall | null = null;
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
      openings: w.openings.map((o) => ({ ...o })),
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
  private originalWallsData: Wall[] = [];
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
        openings: w.openings.map((o) => ({ ...o })),
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
    private height?: number,
  ) {}

  execute(): void {
    const device = this.plan.addDevice(this.wallId, this.type, this.t, this.offset, this.side, undefined, this.height);
    if (device) this.deviceId = device.id;
  }

  undo(): void {
    this.plan.removeDevice(this.deviceId);
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
    private fromDeviceId: string,
    private toDeviceId: string,
    private type: CableType = DEFAULT_CABLE.type,
    private crossSection = DEFAULT_CABLE.crossSection,
  ) {}

  execute(): void {
    const cable = this.plan.addCable(this.fromDeviceId, this.toDeviceId, this.type, this.crossSection);
    if (cable) this.cableId = cable.id;
  }

  undo(): void {
    this.plan.removeCable(this.cableId);
  }
}
