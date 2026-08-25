import { Vector2 } from '../geometry/Vector2';
import { Wall, DEFAULT_WALL_THICKNESS, wallLength, wallDirection } from './Wall';
import { Opening, OpeningType, DEFAULT_DOOR_WIDTH, DEFAULT_WINDOW_WIDTH } from './Opening';
import { Device, DeviceType, DEVICE_SIZE, DEFAULT_DEVICE_NAMES } from './Device';
import { Cable, CableType, DEFAULT_CABLE, defaultPhaseForType, type CablePhase, type CableStyle, type CableRoutingMode, type CableBundleMode } from './Cable';
import { Dimension, createDimension } from './Dimension';
import { DrawingPrimitive, DrawingPrimitiveType, createDrawingPrimitive } from './DrawingPrimitive';
import { detectRooms, Room } from '../geometry/RoomDetector';
import { Quadtree, buildWallQuadtree } from '../geometry/Quadtree';

import { projectPointToSegment } from '../geometry/Geometry';

import { Sheet, createDefaultSheets, createEmptyTitleBlock, SheetTitleBlock } from './Sheet';
import { createSheetTable, SheetTable, SheetTableType } from './SheetTable';
import { CableRunData } from '../electrical/CableRunEngine';
import { routeCableWithVia, simplifyRoute } from '../cables/cableRouting';

/** Отступ точки автотрассировки от поверхности стены в комнату (мм).
 *  Соответствует connector offset из спецификации (100 мм). */
const CABLE_ROUTING_OFFSET = 100;

export interface PlanElectrical {
  consumers: any[];
  circuits: any[];
  distributionBoards: any[];
  cableRuns: CableRunData[];
  priceItems: any[];
  priceWorkItems: any[];
  estimates: any[];
  invoices: any[];
  documents: any[];
  automationConfigs: any[];
}

export function createEmptyElectrical(): PlanElectrical {
  return {
    consumers: [],
    circuits: [],
    distributionBoards: [],
    cableRuns: [],
    priceItems: [],
    priceWorkItems: [],
    estimates: [],
    invoices: [],
    documents: [],
    automationConfigs: [],
  };
}

export interface RoomMetadata {
  id: string;
  number: number;
  name: string;
  centroid: { x: number; y: number };
  area: number;
}

/**
 * Корневая модель плана помещения.
 * Все координаты в миллиметрах.
 */
export class Plan {
  walls: Wall[] = [];
  sheets: Sheet[] = createDefaultSheets();
  activeSheetId: string = '';
  electrical: PlanElectrical = createEmptyElectrical();

  /** Глобальный масштаб иконок устройств, влияющий на точки входа кабелей. */
  deviceIconScale: number = 1;

  private wallQuadtree: Quadtree<Wall> | null = null;
  private cachedQuadtreeHash = '';
  private cachedRooms: Room[] | null = null;
  roomData: RoomMetadata[] = [];

  /** Активный лист (по умолчанию — первый). */
  get activeSheet(): Sheet {
    if (!this.activeSheetId || !this.sheets.some(s => s.id === this.activeSheetId)) {
      this.activeSheetId = this.sheets[0]?.id ?? '';
    }
    return this.sheets.find(s => s.id === this.activeSheetId) as Sheet;
  }

  /** Устройства активного листа (живая ссылка на массив). */
  get devices(): Device[] {
    return this.activeSheet.devices;
  }
  set devices(value: Device[]) {
    this.activeSheet.devices = value;
  }

  /** Кабели активного листа. */
  get cables(): Cable[] {
    return this.activeSheet.cables;
  }
  set cables(value: Cable[]) {
    this.activeSheet.cables = value;
  }

  /** Размеры активного листа. */
  get dimensions(): Dimension[] {
    return this.activeSheet.dimensions;
  }
  set dimensions(value: Dimension[]) {
    this.activeSheet.dimensions = value;
  }

  /** Примитивы рисования активного листа. */
  get primitives(): DrawingPrimitive[] {
    return this.activeSheet.primitives;
  }
  set primitives(value: DrawingPrimitive[]) {
    this.activeSheet.primitives = value;
  }

  addPrimitive(
    type: DrawingPrimitiveType,
    points: Vector2[],
    text?: string,
    fontSize?: number,
    fontFamily?: string,
    color?: string,
    italic?: boolean,
    textAlign?: 'left' | 'center' | 'right',
    lineWidth?: number,
    lineColor?: string,
    lineStyle?: import('./DrawingPrimitive').LineStyle,
    fillColor?: string,
  ): DrawingPrimitive {
    const primitive = createDrawingPrimitive(type, points, text, fontSize, fontFamily, color, italic, textAlign, lineWidth, lineColor, lineStyle, fillColor);
    this.primitives.push(primitive);
    return primitive;
  }

  removePrimitive(id: string): void {
    this.primitives = this.primitives.filter((p) => p.id !== id);
  }

  /** Таблицы активного листа. */
  get tables(): SheetTable[] {
    return this.activeSheet.tables;
  }
  set tables(value: SheetTable[]) {
    this.activeSheet.tables = value;
  }

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
    // Удаляем устройства, связанные со стеной
    this.devices = this.devices.filter(d => d.wallId !== id);
    // Удаляем кабели, у которых оба конца — удалённые устройства (point-концы остаются)
    this.cables = this.cables.filter((c) => {
      const fromOk = !c.fromDeviceId || this.devices.some(d => d.id === c.fromDeviceId);
      const toOk = !c.toDeviceId || this.devices.some(d => d.id === c.toDeviceId);
      return fromOk || toOk;
    });
    this.invalidateRooms();
  }

  setActiveSheet(id: string): void {
    if (this.sheets.some(s => s.id === id)) {
      this.activeSheetId = id;
    }
  }

  addSheet(name: string): Sheet {
    const sheet: Sheet = {
      id: crypto.randomUUID(),
      name,
      devices: [],
      cables: [],
      dimensions: [],
      primitives: [],
      tables: [],
      pageSize: 'A4',
      orientation: 'landscape',
      printScale: 100,
      titleBlock: createEmptyTitleBlock(),
    };
    this.sheets.push(sheet);
    this.activeSheetId = sheet.id;
    return sheet;
  }

  removeSheet(id: string): void {
    if (this.sheets.length <= 1) return;
    const idx = this.sheets.findIndex(s => s.id === id);
    if (idx === -1) return;
    this.sheets.splice(idx, 1);
    if (this.activeSheetId === id) {
      this.activeSheetId = this.sheets[Math.min(idx, this.sheets.length - 1)].id;
    }
  }

  moveSheet(draggedId: string, targetId: string): void {
    const draggedIndex = this.sheets.findIndex(s => s.id === draggedId);
    const targetIndex = this.sheets.findIndex(s => s.id === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    const [dragged] = this.sheets.splice(draggedIndex, 1);
    this.sheets.splice(targetIndex, 0, dragged);
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
    const w2Start = a.distanceTo(w2.a) < eps ? w2.a : w2.b;

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

    return opening;
  }

  removeOpening(id: string): void {
    for (const wall of this.walls) {
      const idx = wall.openings.findIndex(o => o.id === id);
      if (idx !== -1) {
        wall.openings.splice(idx, 1);
    
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
    iconScale = 1,
  ): Device | null {
    const wall = this.findWall(wallId);
    if (!wall) return null;

    const len = wallLength(wall);
    if (len === 0) return null;

    // Отступ от концов стены и от проемов с учётом масштаба иконки
    const size = DEVICE_SIZE[type] ?? { width: 600, height: 600 };
    const scale = iconScale ?? 1;
    const half = (Math.max(size.width, size.height) * scale) / 2;
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
      iconScale: scale,
    };
    this.devices.push(device);
    return device;
  }

  removeDevice(id: string): void {
    this.devices = this.devices.filter(d => d.id !== id);
    this.cables = this.cables.filter(c => c.fromDeviceId !== id && c.toDeviceId !== id);

  }

  addFreeDevice(
    type: DeviceType,
    position: Vector2,
    name?: string,
    iconScale = 1,
  ): Device | null {
    const device: Device = {
      id: crypto.randomUUID(),
      type,
      name: name || this.generateDeviceName(type),
      wallId: '',
      t: 0,
      offset: 0,
      side: 1,
      rotation: 0,
      position: { x: position.x, y: position.y },
      iconScale: iconScale ?? 1,
    };
    this.devices.push(device);

    return device;
  }

  findDevice(id: string): Device | undefined {
    return this.devices.find(d => d.id === id);
  }

  findCable(id: string): Cable | undefined {
    return this.cables.find(c => c.id === id);
  }

  findPrimitive(id: string): DrawingPrimitive | undefined {
    return this.primitives.find(p => p.id === id);
  }

  /** Мировая позиция начала или конца кабеля с учётом точек на стене/в пространстве. */
  cableEndpointPosition(cable: Cable, endpoint: 'from' | 'to'): Vector2 {
    if (endpoint === 'from') {
      if (cable.fromDeviceId) {
        const device = this.findDevice(cable.fromDeviceId);
        if (device) return this.deviceCableEntryPoint(device);
      }
      if (cable.fromPoint) return new Vector2(cable.fromPoint.x, cable.fromPoint.y);
    } else {
      if (cable.toDeviceId) {
        const device = this.findDevice(cable.toDeviceId);
        if (device) return this.deviceCableEntryPoint(device);
      }
      if (cable.toPoint) return new Vector2(cable.toPoint.x, cable.toPoint.y);
    }
    return cable.route[0]?.clone() ?? new Vector2(0, 0);
  }

  addCable(
    fromDeviceId: string | null,
    toDeviceId: string | null,
    type: CableType = DEFAULT_CABLE.type,
    crossSection = DEFAULT_CABLE.crossSection,
    options?: {
      fromPoint?: { x: number; y: number };
      toPoint?: { x: number; y: number };
      viaPoints?: Vector2[];
      circuitId?: string;
      route?: Vector2[];
      phase?: import('../model/Cable.js').CablePhase;
      style?: import('../model/Cable.js').CableStyle;
      routingMode?: import('../model/Cable.js').CableRoutingMode;
      bundleMode?: import('../model/Cable.js').CableBundleMode;
      bundleGroup?: string | null;
      trunkPoint?: { x: number; y: number } | null;
    },
  ): Cable | null {
    const hasFromDevice = !!fromDeviceId;
    const hasToDevice = !!toDeviceId;
    if (hasFromDevice && hasToDevice && fromDeviceId === toDeviceId) return null;

    const fromPos = hasFromDevice
      ? this.deviceCableEntryPoint(this.findDevice(fromDeviceId!)!)
      : options?.fromPoint
        ? new Vector2(options.fromPoint.x, options.fromPoint.y)
        : null;
    const toPos = hasToDevice
      ? this.deviceCableEntryPoint(this.findDevice(toDeviceId!)!)
      : options?.toPoint
        ? new Vector2(options.toPoint.x, options.toPoint.y)
        : null;
    if (!fromPos || !toPos) return null;

    const via = options?.viaPoints ?? [];
    let route: Vector2[];
    const routing: 'auto' | 'manual' = options?.route && options.route.length >= 2 ? 'auto' : 'manual';
    if (options?.route && options.route.length >= 2) {
      route = options.route.map((p) => p.clone());
    } else if (via.length > 0) {
      route = [fromPos, ...via.map((p) => p.clone()), toPos];
    } else {
      route = Plan.computeManhattanRoute(fromPos, toPos);
    }
    const length = Plan.routeLength(route);

    const phase: CablePhase = options?.phase ?? defaultPhaseForType(type);
    const cable: Cable = {
      id: crypto.randomUUID(),
      fromDeviceId,
      toDeviceId,
      fromPoint: options?.fromPoint ? { ...options.fromPoint } : undefined,
      toPoint: options?.toPoint ? { ...options.toPoint } : undefined,
      type,
      crossSection,
      length,
      route,
      viaPoints: via.map(p => p.clone()),
      routing,
      circuitId: options?.circuitId,
      phase,
      style: options?.style,
      routingMode: options?.routingMode ?? routing,
      bundleMode: options?.bundleMode ?? 'none',
      bundleGroup: options?.bundleGroup ?? null,
      trunkPoint: options?.trunkPoint ?? null,
    };
    this.cables.push(cable);

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
    const base = DEFAULT_DEVICE_NAMES[type] ?? 'Устройство';
    const count = this.devices.filter(d => d.type === type).length + 1;
    return `${base} ${count}`;
  }

  removeCable(id: string): void {
    this.cables = this.cables.filter(c => c.id !== id);

  }

  addDimension(a: Vector2, b: Vector2): Dimension {
    const dim = createDimension(a, b);
    this.dimensions.push(dim);

    return dim;
  }

  removeDimension(id: string): void {
    this.dimensions = this.dimensions.filter(d => d.id !== id);

  }

  addSheetTable(type: SheetTableType, position: Vector2, width = 300, height = 200, scale = 1): SheetTable {
    let pos = position.clone();
    let offset = 0;
    while (this.tables.some((t) => Math.abs(t.position.x - pos.x) < 1000 && Math.abs(t.position.y - pos.y) < 1000)) {
      offset += 1000;
      pos = position.add(new Vector2(offset, offset));
    }
    const table = createSheetTable(type, pos, width, height, scale);
    this.tables.push(table);
    return table;
  }

  removeSheetTable(id: string): void {
    this.tables = this.tables.filter(t => t.id !== id);
  }

  findSheetTable(id: string): SheetTable | undefined {
    return this.tables.find(t => t.id === id);
  }

  moveSheetTable(id: string, position: Vector2): void {
    const table = this.findSheetTable(id);
    if (table) {
      table.position = { x: position.x, y: position.y };
    }
  }

  resizeSheetTable(id: string, scale: number, position: Vector2): void {
    const table = this.findSheetTable(id);
    if (table) {
      table.scale = scale;
      table.position = { x: position.x, y: position.y };
    }
  }

  /** Центроид полигона комнаты. */
  private getRoomCentroid(polygon: Vector2[]): Vector2 {
    let cx = 0;
    let cy = 0;
    for (const p of polygon) {
      cx += p.x;
      cy += p.y;
    }
    return new Vector2(cx / polygon.length, cy / polygon.length);
  }

  /** Найти замкнутые комнаты по стенам (с кэшированием).
   * Каждой комнате присваивается устойчивый номер и идентификатор.
   * Имя заполняется вручную через {@link updateRoomName}.
   */
  getRooms(): Room[] {
    if (this.cachedRooms) return this.cachedRooms;
    const raw = detectRooms(this.walls);
    const existing = this.roomData;
    let nextNumber = existing.reduce((m, r) => Math.max(m, r.number), 0) + 1;
    const mapped: Room[] = raw.map((room) => {
      const centroid = this.getRoomCentroid(room.polygon);
      const matched = existing.find((r) => {
        const dx = r.centroid.x - centroid.x;
        const dy = r.centroid.y - centroid.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const areaDiff = Math.abs(r.area - room.area);
        const areaBase = Math.max(r.area, room.area, 1);
        return dist < 50 && areaDiff / areaBase < 0.05;
      });
      if (matched) {
        return {
          ...room,
          id: matched.id,
          number: matched.number,
          name: matched.name,
        };
      }
      return {
        ...room,
        id: crypto.randomUUID(),
        number: nextNumber++,
        name: '',
      };
    });
    this.roomData = mapped.map((r) => ({
      id: r.id!,
      number: r.number!,
      name: r.name!,
      centroid: this.getRoomCentroid(r.polygon),
      area: r.area,
    }));
    this.cachedRooms = mapped;
    return this.cachedRooms;
  }

  /** Обновить наименование комнаты. */
  updateRoomName(id: string, name: string): void {
    const data = this.roomData.find(r => r.id === id);
    if (data) data.name = name;
    const room = this.cachedRooms?.find(r => r.id === id);
    if (room) room.name = name;
  }

  /** Сбросить кэш комнат (вызывать при изменении стен). */
  invalidateRooms(): void {
    this.cachedRooms = null;
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
      const fromAnchor = this.cableEndpointPosition(cable, 'from');
      const toAnchor = this.cableEndpointPosition(cable, 'to');

      if (cable.routing === 'auto') {
        const via = cable.viaPoints ?? [];
        const fromDevice = cable.fromDeviceId ? this.findDevice(cable.fromDeviceId) : undefined;
        const toDevice = cable.toDeviceId ? this.findDevice(cable.toDeviceId) : undefined;
        const fromRouting = fromDevice ? this.deviceCableRoutingPoint(fromDevice) : fromAnchor;
        const toRouting = toDevice ? this.deviceCableRoutingPoint(toDevice) : toAnchor;
        const points = [fromRouting, ...via.map(p => p.clone()), toRouting];
        const routed = routeCableWithVia(this, points, 50);
        let route: Vector2[];
        if (routed && routed.length >= 2) {
          route = [fromAnchor, fromRouting, ...routed, toRouting, toAnchor];
          route = simplifyRoute(route, 1e-3, 25, [...via, fromRouting, toRouting], this);
        } else if (via.length > 0) {
          route = [fromAnchor, ...via.map(p => p.clone()), toAnchor];
        } else {
          route = Plan.computeManhattanRoute(fromAnchor, toAnchor);
        }
        // Якоря крепления кабеля остаются на грани устройства, прилегающей к стене.
        route[0] = fromAnchor.clone();
        route[route.length - 1] = toAnchor.clone();
        cable.route = route;
      } else {
        // Ручной маршрут: сохраняем промежуточные вершины, обновляем только
        // точки подключения к устройствам, чтобы кабель следовал за ними.
        const route = cable.route;
        if (route.length >= 2) {
          route[0] = fromAnchor.clone();
          route[route.length - 1] = toAnchor.clone();
        } else {
          cable.route = Plan.computeManhattanRoute(fromAnchor, toAnchor);
        }
      }

      cable.length = Plan.routeLength(cable.route);
      cable.spareLength = Math.max(cable.length * 0.1, 500);
      cable.totalLength = cable.length + cable.spareLength;
    }
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
    // Свободно размещённое устройство (светильник на потолке)
    if (device.position) {
      return new Vector2(device.position.x, device.position.y);
    }

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

  /**
   * Точка входа кабеля в устройство.
   * Для устройств на стене — центр грани, прилегающей к стене.
   * Для свободно размещённых устройств — позиция устройства.
   */
  deviceCableEntryPoint(device: Device): Vector2 {
    // Свободно размещённое устройство (светильник на потолке)
    if (device.position) {
      return new Vector2(device.position.x, device.position.y);
    }

    const wall = this.findWall(device.wallId);
    if (!wall) return new Vector2(0, 0);
    const len = wallLength(wall);
    const dir = wallDirection(wall);
    const n = dir.perpendicular();
    const centerOnWall = wall.a.add(dir.scale(device.t * len));
    // Центр грани устройства, прилегающей к стене (на поверхности стены)
    return centerOnWall.add(n.scale((wall.thickness / 2) * device.side));
  }

  /**
   * Точка начала/конца автотрассировки для устройства.
   * Смещена от поверхности стены в комнату, чтобы A* не попадал
   * в непроходимую ячейку у границы стены.
   */
  deviceCableRoutingPoint(device: Device): Vector2 {
    // Свободно размещённое устройство
    if (device.position) {
      return new Vector2(device.position.x, device.position.y);
    }

    const wall = this.findWall(device.wallId);
    if (!wall) return new Vector2(0, 0);
    const len = wallLength(wall);
    const dir = wallDirection(wall);
    const n = dir.perpendicular();
    const centerOnWall = wall.a.add(dir.scale(device.t * len));
    // Отступ в комнату от поверхности стены
    return centerOnWall.add(n.scale((wall.thickness / 2 + CABLE_ROUTING_OFFSET) * device.side));
  }

  toJSON(): object {
    const devicesToJSON = (devices: Device[]) => devices.map(d => ({
      id: d.id,
      type: d.type,
      name: d.name,
      wallId: d.wallId,
      t: d.t,
      offset: d.offset,
      side: d.side ?? 1,
      rotation: d.rotation,
      nameOffset: d.nameOffset ? { x: d.nameOffset.x, y: d.nameOffset.y } : undefined,
      position: d.position ? { x: d.position.x, y: d.position.y } : undefined,
      iconScale: d.iconScale,
    }));
    const cablesToJSON = (cables: Cable[]) => cables.map(c => ({
      id: c.id,
      fromDeviceId: c.fromDeviceId,
      toDeviceId: c.toDeviceId,
      fromPoint: c.fromPoint,
      toPoint: c.toPoint,
      type: c.type,
      crossSection: c.crossSection,
      length: c.length,
      spareLength: c.spareLength,
      totalLength: c.totalLength,
      route: c.route.map(p => ({ x: p.x, y: p.y })),
      viaPoints: c.viaPoints?.map(p => ({ x: p.x, y: p.y })),
      circuitId: c.circuitId,
      visible: c.visible ?? true,
      brand: c.brand ?? '',
      marking: c.marking ?? '',
      laid: c.laid ?? false,
    }));
    const dimensionsToJSON = (dimensions: Dimension[]) => dimensions.map(d => ({
      id: d.id,
      a: { x: d.a.x, y: d.a.y },
      b: { x: d.b.x, y: d.b.y },
      length: d.length,
      text: d.text,
    }));
    const primitivesToJSON = (primitives: DrawingPrimitive[]) => primitives.map(p => ({
      id: p.id,
      type: p.type,
      points: p.points.map(pt => ({ x: pt.x, y: pt.y })),
    }));
    const tablesToJSON = (tables: SheetTable[]) => tables.map(t => ({
      id: t.id,
      type: t.type,
      position: { x: t.position.x, y: t.position.y },
      width: t.width,
      height: t.height,
      scale: t.scale,
    }));

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
      sheets: this.sheets.map(s => ({
        id: s.id,
        name: s.name,
        devices: devicesToJSON(s.devices),
        cables: cablesToJSON(s.cables),
        dimensions: dimensionsToJSON(s.dimensions),
        primitives: primitivesToJSON(s.primitives),
        tables: tablesToJSON(s.tables),
        pageSize: s.pageSize,
        orientation: s.orientation,
        printScale: s.printScale,
        titleBlock: s.titleBlock,
      })),
      activeSheetId: this.activeSheetId || this.sheets[0]?.id,
      electrical: this.electrical ?? createEmptyElectrical(),
      roomData: this.roomData,
    };
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
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

    const devicesFromJSON = (list: any[]): Device[] => (list ?? []).map(d => ({
      id: d.id || crypto.randomUUID(),
      type: d.type || 'socket',
      name: d.name || DEFAULT_DEVICE_NAMES[(d.type || 'socket') as DeviceType],
      wallId: d.wallId,
      t: d.t ?? 0.5,
      offset: d.offset ?? 0,
      side: (d.side ?? 1) as 1 | -1,
      rotation: d.rotation ?? 0,
      nameOffset: d.nameOffset ? { x: d.nameOffset.x ?? 0, y: d.nameOffset.y ?? 0 } : undefined,
      position: d.position ? { x: d.position.x ?? 0, y: d.position.y ?? 0 } : undefined,
      iconScale: d.iconScale ?? undefined,
    }));

    const cablesFromJSON = (list: any[], devices: Device[]): Cable[] => (list ?? []).map(c => {
      const fromDeviceId: string | null = c.fromDeviceId ?? null;
      const toDeviceId: string | null = c.toDeviceId ?? null;
      const from = fromDeviceId ? devices.find(d => d.id === fromDeviceId) : undefined;
      const to = toDeviceId ? devices.find(d => d.id === toDeviceId) : undefined;
      const fromPoint = c.fromPoint ? { x: c.fromPoint.x ?? 0, y: c.fromPoint.y ?? 0 } : undefined;
      const toPoint = c.toPoint ? { x: c.toPoint.x ?? 0, y: c.toPoint.y ?? 0 } : undefined;
      const fromPos = from
        ? plan.deviceCableEntryPoint(from)
        : fromPoint
          ? new Vector2(fromPoint.x, fromPoint.y)
          : new Vector2(0, 0);
      const toPos = to
        ? plan.deviceCableEntryPoint(to)
        : toPoint
          ? new Vector2(toPoint.x, toPoint.y)
          : new Vector2(0, 0);
      const viaPoints = (c.viaPoints as Array<{x: number; y: number}> | undefined)
        ?.map(p => new Vector2(p.x, p.y));
      const route = (c.route as Array<{x: number; y: number}> | undefined)?.map(p => new Vector2(p.x, p.y))
        ?? (viaPoints && viaPoints.length > 0
          ? [fromPos, ...viaPoints, toPos]
          : Plan.computeManhattanRoute(fromPos, toPos));
      const length = c.length ?? Plan.routeLength(route);
      return {
        id: c.id || crypto.randomUUID(),
        fromDeviceId,
        toDeviceId,
        fromPoint,
        toPoint,
        type: c.type || DEFAULT_CABLE.type,
        crossSection: c.crossSection ?? DEFAULT_CABLE.crossSection,
        length,
        spareLength: c.spareLength,
        totalLength: c.totalLength,
        route,
        viaPoints,
        circuitId: c.circuitId,
        visible: c.visible ?? true,
        brand: c.brand ?? '',
        marking: c.marking ?? '',
        laid: c.laid ?? false,
      };
    });

    const dimensionsFromJSON = (list: any[]): Dimension[] => (list ?? []).map(d => {
      const a = new Vector2(d.a?.x ?? 0, d.a?.y ?? 0);
      const b = new Vector2(d.b?.x ?? 0, d.b?.y ?? 0);
      return {
        id: d.id || crypto.randomUUID(),
        a,
        b,
        length: d.length ?? a.distanceTo(b),
        text: d.text,
      };
    });
    const tablesFromJSON = (list: any[]): SheetTable[] => (list ?? []).map(t => ({
      id: t.id || crypto.randomUUID(),
      type: t.type || 'spec',
      position: { x: t.position?.x ?? 0, y: t.position?.y ?? 0 },
      width: t.width ?? 300,
      height: t.height ?? 200,
      scale: t.scale ?? 1,
    }));
    const primitivesFromJSON = (list: any[]): DrawingPrimitive[] => (list ?? []).map(p => ({
      id: p.id || crypto.randomUUID(),
      type: p.type || 'segment',
      points: (p.points ?? []).map((pt: any) => new Vector2(pt?.x ?? 0, pt?.y ?? 0)),
    }));

    if (Array.isArray(data.sheets) && data.sheets.length > 0) {
      // Новый формат: листы с собственными устройствами/кабелями/размерами
      plan.sheets = data.sheets.map((s: any) => {
        const devices = devicesFromJSON(s.devices);
        const defaultTb = createEmptyTitleBlock();
        return {
          id: s.id || crypto.randomUUID(),
          name: s.name || 'Лист',
          devices,
          cables: cablesFromJSON(s.cables, devices),
          dimensions: dimensionsFromJSON(s.dimensions),
          primitives: primitivesFromJSON(s.primitives),
          tables: tablesFromJSON(s.tables),
          pageSize: s.pageSize || 'A4',
          orientation: s.orientation || 'landscape',
          printScale: s.printScale ?? 100,
          titleBlock: {
            ...defaultTb,
            ...(s.titleBlock as Partial<SheetTitleBlock> || {}),
            show: {
              ...defaultTb.show,
              ...(s.titleBlock?.show || {}),
            },
          },
        };
      });
      plan.activeSheetId = data.sheets.some((s: any) => s.id === data.activeSheetId)
        ? data.activeSheetId
        : plan.sheets[0].id;
    } else {
      // Старый формат: всё содержимое — в лист «Розетки»
      const first = plan.sheets[0];
      first.devices = devicesFromJSON(data.devices);
      first.cables = cablesFromJSON(data.cables, first.devices);
      first.dimensions = dimensionsFromJSON(data.dimensions);
      first.primitives = primitivesFromJSON(data.primitives);
      plan.activeSheetId = first.id;
    }

    plan.electrical = data.electrical ?? createEmptyElectrical();
    plan.roomData = (data.roomData ?? []).map((r: any) => ({
      id: r.id || crypto.randomUUID(),
      number: r.number ?? 1,
      name: r.name ?? '',
      centroid: { x: r.centroid?.x ?? 0, y: r.centroid?.y ?? 0 },
      area: r.area ?? 0,
    }));

    return plan;
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
