import { Vector2 } from '../geometry/Vector2';
import { InputEvent } from '../engine/InputManager';
import { Plan } from '../model/Plan';
import { Opening } from '../model/Opening';
import { Wall, wallLength, wallDirection } from '../model/Wall';
import { findDeviceCatalogItem, getDeviceIconScale } from '../model/Device';
import { projectPointToSegment } from '../geometry/Geometry';
import { SnapEngine } from '../snap/SnapEngine';
import { CanvasEngine } from '../engine/CanvasEngine';
import { Tool } from './ToolManager';
import {
  RemoveWallCommand,
  RemoveOpeningCommand,
  RemoveDeviceCommand,
  RemoveDimensionCommand,
  MoveWallEndpointsCommand,
  SplitWallCommand,
  MergeWallsCommand,
  MoveDeviceNameCommand,
  MoveDeviceCommand,
  MoveFreeDeviceCommand,
  AddSheetTableCommand,
  RemoveSheetTableCommand,
  MoveSheetTableCommand,
  ResizeSheetTableCommand,
} from '../editor/CommandManager';
import { TableResizeCorner } from '../render/TableRenderer';

const ROOM_VERTEX_SCREEN_THRESHOLD = 8; // px
const ROOM_VERTEX_WORLD_THRESHOLD = 5; // мм
const TABLE_RESIZE_MIN_SCALE = 0.3;

interface DragRoomVertex {
  roomIndex: number;
  vertexIndex: number;
  startWorld: Vector2;
  targets: Array<{ wall: Wall; endpoint: 'a' | 'b'; original: Vector2 }>;
}

interface DragWallVertex {
  world: Vector2;
  startWorld: Vector2;
  targets: Array<{ wall: Wall; endpoint: 'a' | 'b'; original: Vector2 }>;
}

interface DragDeviceName {
  device: import('../model/Device.js').Device;
  startWorld: Vector2;
  originalOffset: { x: number; y: number } | undefined;
}

interface DragDevice {
  device: import('../model/Device.js').Device;
  wall: Wall | null; // null — свободно размещённое устройство (светильник)
  startT: number;
  startWorld: Vector2;
  originalPos: { x: number; y: number } | null;
  moved: boolean;
}

interface DragTable {
  table: import('../model/SheetTable.js').SheetTable;
  startWorld: Vector2;
  originalPos: { x: number; y: number };
  moved: boolean;
}

interface ResizeTable {
  table: import('../model/SheetTable.js').SheetTable;
  corner: import('../render/TableRenderer.js').TableResizeCorner;
  anchor: Vector2;
  startWorld: Vector2;
  startScale: number;
  startPos: { x: number; y: number };
  moved: boolean;
}

/**
 * Инструмент "Выбор".
 * Выделение, перемещение проема, удаление через CommandManager,
 * а также выделение комнат и редактирование их вершин.
 */
export class SelectTool implements Tool {
  readonly name = 'select' as const;

  private dragOpening: { opening: Opening; wall: Wall; startT: number } | null = null;
  private dragRoomVertex: DragRoomVertex | null = null;
  private dragWallVertex: DragWallVertex | null = null;
  private activeRoomVertex: DragRoomVertex | null = null;
  private dragDeviceName: DragDeviceName | null = null;
  private dragDevice: DragDevice | null = null;
  private dragTable: DragTable | null = null;
  private resizeTable: ResizeTable | null = null;
  private selectionBox: {
    startWorld: Vector2;
    currentWorld: Vector2;
    startScreen: Vector2;
    currentScreen: Vector2;
    additive: boolean;
  } | null = null;
  private pointerDownOnEmpty = false;
  private hasDragged = false;
  private pointerDownScreen = new Vector2(0, 0);
  private pointerDownWorld = new Vector2(0, 0);

  constructor(
    private canvas: CanvasEngine,
    private plan: Plan,
    private snapEngine: SnapEngine,
  ) {}

  onActivate(): void {
    this.canvas.setGhost(null);
  }

  private isMultiSelect(e: InputEvent): boolean {
    return e.ctrlKey || e.shiftKey;
  }

  private toggleWallSelection(id: string): void {
    const selected = new Set(this.canvas.getSelectedWalls());
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    this.canvas.setSelectedWalls([...selected]);
  }

  private toggleOpeningSelection(id: string): void {
    const selected = new Set(this.canvas.getSelectedOpenings());
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    this.canvas.setSelectedOpenings([...selected]);
  }

  private toggleDeviceSelection(id: string): void {
    const selected = new Set(this.canvas.getSelectedDevices());
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    this.canvas.setSelectedDevices([...selected]);
  }

  private toggleCableSelection(id: string): void {
    const selected = new Set(this.canvas.getSelectedCables());
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    this.canvas.setSelectedCables([...selected]);
  }

  private toggleDimensionSelection(id: string): void {
    const selected = new Set(this.canvas.getSelectedDimensions());
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    this.canvas.setSelectedDimensions([...selected]);
  }

  private toggleRoomSelection(index: number): void {
    const selected = new Set(this.canvas.getSelectedRooms());
    if (selected.has(index)) selected.delete(index);
    else selected.add(index);
    this.canvas.setSelectedRooms([...selected]);
  }

  private toggleTableSelection(id: string): void {
    const selected = new Set(this.canvas.getSelectedSheetTables());
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    this.canvas.setSelectedSheetTables([...selected]);
  }

  onPointerDown(e: InputEvent): void {
    this.selectionBox = null;
    this.pointerDownOnEmpty = false;

    const hitDeviceName = this.hitTestDeviceName(e.screenPoint);
    const hitDevice = this.hitTestDevice(e.screenPoint);
    const hitCable = this.hitTestCable(e.screenPoint);
    const hitDimension = this.hitTestDimension(e.screenPoint);
    const hitTableHandle = this.hitTestTableResizeHandle(e.screenPoint);
    const hitTable = this.hitTestSheetTable(e.screenPoint);
    const hitOpening = this.hitTestOpening(e.screenPoint);
    const hitWall = this.hitTestWall(e.screenPoint);
    const hitRoomVertex = this.hitTestRoomVertex(e.screenPoint);
    const hitWallVertex = this.hitTestWallVertex(e.screenPoint);

    if (hitDeviceName) {
      if (this.isMultiSelect(e)) {
        this.toggleDeviceSelection(hitDeviceName.id);
      } else {
        this.clearSelection();
        this.canvas.setSelectedDevice(hitDeviceName.id);
        this.dragDeviceName = {
          device: hitDeviceName,
          startWorld: this.canvas.camera.screenToWorld(e.screenPoint),
          originalOffset: hitDeviceName.nameOffset ? { ...hitDeviceName.nameOffset } : undefined,
        };
      }
      this.dragOpening = null;
    } else if (hitDevice) {
      if (this.isMultiSelect(e)) {
        this.toggleDeviceSelection(hitDevice.id);
      } else {
        this.clearSelection();
        this.canvas.setSelectedDevice(hitDevice.id);
        // Начинаем drag устройства: смещение применится, если мышь сдвинется
        const wall = this.plan.findWall(hitDevice.wallId) ?? null;
        this.dragDevice = {
          device: hitDevice,
          wall,
          startT: hitDevice.t,
          startWorld: this.canvas.camera.screenToWorld(e.screenPoint),
          originalPos: hitDevice.position ? { ...hitDevice.position } : null,
          moved: false,
        };
      }
      this.dragOpening = null;
    } else if (hitCable) {
      if (this.isMultiSelect(e)) {
        this.toggleCableSelection(hitCable.id);
      } else {
        this.clearSelection();
        this.canvas.setSelectedCable(hitCable.id);
      }
      this.dragOpening = null;
    } else if (hitDimension) {
      if (this.isMultiSelect(e)) {
        this.toggleDimensionSelection(hitDimension.id);
      } else {
        this.clearSelection();
        this.canvas.setSelectedDimension(hitDimension.id);
      }
      this.dragOpening = null;
    } else if (hitTableHandle) {
      if (this.isMultiSelect(e)) {
        this.toggleTableSelection(hitTableHandle.table.id);
      } else {
        this.clearSelection();
        this.canvas.setSelectedSheetTable(hitTableHandle.table.id);
      }
      this.startResizeTable(hitTableHandle, e.screenPoint);
      this.dragOpening = null;
    } else if (hitTable) {
      if (this.isMultiSelect(e)) {
        this.toggleTableSelection(hitTable.id);
      } else {
        this.clearSelection();
        this.canvas.setSelectedSheetTable(hitTable.id);
        this.dragTable = {
          table: hitTable,
          startWorld: this.canvas.camera.screenToWorld(e.screenPoint),
          originalPos: { ...hitTable.position },
          moved: false,
        };
      }
      this.dragOpening = null;
    } else if (hitOpening) {
      if (this.isMultiSelect(e)) {
        this.toggleOpeningSelection(hitOpening.opening.id);
      } else {
        this.clearSelection();
        this.canvas.setSelectedOpening(hitOpening.opening.id);
        this.dragOpening = {
          opening: hitOpening.opening,
          wall: hitOpening.wall,
          startT: hitOpening.opening.t,
        };
      }
    } else if (hitWallVertex) {
      if (this.isMultiSelect(e)) {
        this.toggleWallSelection(hitWallVertex.targets[0].wall.id);
      } else {
        this.clearSelection();
        this.canvas.setSelectedWall(hitWallVertex.targets[0].wall.id);
        this.dragWallVertex = {
          world: hitWallVertex.world,
          startWorld: hitWallVertex.world,
          targets: hitWallVertex.targets,
        };
      }
      this.dragOpening = null;
    } else if (hitRoomVertex) {
      if (this.isMultiSelect(e)) {
        this.toggleRoomSelection(hitRoomVertex.roomIndex);
      } else {
        this.canvas.setSelectedRoom(hitRoomVertex.roomIndex);
      }
      this.dragRoomVertex = {
        roomIndex: hitRoomVertex.roomIndex,
        vertexIndex: hitRoomVertex.vertexIndex,
        startWorld: hitRoomVertex.world,
        targets: hitRoomVertex.targets,
      };
      this.activeRoomVertex = this.dragRoomVertex;
      this.dragOpening = null;
    } else if (hitWall) {
      if (this.isMultiSelect(e)) {
        this.toggleWallSelection(hitWall.id);
      } else {
        this.clearSelection();
        this.canvas.setSelectedWall(hitWall.id);
      }
      this.dragOpening = null;
    } else {
      const hitRoom = this.hitTestRoom(e.screenPoint);
      if (hitRoom !== null) {
        if (this.isMultiSelect(e)) {
          this.toggleRoomSelection(hitRoom);
        } else {
          this.clearSelection();
          this.canvas.setSelectedRoom(hitRoom);
        }
        this.dragOpening = null;
        this.dragRoomVertex = null;
      } else {
        this.startSelectionBox(e);
      }
    }
  }

  onPointerMove(e: InputEvent): void {
    if (this.pointerDownOnEmpty) {
      const dist = e.screenPoint.distanceTo(this.pointerDownScreen);
      if (!this.selectionBox && dist > 4) {
        const additive = this.isMultiSelect(e);
        this.selectionBox = {
          startWorld: this.pointerDownWorld.clone(),
          currentWorld: e.worldPoint.clone(),
          startScreen: this.pointerDownScreen.clone(),
          currentScreen: e.screenPoint.clone(),
          additive,
        };
        this.hasDragged = true;
        if (!additive) {
          this.clearSelection();
        }
      }
      if (this.selectionBox) {
        this.selectionBox.currentWorld = e.worldPoint.clone();
        this.selectionBox.currentScreen = e.screenPoint.clone();
        this.canvas.setGhost(ctx => this.drawSelectionBox(ctx));
        this.canvas.requestRender();
      }
      return;
    }

    if (this.resizeTable) {
      const world = this.canvas.camera.screenToWorld(e.screenPoint);
      this.applyResizeTable(world);
      return;
    }

    if (this.dragTable) {
      const world = this.canvas.camera.screenToWorld(e.screenPoint);
      const delta = world.sub(this.dragTable.startWorld);
      this.dragTable.table.position = {
        x: this.dragTable.originalPos.x + delta.x,
        y: this.dragTable.originalPos.y + delta.y,
      };
      this.dragTable.moved = true;
      this.canvas.notifyChanged();
    }

    if (this.dragDevice) {
      const { device, wall } = this.dragDevice;
      // Привязка работает и при перетаскивании: позиция идёт через snap
      const snap = this.snapEngine.snap(e.screenPoint);
      const world = snap.point;
      this.canvas.setSnap(snap);
      this.canvas.setGhost(ctx => {
        this.canvas.ghostRenderer.drawSnapMarker(ctx, snap);
      });

      if (this.dragDevice.originalPos) {
        // Свободно размещённое устройство — центр значка привязывается к snap-точке
        device.position = { x: world.x, y: world.y };
        device.wallId = '';
        device.t = 0;
        this.dragDevice.moved = true;
        this.plan.recalcCableRoutes();
        this.canvas.notifyChanged();
      } else {
        // Перетаскивание вдоль стены или перенос на ближайшую стену.
        // Сначала ищем стену в радиусе 60 px от курсора (больше, чем при размещении).
        const nearest = this.findNearestWallWithin(e.screenPoint, 60);
        const targetWall = nearest?.wall ?? wall;
        if (!targetWall) return;

        const proj = projectPointToSegment(world, targetWall.a, targetWall.b);
        const len = wallLength(targetWall);
        if (len === 0) return;
        let t = proj.t;

        // Отступы от концов стены и от проёмов с учётом масштаба иконки
        const globalIconScale = this.canvas.editorState.get('deviceIconScale') ?? 1;
        const item = findDeviceCatalogItem(device.type);
        const scale = globalIconScale * getDeviceIconScale(device);
        const half = ((item ? Math.max(item.width, item.height) : 600) * scale) / 2;
        const minT = (half + 20) / len;
        const maxT = 1 - (half + 20) / len;
        t = Math.max(minT, Math.min(maxT, t));
        for (const opening of targetWall.openings) {
          const oHalf = opening.width / 2 + half + 10;
          if (Math.abs(t - opening.t) * len < oHalf) {
            t = t < opening.t ? opening.t - oHalf / len : opening.t + oHalf / len;
            t = Math.max(minT, Math.min(maxT, t));
          }
        }

        // Сторона относительно стены
        const dir = wallDirection(targetWall);
        const n = dir.perpendicular();
        const centerOnWall = targetWall.a.add(dir.scale(t * len));
        const cursorDir = world.sub(centerOnWall);
        const side: 1 | -1 = cursorDir.dot(n) >= 0 ? 1 : -1;

        if (device.wallId !== targetWall.id || device.t !== t || device.side !== side) {
          device.wallId = targetWall.id;
          device.t = t;
          device.side = side;
          this.dragDevice.wall = targetWall;
          this.dragDevice.moved = true;
          this.plan.recalcCableRoutes();
          this.canvas.notifyChanged();
        }
      }
    } else if (this.dragDeviceName) {
      const world = this.canvas.camera.screenToWorld(e.screenPoint);
      const delta = world.sub(this.dragDeviceName.startWorld);
      const orig = this.dragDeviceName.originalOffset ?? { x: 0, y: 0 };
      this.dragDeviceName.device.nameOffset = {
        x: orig.x + delta.x,
        y: orig.y + delta.y,
      };
      this.canvas.notifyChanged();
    } else if (this.dragOpening) {
      const { opening, wall } = this.dragOpening;
      const world = this.canvas.camera.screenToWorld(e.screenPoint);
      const proj = projectPointToSegment(world, wall.a, wall.b);
      const len = wallLength(wall);
      if (len > 0) {
        const half = opening.width / 2;
        const minT = (half + 10) / len;
        const maxT = 1 - (half + 10) / len;
        opening.t = Math.max(minT, Math.min(maxT, proj.t));
        this.canvas.notifyChanged();
      }
    } else if (this.dragRoomVertex) {
      const world = this.canvas.camera.screenToWorld(e.screenPoint);
      const delta = world.sub(this.dragRoomVertex.startWorld);
      for (const target of this.dragRoomVertex.targets) {
        target.wall[target.endpoint] = target.original.add(delta);
        if (target.wall.arc) {
          target.wall.arc = undefined;
        }
      }
      this.plan.invalidateRooms();
      this.canvas.notifyChanged();
    } else if (this.dragWallVertex) {
      const world = this.canvas.camera.screenToWorld(e.screenPoint);
      const delta = world.sub(this.dragWallVertex.startWorld);
      for (const target of this.dragWallVertex.targets) {
        target.wall[target.endpoint] = target.original.add(delta);
        if (target.wall.arc) {
          target.wall.arc = undefined;
        }
      }
      this.plan.recalcCableRoutes();
      this.plan.invalidateRooms();
      this.canvas.notifyChanged();
    }
  }

  onPointerUp(e: InputEvent): void {
    if (this.resizeTable) {
      const { table, startScale, startPos, moved } = this.resizeTable;
      if (moved) {
        this.canvas.commandManager.execute(
          new ResizeSheetTableCommand(this.plan, table.id, startScale, table.scale ?? 1, startPos, { ...table.position }),
        );
      }
      this.resizeTable = null;
      this.canvas.notifyChanged();
      return;
    }

    if (this.dragTable) {
      const { table, originalPos, moved } = this.dragTable;
      if (moved) {
        this.canvas.commandManager.execute(
          new MoveSheetTableCommand(this.plan, table.id, originalPos, { ...table.position }),
        );
      }
      this.dragTable = null;
      this.canvas.notifyChanged();
      return;
    }

    if (this.dragDevice) {
      const { device, wall, startT, originalPos, moved } = this.dragDevice;
      if (moved) {
        if (originalPos && device.position) {
          this.canvas.commandManager.execute(
            new MoveFreeDeviceCommand(this.plan, device.id, originalPos, { ...device.position }),
          );
        } else {
          this.canvas.commandManager.execute(
            new MoveDeviceCommand(
              this.plan,
              device.id,
              wall?.id ?? '',
              startT,
              device.side,
              originalPos ?? undefined,
              device.wallId,
              device.t,
              device.side,
              device.position,
            ),
          );
        }
      }
      this.dragDevice = null;
      this.canvas.setGhost(null);
      this.canvas.setSnap(null);
      this.snapEngine.clearTracking();
      this.canvas.notifyChanged();
      return;
    }
    if (this.dragDeviceName) {
      const { device, originalOffset } = this.dragDeviceName;
      const newOffset = device.nameOffset ? { ...device.nameOffset } : undefined;
      // Команда фиксирует старое/новое смещение для undo
      this.canvas.commandManager.execute(
        new MoveDeviceNameCommand(this.plan, device.id, originalOffset, newOffset),
      );
      this.dragDeviceName = null;
      this.canvas.notifyChanged();
      return;
    }
    if (this.dragRoomVertex) {
      const world = this.canvas.camera.screenToWorld(e.screenPoint);
      const delta = world.sub(this.dragRoomVertex.startWorld);
      const moves = this.dragRoomVertex.targets.map(target => ({
        wallId: target.wall.id,
        endpoint: target.endpoint,
        oldPos: target.original.clone(),
        newPos: target.original.add(delta).clone(),
      }));
      this.canvas.commandManager.execute(new MoveWallEndpointsCommand(this.plan, moves));
      this.dragRoomVertex = null;
      this.canvas.notifyChanged();
    }

    if (this.dragWallVertex) {
      const world = this.canvas.camera.screenToWorld(e.screenPoint);
      const delta = world.sub(this.dragWallVertex.startWorld);
      const moves = this.dragWallVertex.targets.map(target => ({
        wallId: target.wall.id,
        endpoint: target.endpoint,
        oldPos: target.original.clone(),
        newPos: target.original.add(delta).clone(),
      }));
      this.canvas.commandManager.execute(new MoveWallEndpointsCommand(this.plan, moves));
      this.dragWallVertex = null;
      this.canvas.notifyChanged();
    }

    if (this.selectionBox) {
      this.finalizeSelectionBox();
      this.selectionBox = null;
      this.pointerDownOnEmpty = false;
      this.canvas.setGhost(null);
      this.canvas.notifyChanged();
      return;
    }

    if (this.pointerDownOnEmpty) {
      this.clearSelection();
      this.pointerDownOnEmpty = false;
      this.canvas.setGhost(null);
      this.canvas.notifyChanged();
      return;
    }

    this.dragOpening = null;
  }

  onDoubleClick(e: InputEvent): void {
    const selectedRoom = this.canvas.getSelectedRoom();
    if (selectedRoom === null) return;
    const hitWall = this.hitTestWall(e.screenPoint);
    if (hitWall) {
      const world = this.canvas.camera.screenToWorld(e.screenPoint);
      this.canvas.commandManager.execute(new SplitWallCommand(this.plan, hitWall.id, world));
      this.canvas.notifyChanged();
    }
  }

  onKeyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const walls = this.canvas.getSelectedWalls();
      const openings = this.canvas.getSelectedOpenings();
      const devices = this.canvas.getSelectedDevices();
      const cables = this.canvas.getSelectedCables();
      const dimensions = this.canvas.getSelectedDimensions();
      const tables = this.canvas.getSelectedSheetTables();
      const hasAny =
        walls.length > 0 ||
        openings.length > 0 ||
        devices.length > 0 ||
        cables.length > 0 ||
        dimensions.length > 0 ||
        tables.length > 0;

      if (hasAny) {
        // Удаляем сначала независимые объекты, затем стены.
        // removeWall также удаляет устройства и кабели на стене,
        // поэтому отдельные команды на них просто станут no-op.
        for (const id of tables) {
          this.canvas.commandManager.execute(new RemoveSheetTableCommand(this.plan, id));
        }
        for (const id of dimensions) {
          this.canvas.commandManager.execute(new RemoveDimensionCommand(this.plan, id));
        }
        for (const id of openings) {
          this.canvas.commandManager.execute(new RemoveOpeningCommand(this.plan, id));
        }
        for (const id of cables) {
          this.plan.removeCable(id);
        }
        for (const id of devices) {
          this.canvas.commandManager.execute(new RemoveDeviceCommand(this.plan, id));
        }
        for (const id of walls) {
          this.canvas.commandManager.execute(new RemoveWallCommand(this.plan, id));
        }
        this.canvas.setSelectedWalls([]);
        this.canvas.setSelectedOpenings([]);
        this.canvas.setSelectedDevices([]);
        this.canvas.setSelectedCables([]);
        this.canvas.setSelectedDimensions([]);
        this.canvas.setSelectedSheetTables([]);
        this.canvas.notifyChanged();
        return true;
      }

      // Удаление вершины комнаты — объединение двух коллинеарных стен
      if (this.activeRoomVertex && this.activeRoomVertex.targets.length === 2) {
        const [t1, t2] = this.activeRoomVertex.targets;
        if (t1.wall.id !== t2.wall.id) {
          this.canvas.commandManager.execute(new MergeWallsCommand(this.plan, t1.wall.id, t2.wall.id));
          this.activeRoomVertex = null;
          this.canvas.notifyChanged();
          return true;
        }
      }
    }
    return false;
  }

  private clearSelection(): void {
    this.canvas.setSelectedWall(null);
    this.canvas.setSelectedOpening(null);
    this.canvas.setSelectedDevice(null);
    this.canvas.setSelectedCable(null);
    this.canvas.setSelectedDimension(null);
    this.canvas.setSelectedRoom(null);
    this.canvas.setSelectedSheetTable(null);
    this.activeRoomVertex = null;
  }

  /** Hit-test подписи (атрибута) устройства — для перетаскивания. */
  private hitTestDeviceName(screenPoint: Vector2): import('../model/Device.js').Device | null {
    const world = this.canvas.camera.screenToWorld(screenPoint);
    const marginWorld = 4 / this.canvas.camera.scale; // ~4px запас
    for (const device of this.plan.devices) {
      const bounds = this.canvas.deviceRenderer.getNameLabelBounds(device);
      if (!bounds) continue;
      if (
        Math.abs(world.x - bounds.center.x) <= bounds.halfW + marginWorld &&
        Math.abs(world.y - bounds.center.y) <= bounds.halfH + marginWorld
      ) {
        return device;
      }
    }
    return null;
  }

  private hitTestDevice(screenPoint: Vector2): import('../model/Device.js').Device | null {
    const globalIconScale = this.canvas.editorState.get('deviceIconScale') ?? 1;
    for (const device of this.plan.devices) {
      const item = findDeviceCatalogItem(device.type);
      const baseSizeMm = item ? Math.max(item.width, item.height) : 600;
      // Мировой размер в мм (совпадает с DeviceRenderer)
      const sizeWorld = baseSizeMm * globalIconScale * getDeviceIconScale(device);
      const halfWorld = sizeWorld / 2;
      const halfScreen = halfWorld * this.canvas.camera.scale + 4; // небольшой запас
      const surfacePos = this.plan.deviceWorldPosition(device);
      const wall = this.plan.findWall(device.wallId);
      let iconPos = surfacePos;
      if (wall) {
        const dir = wallDirection(wall);
        const n = dir.perpendicular();
        iconPos = surfacePos.add(n.scale(halfWorld * device.side));
      }
      const pos = this.canvas.camera.worldToScreen(iconPos);
      if (
        Math.abs(pos.x - screenPoint.x) <= halfScreen &&
        Math.abs(pos.y - screenPoint.y) <= halfScreen
      ) {
        return device;
      }
    }
    return null;
  }

  private hitTestDimension(screenPoint: Vector2): import('../model/Dimension.js').Dimension | null {
    const world = this.canvas.camera.screenToWorld(screenPoint);
    const thresholdMm = 10 / this.canvas.camera.scale;

    for (const dim of this.plan.dimensions) {
      const proj = this.projectPointToSegment(world, dim.a, dim.b);
      if (proj.dist < thresholdMm) {
        return dim;
      }
    }
    return null;
  }

  private hitTestSheetTable(screenPoint: Vector2): import('../model/SheetTable.js').SheetTable | null {
    const world = this.canvas.camera.screenToWorld(screenPoint);
    for (const table of this.plan.tables) {
      const bounds = this.canvas.tableRenderer.getTableBounds(table);
      if (
        world.x >= bounds.min.x &&
        world.x <= bounds.max.x &&
        world.y >= bounds.min.y &&
        world.y <= bounds.max.y
      ) {
        return table;
      }
    }
    return null;
  }

  private hitTestTableResizeHandle(
    screenPoint: Vector2,
  ): { table: import('../model/SheetTable.js').SheetTable; corner: TableResizeCorner } | null {
    const selected = new Set(this.canvas.getSelectedSheetTables());
    for (const table of this.plan.tables) {
      if (!selected.has(table.id)) continue;
      const hit = this.canvas.tableRenderer.hitTestResizeHandle(screenPoint, table);
      if (hit) return hit;
    }
    return null;
  }

  private startResizeTable(
    hit: { table: import('../model/SheetTable.js').SheetTable; corner: TableResizeCorner },
    screenPoint: Vector2,
  ): void {
    const bounds = this.canvas.tableRenderer.getTableBounds(hit.table);
    const anchor = this.canvas.tableRenderer.getAnchorForCorner(hit.corner, bounds);
    this.resizeTable = {
      table: hit.table,
      corner: hit.corner,
      anchor: anchor,
      startWorld: this.canvas.camera.screenToWorld(screenPoint),
      startScale: hit.table.scale ?? 1,
      startPos: { ...hit.table.position },
      moved: false,
    };
  }

  private applyResizeTable(world: Vector2): void {
    if (!this.resizeTable) return;
    const { table, anchor, startWorld, startScale, startPos } = this.resizeTable;
    const startDist = startWorld.distanceTo(anchor);
    const newDist = world.distanceTo(anchor);
    if (startDist === 0) return;
    let newScale = startScale * (newDist / startDist);
    newScale = Math.max(TABLE_RESIZE_MIN_SCALE, newScale);
    const scaleRatio = newScale / startScale;
    const offset = new Vector2(startPos.x - anchor.x, startPos.y - anchor.y).scale(scaleRatio);
    table.scale = newScale;
    table.position = { x: anchor.x + offset.x, y: anchor.y + offset.y };
    this.resizeTable.moved = true;
    this.canvas.notifyChanged();
  }

  private hitTestCable(screenPoint: Vector2): import('../model/Cable.js').Cable | null {
    const world = this.canvas.camera.screenToWorld(screenPoint);
    const thresholdMm = 10 / this.canvas.camera.scale;

    for (const cable of this.plan.cables) {
      const route = cable.route.length >= 2 ? cable.route : [];
      for (let i = 1; i < route.length; i++) {
        const proj = this.projectPointToSegment(world, route[i - 1], route[i]);
        if (proj.dist < thresholdMm) {
          return cable;
        }
      }
    }
    return null;
  }

  private projectPointToSegment(p: Vector2, a: Vector2, b: Vector2) {
    const v = b.sub(a);
    const lenSq = v.dot(v);
    let t = lenSq > 0 ? p.sub(a).dot(v) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const point = a.add(v.scale(t));
    return { point, t, dist: p.distanceTo(point) };
  }

  /** Ищет ближайшую стену к курсору в пределах thresholdPx (экранных пикселей). */
  private findNearestWallWithin(screenPoint: Vector2, thresholdPx: number): { wall: Wall; t: number } | null {
    const world = this.canvas.camera.screenToWorld(screenPoint);
    const tree = this.plan.getWallQuadtree();
    const thresholdWorld = thresholdPx / this.canvas.camera.scale;
    const candidates = tree.query({
      min: new Vector2(world.x - thresholdWorld, world.y - thresholdWorld),
      max: new Vector2(world.x + thresholdWorld, world.y + thresholdWorld),
    });

    let best: { wall: Wall; t: number; distPx: number } | null = null;
    for (const wall of candidates) {
      const proj = projectPointToSegment(world, wall.a, wall.b);
      const screenProj = this.canvas.camera.worldToScreen(proj.point);
      const distPx = screenProj.distanceTo(screenPoint);
      if (distPx < thresholdPx && (!best || distPx < best.distPx)) {
        best = { wall, t: proj.t, distPx };
      }
    }
    return best;
  }

  private hitTestWall(screenPoint: Vector2): Wall | null {
    const world = this.canvas.camera.screenToWorld(screenPoint);
    const thresholdMm = 8 / this.canvas.camera.scale;
    const searchRadius = Math.max(500, thresholdMm + 200); // запас на толщину стены

    const tree = this.plan.getWallQuadtree();
    const candidates = tree.query({
      min: new Vector2(world.x - searchRadius, world.y - searchRadius),
      max: new Vector2(world.x + searchRadius, world.y + searchRadius),
    });

    for (const wall of candidates) {
      const proj = projectPointToSegment(world, wall.a, wall.b);
      const halfThick = wall.thickness / 2;
      if (proj.dist <= halfThick + thresholdMm) {
        return wall;
      }
    }
    return null;
  }

  private hitTestOpening(screenPoint: Vector2): { opening: Opening; wall: Wall } | null {
    const world = this.canvas.camera.screenToWorld(screenPoint);
    const thresholdMm = 20 / this.canvas.camera.scale;

    for (const wall of this.plan.walls) {
      const len = wallLength(wall);
      if (len === 0) continue;
      const dir = wallDirection(wall);
      for (const opening of wall.openings) {
        const center = wall.a.add(dir.scale(opening.t * len));
        if (center.distanceTo(world) < thresholdMm) {
          return { opening, wall };
        }
      }
    }
    return null;
  }

  private hitTestRoom(screenPoint: Vector2): number | null {
    const world = this.canvas.camera.screenToWorld(screenPoint);
    const rooms = this.plan.getRooms();
    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      if (!this.pointInPolygon(world, room.polygon)) continue;
      let insideHole = false;
      for (const hole of room.holes) {
        if (this.pointInPolygon(world, hole)) {
          insideHole = true;
          break;
        }
      }
      if (!insideHole) return i;
    }
    return null;
  }

  private hitTestWallVertex(screenPoint: Vector2): {
    world: Vector2;
    targets: Array<{ wall: Wall; endpoint: 'a' | 'b'; original: Vector2 }>;
  } | null {
    const thresholdPx = 8;
    let bestWorld: Vector2 | null = null;
    let bestScreenDist = Infinity;

    for (const wall of this.plan.walls) {
      for (const endpoint of ['a', 'b'] as const) {
        const p = wall[endpoint];
        const screen = this.canvas.camera.worldToScreen(p);
        const dist = Math.hypot(screen.x - screenPoint.x, screen.y - screenPoint.y);
        if (dist <= thresholdPx && dist < bestScreenDist) {
          bestScreenDist = dist;
          bestWorld = p;
        }
      }
    }

    if (!bestWorld) return null;

    const targets = this.collectCoincidentEndpoints(bestWorld);
    if (targets.length === 0) return null;

    return {
      world: bestWorld.clone(),
      targets,
    };
  }

  private hitTestRoomVertex(screenPoint: Vector2): {
    roomIndex: number;
    vertexIndex: number;
    world: Vector2;
    targets: Array<{ wall: Wall; endpoint: 'a' | 'b'; original: Vector2 }>;
  } | null {
    const selectedIndex = this.canvas.getSelectedRoom();
    if (selectedIndex === null) return null;
    const rooms = this.plan.getRooms();
    if (selectedIndex < 0 || selectedIndex >= rooms.length) return null;

    const poly = rooms[selectedIndex].polygon;
    let bestWorld: Vector2 | null = null;
    let bestScreenDist = Infinity;
    let bestIndex = -1;
    let index = 0;

    for (const wall of this.plan.walls) {
      for (const endpoint of ['a', 'b'] as const) {
        const p = wall[endpoint];
        if (!this.isPointOnPolygonBoundary(p, poly, wall.thickness + ROOM_VERTEX_WORLD_THRESHOLD)) {
          continue;
        }
        const screen = this.canvas.camera.worldToScreen(p);
        const dist = Math.hypot(screen.x - screenPoint.x, screen.y - screenPoint.y);
        if (dist <= ROOM_VERTEX_SCREEN_THRESHOLD && dist < bestScreenDist) {
          bestScreenDist = dist;
          bestWorld = p;
          bestIndex = index;
        }
        index++;
      }
    }

    if (!bestWorld) return null;

    const targets = this.collectCoincidentEndpoints(bestWorld);
    if (targets.length === 0) return null;

    return {
      roomIndex: selectedIndex,
      vertexIndex: bestIndex,
      world: bestWorld.clone(),
      targets,
    };
  }

  private collectCoincidentEndpoints(world: Vector2): Array<{ wall: Wall; endpoint: 'a' | 'b'; original: Vector2 }> {
    const targets: Array<{ wall: Wall; endpoint: 'a' | 'b'; original: Vector2 }> = [];
    for (const wall of this.plan.walls) {
      for (const endpoint of ['a', 'b'] as const) {
        if (wall[endpoint].distanceTo(world) <= ROOM_VERTEX_WORLD_THRESHOLD) {
          targets.push({ wall, endpoint, original: wall[endpoint].clone() });
        }
      }
    }
    return targets;
  }

  private isPointOnPolygonBoundary(p: Vector2, polygon: Vector2[], threshold: number): boolean {
    const n = polygon.length;
    for (let i = 0; i < n; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % n];
      const v = b.sub(a);
      const lenSq = v.dot(v);
      let t = lenSq > 0 ? p.sub(a).dot(v) / lenSq : 0;
      t = Math.max(0, Math.min(1, t));
      if (p.distanceTo(a.add(v.scale(t))) <= threshold) return true;
    }
    return false;
  }

  private pointInPolygon(point: Vector2, polygon: Vector2[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      const intersect =
        yi > point.y !== yj > point.y &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 1e-12) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private startSelectionBox(e: InputEvent): void {
    this.pointerDownOnEmpty = true;
    this.hasDragged = false;
    this.pointerDownScreen = e.screenPoint.clone();
    this.pointerDownWorld = e.worldPoint.clone();
  }

  private drawSelectionBox(ctx: CanvasRenderingContext2D): void {
    if (!this.selectionBox) return;
    const { startWorld, currentWorld, startScreen, currentScreen } = this.selectionBox;
    const minX = Math.min(startWorld.x, currentWorld.x);
    const minY = Math.min(startWorld.y, currentWorld.y);
    const w = Math.abs(currentWorld.x - startWorld.x);
    const h = Math.abs(currentWorld.y - startWorld.y);
    const isWindow = currentScreen.x >= startScreen.x;
    ctx.fillStyle = isWindow ? 'rgba(0, 200, 0, 0.08)' : 'rgba(200, 0, 0, 0.08)';
    ctx.strokeStyle = isWindow ? 'rgba(0, 160, 0, 0.8)' : 'rgba(160, 0, 0, 0.8)';
    ctx.lineWidth = 2 / this.canvas.camera.scale;
    ctx.fillRect(minX, minY, w, h);
    ctx.strokeRect(minX, minY, w, h);
  }

  private finalizeSelectionBox(): void {
    const box = this.getSelectionBox();
    const isWindow = this.selectionBox!.currentScreen.x >= this.selectionBox!.startScreen.x;
    const selected = this.selectByBox(box, isWindow);
    this.applySelection(selected, this.selectionBox!.additive);
  }

  /** Результат выделения рамкой: все объекты, попавшие в рамку. */
  private selectByBox(
    box: { min: Vector2; max: Vector2 },
    isWindow: boolean,
  ): {
    walls: string[];
    openings: string[];
    devices: string[];
    cables: string[];
    dimensions: string[];
    rooms: number[];
    tables: string[];
  } {
    const devices: string[] = [];
    for (const device of this.plan.devices) {
      if (this.deviceInBox(device, box, isWindow)) devices.push(device.id);
    }

    const openings: string[] = [];
    for (const wall of this.plan.walls) {
      for (const opening of wall.openings) {
        if (this.openingInBox(opening, wall, box, isWindow)) openings.push(opening.id);
      }
    }

    const walls: string[] = [];
    for (const wall of this.plan.walls) {
      if (this.wallInBox(wall, box, isWindow)) walls.push(wall.id);
    }

    const dimensions: string[] = [];
    for (const dim of this.plan.dimensions) {
      if (this.dimensionInBox(dim, box, isWindow)) dimensions.push(dim.id);
    }

    const cables: string[] = [];
    for (const cable of this.plan.cables) {
      if (this.cableInBox(cable, box, isWindow)) cables.push(cable.id);
    }

    const rooms: number[] = [];
    const roomList = this.plan.getRooms();
    for (let i = 0; i < roomList.length; i++) {
      if (this.roomInBox(roomList[i], box, isWindow)) rooms.push(i);
    }

    const tables: string[] = [];
    for (const table of this.plan.tables) {
      if (this.tableInBox(table, box, isWindow)) tables.push(table.id);
    }

    return { walls, openings, devices, cables, dimensions, rooms, tables };
  }

  private applySelection(
    selected: {
      walls: string[];
      openings: string[];
      devices: string[];
      cables: string[];
      dimensions: string[];
      rooms: number[];
      tables: string[];
    },
    additive = false,
  ): void {
    const hasAny =
      selected.walls.length > 0 ||
      selected.openings.length > 0 ||
      selected.devices.length > 0 ||
      selected.cables.length > 0 ||
      selected.dimensions.length > 0 ||
      selected.rooms.length > 0 ||
      selected.tables.length > 0;
    if (!hasAny && !additive) {
      this.clearSelection();
      return;
    }
    if (!hasAny) return;

    if (additive) {
      this.canvas.setSelectedWalls([...new Set([...this.canvas.getSelectedWalls(), ...selected.walls])]);
      this.canvas.setSelectedOpenings([...new Set([...this.canvas.getSelectedOpenings(), ...selected.openings])]);
      this.canvas.setSelectedDevices([...new Set([...this.canvas.getSelectedDevices(), ...selected.devices])]);
      this.canvas.setSelectedCables([...new Set([...this.canvas.getSelectedCables(), ...selected.cables])]);
      this.canvas.setSelectedDimensions([...new Set([...this.canvas.getSelectedDimensions(), ...selected.dimensions])]);
      this.canvas.setSelectedRooms([...new Set([...this.canvas.getSelectedRooms(), ...selected.rooms])]);
      this.canvas.setSelectedSheetTables([...new Set([...this.canvas.getSelectedSheetTables(), ...selected.tables])]);
    } else {
      this.canvas.setSelectedWalls(selected.walls);
      this.canvas.setSelectedOpenings(selected.openings);
      this.canvas.setSelectedDevices(selected.devices);
      this.canvas.setSelectedCables(selected.cables);
      this.canvas.setSelectedDimensions(selected.dimensions);
      this.canvas.setSelectedRooms(selected.rooms);
      this.canvas.setSelectedSheetTables(selected.tables);
    }
  }

  private getSelectionBox(): { min: Vector2; max: Vector2 } {
    const { startWorld, currentWorld } = this.selectionBox!;
    return {
      min: new Vector2(Math.min(startWorld.x, currentWorld.x), Math.min(startWorld.y, currentWorld.y)),
      max: new Vector2(Math.max(startWorld.x, currentWorld.x), Math.max(startWorld.y, currentWorld.y)),
    };
  }

  private pointInBox(p: Vector2, box: { min: Vector2; max: Vector2 }): boolean {
    return p.x >= box.min.x && p.x <= box.max.x && p.y >= box.min.y && p.y <= box.max.y;
  }

  private rectInBox(rect: { min: Vector2; max: Vector2 }, box: { min: Vector2; max: Vector2 }): boolean {
    return rect.min.x >= box.min.x && rect.max.x <= box.max.x && rect.min.y >= box.min.y && rect.max.y <= box.max.y;
  }

  private rectIntersectsBox(rect: { min: Vector2; max: Vector2 }, box: { min: Vector2; max: Vector2 }): boolean {
    return !(rect.max.x < box.min.x || rect.min.x > box.max.x || rect.max.y < box.min.y || rect.min.y > box.max.y);
  }

  private lineIntersectsBox(a: Vector2, b: Vector2, box: { min: Vector2; max: Vector2 }): boolean {
    if (this.pointInBox(a, box) || this.pointInBox(b, box)) return true;
    const corners = [
      box.min,
      new Vector2(box.max.x, box.min.y),
      box.max,
      new Vector2(box.min.x, box.max.y),
    ];
    for (let i = 0; i < 4; i++) {
      if (this.segmentsIntersect(a, b, corners[i], corners[(i + 1) % 4])) return true;
    }
    return false;
  }

  private segmentsIntersect(a1: Vector2, a2: Vector2, b1: Vector2, b2: Vector2): boolean {
    const d1 = a2.sub(a1).cross(b1.sub(a1));
    const d2 = a2.sub(a1).cross(b2.sub(a1));
    const d3 = b2.sub(b1).cross(a1.sub(b1));
    const d4 = b2.sub(b1).cross(a2.sub(b1));
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
      return true;
    }
    // Коллинеарные случаи: конец одного отрезка лежит на другом
    if (this.pointOnSegment(a1, b1, b2) || this.pointOnSegment(a2, b1, b2) ||
        this.pointOnSegment(b1, a1, a2) || this.pointOnSegment(b2, a1, a2)) {
      return true;
    }
    return false;
  }

  private pointOnSegment(p: Vector2, a: Vector2, b: Vector2): boolean {
    const v = b.sub(a);
    const lenSq = v.dot(v);
    if (lenSq === 0) return p.equals(a);
    const t = Math.max(0, Math.min(1, p.sub(a).dot(v) / lenSq));
    const proj = a.add(v.scale(t));
    return p.distanceTo(proj) < 1e-6;
  }

  private getDeviceBounds(device: import('../model/Device').Device): { min: Vector2; max: Vector2 } {
    const globalIconScale = this.canvas.editorState.get('deviceIconScale') ?? 1;
    const item = findDeviceCatalogItem(device.type);
    const baseSizeMm = item ? Math.max(item.width, item.height) : 600;
    const sizeWorld = baseSizeMm * globalIconScale * getDeviceIconScale(device);
    const halfWorld = sizeWorld / 2;
    const pos = this.plan.deviceWorldPosition(device);
    const wall = this.plan.findWall(device.wallId);
    let iconPos = pos;
    if (wall) {
      const dir = wallDirection(wall);
      const n = dir.perpendicular();
      iconPos = pos.add(n.scale(halfWorld * device.side));
    }
    return {
      min: new Vector2(iconPos.x - halfWorld, iconPos.y - halfWorld),
      max: new Vector2(iconPos.x + halfWorld, iconPos.y + halfWorld),
    };
  }

  private deviceInBox(
    device: import('../model/Device').Device,
    box: { min: Vector2; max: Vector2 },
    isWindow: boolean,
  ): boolean {
    const bounds = this.getDeviceBounds(device);
    if (isWindow) return this.rectInBox(bounds, box);
    return this.rectIntersectsBox(bounds, box);
  }

  private getOpeningBounds(opening: Opening, wall: Wall): { min: Vector2; max: Vector2 } {
    const len = wallLength(wall);
    if (len === 0) {
      return { min: new Vector2(0, 0), max: new Vector2(0, 0) };
    }
    const dir = wallDirection(wall);
    const n = dir.perpendicular();
    const center = wall.a.add(dir.scale(opening.t * len));
    const half = opening.width / 2;
    const h = wall.thickness / 2 + 3;
    const c1 = center.add(dir.scale(-half)).add(n.scale(h));
    const c2 = center.add(dir.scale(half)).add(n.scale(h));
    const c3 = center.add(dir.scale(half)).sub(n.scale(h));
    const c4 = center.add(dir.scale(-half)).sub(n.scale(h));
    return {
      min: new Vector2(Math.min(c1.x, c2.x, c3.x, c4.x), Math.min(c1.y, c2.y, c3.y, c4.y)),
      max: new Vector2(Math.max(c1.x, c2.x, c3.x, c4.x), Math.max(c1.y, c2.y, c3.y, c4.y)),
    };
  }

  private openingInBox(
    opening: Opening,
    wall: Wall,
    box: { min: Vector2; max: Vector2 },
    isWindow: boolean,
  ): boolean {
    const bounds = this.getOpeningBounds(opening, wall);
    if (isWindow) return this.rectInBox(bounds, box);
    return this.rectIntersectsBox(bounds, box);
  }

  private wallInBox(wall: Wall, box: { min: Vector2; max: Vector2 }, isWindow: boolean): boolean {
    const aInside = this.pointInBox(wall.a, box);
    const bInside = this.pointInBox(wall.b, box);
    if (isWindow) return aInside && bInside;
    return aInside || bInside || this.lineIntersectsBox(wall.a, wall.b, box);
  }

  private dimensionInBox(
    dim: import('../model/Dimension').Dimension,
    box: { min: Vector2; max: Vector2 },
    isWindow: boolean,
  ): boolean {
    const aInside = this.pointInBox(dim.a, box);
    const bInside = this.pointInBox(dim.b, box);
    if (isWindow) return aInside && bInside;
    return aInside || bInside || this.lineIntersectsBox(dim.a, dim.b, box);
  }

  private cableInBox(
    cable: import('../model/Cable').Cable,
    box: { min: Vector2; max: Vector2 },
    isWindow: boolean,
  ): boolean {
    if (cable.route.length === 0) return false;
    if (isWindow) {
      return cable.route.every(p => this.pointInBox(p, box));
    }
    for (let i = 1; i < cable.route.length; i++) {
      const a = cable.route[i - 1];
      const b = cable.route[i];
      if (this.pointInBox(a, box) || this.pointInBox(b, box) || this.lineIntersectsBox(a, b, box)) {
        return true;
      }
    }
    return false;
  }

  private roomInBox(
    room: { polygon: Vector2[]; holes: Vector2[][] },
    box: { min: Vector2; max: Vector2 },
    isWindow: boolean,
  ): boolean {
    if (isWindow) {
      return room.polygon.every(p => this.pointInBox(p, box));
    }
    const center = this.polygonCentroid(room.polygon);
    if (this.pointInBox(center, box)) return true;
    // Для crossing проверяем пересечение границы комнаты с рамкой
    for (let i = 0; i < room.polygon.length; i++) {
      const a = room.polygon[i];
      const b = room.polygon[(i + 1) % room.polygon.length];
      if (this.lineIntersectsBox(a, b, box)) return true;
    }
    return false;
  }

  private tableInBox(
    table: import('../model/SheetTable').SheetTable,
    box: { min: Vector2; max: Vector2 },
    isWindow: boolean,
  ): boolean {
    const bounds = this.canvas.tableRenderer.getTableBounds(table);
    if (isWindow) return this.rectInBox(bounds, box);
    return this.rectIntersectsBox(bounds, box);
  }

  private polygonCentroid(polygon: Vector2[]): Vector2 {
    let x = 0;
    let y = 0;
    for (const p of polygon) {
      x += p.x;
      y += p.y;
    }
    return new Vector2(x / polygon.length, y / polygon.length);
  }
}
