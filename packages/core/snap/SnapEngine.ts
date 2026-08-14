import { Vector2 } from '../geometry/Vector2';
import { projectPointToSegment, segmentsIntersection, lineIntersection, pointInPolygon } from '../geometry/Geometry';
import { Room } from '../geometry/RoomDetector';
import { Camera } from '../engine/Camera';
import { Plan } from '../model/Plan';
import { Wall } from '../model/Wall';
import { DrawingPrimitive } from '../model/DrawingPrimitive';

export type SnapType =
  | 'endpoint'
  | 'midpoint'
  | 'center'
  | 'intersection'
  | 'extension'
  | 'wall-line'
  | 'primitive-line'
  | 'tracking'
  | 'grid';

/** Типы привязки, которые «захватываются» (липкая точка с лучами). */
const ACQUIRABLE_TYPES: SnapType[] = ['endpoint', 'midpoint', 'center', 'intersection', 'extension'];

export interface SnapGuide {
  point: Vector2;
  type: SnapType;
  wall?: Wall;
  wall2?: Wall;
  /** Привязка произошла к этому примитиву (для подсветки). */
  primitive?: DrawingPrimitive;
}

export interface SnapResult {
  point: Vector2;
  type: SnapType;
  wall?: Wall;
  /** Вторая стена — для intersection (направляющие по обеим осям). */
  wall2?: Wall;
  openingId?: string;
  /** Ближайший конец стены для extension — отрисовка пунктирной направляющей. */
  extensionFrom?: Vector2;
  /** Захваченные точки привязки (до двух) — от них рисуются лучи. */
  guides?: SnapGuide[];
  /** Привязка произошла к этому примитиву (для подсветки). */
  primitive?: DrawingPrimitive;
  /** Ребро примитива, к которому произошла привязка к линии (для подсветки). */
  primitiveEdge?: { a: Vector2; b: Vector2 };
  /** Окружность примитива, к которой произошла привязка к линии (для подсветки). */
  primitiveCircle?: { center: Vector2; radius: number };
}

/**
 * Примагничивание точки к сетке, стенам и объектным привязкам
 * (конец, середина, центр, пересечение, продолжение).
 * Пороги заданы в экранных пикселях и пересчитываются в мм через scale камеры.
 */
export class SnapEngine {
  // Пороги в экранных пикселях
  private endpointThresholdPx = 15;
  private objectThresholdPx = 12;
  private lineThresholdPx = 12;
  private extensionThresholdPx = 10;
  private wallAttachThresholdPx = 20;
  private trackingThresholdPx = 10;
  /** Макс. расстояние от конца стены, где работает продолжение (мм). */
  private extensionMaxDistMm = 2000;

  /** Захваченные («липкие») точки привязки (до двух) — лучи остаются при отводе курсора. */
  private acquired: SnapGuide[] = [];
  private static readonly MAX_ACQUIRED = 2;

  constructor(private plan: Plan, private camera: Camera) {}

  /** Сбросить захваченные точки привязки (Escape, смена инструмента). */
  clearTracking(): void {
    this.acquired = [];
  }

  /** Добавить точку в захваченные (максимум MAX_ACQUIRED, старейшая вытесняется). */
  private acquire(guide: SnapGuide): void {
    const eps = 1; // мм
    this.acquired = this.acquired.filter(g => g.point.distanceTo(guide.point) > eps);
    this.acquired.push(guide);
    while (this.acquired.length > SnapEngine.MAX_ACQUIRED) {
      this.acquired.shift();
    }
  }

  /** Направления лучей от одной захваченной точки: оси X/Y + оси стен. */
  private guideDirs(guide: SnapGuide): Vector2[] {
    const dirs = [new Vector2(1, 0), new Vector2(0, 1)];
    for (const w of [guide.wall, guide.wall2]) {
      if (!w) continue;
      const d = w.b.sub(w.a);
      if (d.length() > 1e-9) {
        dirs.push(d.normalized());
        dirs.push(d.normalized().perpendicular());
      }
    }
    return dirs;
  }

  /** Центроид комнаты по площади (с вычетом внутренних вырезов). */
  private roomCentroid(room: Room): Vector2 {
    const part = (poly: Vector2[]): { c: Vector2; a: number } => {
      let a = 0;
      let cx = 0;
      let cy = 0;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const w = poly[j].x * poly[i].y - poly[i].x * poly[j].y;
        a += w;
        cx += (poly[j].x + poly[i].x) * w;
        cy += (poly[j].y + poly[i].y) * w;
      }
      a /= 2;
      if (Math.abs(a) < 1e-9) {
        return { c: poly[0]?.clone() ?? new Vector2(0, 0), a: 0 };
      }
      return { c: new Vector2(cx / (6 * a), cy / (6 * a)), a: Math.abs(a) };
    };

    const outer = part(room.polygon);
    let area = outer.a;
    let sx = outer.c.x * outer.a;
    let sy = outer.c.y * outer.a;
    for (const hole of room.holes) {
      const h = part(hole);
      area -= h.a;
      sx -= h.c.x * h.a;
      sy -= h.c.y * h.a;
    }
    return area > 0 ? new Vector2(sx / area, sy / area) : outer.c;
  }

  /**
   * Найти ближайшую snap-точку для экранной точки.
   * Если snap не найден — всё равно возвращает точку, примагниченную к сетке.
   */
  snap(screenPoint: Vector2, options?: { noGrid?: boolean; wallOnly?: boolean }): SnapResult {
    const world = this.camera.screenToWorld(screenPoint);
    let best: SnapResult | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    /** Центроид комнаты под курсором — для отображения направляющих. */
    let roomCenterGuide: SnapGuide | null = null;

    const consider = (candidate: SnapResult, distPx: number, penalty: number): void => {
      const score = distPx + penalty;
      if (score < bestScore) {
        best = candidate;
        bestScore = score;
      }
    };

    if (!options?.wallOnly) {
      // 1. Концы стен
      for (const wall of this.plan.walls) {
        for (const end of [wall.a, wall.b]) {
          const screenEnd = this.camera.worldToScreen(end);
          const distPx = screenEnd.distanceTo(screenPoint);
          if (distPx < this.endpointThresholdPx) {
            consider({ point: end.clone(), type: 'endpoint', wall }, distPx, 0);
          }
        }
      }

      // 2. Середины стен
      for (const wall of this.plan.walls) {
        const mid = wall.a.add(wall.b).scale(0.5);
        const distPx = this.camera.worldToScreen(mid).distanceTo(screenPoint);
        if (distPx < this.objectThresholdPx) {
          consider({ point: mid, type: 'midpoint', wall }, distPx, 40);
        }
      }

      // 3. Центры: дуговые стены + устройства
      for (const wall of this.plan.walls) {
        if (!wall.arc) continue;
        const distPx = this.camera.worldToScreen(wall.arc.center).distanceTo(screenPoint);
        if (distPx < this.objectThresholdPx) {
          consider({ point: wall.arc.center.clone(), type: 'center', wall }, distPx, 40);
        }
      }
      for (const device of this.plan.devices) {
        const pos = this.plan.deviceWorldPosition(device);
        const distPx = this.camera.worldToScreen(pos).distanceTo(screenPoint);
        if (distPx < this.objectThresholdPx) {
          consider({ point: pos, type: 'center' }, distPx, 40);
        }
      }

      // 3.5. Центр комнаты — при наведении внутрь комнаты (для расстановки светильников)
      for (const room of this.plan.getRooms()) {
        if (!pointInPolygon(world, room.polygon)) continue;
        if (room.holes.some(h => pointInPolygon(world, h))) continue;
        const c = this.roomCentroid(room);
        // Направляющие центра показываем в любой точке комнаты
        roomCenterGuide = { point: c, type: 'center' };
        // Привязка к центру — только вблизи него
        const distPx = this.camera.worldToScreen(c).distanceTo(screenPoint);
        if (distPx < this.objectThresholdPx) {
          consider({ point: c, type: 'center' }, distPx, 40);
        }
        break;
      }

      // 3.6. Примитивы рисования — концы, середины, центры, грани
      for (const primitive of this.plan.primitives) {
        if (primitive.type === 'segment') {
          const [a, b] = primitive.points;
          if (!a || !b) continue;
          for (const end of [a, b]) {
            const distPx = this.camera.worldToScreen(end).distanceTo(screenPoint);
            if (distPx < this.endpointThresholdPx) {
              consider({ point: end.clone(), type: 'endpoint', primitive }, distPx, 0);
            }
          }
          const mid = a.add(b).scale(0.5);
          const distPx = this.camera.worldToScreen(mid).distanceTo(screenPoint);
          if (distPx < this.objectThresholdPx) {
            consider({ point: mid, type: 'midpoint', primitive }, distPx, 40);
          }
        } else if (primitive.type === 'polyline') {
          const pts = primitive.points;
          for (let i = 0; i < pts.length; i++) {
            const p = pts[i];
            if (!p) continue;
            const distPx = this.camera.worldToScreen(p).distanceTo(screenPoint);
            if (distPx < this.endpointThresholdPx) {
              consider({ point: p.clone(), type: 'endpoint', primitive }, distPx, 0);
            }
            if (i > 0) {
              const prev = pts[i - 1];
              if (!prev) continue;
              const mid = p.add(prev).scale(0.5);
              const distPx = this.camera.worldToScreen(mid).distanceTo(screenPoint);
              if (distPx < this.objectThresholdPx) {
                consider({ point: mid, type: 'midpoint', primitive }, distPx, 40);
              }
            }
          }
        } else if (primitive.type === 'rectangle') {
          const [min, max] = primitive.points;
          if (!min || !max) continue;
          const corners = [
            min.clone(),
            new Vector2(max.x, min.y),
            max.clone(),
            new Vector2(min.x, max.y),
          ];
          for (const p of corners) {
            const distPx = this.camera.worldToScreen(p).distanceTo(screenPoint);
            if (distPx < this.endpointThresholdPx) {
              consider({ point: p.clone(), type: 'endpoint', primitive }, distPx, 0);
            }
          }
          const edges: Array<[Vector2, Vector2]> = [
            [corners[0], corners[1]],
            [corners[1], corners[2]],
            [corners[2], corners[3]],
            [corners[3], corners[0]],
          ];
          for (const [a, b] of edges) {
            const mid = a.add(b).scale(0.5);
            const distPx = this.camera.worldToScreen(mid).distanceTo(screenPoint);
            if (distPx < this.objectThresholdPx) {
              consider({ point: mid, type: 'midpoint', primitive }, distPx, 40);
            }
          }
          const center = min.add(max).scale(0.5);
          const distPx = this.camera.worldToScreen(center).distanceTo(screenPoint);
          if (distPx < this.objectThresholdPx) {
            consider({ point: center, type: 'center', primitive }, distPx, 40);
          }
        } else if (primitive.type === 'circle') {
          const [center, rim] = primitive.points;
          if (!center) continue;
          const distPx = this.camera.worldToScreen(center).distanceTo(screenPoint);
          if (distPx < this.objectThresholdPx) {
            consider({ point: center.clone(), type: 'center', primitive }, distPx, 40);
          }
          const radius = rim ? center.distanceTo(rim) : 0;
          if (radius > 0) {
            const rimPoints = [
              rim.clone(),
              center.add(new Vector2(radius, 0)),
              center.add(new Vector2(-radius, 0)),
              center.add(new Vector2(0, radius)),
              center.add(new Vector2(0, -radius)),
            ];
            for (const p of rimPoints) {
              const distPx = this.camera.worldToScreen(p).distanceTo(screenPoint);
              if (distPx < this.endpointThresholdPx) {
                consider({ point: p.clone(), type: 'endpoint', primitive }, distPx, 0);
              }
            }
          }
        }
      }

      // 3.7. Привязка к линиям/граням/окружностям примитивов
      for (const primitive of this.plan.primitives) {
        if (primitive.type === 'segment') {
          const [a, b] = primitive.points;
          if (!a || !b) continue;
          const proj = projectPointToSegment(world, a, b);
          if (proj.t <= 0 || proj.t >= 1) continue;
          const screenProj = this.camera.worldToScreen(proj.point);
          const distPx = screenProj.distanceTo(screenPoint);
          if (distPx < this.lineThresholdPx) {
            consider(
              { point: proj.point, type: 'primitive-line', primitive, primitiveEdge: { a: a.clone(), b: b.clone() } },
              distPx,
              100,
            );
          }
        } else if (primitive.type === 'polyline') {
          const pts = primitive.points;
          let bestProj: { point: Vector2; a: Vector2; b: Vector2; distPx: number } | null = null;
          for (let i = 1; i < pts.length; i++) {
            const prev = pts[i - 1];
            const curr = pts[i];
            if (!prev || !curr) continue;
            const proj = projectPointToSegment(world, prev, curr);
            if (proj.t <= 0 || proj.t >= 1) continue;
            const screenProj = this.camera.worldToScreen(proj.point);
            const distPx = screenProj.distanceTo(screenPoint);
            if (distPx < this.lineThresholdPx && (!bestProj || distPx < bestProj.distPx)) {
              bestProj = { point: proj.point, a: prev.clone(), b: curr.clone(), distPx };
            }
          }
          if (bestProj) {
            consider(
              { point: bestProj.point, type: 'primitive-line', primitive, primitiveEdge: { a: bestProj.a, b: bestProj.b } },
              bestProj.distPx,
              100,
            );
          }
        } else if (primitive.type === 'rectangle') {
          const [min, max] = primitive.points;
          if (!min || !max) continue;
          const corners = [
            min.clone(),
            new Vector2(max.x, min.y),
            max.clone(),
            new Vector2(min.x, max.y),
          ];
          const edges: Array<[Vector2, Vector2]> = [
            [corners[0], corners[1]],
            [corners[1], corners[2]],
            [corners[2], corners[3]],
            [corners[3], corners[0]],
          ];
          let bestProj: { point: Vector2; a: Vector2; b: Vector2; distPx: number } | null = null;
          for (const [a, b] of edges) {
            const proj = projectPointToSegment(world, a, b);
            if (proj.t <= 0 || proj.t >= 1) continue;
            const screenProj = this.camera.worldToScreen(proj.point);
            const distPx = screenProj.distanceTo(screenPoint);
            if (distPx < this.lineThresholdPx && (!bestProj || distPx < bestProj.distPx)) {
              bestProj = { point: proj.point, a: a.clone(), b: b.clone(), distPx };
            }
          }
          if (bestProj) {
            consider(
              { point: bestProj.point, type: 'primitive-line', primitive, primitiveEdge: { a: bestProj.a, b: bestProj.b } },
              bestProj.distPx,
              100,
            );
          }
        } else if (primitive.type === 'circle') {
          const [center, rim] = primitive.points;
          if (!center || !rim) continue;
          const radius = center.distanceTo(rim);
          if (radius <= 0) continue;
          const dir = world.sub(center);
          const distWorld = Math.abs(dir.length() - radius);
          const distPx = distWorld * this.camera.scale;
          if (distPx < this.lineThresholdPx) {
            const nearest = center.add(dir.normalized().scale(radius));
            consider(
              { point: nearest, type: 'primitive-line', primitive, primitiveCircle: { center: center.clone(), radius } },
              distPx,
              100,
            );
          }
        }
      }

      // 4. Пересечения осевых линий стен
      const walls = this.plan.walls;
      for (let i = 0; i < walls.length; i++) {
        for (let j = i + 1; j < walls.length; j++) {
          const p = segmentsIntersection(walls[i].a, walls[i].b, walls[j].a, walls[j].b);
          if (!p) continue;
          const distPx = this.camera.worldToScreen(p).distanceTo(screenPoint);
          if (distPx < this.objectThresholdPx) {
            consider({ point: p, type: 'intersection', wall: walls[i], wall2: walls[j] }, distPx, 40);
          }
        }
      }

      // 5. Линии стен (проекция)
      for (const wall of this.plan.walls) {
        const proj = projectPointToSegment(world, wall.a, wall.b);
        const screenProj = this.camera.worldToScreen(proj.point);
        const distPx = screenProj.distanceTo(screenPoint);
        if (proj.t > 0 && proj.t < 1 && distPx < this.lineThresholdPx) {
          consider({ point: proj.point, type: 'wall-line', wall }, distPx, 100);
        }
      }

      // 6. Продолжение стены за её концы
      for (const wall of this.plan.walls) {
        const v = wall.b.sub(wall.a);
        const lenSq = v.dot(v);
        if (lenSq === 0) continue;
        const t = world.sub(wall.a).dot(v) / lenSq;
        if (t >= 0 && t <= 1) continue; // внутри сегмента — это wall-line
        const projPoint = wall.a.add(v.scale(t));
        // Ограничиваем дальность продолжения
        const nearestEnd = t < 0 ? wall.a : wall.b;
        if (projPoint.distanceTo(nearestEnd) > this.extensionMaxDistMm) continue;
        const distPx = this.camera.worldToScreen(projPoint).distanceTo(screenPoint);
        if (distPx < this.extensionThresholdPx) {
          consider(
            { point: projPoint, type: 'extension', wall, extensionFrom: nearestEnd.clone() },
            distPx,
            120,
          );
        }
      }
    } else {
      // wallOnly — только ближайшая стена
      for (const wall of this.plan.walls) {
        const proj = projectPointToSegment(world, wall.a, wall.b);
        const screenProj = this.camera.worldToScreen(proj.point);
        const distPx = screenProj.distanceTo(screenPoint);
        if (distPx < this.wallAttachThresholdPx) {
          consider({ point: proj.point, type: 'wall-line', wall }, distPx, 0);
        }
      }
    }

    // 7. Сетка (всегда)
    if (!options?.noGrid) {
      const gridStep = this.camera.scale < 0.05 ? 100 : 50; // мм
      const gridPoint = new Vector2(
        Math.round(world.x / gridStep) * gridStep,
        Math.round(world.y / gridStep) * gridStep,
      );
      const screenGrid = this.camera.worldToScreen(gridPoint);
      const distPx = screenGrid.distanceTo(screenPoint);
      const score = distPx + 200; // сетка низший приоритет
      if (score < bestScore || best === null) {
        best = { point: gridPoint, type: 'grid' };
        bestScore = score;
      }
    }

    const result = best ?? { point: world, type: 'grid' as SnapType };

    // 8. Липкая привязка (tracking): захват до двух точек, лучи от них
    if (!options?.wallOnly) {
      if (ACQUIRABLE_TYPES.includes(result.type)) {
        // Новый захват: запоминаем точку (максимум две, старейшая вытесняется)
        this.acquire({
          point: result.point.clone(),
          type: result.type,
          wall: result.wall,
          wall2: result.wall2,
        });
      } else if (this.acquired.length > 0) {
        let tracking: SnapResult | null = null;
        let trackingDistPx = this.trackingThresholdPx;

        // Привязка к пересечению лучей двух захваченных точек
        if (this.acquired.length === 2) {
          const [g1, g2] = this.acquired;
          for (const d1 of this.guideDirs(g1)) {
            for (const d2 of this.guideDirs(g2)) {
              const p = lineIntersection(g1.point, g1.point.add(d1), g2.point, g2.point.add(d2));
              if (!p) continue;
              const distPx = this.camera.worldToScreen(p).distanceTo(screenPoint);
              if (distPx < trackingDistPx) {
                trackingDistPx = distPx;
                tracking = { point: p, type: 'tracking' };
              }
            }
          }
        }

        // Привязка к одиночному лучу захваченной точки
        if (!tracking) {
          for (const guide of this.acquired) {
            for (const dir of this.guideDirs(guide)) {
              const rel = world.sub(guide.point);
              const proj = guide.point.add(dir.scale(rel.dot(dir)));
              const distPx = this.camera.worldToScreen(proj).distanceTo(screenPoint);
              if (distPx < trackingDistPx) {
                trackingDistPx = distPx;
                tracking = { point: proj, type: 'tracking' };
              }
            }
          }
        }

        if (tracking && (result.type === 'grid' || result.type === 'wall-line')) {
          tracking.guides = this.collectGuides(roomCenterGuide);
          return tracking;
        }
      }

      // Лучи остаются от захваченных точек (+ центр комнаты под курсором)
      const guides = this.collectGuides(roomCenterGuide);
      if (guides.length > 0) {
        result.guides = guides;
      }
    }

    return result;
  }

  /** Захваченные точки + центроид комнаты под курсором (без дубликатов). */
  private collectGuides(roomCenterGuide: SnapGuide | null): SnapGuide[] {
    const guides = this.acquired.map(g => ({ ...g, point: g.point.clone() }));
    if (roomCenterGuide && !guides.some(g => g.point.distanceTo(roomCenterGuide.point) < 1)) {
      guides.push(roomCenterGuide);
    }
    return guides;
  }

  /** Найти ближайшую стену к точке (для размещения проема). */
  findNearestWall(screenPoint: Vector2): { wall: Wall; point: Vector2; t: number } | null {
    const world = this.camera.screenToWorld(screenPoint);
    const thresholdWorld = this.wallAttachThresholdPx / this.camera.scale;

    // Запрашиваем у quadtree стены в окрестности точки
    const tree = this.plan.getWallQuadtree();
    const candidates = tree.query({
      min: new Vector2(world.x - thresholdWorld, world.y - thresholdWorld),
      max: new Vector2(world.x + thresholdWorld, world.y + thresholdWorld),
    });

    let best: { wall: Wall; point: Vector2; t: number; distPx: number } | null = null;

    for (const wall of candidates) {
      const proj = projectPointToSegment(world, wall.a, wall.b);
      const screenProj = this.camera.worldToScreen(proj.point);
      const distPx = screenProj.distanceTo(screenPoint);
      if (distPx < this.wallAttachThresholdPx) {
        if (!best || distPx < best.distPx) {
          best = { wall, point: proj.point, t: proj.t, distPx };
        }
      }
    }

    return best;
  }
}
