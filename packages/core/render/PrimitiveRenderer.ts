import { Camera } from '../engine/Camera';
import { Plan } from '../model/Plan';
import { ThemeManager } from '../editor/ThemeManager';
import { Vector2 } from '../geometry/Vector2';

/**
 * Отрисовка примитивов рисования (полилиния, отрезок, прямоугольник, круг).
 */
export class PrimitiveRenderer {
  private selectedIds = new Set<string>();

  constructor(
    private plan: Plan,
    private camera: Camera,
    private themeManager: ThemeManager,
  ) {}

  setSelectedPrimitiveIds(ids: string[]): void {
    this.selectedIds = new Set(ids);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const color = this.themeManager.getColor('dimension');
    const selectedColor = this.themeManager.getColor('selected');
    ctx.fillStyle = color;

    for (const primitive of this.plan.primitives) {
      const points = primitive.points;
      if (points.length === 0) continue;
      const isSelected = this.selectedIds.has(primitive.id);
      ctx.strokeStyle = isSelected ? selectedColor : color;
      ctx.lineWidth = isSelected ? 2.5 / this.camera.scale : 1 / this.camera.scale;

      switch (primitive.type) {
        case 'polyline':
        case 'segment':
          if (points.length < 2) continue;
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.stroke();
          break;

        case 'rectangle':
          if (points.length < 2) continue;
          {
            const x = Math.min(points[0].x, points[1].x);
            const y = Math.min(points[0].y, points[1].y);
            const w = Math.abs(points[1].x - points[0].x);
            const h = Math.abs(points[1].y - points[0].y);
            ctx.strokeRect(x, y, w, h);
          }
          break;

        case 'circle':
          if (points.length < 2) continue;
          {
            const radius = points[0].distanceTo(points[1]);
            ctx.beginPath();
            ctx.arc(points[0].x, points[0].y, radius, 0, Math.PI * 2);
            ctx.stroke();
          }
          break;

        case 'text': {
          if (!primitive.text || points.length === 0) continue;
          const pos = points[0];
          const fontSize = primitive.fontSize ?? 140;
          ctx.font = `${isSelected ? 'bold ' : ''}${fontSize}px ui-sans-serif, system-ui, sans-serif`;
          ctx.fillStyle = isSelected ? selectedColor : color;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';

          // Линия выноски для callout (второй точкой задаётся конец выноски)
          if (points.length >= 2) {
            const end = points[1];
            ctx.strokeStyle = isSelected ? selectedColor : color;
            ctx.lineWidth = 1 / this.camera.scale;
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
          }

          const lines = primitive.text.split('\n');
          const lineHeight = fontSize * 1.2;
          for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i] ?? '', pos.x, pos.y + i * lineHeight);
          }
          break;
        }
      }
    }
  }

  /** Hit-test примитива: ближайший сегмент/грань/окружность в пределах thresholdPx. */
  hitTest(screenPoint: { x: number; y: number }, thresholdPx = 8): import('../model/DrawingPrimitive').DrawingPrimitive | null {
    const { projectPointToSegment } = require('../geometry/Geometry');
    const world = this.camera.screenToWorld(new Vector2(screenPoint.x, screenPoint.y));
    const thresholdWorld = thresholdPx / this.camera.scale;
    let best: { primitive: import('../model/DrawingPrimitive').DrawingPrimitive; distWorld: number } | null = null;

    const toV2 = (p: { x: number; y: number }) => (p instanceof Vector2 ? p : new Vector2(p.x, p.y));

    for (const primitive of this.plan.primitives) {
      const points = primitive.points.map(toV2);
      if (points.length === 0) continue;

      if (primitive.type === 'segment' || primitive.type === 'polyline') {
        const count = primitive.type === 'segment' ? Math.min(2, points.length) : points.length;
        for (let i = 1; i < count; i++) {
          const a = points[i - 1];
          const b = points[i];
          if (!a || !b) continue;
          const proj = projectPointToSegment(world, a, b);
          if (proj.dist < thresholdWorld && (!best || proj.dist < best.distWorld)) {
            best = { primitive, distWorld: proj.dist };
          }
        }
      } else if (primitive.type === 'rectangle') {
        if (points.length < 2) continue;
        const min = points[0];
        const max = points[1];
        const corners = [min, new Vector2(max.x, min.y), max, new Vector2(min.x, max.y)];
        const edges: Array<[Vector2, Vector2]> = [
          [corners[0], corners[1]],
          [corners[1], corners[2]],
          [corners[2], corners[3]],
          [corners[3], corners[0]],
        ];
        for (const [a, b] of edges) {
          const proj = projectPointToSegment(world, a, b);
          if (proj.dist < thresholdWorld && (!best || proj.dist < best.distWorld)) {
            best = { primitive, distWorld: proj.dist };
          }
        }
      } else if (primitive.type === 'circle') {
        if (points.length < 2) continue;
        const center = points[0];
        const rim = points[1];
        const radius = center.distanceTo(rim);
        const distWorld = Math.abs(world.distanceTo(center) - radius);
        if (distWorld < thresholdWorld && (!best || distWorld < best.distWorld)) {
          best = { primitive, distWorld };
        }
      } else if (primitive.type === 'text') {
        if (!primitive.text || points.length === 0) continue;
        const pos = points[0];
        const fontSize = primitive.fontSize ?? 140;
        const lineHeight = fontSize * 1.2;
        const lines = primitive.text.split('\n');
        const textWidth = Math.max(
          ...lines.map((line) => {
            // Приблизительная ширина: 0.55 от высоты символа
            return line.length * fontSize * 0.55;
          }),
        );
        const textHeight = lines.length * lineHeight;
        const minX = pos.x;
        const minY = pos.y;
        const maxX = pos.x + textWidth;
        const maxY = pos.y + textHeight;
        if (
          world.x >= minX - thresholdWorld &&
          world.x <= maxX + thresholdWorld &&
          world.y >= minY - thresholdWorld &&
          world.y <= maxY + thresholdWorld
        ) {
          const cx = (minX + maxX) / 2;
          const cy = (minY + maxY) / 2;
          const distWorld = Math.hypot(world.x - cx, world.y - cy);
          if (!best || distWorld < best.distWorld) {
            best = { primitive, distWorld };
          }
        }
      }
    }

    return best?.primitive ?? null;
  }
}
