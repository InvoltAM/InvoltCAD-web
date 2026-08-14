import { Camera } from '../engine/Camera';
import { Plan } from '../model/Plan';
import { ThemeManager } from '../editor/ThemeManager';

/**
 * Отрисовка примитивов рисования (полилиния, отрезок, прямоугольник, круг).
 */
export class PrimitiveRenderer {
  constructor(
    private plan: Plan,
    private camera: Camera,
    private themeManager: ThemeManager,
  ) {}

  render(ctx: CanvasRenderingContext2D): void {
    const color = this.themeManager.getColor('dimension');
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1 / this.camera.scale;

    for (const primitive of this.plan.primitives) {
      const points = primitive.points;
      if (points.length === 0) continue;

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
      }
    }
  }
}
