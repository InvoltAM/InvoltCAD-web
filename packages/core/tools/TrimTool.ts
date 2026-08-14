import { Vector2 } from '../geometry/Vector2';
import { InputEvent } from '../engine/InputManager';
import { Plan } from '../model/Plan';
import { SnapEngine } from '../snap/SnapEngine';
import { CanvasEngine } from '../engine/CanvasEngine';
import { Tool } from './ToolManager';
import { UpdatePrimitiveCommand } from '../editor/ModifyCommands';
import { lineIntersection, projectPointToSegment } from '../geometry/Geometry';

type TrimState = 'idle' | 'boundary' | 'target';

type TrimBoundary =
  | { type: 'segment'; a: Vector2; b: Vector2 }
  | { type: 'circle'; center: Vector2; radius: number };

/**
 * Инструмент "Обрезать".
 * Два шага:
 *  1. Клик по секущей линии (стена, отрезок, сегмент полилинии, грань прямоугольника, окружность).
 *  2. Клик по обрезаемому отрезку/сегменту полилинии — удаляется часть, ближайшая к курсору,
 *     до точки пересечения с выбранной секущей плоскостью.
 */
export class TrimTool implements Tool {
  readonly name = 'trim' as const;

  private state: TrimState = 'idle';
  private boundary: TrimBoundary | null = null;

  constructor(
    private canvas: CanvasEngine,
    private plan: Plan,
    private snapEngine: SnapEngine,
  ) {}

  onActivate(): void {
    this.state = 'idle';
    this.boundary = null;
    this.canvas.setGhost(null);
    this.canvas.setSnap(null);
  }

  onDeactivate(): void {
    this.state = 'idle';
    this.boundary = null;
    this.canvas.setGhost(null);
    this.canvas.setSnap(null);
    this.snapEngine.clearTracking();
  }

  onPointerDown(e: InputEvent): void {
    const world = this.canvas.camera.screenToWorld(e.screenPoint);

    if (this.state === 'idle') {
      const picked = this.pickBoundary(e.screenPoint);
      if (!picked) return;
      this.boundary = picked;
      this.state = 'target';
      this.drawBoundaryGhost();
      return;
    }

    if (this.state === 'target') {
      if (!this.boundary) return;
      const target = this.pickTarget(e.screenPoint);
      if (!target) return;
      this.applyTrim(target, world, e.screenPoint);
      // Остаёмся в режиме target для обрезки следующих объектов той же границей.
      this.drawBoundaryGhost();
    }
  }

  onPointerMove(e: InputEvent): void {
    if (this.state === 'target' && this.boundary) {
      this.drawBoundaryGhost();
    }
  }

  onPointerUp(e: InputEvent): void {}

  onKeyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') {
      this.state = 'idle';
      this.boundary = null;
      this.canvas.setGhost(null);
      this.canvas.setSnap(null);
      return true;
    }
    return false;
  }

  /** Выбор секущей линии. */
  private pickBoundary(screenPoint: { x: number; y: number }): TrimBoundary | null {
    const world = this.canvas.camera.screenToWorld(new Vector2(screenPoint.x, screenPoint.y));

    // Сначала проверяем примитивы
    const hitPrimitive = this.canvas.primitiveRenderer.hitTest(screenPoint);
    if (hitPrimitive) {
      const boundary = this.primitiveSegment(hitPrimitive, world, screenPoint);
      if (boundary) return boundary;
    }

    // Затем стены
    const hitWall = this.hitTestWall(screenPoint);
    if (hitWall) {
      return { type: 'segment', a: hitWall.a, b: hitWall.b };
    }

    return null;
  }

  /** Выбор обрезаемого сегмента. */
  private pickTarget(screenPoint: { x: number; y: number }): { primitiveId: string; segmentIndex: number; points: Vector2[] } | null {
    const hitPrimitive = this.canvas.primitiveRenderer.hitTest(screenPoint);
    if (!hitPrimitive) return null;

    const world = this.canvas.camera.screenToWorld(new Vector2(screenPoint.x, screenPoint.y));
    const points = hitPrimitive.points;
    if (points.length < 2) return null;

    if (hitPrimitive.type === 'segment') {
      return { primitiveId: hitPrimitive.id, segmentIndex: 0, points };
    }

    if (hitPrimitive.type === 'polyline') {
      let segmentIndex = 0;
      let minDist = Infinity;
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        if (!a || !b) continue;
        const proj = projectPointToSegment(world, a, b);
        const screenA = this.canvas.camera.worldToScreen(a);
        const screenB = this.canvas.camera.worldToScreen(b);
        const distToSegment = Math.min(
          screenA.distanceTo(new Vector2(screenPoint.x, screenPoint.y)),
          screenB.distanceTo(new Vector2(screenPoint.x, screenPoint.y)),
          this.canvas.camera.worldToScreen(proj.point).distanceTo(new Vector2(screenPoint.x, screenPoint.y)),
        );
        if (distToSegment < minDist) {
          minDist = distToSegment;
          segmentIndex = i - 1;
        }
      }
      return { primitiveId: hitPrimitive.id, segmentIndex, points };
    }

    return null;
  }

  private primitiveSegment(
    primitive: import('../model/DrawingPrimitive').DrawingPrimitive,
    world: Vector2,
    screenPoint: { x: number; y: number },
  ): TrimBoundary | null {
    const pts = primitive.points;
    if (pts.length < 2) return null;

    if (primitive.type === 'segment') {
      return { type: 'segment', a: pts[0], b: pts[1] };
    }

    if (primitive.type === 'polyline') {
      let best: { a: Vector2; b: Vector2; dist: number } | null = null;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        if (!a || !b) continue;
        const proj = projectPointToSegment(world, a, b);
        const screenA = this.canvas.camera.worldToScreen(a);
        const screenB = this.canvas.camera.worldToScreen(b);
        const distToSegment = Math.min(
          screenA.distanceTo(new Vector2(screenPoint.x, screenPoint.y)),
          screenB.distanceTo(new Vector2(screenPoint.x, screenPoint.y)),
          this.canvas.camera.worldToScreen(proj.point).distanceTo(new Vector2(screenPoint.x, screenPoint.y)),
        );
        if (!best || distToSegment < best.dist) {
          best = { a, b, dist: distToSegment };
        }
      }
      return best ? { type: 'segment', a: best.a, b: best.b } : null;
    }

    if (primitive.type === 'rectangle') {
      const [min, max] = pts;
      if (!min || !max) return null;
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
      let best: { a: Vector2; b: Vector2; dist: number } | null = null;
      for (const [a, b] of edges) {
        const proj = projectPointToSegment(world, a, b);
        const screenA = this.canvas.camera.worldToScreen(a);
        const screenB = this.canvas.camera.worldToScreen(b);
        const distToSegment = Math.min(
          screenA.distanceTo(new Vector2(screenPoint.x, screenPoint.y)),
          screenB.distanceTo(new Vector2(screenPoint.x, screenPoint.y)),
          this.canvas.camera.worldToScreen(proj.point).distanceTo(new Vector2(screenPoint.x, screenPoint.y)),
        );
        if (!best || distToSegment < best.dist) {
          best = { a, b, dist: distToSegment };
        }
      }
      return best ? { type: 'segment', a: best.a, b: best.b } : null;
    }

    if (primitive.type === 'circle') {
      const [center, rim] = pts;
      if (!center || !rim) return null;
      return { type: 'circle', center, radius: center.distanceTo(rim) };
    }

    return null;
  }

  private hitTestWall(screenPoint: { x: number; y: number }): import('../model/Wall').Wall | null {
    const { projectPointToSegment } = require('../geometry/Geometry');
    const world = this.canvas.camera.screenToWorld(new Vector2(screenPoint.x, screenPoint.y));
    const thresholdMm = 8 / this.canvas.camera.scale;
    const searchRadius = Math.max(500, thresholdMm + 200);

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

  private applyTrim(
    target: { primitiveId: string; segmentIndex: number; points: Vector2[] },
    world: Vector2,
    screenPoint: { x: number; y: number },
  ): void {
    if (!this.boundary) return;

    const idx = target.segmentIndex;
    const a = target.points[idx];
    const b = target.points[idx + 1];
    if (!a || !b) return;

    const intersection = this.findBoundaryIntersection(a, b);
    if (!intersection) return;

    // Проверяем, что пересечение лежит на сегменте target
    const local = projectPointToSegment(intersection, a, b);
    if (local.t < -1e-9 || local.t > 1 + 1e-9) return;

    // Определяем, какой конец обрезать — ближайший к курсору
    const distA = this.canvas.camera.worldToScreen(a).distanceTo(new Vector2(screenPoint.x, screenPoint.y));
    const distB = this.canvas.camera.worldToScreen(b).distanceTo(new Vector2(screenPoint.x, screenPoint.y));
    const closestT = distA < distB ? 0 : 1;

    const newPoints = target.points.map(p => p.clone());
    if (closestT < 0.5) {
      newPoints[idx] = intersection.clone();
    } else {
      newPoints[idx + 1] = intersection.clone();
    }

    this.canvas.commandManager.execute(new UpdatePrimitiveCommand(this.plan, target.primitiveId, newPoints));
    this.canvas.notifyChanged();
  }

  private findBoundaryIntersection(a: Vector2, b: Vector2): Vector2 | null {
    if (!this.boundary) return null;

    if (this.boundary.type === 'segment') {
      return lineIntersection(a, b, this.boundary.a, this.boundary.b);
    }

    if (this.boundary.type === 'circle') {
      return this.segmentCircleIntersection(a, b, this.boundary.center, this.boundary.radius);
    }

    return null;
  }

  private segmentCircleIntersection(a: Vector2, b: Vector2, center: Vector2, radius: number): Vector2 | null {
    const dir = b.sub(a);
    const lenSq = dir.dot(dir);
    if (lenSq === 0) return null;

    const oc = a.sub(center);
    const d = dir.scale(1 / Math.sqrt(lenSq));
    const qx = oc.dot(d);
    const qy = oc.dot(d.perpendicular());

    const h2 = radius * radius - qy * qy;
    if (h2 < 0) return null;

    const h = Math.sqrt(h2);
    const t1 = -qx - h;
    const t2 = -qx + h;

    const tMax = Math.sqrt(lenSq);
    const tMin = 0;

    const validT1 = t1 >= tMin - 1e-9 && t1 <= tMax + 1e-9 ? t1 : null;
    const validT2 = t2 >= tMin - 1e-9 && t2 <= tMax + 1e-9 ? t2 : null;

    if (validT1 !== null && validT2 !== null) {
      // Возвращаем ближайшее к середине сегмента
      const midT = tMax / 2;
      const t = Math.abs(t1 - midT) < Math.abs(t2 - midT) ? t1 : t2;
      return a.add(d.scale(t));
    }
    if (validT1 !== null) return a.add(d.scale(validT1));
    if (validT2 !== null) return a.add(d.scale(validT2));
    return null;
  }

  private drawBoundaryGhost(): void {
    if (!this.boundary) {
      this.canvas.setGhost(null);
      return;
    }

    this.canvas.setGhost((ctx) => {
      const color = this.canvas.themeManager.getColor('selected');
      ctx.strokeStyle = color;
      ctx.lineWidth = 3 / this.canvas.camera.scale;
      ctx.setLineDash([8 / this.canvas.camera.scale, 4 / this.canvas.camera.scale]);

      if (this.boundary!.type === 'segment') {
        ctx.beginPath();
        ctx.moveTo(this.boundary!.a.x, this.boundary!.a.y);
        ctx.lineTo(this.boundary!.b.x, this.boundary!.b.y);
        ctx.stroke();
      } else if (this.boundary!.type === 'circle') {
        ctx.beginPath();
        ctx.arc(this.boundary!.center.x, this.boundary!.center.y, this.boundary!.radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.setLineDash([]);
    });
    this.canvas.requestRender();
  }
}
