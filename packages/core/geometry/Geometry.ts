import { Vector2 } from './Vector2';

export interface Rect {
  min: Vector2;
  max: Vector2;
}

export interface ProjectionResult {
  point: Vector2;
  t: number;
  dist: number;
}

/**
 * Проекция точки p на отрезок [a, b].
 * t = 0..1 — параметр вдоль отрезка, point — ближайшая точка на отрезке,
 * dist — расстояние от p до point.
 */
export function projectPointToSegment(p: Vector2, a: Vector2, b: Vector2): ProjectionResult {
  const v = b.sub(a);
  const lenSq = v.dot(v);
  let t = lenSq > 0 ? p.sub(a).dot(v) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const point = a.add(v.scale(t));
  return { point, t, dist: p.distanceTo(point) };
}

/** Расстояние от точки до отрезка [a, b]. */
export function distPointToSegment(p: Vector2, a: Vector2, b: Vector2): number {
  return projectPointToSegment(p, a, b).dist;
}

/** Проверка: лежит ли точка p на отрезке [a, b] с допуском eps (в мм). */
export function isPointOnSegment(p: Vector2, a: Vector2, b: Vector2, eps = 1): boolean {
  const proj = projectPointToSegment(p, a, b);
  return proj.dist < eps;
}

/** Пересечение отрезка [a, b] с осью-вырожденным прямоугольником rect. */
export function segmentIntersectsRect(a: Vector2, b: Vector2, rect: Rect): boolean {
  // Быстрая проверка ограничивающего прямоугольника отрезка
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);

  if (maxX < rect.min.x || minX > rect.max.x || maxY < rect.min.y || minY > rect.max.y) {
    return false;
  }

  // Если хотя бы один конец внутри rect — пересекает
  if (
    a.x >= rect.min.x && a.x <= rect.max.x && a.y >= rect.min.y && a.y <= rect.max.y
  ) return true;
  if (
    b.x >= rect.min.x && b.x <= rect.max.x && b.y >= rect.min.y && b.y <= rect.max.y
  ) return true;

  // Проверка пересечения со сторонами rect
  const edges: Array<[Vector2, Vector2]> = [
    [rect.min, new Vector2(rect.max.x, rect.min.y)],
    [new Vector2(rect.max.x, rect.min.y), rect.max],
    [rect.max, new Vector2(rect.min.x, rect.max.y)],
    [new Vector2(rect.min.x, rect.max.y), rect.min],
  ];

  for (const [e0, e1] of edges) {
    if (segmentsIntersect(a, b, e0, e1)) return true;
  }
  return false;
}

/** Пересечение двух отрезков (не учитывает вырожденные случаи). */
function segmentsIntersect(a1: Vector2, a2: Vector2, b1: Vector2, b2: Vector2): boolean {
  function ccw(A: Vector2, B: Vector2, C: Vector2): boolean {
    return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
  }
  return ccw(a1, b1, b2) !== ccw(a2, b1, b2) && ccw(a1, a2, b1) !== ccw(a1, a2, b2);
}

/**
 * Точка пересечения двух отрезков [a1, a2] и [b1, b2].
 * Возвращает null, если отрезки параллельны или не пересекаются во внутренних точках.
 */
export function segmentsIntersection(a1: Vector2, a2: Vector2, b1: Vector2, b2: Vector2): Vector2 | null {
  const d1 = a2.sub(a1);
  const d2 = b2.sub(b1);
  const det = d1.cross(d2);
  if (Math.abs(det) < 1e-9) return null; // параллельны

  const t = b1.sub(a1).cross(d2) / det;
  const u = b1.sub(a1).cross(d1) / det;
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;

  return a1.add(d1.scale(t));
}

/**
 * Точка пересечения двух бесконечных прямых, проходящих через точки.
 * Возвращает null, если прямые параллельны.
 */
export function lineIntersection(a1: Vector2, a2: Vector2, b1: Vector2, b2: Vector2): Vector2 | null {
  const d1 = a2.sub(a1);
  const d2 = b2.sub(b1);
  const det = d1.cross(d2);
  if (Math.abs(det) < 1e-9) return null;
  const t = b1.sub(a1).cross(d2) / det;
  return a1.add(d1.scale(t));
}

/** Выпуклая оболочка набора точек (алгоритм monotone chain). */
export function convexHull(points: Vector2[]): Vector2[] {
  if (points.length <= 1) return points.map(p => p.clone());

  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));

  const cross = (o: Vector2, a: Vector2, b: Vector2) => a.sub(o).cross(b.sub(o));

  const lower: Vector2[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Vector2[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

/** Проверка, находится ли точка внутри полигона (ray casting). */
export function pointInPolygon(p: Vector2, poly: Vector2[]): boolean {
  let inside = false;
  const eps = 1e-9;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > p.y) !== (yj > p.y)) &&
      (p.x < (xj - xi) * (p.y - yi) / (yj - yi + eps) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}


/** Округление угла до ближайшего кратного step (радиан). */
export function snapAngle(angle: number, step = Math.PI / 2): number {
  return Math.round(angle / step) * step;
}
