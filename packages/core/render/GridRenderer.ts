import { Camera } from '../engine/Camera';
import { ThemeManager } from '../editor/ThemeManager';

/**
 * Отрисовка координатной сетки в мировых координатах.
 * Шаг адаптируется под zoom: при маленьком масштабе рисуем только крупную сетку.
 */
export class GridRenderer {
  constructor(
    private camera: Camera,
    private themeManager: ThemeManager,
  ) {}

  render(ctx: CanvasRenderingContext2D): void {
    const rect = this.camera.visibleRect(0.05);
    const scale = this.camera.scale;

    // Адаптация шага
    let minorStep = 100; // мм
    let majorStep = 1000;
    if (scale < 0.03) {
      minorStep = 1000;
      majorStep = 5000;
    } else if (scale < 0.08) {
      minorStep = 500;
      majorStep = 1000;
    } else if (scale > 0.4) {
      minorStep = 50;
      majorStep = 100;
    } else if (scale > 1.0) {
      minorStep = 10;
      majorStep = 50;
    }

    const startX = Math.floor(rect.min.x / minorStep) * minorStep;
    const endX = Math.ceil(rect.max.x / minorStep) * minorStep;
    const startY = Math.floor(rect.min.y / minorStep) * minorStep;
    const endY = Math.ceil(rect.max.y / minorStep) * minorStep;

    ctx.lineWidth = 1 / scale;

    // Мелкая сетка (рисуем только если шаг на экране >= 8 px)
    const minorPx = minorStep * scale;
    if (minorPx >= 8) {
      ctx.strokeStyle = this.themeManager.getColor('gridMinor');
      ctx.beginPath();
      for (let x = startX; x <= endX; x += minorStep) {
        ctx.moveTo(x, rect.min.y);
        ctx.lineTo(x, rect.max.y);
      }
      for (let y = startY; y <= endY; y += minorStep) {
        ctx.moveTo(rect.min.x, y);
        ctx.lineTo(rect.max.x, y);
      }
      ctx.stroke();
    }

    // Крупная сетка
    ctx.strokeStyle = this.themeManager.getColor('gridMajor');
    ctx.beginPath();
    const majorStartX = Math.floor(rect.min.x / majorStep) * majorStep;
    const majorEndX = Math.ceil(rect.max.x / majorStep) * majorStep;
    const majorStartY = Math.floor(rect.min.y / majorStep) * majorStep;
    const majorEndY = Math.ceil(rect.max.y / majorStep) * majorStep;

    for (let x = majorStartX; x <= majorEndX; x += majorStep) {
      ctx.moveTo(x, rect.min.y);
      ctx.lineTo(x, rect.max.y);
    }
    for (let y = majorStartY; y <= majorEndY; y += majorStep) {
      ctx.moveTo(rect.min.x, y);
      ctx.lineTo(rect.max.x, y);
    }
    ctx.stroke();
  }
}
