import { Vector2 } from '../geometry/Vector2';
import { InputEvent } from '../engine/InputManager';
import { Plan } from '../model/Plan';
import { SnapEngine } from '../snap/SnapEngine';
import { CanvasEngine } from '../engine/CanvasEngine';
import { Tool } from './ToolManager';
import { UpdatePrimitiveCommand } from '../editor/ModifyCommands';
import { lineIntersection, projectPointToSegment } from '../geometry/Geometry';

/**
 * Инструмент "Обрезать".
 * Клик по отрезку/сегменту полилинии обрезает его до ближайшего пересечения
 * с другим примитивом или стеной. Обрезается часть, ближайшая к курсору.
 */
export class TrimTool implements Tool {
  readonly name = 'trim' as const;

  constructor(
    private canvas: CanvasEngine,
    private plan: Plan,
    private snapEngine: SnapEngine,
  ) {}

  onActivate(): void {
    this.canvas.setGhost(null);
    this.canvas.setSnap(null);
  }

  onDeactivate(): void {
    this.canvas.setGhost(null);
    this.canvas.setSnap(null);
    this.snapEngine.clearTracking();
  }

  onPointerDown(e: InputEvent): void {
    const hit = this.canvas.primitiveRenderer.hitTest(e.screenPoint);
    if (!hit) return;

    const points = hit.points;
    if (points.length < 2) return;

    // Определяем сегмент и ближайший конец
    let segmentIndex = 0;
    let closestT = 0;
    let minDist = Infinity;
    const world = this.canvas.camera.screenToWorld(e.screenPoint);

    if (hit.type === 'segment') {
      const proj = projectPointToSegment(world, points[0], points[1]);
      closestT = proj.t;
    } else if (hit.type === 'polyline') {
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        if (!a || !b) continue;
        const proj = projectPointToSegment(world, a, b);
        const screenA = this.canvas.camera.worldToScreen(a);
        const screenB = this.canvas.camera.worldToScreen(b);
        const distToSegment = Math.min(
          screenA.distanceTo(e.screenPoint),
          screenB.distanceTo(e.screenPoint),
          this.canvas.camera.worldToScreen(proj.point).distanceTo(e.screenPoint),
        );
        if (distToSegment < minDist) {
          minDist = distToSegment;
          segmentIndex = i - 1;
          closestT = proj.t;
        }
      }
    } else {
      // Для прямоугольника и круга обрезка не поддерживается
      return;
    }

    const a = points[segmentIndex];
    const b = points[segmentIndex + 1];
    if (!a || !b) return;

    // Направление сегмента
    const dir = b.sub(a).normalized();
    if (dir.length() === 0) return;

    // Ближайший конец к курсору — его и обрезаем.
    // Луч идёт от обрезаемого конца внутрь сегмента (к другому концу).
    const trimStart = closestT < 0.5 ? a : b;
    const rayDir = closestT < 0.5 ? dir : dir.scale(-1);

    // Ищем ближайшее пересечение луча с другими объектами
    const intersection = this.findNearestIntersection(trimStart, rayDir, hit.id);
    if (!intersection) return;

    // Проверяем, что точка пересечения лежит между trimStart и keepStart (для trim)
    const local = projectPointToSegment(intersection, a, b);
    if (local.t < 0 || local.t > 1) return;

    // Обновляем точки
    const newPoints = points.map(p => p.clone());
    if (closestT < 0.5) {
      newPoints[segmentIndex] = intersection.clone();
    } else {
      newPoints[segmentIndex + 1] = intersection.clone();
    }

    this.canvas.commandManager.execute(new UpdatePrimitiveCommand(this.plan, hit.id, newPoints));
    this.canvas.notifyChanged();
  }

  onPointerMove(e: InputEvent): void {
    // Нет превью для trim
  }

  onPointerUp(e: InputEvent): void {}

  onKeyDown(e: KeyboardEvent): boolean {
    return false;
  }

  private findNearestIntersection(start: Vector2, dir: Vector2, excludePrimitiveId: string): Vector2 | null {
    let best: { point: Vector2; t: number } | null = null;

    // Пересечение с другими примитивами
    for (const primitive of this.plan.primitives) {
      if (primitive.id === excludePrimitiveId) continue;
      const pts = primitive.points;
      if (pts.length < 2) continue;

      if (primitive.type === 'segment' || primitive.type === 'polyline') {
        const count = primitive.type === 'segment' ? Math.min(2, pts.length) : pts.length;
        for (let i = 1; i < count; i++) {
          const a = pts[i - 1];
          const b = pts[i];
          if (!a || !b) continue;
          best = this.checkSegmentIntersection(start, dir, a, b, best);
        }
      } else if (primitive.type === 'rectangle') {
        const [min, max] = pts;
        if (!min || !max) continue;
        const corners = [
          min,
          new Vector2(max.x, min.y),
          max,
          new Vector2(min.x, max.y),
        ];
        const edges: Array<[Vector2, Vector2]> = [
          [corners[0], corners[1]],
          [corners[1], corners[2]],
          [corners[2], corners[3]],
          [corners[3], corners[0]],
        ];
        for (const [a, b] of edges) {
          best = this.checkSegmentIntersection(start, dir, a, b, best);
        }
      } else if (primitive.type === 'circle') {
        const [center, rim] = pts;
        if (!center || !rim) continue;
        const radius = center.distanceTo(rim);
        const intersection = this.rayCircleIntersection(start, dir, center, radius);
        if (intersection) {
          const t = intersection.sub(start).dot(dir);
          if (t > 1 && (!best || t < best.t)) {
            best = { point: intersection, t };
          }
        }
      }
    }

    // Пересечение со стенами
    for (const wall of this.plan.walls) {
      best = this.checkSegmentIntersection(start, dir, wall.a, wall.b, best);
    }

    return best?.point ?? null;
  }

  private checkSegmentIntersection(
    start: Vector2,
    dir: Vector2,
    a: Vector2,
    b: Vector2,
    currentBest: { point: Vector2; t: number } | null,
  ): { point: Vector2; t: number } | null {
    const p = lineIntersection(start, start.add(dir), a, b);
    if (!p) return currentBest;
    // Проверяем, что пересечение на луче
    const t = p.sub(start).dot(dir);
    if (t <= 1) return currentBest;
    // Проверяем, что пересечение на отрезке
    const segProj = projectPointToSegment(p, a, b);
    if (segProj.t < -1e-9 || segProj.t > 1 + 1e-9) return currentBest;
    if (!currentBest || t < currentBest.t) {
      return { point: p, t };
    }
    return currentBest;
  }

  private rayCircleIntersection(start: Vector2, dir: Vector2, center: Vector2, radius: number): Vector2 | null {
    const oc = start.sub(center);
    const a = dir.dot(dir);
    const b = 2 * oc.dot(dir);
    const c = oc.dot(oc) - radius * radius;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;
    const t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
    const t2 = (-b + Math.sqrt(discriminant)) / (2 * a);
    const t = t1 > 1e-9 ? t1 : t2 > 1e-9 ? t2 : null;
    if (t === null) return null;
    return start.add(dir.scale(t));
  }
}
