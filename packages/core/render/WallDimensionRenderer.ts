import { Camera } from '../engine/Camera';
import { Plan } from '../model/Plan';
import { Vector2 } from '../geometry/Vector2';
import { wallDirection, wallLength } from '../model/Wall';
import { segmentIntersectsRect } from '../geometry/Geometry';
import { ThemeManager } from '../editor/ThemeManager';

const OFFSET_MM = 300; // смещение размерной линии от стены

/**
 * Автоматические размерные линии для стен.
 * Рисуется поверх стен; длина берётся из модели стены.
 */
export class WallDimensionRenderer {
  constructor(
    private plan: Plan,
    private camera: Camera,
    private themeManager: ThemeManager,
  ) {}

  render(ctx: CanvasRenderingContext2D): void {
    const rect = this.camera.visibleRect(0.1);
    for (const wall of this.plan.walls) {
      if (segmentIntersectsRect(wall.a, wall.b, { min: rect.min, max: rect.max })) {
        this.drawWallDimension(ctx, wall);
      }
    }
  }

  private drawWallDimension(ctx: CanvasRenderingContext2D, wall: import('../model/Wall').Wall): void {
    const len = wallLength(wall);
    if (len === 0) return;

    const dir = wallDirection(wall);
    const n = dir.perpendicular();
    const mid = wall.a.add(wall.b).scale(0.5);
    const offsetPoint = mid.add(n.scale(OFFSET_MM));

    const p1 = wall.a.add(n.scale(OFFSET_MM));
    const p2 = wall.b.add(n.scale(OFFSET_MM));

    ctx.strokeStyle = this.themeManager.getColor('dimension');
    ctx.fillStyle = this.themeManager.getColor('dimension');
    ctx.lineWidth = 1 / this.camera.scale;

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    const tickLen = 6 / this.camera.scale;
    for (const p of [p1, p2]) {
      ctx.beginPath();
      ctx.moveTo(p.x - n.x * tickLen, p.y - n.y * tickLen);
      ctx.lineTo(p.x + n.x * tickLen, p.y + n.y * tickLen);
      ctx.stroke();
    }

    const text = `${Math.round(len)} мм`;
    ctx.font = `${12 / this.camera.scale}px ui-sans-serif, system-ui, sans-serif`;
    const metrics = ctx.measureText(text);
    const padding = 3 / this.camera.scale;
    const tw = metrics.width + padding * 2;
    const th = (14 / this.camera.scale) + padding * 2;

    ctx.fillStyle = this.themeManager.getColor('dimensionTextBg');
    ctx.beginPath();
    ctx.rect(offsetPoint.x - tw / 2, offsetPoint.y - th / 2, tw, th);
    ctx.fill();

    ctx.fillStyle = this.themeManager.getColor('dimension');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, offsetPoint.x, offsetPoint.y);
  }
}
