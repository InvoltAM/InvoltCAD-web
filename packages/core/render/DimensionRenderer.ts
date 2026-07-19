import { Camera } from '../engine/Camera';
import { Plan } from '../model/Plan';
import { Dimension } from '../model/Dimension';
import { segmentIntersectsRect } from '../geometry/Geometry';
import { ThemeManager } from '../editor/ThemeManager';

/**
 * Отрисовка ручных размерных линий.
 */
export class DimensionRenderer {
  private selectedId: string | null = null;

  constructor(
    private plan: Plan,
    private camera: Camera,
    private themeManager: ThemeManager,
  ) {}

  setSelectedDimension(id: string | null): void {
    this.selectedId = id;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const rect = this.camera.visibleRect(0.1);
    for (const dim of this.plan.dimensions) {
      if (segmentIntersectsRect(dim.a, dim.b, { min: rect.min, max: rect.max })) {
        this.drawDimension(ctx, dim);
      }
    }
  }

  private drawDimension(ctx: CanvasRenderingContext2D, dim: Dimension): void {
    const { a, b } = dim;
    const dir = b.sub(a);
    const len = dir.length();
    if (len === 0) return;
    const d = dir.normalized();
    const n = d.perpendicular();
    const mid = a.add(b).scale(0.5);
    const color = dim.id === this.selectedId ? this.themeManager.getColor('dimensionSelected') : this.themeManager.getColor('dimension');

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1 / this.camera.scale;

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    const tickLen = 6 / this.camera.scale;
    for (const p of [a, b]) {
      ctx.beginPath();
      ctx.moveTo(p.x - n.x * tickLen, p.y - n.y * tickLen);
      ctx.lineTo(p.x + n.x * tickLen, p.y + n.y * tickLen);
      ctx.stroke();
    }

    const text = dim.text && dim.text.trim() !== '' ? dim.text : `${Math.round(dim.length)} мм`;
    ctx.font = `${12 / this.camera.scale}px ui-sans-serif, system-ui, sans-serif`;
    const metrics = ctx.measureText(text);
    const padding = 3 / this.camera.scale;
    const tw = metrics.width + padding * 2;
    const th = (14 / this.camera.scale) + padding * 2;

    ctx.fillStyle = this.themeManager.getColor('dimensionTextBg');
    ctx.beginPath();
    ctx.rect(mid.x - tw / 2, mid.y - th / 2, tw, th);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, mid.x, mid.y);
  }
}
