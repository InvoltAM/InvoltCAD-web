import { Vector2 } from '../geometry/Vector2';
import { projectPointToSegment } from '../geometry/Geometry';
import { Camera } from '../engine/Camera';
import { Plan } from '../model/Plan';
import { Wall } from '../model/Wall';

export type SnapType = 'endpoint' | 'wall-line' | 'grid';

export interface SnapResult {
  point: Vector2;
  type: SnapType;
  wall?: Wall;
  openingId?: string;
}

/**
 * Примагничивание точки к сетке, стенам и концам стен.
 * Пороги заданы в экранных пикселях и пересчитываются в мм через scale камеры.
 */
export class SnapEngine {
  // Пороги в экранных пикселях
  private endpointThresholdPx = 15;
  private lineThresholdPx = 12;
  private wallAttachThresholdPx = 20;

  constructor(private plan: Plan, private camera: Camera) {}

  /**
   * Найти ближайшую snap-точку для экранной точки.
   * Если snap не найден — всё равно возвращает точку, примагниченную к сетке.
   */
  snap(screenPoint: Vector2, options?: { noGrid?: boolean; wallOnly?: boolean }): SnapResult {
    const world = this.camera.screenToWorld(screenPoint);
    let best: SnapResult | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    if (!options?.wallOnly) {
      // 1. Концы стен
      for (const wall of this.plan.walls) {
        for (const end of [wall.a, wall.b]) {
          const screenEnd = this.camera.worldToScreen(end);
          const distPx = screenEnd.distanceTo(screenPoint);
          if (distPx < this.endpointThresholdPx) {
            const score = distPx;
            if (score < bestScore) {
              best = { point: end.clone(), type: 'endpoint' };
              bestScore = score;
            }
          }
        }
      }

      // 2. Линии стен (проекция)
      for (const wall of this.plan.walls) {
        const proj = projectPointToSegment(world, wall.a, wall.b);
        const screenProj = this.camera.worldToScreen(proj.point);
        const distPx = screenProj.distanceTo(screenPoint);
        if (proj.t > 0 && proj.t < 1 && distPx < this.lineThresholdPx) {
          const score = distPx + 100; // endpoint приоритетнее
          if (score < bestScore) {
            best = { point: proj.point, type: 'wall-line', wall };
            bestScore = score;
          }
        }
      }
    } else {
      // wallOnly — только ближайшая стена
      for (const wall of this.plan.walls) {
        const proj = projectPointToSegment(world, wall.a, wall.b);
        const screenProj = this.camera.worldToScreen(proj.point);
        const distPx = screenProj.distanceTo(screenPoint);
        if (distPx < this.wallAttachThresholdPx) {
          const score = distPx;
          if (score < bestScore) {
            best = { point: proj.point, type: 'wall-line', wall };
            bestScore = score;
          }
        }
      }
    }

    // 3. Сетка (всегда)
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

    return best ?? { point: world, type: 'grid' };
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
