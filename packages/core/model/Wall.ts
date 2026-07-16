import { Vector2 } from '../geometry/Vector2';
import { Opening } from './Opening';

export const DEFAULT_WALL_THICKNESS = 200;

export interface WallArc {
  center: Vector2;
  radius: number;
  startAngle: number; // радианы
  endAngle: number;   // радианы
  clockwise?: boolean; // направление обхода дуги (как в Canvas API)
}

export interface Wall {
  id: string;
  a: Vector2;                   // начало осевой линии (мм)
  b: Vector2;                   // конец осевой линии (мм)
  thickness: number;            // толщина стены, мм
  openings: Opening[];          // проемы в этой стене
  arc?: WallArc;                // опциональные параметры дуговой стены
}

export function wallHasArc(wall: Wall): boolean {
  return wall.arc !== undefined;
}

/** Возвращает точку на дуге для заданного угла. */
export function wallArcPoint(arc: WallArc, angle: number): Vector2 {
  return new Vector2(
    arc.center.x + Math.cos(angle) * arc.radius,
    arc.center.y + Math.sin(angle) * arc.radius,
  );
}

/** Приводит угловой размах к диапазону, соответствующему направлению дуги. */
function normalizeArcSweep(arc: WallArc): number {
  let sweep = arc.endAngle - arc.startAngle;
  const clockwise = arc.clockwise ?? true;
  if (clockwise) {
    while (sweep > 0) sweep -= 2 * Math.PI;
  } else {
    while (sweep < 0) sweep += 2 * Math.PI;
  }
  return sweep;
}

/** Длина осевой линии стены (прямой или дуговой). */
export function wallLength(wall: Wall): number {
  if (wall.arc) {
    return Math.abs(normalizeArcSweep(wall.arc)) * wall.arc.radius;
  }
  return wall.a.distanceTo(wall.b);
}

/** Направление касательной в начале стены. */
export function wallDirection(wall: Wall): Vector2 {
  if (wall.arc) {
    const startRadius = wall.a.sub(wall.arc.center);
    const tangent = wall.arc.clockwise ?? true
      ? startRadius.perpendicular().scale(-1)
      : startRadius.perpendicular();
    const len = tangent.length();
    return len > 0 ? tangent.scale(1 / len) : new Vector2(1, 0);
  }
  const dir = wall.b.sub(wall.a);
  const len = dir.length();
  return len > 0 ? dir.scale(1 / len) : new Vector2(1, 0);
}

/**
 * Аппроксимирует стену ломаной.
 * Для прямой стены возвращает [a, b].
 * Для дуговой — набор точек по дуге с шагом не более maxChordLength.
 */
export function wallPolyline(wall: Wall, maxChordLength = 100): Vector2[] {
  if (!wall.arc) {
    return [wall.a.clone(), wall.b.clone()];
  }

  const sweep = normalizeArcSweep(wall.arc);
  const arcLength = Math.abs(sweep) * wall.arc.radius;
  const count = Math.max(1, Math.ceil(arcLength / maxChordLength));
  const step = sweep / count;
  const pts: Vector2[] = [];

  for (let i = 0; i <= count; i++) {
    pts.push(wallArcPoint(wall.arc, wall.arc.startAngle + step * i));
  }
  return pts;
}

/** Синхронизирует конечные точки a/b дуговой стены с её параметрами. */
export function updateWallArcEndpoints(wall: Wall): void {
  if (!wall.arc) return;
  wall.a = wallArcPoint(wall.arc, wall.arc.startAngle);
  wall.b = wallArcPoint(wall.arc, wall.arc.endAngle);
}

/**
 * Создаёт дугу по хорде a-b с заданным радиусом и стороной выпуклости.
 * clockwise = true — дуга выпукла в направлении, совпадающем с обходом a->b по часовой стрелке.
 */
export function createWallArcFromChord(
  a: Vector2,
  b: Vector2,
  radius: number,
  clockwise: boolean,
): WallArc | null {
  const chord = b.sub(a);
  const halfChord = chord.length() / 2;
  if (radius < halfChord - 1e-6) return null;

  const mid = a.add(b).scale(0.5);
  const perp = chord.perpendicular().normalized();
  const height = Math.sqrt(Math.max(0, radius * radius - halfChord * halfChord));
  const center = clockwise ? mid.add(perp.scale(height)) : mid.sub(perp.scale(height));

  const startAngle = Math.atan2(a.y - center.y, a.x - center.x);
  const endAngle = Math.atan2(b.y - center.y, b.x - center.x);

  return { center, radius, startAngle, endAngle, clockwise };
}
