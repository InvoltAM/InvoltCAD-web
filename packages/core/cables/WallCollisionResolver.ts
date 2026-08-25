import { Vector2 } from '../geometry/Vector2';
import { Plan } from '../model/Plan';
import { Wall, wallDirection } from '../model/Wall';
import { segmentsIntersection } from '../geometry/Geometry';
import { distanceToWallSurface, isPointInSafeZone, SafeZone, getBlockSafeZones } from './CableValidator';

const MIN_CLEARANCE = 400; // мм
const CONNECTOR_CLEARANCE = 100; // мм

export interface PointResolution {
  point: Vector2;
  blocked: boolean;
  message?: string;
}

export interface SegmentResolution {
  end: Vector2;
  hitWall: boolean;
  hitPoint?: Vector2;
}

/**
 * Разрешает коллизии кабеля со стенами при интерактивном рисовании.
 * Не позволяет точке зайти внутрь стены и/или ближе допустимого зазора.
 */
export class WallCollisionResolver {
  private walls: Wall[];
  private safeZones: SafeZone[];

  constructor(plan: Plan) {
    this.walls = plan.walls;
    this.safeZones = getBlockSafeZones(plan);
  }

  /**
   * Проверяет, можно ли поставить точку кабеля в данной позиции.
   * Возвращает скорректированную позицию (clamped к поверхности + зазор).
   */
  resolvePoint(proposedPoint: Vector2, isConnector: boolean): PointResolution {
    const required = isConnector ? CONNECTOR_CLEARANCE : MIN_CLEARANCE;

    if (this.safeZones.some((z) => isPointInSafeZone(proposedPoint, z))) {
      return { point: proposedPoint.clone(), blocked: false };
    }

    for (const wall of this.walls) {
      const { distance, projection, closestPoint } = distanceToWallSurface(proposedPoint, wall);
      if (projection < 0 || projection > 1) continue;

      if (distance < 0) {
        // Точка внутри материала стены — абсолютный запрет
        const normalDir = proposedPoint.sub(closestPoint).normalized();
        const clampedPoint = closestPoint.add(normalDir.scale(required));
        return {
          point: clampedPoint,
          blocked: true,
          message: 'Кабель не может проходить внутри стены',
        };
      }

      if (distance < required - 1e-6) {
        const normalDir = proposedPoint.sub(closestPoint).normalized();
        const clampedPoint = closestPoint.add(normalDir.scale(required));
        return { point: clampedPoint, blocked: false };
      }
    }

    return { point: proposedPoint.clone(), blocked: false };
  }

  /**
   * Проверяет сегмент: если он пересекает стену, возвращает точку остановки
   * перед поверхностью стены (с небольшим запасом).
   */
  resolveSegment(segStart: Vector2, proposedEnd: Vector2): SegmentResolution {
    for (const wall of this.walls) {
      const halfThick = wall.thickness / 2;
      const dir = wallDirection(wall);
      const n = dir.perpendicular();
      const w1 = wall.a.add(n.scale(halfThick));
      const w2 = wall.b.add(n.scale(halfThick));
      const w3 = wall.b.sub(n.scale(halfThick));
      const w4 = wall.a.sub(n.scale(halfThick));
      const edges: [Vector2, Vector2][] = [
        [w1, w2],
        [w2, w3],
        [w3, w4],
        [w4, w1],
      ];

      for (const [edgeStart, edgeEnd] of edges) {
        const hit = segmentsIntersection(segStart, proposedEnd, edgeStart, edgeEnd);
        if (hit) {
          const dirVec = proposedEnd.sub(segStart);
          const len = dirVec.length();
          if (len < 1e-9) return { end: proposedEnd.clone(), hitWall: true, hitPoint: hit };
          const stopPoint = hit.sub(dirVec.scale(50 / len));
          return { end: stopPoint, hitWall: true, hitPoint: hit };
        }
      }
    }

    return { end: proposedEnd.clone(), hitWall: false };
  }
}
