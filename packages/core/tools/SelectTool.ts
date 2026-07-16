import { Vector2 } from '../geometry/Vector2';
import { InputEvent } from '../engine/InputManager';
import { Plan } from '../model/Plan';
import { Opening } from '../model/Opening';
import { Wall, wallLength, wallDirection } from '../model/Wall';
import { findDeviceCatalogItem } from '../model/Device';
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
} from '../editor/CommandManager';

const ROOM_VERTEX_SCREEN_THRESHOLD = 8; // px
const ROOM_VERTEX_WORLD_THRESHOLD = 5; // мм

interface DragRoomVertex {
  roomIndex: number;
  vertexIndex: number;
  startWorld: Vector2;
  targets: Array<{ wall: Wall; endpoint: 'a' | 'b'; original: Vector2 }>;
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
  private activeRoomVertex: DragRoomVertex | null = null;

  constructor(
    private canvas: CanvasEngine,
    private plan: Plan,
    private snapEngine: SnapEngine,
  ) {}

  onActivate(): void {
    this.canvas.setGhost(null);
  }

  onPointerDown(e: InputEvent): void {
    const hitDevice = this.hitTestDevice(e.screenPoint);
    const hitCable = this.hitTestCable(e.screenPoint);
    const hitDimension = this.hitTestDimension(e.screenPoint);
    const hitOpening = this.hitTestOpening(e.screenPoint);
    const hitWall = this.hitTestWall(e.screenPoint);
    const hitRoomVertex = this.hitTestRoomVertex(e.screenPoint);

    if (hitDevice) {
      this.clearSelection();
      this.canvas.setSelectedDevice(hitDevice.id);
      this.dragOpening = null;
    } else if (hitCable) {
      this.clearSelection();
      this.canvas.setSelectedCable(hitCable.id);
      this.dragOpening = null;
    } else if (hitDimension) {
      this.clearSelection();
      this.canvas.setSelectedDimension(hitDimension.id);
      this.dragOpening = null;
    } else if (hitOpening) {
      this.clearSelection();
      this.canvas.setSelectedOpening(hitOpening.opening.id);
      this.dragOpening = {
        opening: hitOpening.opening,
        wall: hitOpening.wall,
        startT: hitOpening.opening.t,
      };
    } else if (hitRoomVertex) {
      this.canvas.setSelectedRoom(hitRoomVertex.roomIndex);
      this.dragRoomVertex = {
        roomIndex: hitRoomVertex.roomIndex,
        vertexIndex: hitRoomVertex.vertexIndex,
        startWorld: hitRoomVertex.world,
        targets: hitRoomVertex.targets,
      };
      this.activeRoomVertex = this.dragRoomVertex;
      this.dragOpening = null;
    } else if (hitWall) {
      this.clearSelection();
      this.canvas.setSelectedWall(hitWall.id);
      this.dragOpening = null;
    } else {
      const hitRoom = this.hitTestRoom(e.screenPoint);
      if (hitRoom !== null) {
        this.clearSelection();
        this.canvas.setSelectedRoom(hitRoom);
      } else {
        this.clearSelection();
      }
      this.dragOpening = null;
      this.dragRoomVertex = null;
    }
  }

  onPointerMove(e: InputEvent): void {
    if (this.dragOpening) {
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
    }
  }

  onPointerUp(e: InputEvent): void {
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
      const wallId = this.canvas.getSelectedWall();
      const openingId = this.canvas.getSelectedOpening();
      const deviceId = this.canvas.getSelectedDevice();
      const cableId = this.canvas.getSelectedCable();
      if (cableId) {
        this.plan.removeCable(cableId);
        this.canvas.setSelectedCable(null);
        this.canvas.notifyChanged();
        return true;
      }
      if (deviceId) {
        this.canvas.commandManager.execute(new RemoveDeviceCommand(this.plan, deviceId));
        this.canvas.setSelectedDevice(null);
        this.canvas.notifyChanged();
        return true;
      }
      if (openingId) {
        this.canvas.commandManager.execute(new RemoveOpeningCommand(this.plan, openingId));
        this.canvas.setSelectedOpening(null);
        this.canvas.notifyChanged();
        return true;
      }
      if (wallId) {
        this.canvas.commandManager.execute(new RemoveWallCommand(this.plan, wallId));
        this.canvas.setSelectedWall(null);
        this.canvas.notifyChanged();
        return true;
      }
      const dimensionId = this.canvas.getSelectedDimension();
      if (dimensionId) {
        this.canvas.commandManager.execute(new RemoveDimensionCommand(this.plan, dimensionId));
        this.canvas.setSelectedDimension(null);
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
    this.activeRoomVertex = null;
  }

  private hitTestDevice(screenPoint: Vector2): import('../model/Device').Device | null {
    const iconScale = this.canvas.editorState.get('deviceIconScale') ?? 1;
    for (const device of this.plan.devices) {
      const item = findDeviceCatalogItem(device.type);
      const baseSizeMm = item ? Math.max(item.width, item.height) : 600;
      const sizePx = (baseSizeMm / 10) * iconScale * (80 / 60) + 4;
      const halfScreen = sizePx / 2 + 4; // небольшой запас
      const surfacePos = this.plan.deviceWorldPosition(device);
      const wall = this.plan.findWall(device.wallId);
      let iconPos = surfacePos;
      if (wall) {
        const dir = wallDirection(wall);
        const n = dir.perpendicular();
        const halfWorld = (sizePx / 2) / this.canvas.camera.scale;
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

  private hitTestDimension(screenPoint: Vector2): import('../model/Dimension').Dimension | null {
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

  private hitTestCable(screenPoint: Vector2): import('../model/Cable').Cable | null {
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
}
