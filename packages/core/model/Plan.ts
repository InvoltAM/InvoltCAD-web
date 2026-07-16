import { Vector2 } from '../geometry/Vector2';
import { Wall, DEFAULT_WALL_THICKNESS, wallLength, wallDirection } from './Wall';
import { Opening, OpeningType, DEFAULT_DOOR_WIDTH, DEFAULT_WINDOW_WIDTH } from './Opening';
import { Device, DeviceType, DEVICE_SIZE, DEFAULT_DEVICE_NAMES, defaultDeviceHeight } from './Device';
import { Cable, CableType, DEFAULT_CABLE, computeCableSpareLength, computeCableTotalLength } from './Cable';
import { Dimension, createDimension } from './Dimension';
import { detectRooms, Room } from '../geometry/RoomDetector';
import { Quadtree, buildWallQuadtree } from '../geometry/Quadtree';

import { validatePlan, ValidationResult } from '../rules/PlanValidator';
import { projectPointToSegment } from '../geometry/Geometry';

/**
 * Корневая модель плана помещения.
 * Все координаты в миллиметрах.
 */
export class Plan {
  walls: Wall[] = [];
  devices: Device[] = [];
  cables: Cable[] = [];
  dimensions: Dimension[] = [];

  private wallQuadtree: Quadtree<Wall> | null = null;
  private cachedQuadtreeHash = '';
  private cachedRooms: Room[] | null = null;
  private cachedValidation: import('../rules/PlanValidator').ValidationResult | null = null;

  addWall(a: Vector2, b: Vector2, thickness = DEFAULT_WALL_THICKNESS): Wall {
    const wall: Wall = {
      id: crypto.randomUUID(),
      a: a.clone(),
      b: b.clone(),
      thickness,
      openings: [],
    };
    this.walls.push(wall);
    this.invalidateRooms();
    return wall;
  }

  removeWall(id: string): void {
    this.walls = this.walls.filter(w => w.id !== id);
    // Удаляем устройства и кабели, связанные со стеной
    this.devices = this.devices.filter(d => d.wallId !== id);
    this.cables = this.cables.filter(
      c => this.devices.some(d => d.id === c.fromDeviceId || d.id === c.toDeviceId),
    );
    this.invalidateRooms();
  }

  /**
   * Разбить стену в заданной точке на две коллинеарные стены.
   * Переносит проёмы и устройства с сохранением положения в миллиметрах.
   * Дуговые стены не разбиваются.
   */
  splitWallAtPoint(
    wall: Wall,
    point: Vector2,
  ): { w1: Wall; w2: Wall; movedDevices: Device[] } {
    if (wall.arc) {
      throw new Error('Разбиение дуговых стен пока не поддерживается');
    }

    const len = wall.a.distanceTo(wall.b);
    const proj = projectPointToSegment(point, wall.a, wall.b);
    const t0 = proj.t;
    const len1 = Math.max(0, t0 * len);
    const len2 = Math.max(0, len - len1);

    const w1: Wall = {
      id: crypto.randomUUID(),
      a: wall.a.clone(),
      b: point.clone(),
      thickness: wall.thickness,
      openings: [],
    };
    const w2: Wall = {
      id: crypto.randomUUID(),
      a: point.clone(),
      b: wall.b.clone(),
      thickness: wall.thickness,
      openings: [],
    };

    for (const o of wall.openings) {
      const dist = o.t * len;
      if (len1 > 0 && dist <= len1 + 0.001) {
        w1.openings.push({ ...o, wallId: w1.id });
      } else if (len2 > 0) {
        w2.openings.push({ ...o, wallId: w2.id, t: len1 > 0 ? (dist - len1) / len2 : 0 });
      }
    }

    for (const o of w1.openings) {
      o.t = (o.t * len) / len1;
    }

    const movedDevices: Device[] = [];
    for (const device of this.devices) {
      if (device.wallId !== wall.id) continue;
      const dist = device.t * len;
      if (len1 > 0 && dist <= len1 + 0.001) {
        device.wallId = w1.id;
        device.t = dist / len1;
        movedDevices.push(device);
      } else if (len2 > 0) {
        device.wallId = w2.id;
        device.t = len1 > 0 ? (dist - len1) / len2 : 0;
        movedDevices.push(device);
      }
    }

    return { w1, w2, movedDevices };
  }

  /**
   * Объединить две коллинеарные стены, sharing an endpoint, в одну.
   * Возвращает объединённую стену или null, если объединение невозможно.
   */
  mergeWalls(w1: Wall, w2: Wall): Wall | null {
    if (w1.arc || w2.arc) return null;

    const dir1 = w1.b.sub(w1.a);
    const dir2 = w2.b.sub(w2.a);
    const cross = Math.abs(dir1.x * dir2.y - dir1.y * dir2.x);
    const eps = 0.001;
    if (cross > eps * dir1.length() * dir2.length()) return null;

    let a: Vector2;
    let b: Vector2;
    if (w1.a.distanceTo(w2.a) < eps) {
      a = w1.b.clone();
      b = w2.b.clone();
    } else if (w1.a.distanceTo(w2.b) < eps) {
      a = w1.b.clone();
      b = w2.a.clone();
    } else if (w1.b.distanceTo(w2.a) < eps) {
      a = w1.a.clone();
      b = w2.b.clone();
    } else if (w1.b.distanceTo(w2.b) < eps) {
      a = w1.a.clone();
      b = w2.a.clone();
    } else {
      return null;
    }

    const merged: Wall = {
      id: crypto.randomUUID(),
      a,
      b,
      thickness: w1.thickness,
      openings: [],
    };

    const len = a.distanceTo(b);
    const len1 = w1.a.distanceTo(w1.b);
    const len2 = w2.a.distanceTo(w2.b);

    // Ориентация объединённой стены от a к b. Сопоставляем исходные стены.
    const w1Start = a.distanceTo(w1.a) < eps ? w1.a : w1.b;
    const w1End = a.distanceTo(w1.a) < eps ? w1.b : w1.a;
    const w2Start = a.distanceTo(w2.a) < eps ? w2.a : w2.b;
    const w2End = a.distanceTo(w2.a) < eps ? w2.b : w2.a;

    if (len1 > 0) {
      const base = w1Start.distanceTo(a);
      for (const o of w1.openings) {
        const dist = base + o.t * len1;
        merged.openings.push({ ...o, wallId: merged.id, t: len > 0 ? dist / len : 0 });
      }
      for (const device of this.devices) {
        if (device.wallId !== w1.id) continue;
        const dist = base + device.t * len1;
        device.wallId = merged.id;
        device.t = len > 0 ? dist / len : 0;
      }
    }

    if (len2 > 0) {
      const base = w2Start.distanceTo(a);
      for (const o of w2.openings) {
        const dist = base + o.t * len2;
        merged.openings.push({ ...o, wallId: merged.id, t: len > 0 ? dist / len : 0 });
      }
      for (const device of this.devices) {
        if (device.wallId !== w2.id) continue;
        const dist = base + device.t * len2;
        device.wallId = merged.id;
        device.t = len > 0 ? dist / len : 0;
      }
    }

    return merged;
  }

  findWall(id: string): Wall | undefined {
    return this.walls.find(w => w.id === id);
  }

  addOpening(
    wallId: string,
    type: OpeningType,
    t: number,
    width = type === 'door' ? DEFAULT_DOOR_WIDTH : DEFAULT_WINDOW_WIDTH,
  ): Opening | null {
    const wall = this.findWall(wallId);
    if (!wall) return null;

    const len = wallLength(wall);
    if (len === 0) return null;

    const half = width / 2;
    const minT = (half + 10) / len;
    const maxT = 1 - (half + 10) / len;
    t = Math.max(minT, Math.min(maxT, t));

    const opening: Opening = {
      id: crypto.randomUUID(),
      type,
      wallId,
      t,
      width,
      swingSide: type === 'door' ? 'left' : undefined,
      openDir: type === 'door' ? 1 : undefined,
    };
    wall.openings.push(opening);
    this.cachedValidation = null;
    return opening;
  }

  removeOpening(id: string): void {
    for (const wall of this.walls) {
      const idx = wall.openings.findIndex(o => o.id === id);
      if (idx !== -1) {
        wall.openings.splice(idx, 1);
        this.cachedValidation = null;
        return;
      }
    }
  }

  findOpening(id: string): { opening: Opening; wall: Wall } | undefined {
    for (const wall of this.walls) {
      const opening = wall.openings.find(o => o.id === id);
      if (opening) return { opening, wall };
    }
    return undefined;
  }

  addDevice(
    wallId: string,
    type: DeviceType,
    t: number,
    offset = 0,
    side: 1 | -1 = 1,
    name?: string,
    height?: number,
  ): Device | null {
    const wall = this.findWall(wallId);
    if (!wall) return null;

    const len = wallLength(wall);
    if (len === 0) return null;

    // Отступ от концов стены и от проемов
    const size = DEVICE_SIZE[type];
    const half = Math.max(size.width, size.height) / 2;
    const minT = (half + 20) / len;
    const maxT = 1 - (half + 20) / len;
    t = Math.max(minT, Math.min(maxT, t));

    // Проверка пересечения с проемами
    for (const opening of wall.openings) {
      const oHalf = opening.width / 2 + half + 10;
      const oCenterT = opening.t;
      if (Math.abs(t - oCenterT) * len < oHalf) {
        // Сдвигаем в ближайшую сторону
        t = t < oCenterT ? oCenterT - oHalf / len : oCenterT + oHalf / len;
        t = Math.max(minT, Math.min(maxT, t));
      }
    }

    const device: Device = {
      id: crypto.randomUUID(),
      type,
      name: name || this.generateDeviceName(type),
      wallId,
      t,
      offset,
      side,
      rotation: 0,
      height: height ?? defaultDeviceHeight(type),
    };
    this.devices.push(device);
    this.cachedValidation = null;
    return device;
  }

  removeDevice(id: string): void {
    this.devices = this.devices.filter(d => d.id !== id);
    this.cables = this.cables.filter(c => c.fromDeviceId !== id && c.toDeviceId !== id);
    this.cachedValidation = null;
  }

  findDevice(id: string): Device | undefined {
    return this.devices.find(d => d.id === id);
  }

  findCable(id: string): Cable | undefined {
    return this.cables.find(c => c.id === id);
  }

  addCable(
    fromDeviceId: string,
    toDeviceId: string,
    type: CableType = DEFAULT_CABLE.type,
    crossSection = DEFAULT_CABLE.crossSection,
  ): Cable | null {
    if (fromDeviceId === toDeviceId) return null;
    const from = this.findDevice(fromDeviceId);
    const to = this.findDevice(toDeviceId);
    if (!from || !to) return null;

    const fromPos = this.deviceWorldPosition(from);
    const toPos = this.deviceWorldPosition(to);
    const route = Plan.computeManhattanRoute(fromPos, toPos);
    const length = Plan.routeLength(route);
    const spareLength = computeCableSpareLength(length);
    const totalLength = length + spareLength;

    const cable: Cable = {
      id: crypto.randomUUID(),
      fromDeviceId,
      toDeviceId,
      type,
      crossSection,
      length,
      spareLength,
      totalLength,
      route,
    };
    this.cables.push(cable);
    this.cachedValidation = null;
    return cable;
  }

  /** Manhattan-маршрутизация: выбираем кратчайший из двух прямоугольных путей. */
  static computeManhattanRoute(a: Vector2, b: Vector2): Vector2[] {
    const mid1 = new Vector2(b.x, a.y);
    const mid2 = new Vector2(a.x, b.y);
    const len1 = a.distanceTo(mid1) + mid1.distanceTo(b);
    const len2 = a.distanceTo(mid2) + mid2.distanceTo(b);
    return len1 <= len2 ? [a, mid1, b] : [a, mid2, b];
  }

  static routeLength(route: Vector2[]): number {
    let len = 0;
    for (let i = 1; i < route.length; i++) {
      len += route[i - 1].distanceTo(route[i]);
    }
    return len;
  }

  private generateDeviceName(type: DeviceType): string {
    const base = DEFAULT_DEVICE_NAMES[type];
    const count = this.devices.filter(d => d.type === type).length + 1;
    return `${base} ${count}`;
  }

  removeCable(id: string): void {
    this.cables = this.cables.filter(c => c.id !== id);
    this.cachedValidation = null;
  }

  addDimension(a: Vector2, b: Vector2): Dimension {
    const dim = createDimension(a, b);
    this.dimensions.push(dim);
    this.cachedValidation = null;
    return dim;
  }

  removeDimension(id: string): void {
    this.dimensions = this.dimensions.filter(d => d.id !== id);
    this.cachedValidation = null;
  }

  /** Найти замкнутые комнаты по стенам (с кэшированием). */
  getRooms(): Room[] {
    if (this.cachedRooms) return this.cachedRooms;
    this.cachedRooms = detectRooms(this.walls);
    return this.cachedRooms;
  }

  /** Сбросить кэш комнат и валидации (вызывать при изменении стен). */
  invalidateRooms(): void {
    this.cachedRooms = null;
    this.cachedValidation = null;
  }

  /** Запустить валидацию плана (с кэшированием). */
  validate(): ValidationResult {
    if (this.cachedValidation) return this.cachedValidation;
    this.cachedValidation = validatePlan(this);
    return this.cachedValidation;
  }

  /** Получить пространственный индекс стен (ленивое построение). */
  getWallQuadtree(): Quadtree<Wall> {
    const hash = this.walls.map(w => `${w.id}:${w.a.x}:${w.a.y}:${w.b.x}:${w.b.y}`).join('|');
    if (!this.wallQuadtree || hash !== this.cachedQuadtreeHash) {
      this.wallQuadtree = buildWallQuadtree(this.walls);
      this.cachedQuadtreeHash = hash;
    }
    return this.wallQuadtree;
  }

  /** Пересчитать маршруты и длины всех кабелей после изменения устройств. */
  recalcCableRoutes(): void {
    for (const cable of this.cables) {
      const from = this.findDevice(cable.fromDeviceId);
      const to = this.findDevice(cable.toDeviceId);
      if (!from || !to) continue;
      const fromPos = this.deviceWorldPosition(from);
      const toPos = this.deviceWorldPosition(to);
      cable.route = Plan.computeManhattanRoute(fromPos, toPos);
      cable.length = Plan.routeLength(cable.route);
      cable.spareLength = computeCableSpareLength(cable.length);
      cable.totalLength = cable.length + cable.spareLength;
    }
    this.cachedValidation = null;
  }

  /** Возвращает ограничивающий прямоугольник плана с заданным отступом (мм). */
  getBounds(margin = 100): { min: Vector2; max: Vector2 } {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let hasObjects = false;

    const add = (p: Vector2, r = 0): void => {
      minX = Math.min(minX, p.x - r);
      minY = Math.min(minY, p.y - r);
      maxX = Math.max(maxX, p.x + r);
      maxY = Math.max(maxY, p.y + r);
      hasObjects = true;
    };

    for (const wall of this.walls) {
      add(wall.a);
      add(wall.b);
    }

    for (const device of this.devices) {
      const pos = this.deviceWorldPosition(device);
      const size = DEVICE_SIZE[device.type];
      const r = Math.max(size.width, size.height) / 2;
      add(pos, r);
    }

    for (const dim of this.dimensions) {
      add(dim.a);
      add(dim.b);
    }

    for (const cable of this.cables) {
      for (const p of cable.route) {
        add(p);
      }
    }

    if (!hasObjects) {
      return { min: new Vector2(-1000, -1000), max: new Vector2(1000, 1000) };
    }

    return {
      min: new Vector2(minX - margin, minY - margin),
      max: new Vector2(maxX + margin, maxY + margin),
    };
  }

  /** Мировая позиция устройства (центр). */
  deviceWorldPosition(device: Device): Vector2 {
    const wall = this.findWall(device.wallId);
    if (!wall) return new Vector2(0, 0);
    const len = wallLength(wall);
    const dir = wallDirection(wall);
    const n = dir.perpendicular();
    const centerOnWall = wall.a.add(dir.scale(device.t * len));
    // offset вдоль нормали от стены
    // Центр условного обозначения — на поверхности стены с той стороны, где курсор
    const h = wall.thickness / 2;
    return centerOnWall.add(n.scale(h * device.side));
  }

  toJSON(): object {
    return {
      walls: this.walls.map(w => ({
        id: w.id,
        a: { x: w.a.x, y: w.a.y },
        b: { x: w.b.x, y: w.b.y },
        thickness: w.thickness,
        openings: w.openings.map(o => ({
          id: o.id,
          type: o.type,
          wallId: o.wallId,
          t: o.t,
          width: o.width,
          swingSide: o.swingSide,
          openDir: o.openDir,
        })),
      })),
      devices: this.devices.map(d => ({
        id: d.id,
        type: d.type,
        name: d.name,
        wallId: d.wallId,
        t: d.t,
        offset: d.offset,
        side: d.side ?? 1,
        rotation: d.rotation,
        height: d.height ?? defaultDeviceHeight(d.type),
      })),
      cables: this.cables.map(c => ({
        id: c.id,
        fromDeviceId: c.fromDeviceId,
        toDeviceId: c.toDeviceId,
        type: c.type,
        crossSection: c.crossSection,
        length: c.length,
        spareLength: c.spareLength,
        totalLength: c.totalLength,
        route: c.route.map(p => ({ x: p.x, y: p.y })),
      })),
      dimensions: this.dimensions.map(d => ({
        id: d.id,
        a: { x: d.a.x, y: d.a.y },
        b: { x: d.b.x, y: d.b.y },
        length: d.length,
        text: d.text,
      })),
    };
  }

  static fromJSON(data: any): Plan {
    const plan = new Plan();
    if (!data) return plan;

    for (const w of data.walls ?? []) {
      const wall: Wall = {
        id: w.id || crypto.randomUUID(),
        a: new Vector2(w.a?.x ?? 0, w.a?.y ?? 0),
        b: new Vector2(w.b?.x ?? 0, w.b?.y ?? 0),
        thickness: w.thickness ?? DEFAULT_WALL_THICKNESS,
        openings: [],
      };
      for (const o of w.openings ?? []) {
        wall.openings.push({
          id: o.id || crypto.randomUUID(),
          type: o.type,
          wallId: o.wallId || wall.id,
          t: o.t ?? 0.5,
          width: o.width ?? (o.type === 'door' ? DEFAULT_DOOR_WIDTH : DEFAULT_WINDOW_WIDTH),
          swingSide: o.swingSide,
          openDir: o.openDir,
        });
      }
      plan.walls.push(wall);
    }

    for (const d of data.devices ?? []) {
      plan.devices.push({
        id: d.id || crypto.randomUUID(),
        type: d.type || 'socket',
        name: d.name || DEFAULT_DEVICE_NAMES[(d.type || 'socket') as DeviceType],
        wallId: d.wallId,
        t: d.t ?? 0.5,
        offset: d.offset ?? 0,
        side: (d.side ?? 1) as 1 | -1,
        rotation: d.rotation ?? 0,
        height: d.height ?? defaultDeviceHeight(d.type || 'socket'),
      });
    }

    for (const c of data.cables ?? []) {
      const from = plan.devices.find(d => d.id === c.fromDeviceId);
      const to = plan.devices.find(d => d.id === c.toDeviceId);
      const fromPos = from ? plan.deviceWorldPosition(from) : new Vector2(0, 0);
      const toPos = to ? plan.deviceWorldPosition(to) : new Vector2(0, 0);
      const route = (c.route as Array<{x: number; y: number}> | undefined)?.map(p => new Vector2(p.x, p.y))
        ?? Plan.computeManhattanRoute(fromPos, toPos);

      plan.cables.push({
        id: c.id || crypto.randomUUID(),
        fromDeviceId: c.fromDeviceId,
        toDeviceId: c.toDeviceId,
        type: c.type || DEFAULT_CABLE.type,
        crossSection: c.crossSection ?? DEFAULT_CABLE.crossSection,
        length: c.length ?? Plan.routeLength(route),
        spareLength: c.spareLength ?? computeCableSpareLength(c.length ?? Plan.routeLength(route)),
        totalLength: c.totalLength ?? (c.length ?? Plan.routeLength(route)) + computeCableSpareLength(c.length ?? Plan.routeLength(route)),
        route,
      });
    }

    for (const d of data.dimensions ?? []) {
      const a = new Vector2(d.a?.x ?? 0, d.a?.y ?? 0);
      const b = new Vector2(d.b?.x ?? 0, d.b?.y ?? 0);
      plan.dimensions.push({
        id: d.id || crypto.randomUUID(),
        a,
        b,
        length: d.length ?? a.distanceTo(b),
        text: d.text,
      });
    }

    return plan;
  }
}
