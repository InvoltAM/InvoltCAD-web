import { Vector2 } from '../geometry/Vector2';
import { Plan } from '../model/Plan';
import { Cable } from '../model/Cable';
import { Wall, wallLength, wallDirection } from '../model/Wall';
import { Opening } from '../model/Opening';
import { Device } from '../model/Device';
import { projectPointToSegment } from '../geometry/Geometry';
import { segmentCrossesWallOutsideOpening, straightSegmentIsAllowed, WALL_CLEARANCE, CONNECTOR_CLEARANCE } from './cableRouting';

export interface SafeZone {
  center: Vector2;
  halfSize: number;
}

export interface ClearanceViolation {
  segmentIndex: number;
  point: Vector2;
  wall: Wall;
  distance: number;
  required: number;
}

export interface IntersectionViolation {
  segmentIndex: number;
  wall: Wall;
  intersectionPoint: Vector2;
}

export interface DoorwayViolation {
  segmentIndex: number;
  point: Vector2;
  opening: Opening;
}

export interface InsideWallViolation {
  segmentIndex: number;
  wall: Wall;
  point: Vector2;
}

export interface CableValidationResult {
  valid: boolean;
  clearanceViolations: ClearanceViolation[];
  intersectionViolations: IntersectionViolation[];
  doorwayViolations: DoorwayViolation[];
  insideWallViolations: InsideWallViolation[];
}

export type ValidationMode = 'strict' | 'user';

const SAFE_ZONE_HALF = 250; // 50×50 см → половина 25 см = 250 мм

export function getBlockSafeZone(block: Device): SafeZone {
  const pos = block.position ? new Vector2(block.position.x, block.position.y) : new Vector2(0, 0);
  return { center: pos, halfSize: SAFE_ZONE_HALF };
}

export function getBlockSafeZones(plan: Plan): SafeZone[] {
  return plan.devices.map(getBlockSafeZone);
}

export function isPointInSafeZone(point: Vector2, zone: SafeZone): boolean {
  return (
    Math.abs(point.x - zone.center.x) <= zone.halfSize &&
    Math.abs(point.y - zone.center.y) <= zone.halfSize
  );
}

export function segmentIntersectsSafeZone(a: Vector2, b: Vector2, zone: SafeZone): boolean {
  if (isPointInSafeZone(a, zone) || isPointInSafeZone(b, zone)) return true;
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const zoneMinX = zone.center.x - zone.halfSize;
  const zoneMaxX = zone.center.x + zone.halfSize;
  const zoneMinY = zone.center.y - zone.halfSize;
  const zoneMaxY = zone.center.y + zone.halfSize;
  return maxX >= zoneMinX && minX <= zoneMaxX && maxY >= zoneMinY && minY <= zoneMaxY;
}

export function distanceToWallSurface(point: Vector2, wall: Wall): { distance: number; projection: number; closestPoint: Vector2 } {
  const { point: closest, t } = projectPointToSegment(point, wall.a, wall.b);
  const distToAxis = point.distanceTo(closest);
  const distToSurface = distToAxis - wall.thickness / 2;
  return { distance: distToSurface, projection: t, closestPoint: closest };
}

export function isPointInsideWall(point: Vector2, wall: Wall): boolean {
  const { distance, projection } = distanceToWallSurface(point, wall);
  return distance < -1e-6 && projection >= 0 && projection <= 1;
}

export function pointInDoorway(point: Vector2, opening: Opening, wall: Wall): boolean {
  const { projection } = distanceToWallSurface(point, wall);
  const len = wallLength(wall);
  if (len < 1e-9) return false;
  const distOnWall = Math.abs(projection - opening.t) * len;
  return distOnWall < opening.width / 2 + 1e-3;
}

export function isPointInDoorwaySafePath(point: Vector2, opening: Opening, wall: Wall): boolean {
  const { projection } = distanceToWallSurface(point, wall);
  const len = wallLength(wall);
  if (len < 1e-9) return false;
  const distOnWall = Math.abs(projection - opening.t) * len;
  const safeHalf = Math.max(0, opening.width / 2 - 100); // DOORWAY_MARGIN = 100 мм
  return distOnWall <= safeHalf + 1e-3;
}

export function checkSegmentClearance(
  a: Vector2,
  b: Vector2,
  wall: Wall,
  openings: Opening[],
  safeZones: SafeZone[],
  required: number,
): ClearanceViolation[] {
  const violations: ClearanceViolation[] = [];
  const points = 8;
  for (let i = 0; i <= points; i++) {
    const t = i / points;
    const point = a.add(b.sub(a).scale(t));

    if (safeZones.some((z) => isPointInSafeZone(point, z))) continue;

    const inDoorway = openings.some((o) => o.type === 'door' && pointInDoorway(point, o, wall));
    if (inDoorway) continue;

    const { distance, projection } = distanceToWallSurface(point, wall);
    if (distance < required - 1e-6) {
      violations.push({ segmentIndex: -1, point: point.clone(), wall, distance, required });
    }
  }
  return violations;
}

export function checkSegmentWallIntersection(
  a: Vector2,
  b: Vector2,
  wall: Wall,
  opening?: Opening,
): IntersectionViolation | null {
  const halfThick = wall.thickness / 2;
  const dir = wallDirection(wall);
  const n = dir.perpendicular();
  const w1 = wall.a.add(n.scale(halfThick));
  const w2 = wall.b.add(n.scale(halfThick));
  const w3 = wall.b.sub(n.scale(halfThick));
  const w4 = wall.a.sub(n.scale(halfThick));
  const edges = [
    [w1, w2],
    [w2, w3],
    [w3, w4],
    [w4, w1],
  ] as [Vector2, Vector2][];

  for (const [edgeStart, edgeEnd] of edges) {
    const intersection = segmentsIntersect(a, b, edgeStart, edgeEnd);
    if (intersection.intersect && intersection.point) {
      if (opening && opening.type === 'door') {
        const len = wallLength(wall);
        if (len > 0) {
          const tOnWall = intersection.point.sub(wall.a).dot(dir) / len;
          const distOnWall = Math.abs(tOnWall - opening.t) * len;
          if (distOnWall < opening.width / 2 + 1e-3) continue;
        }
      }
      return { segmentIndex: -1, wall, intersectionPoint: intersection.point };
    }
  }
  return null;
}

function ccw(A: Vector2, B: Vector2, C: Vector2): boolean {
  return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
}

function segmentsIntersect(
  a1: Vector2,
  a2: Vector2,
  b1: Vector2,
  b2: Vector2,
): { intersect: boolean; point?: Vector2 } {
  if (ccw(a1, b1, b2) !== ccw(a2, b1, b2) && ccw(a1, a2, b1) !== ccw(a1, a2, b2)) {
    const d1 = a2.sub(a1);
    const d2 = b2.sub(b1);
    const cross = d1.x * d2.y - d1.y * d2.x;
    if (Math.abs(cross) < 1e-10) return { intersect: false };
    const t1 = ((b1.x - a1.x) * d2.y - (b1.y - a1.y) * d2.x) / cross;
    return { intersect: true, point: a1.add(d1.scale(t1)) };
  }
  return { intersect: false };
}

export function checkDoorwayRestrictedZone(
  a: Vector2,
  b: Vector2,
  opening: Opening,
  wall: Wall,
): DoorwayViolation[] {
  const violations: DoorwayViolation[] = [];
  const points = 6;
  for (let i = 0; i <= points; i++) {
    const t = i / points;
    const point = a.add(b.sub(a).scale(t));
    if (!pointInDoorway(point, opening, wall)) continue;
    if (!isPointInDoorwaySafePath(point, opening, wall)) {
      violations.push({ segmentIndex: -1, point: point.clone(), opening });
    }
  }
  return violations;
}

export function checkSegmentInsideWall(
  a: Vector2,
  b: Vector2,
  wall: Wall,
  opening?: Opening,
  safeZones?: SafeZone[],
): InsideWallViolation[] {
  const violations: InsideWallViolation[] = [];
  const points = 6;
  for (let i = 0; i <= points; i++) {
    const t = i / points;
    const point = a.add(b.sub(a).scale(t));
    if (safeZones?.some((z) => isPointInSafeZone(point, z))) continue;
    if (!isPointInsideWall(point, wall)) continue;
    if (opening && opening.type === 'door' && pointInDoorway(point, opening, wall)) continue;
    violations.push({ segmentIndex: -1, wall, point: point.clone() });
  }
  return violations;
}

export function validateCable(
  plan: Plan,
  cable: Cable,
  mode: ValidationMode = 'strict',
  blocks: Device[] = [],
): CableValidationResult {
  if (mode === 'user') {
    return {
      valid: true,
      clearanceViolations: [],
      intersectionViolations: [],
      doorwayViolations: [],
      insideWallViolations: [],
    };
  }

  const result: CableValidationResult = {
    valid: true,
    clearanceViolations: [],
    intersectionViolations: [],
    doorwayViolations: [],
    insideWallViolations: [],
  };

  const safeZones = blocks.map(getBlockSafeZone);
  const n = cable.route.length;

  for (let i = 0; i < n - 1; i++) {
    const start = cable.route[i];
    const end = cable.route[i + 1];
    const isConnector = i < 2 || i >= n - 1 - 2;
    const required = isConnector ? CONNECTOR_CLEARANCE : WALL_CLEARANCE;

    // Отступ от стен (connector-сегменты не проверяются — допускается 100 мм)
    if (!isConnector) {
      for (const wall of plan.walls) {
        const wallOpenings = wall.openings.filter((o) => o.type === 'door');
        const clearance = checkSegmentClearance(start, end, wall, wallOpenings, safeZones, required);
        for (const v of clearance) {
          v.segmentIndex = i;
          result.clearanceViolations.push(v);
        }
      }
    }

    // Пересечение со стеной
    for (const wall of plan.walls) {
      const opening = wall.openings.find((o) => o.type === 'door');
      const violation = checkSegmentWallIntersection(start, end, wall, opening);
      if (violation) {
        violation.segmentIndex = i;
        result.intersectionViolations.push(violation);
      }
    }

    // Doorway Restricted Zone
    for (const wall of plan.walls) {
      for (const opening of wall.openings) {
        if (opening.type !== 'door') continue;
        const dw = checkDoorwayRestrictedZone(start, end, opening, wall);
        for (const v of dw) {
          v.segmentIndex = i;
          result.doorwayViolations.push(v);
        }
      }
    }

    // Кабель внутри стены
    for (const wall of plan.walls) {
      const opening = wall.openings.find((o) => o.type === 'door');
      const iw = checkSegmentInsideWall(start, end, wall, opening, safeZones);
      for (const v of iw) {
        v.segmentIndex = i;
        result.insideWallViolations.push(v);
      }
    }
  }

  result.valid =
    result.clearanceViolations.length === 0 &&
    result.intersectionViolations.length === 0 &&
    result.doorwayViolations.length === 0 &&
    result.insideWallViolations.length === 0;

  return result;
}

export function cableValidationResultValid(result: CableValidationResult): boolean {
  return result.valid;
}

/**
 * Визуально подсвечивает найденные нарушения на холсте.
 */
export function highlightCableViolations(
  ctx: CanvasRenderingContext2D,
  result: CableValidationResult,
  camera: import('../engine/Camera').Camera,
): void {
  // Нарушения отступа — красные круги
  ctx.fillStyle = 'rgba(231, 76, 60, 0.7)';
  for (const v of result.clearanceViolations) {
    const s = camera.worldToScreen(v.point);
    ctx.beginPath();
    ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Пересечения — красная линия
  ctx.strokeStyle = 'rgba(231, 76, 60, 0.9)';
  ctx.lineWidth = 5;
  for (const v of result.intersectionViolations) {
    const s = camera.worldToScreen(v.intersectionPoint);
    ctx.beginPath();
    ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Doorway — жёлтые треугольники
  ctx.fillStyle = 'rgba(241, 196, 15, 0.9)';
  for (const v of result.doorwayViolations) {
    const s = camera.worldToScreen(v.point);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - 8);
    ctx.lineTo(s.x - 6, s.y + 4);
    ctx.lineTo(s.x + 6, s.y + 4);
    ctx.closePath();
    ctx.fill();
  }

  // Внутри стены — фиолетовые ромбы
  ctx.fillStyle = 'rgba(155, 89, 182, 0.9)';
  for (const v of result.insideWallViolations) {
    const s = camera.worldToScreen(v.point);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - 6);
    ctx.lineTo(s.x + 6, s.y);
    ctx.lineTo(s.x, s.y + 6);
    ctx.lineTo(s.x - 6, s.y);
    ctx.closePath();
    ctx.fill();
  }
}
