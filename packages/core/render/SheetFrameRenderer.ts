import { Camera } from '../engine/Camera';
import { Plan } from '../model/Plan';
import { ThemeManager } from '../editor/ThemeManager';
import { getSheetDimensions } from '../model/Sheet';

/**
 * Отрисовка рамки листа по ГОСТ на canvas в мировых координатах.
 * Размер рамки = физический размер бумаги (мм) × масштаб печати.
 * Центр рамки совпадает с центром ограничивающего прямоугольника плана.
 */
export class SheetFrameRenderer {
  constructor(
    private plan: Plan,
    private camera: Camera,
    private themeManager: ThemeManager,
  ) {}

  render(ctx: CanvasRenderingContext2D): void {
    const sheet = this.plan.activeSheet;
    if (!sheet) return;

    const dims = getSheetDimensions(sheet.pageSize, sheet.orientation);
    const scale = sheet.printScale || 100;
    const wWorld = dims.width * scale;
    const hWorld = dims.height * scale;

    const bounds = this.plan.getBounds(0);
    const cx = (bounds.min.x + bounds.max.x) / 2;
    const cy = (bounds.min.y + bounds.max.y) / 2;

    const x = cx - wWorld / 2;
    const y = cy - hWorld / 2;

    ctx.save();
    ctx.strokeStyle = this.themeManager.getColor('sheetFrame');
    ctx.lineWidth = 2 / this.camera.scale;
    ctx.setLineDash([10 / this.camera.scale, 5 / this.camera.scale]);

    ctx.beginPath();
    ctx.rect(x, y, wWorld, hWorld);
    ctx.stroke();

    // Угловые насечки ГОСТ (упрощённые): отрезки по 5 мм от угла.
    const tick = 5 * scale;
    ctx.lineWidth = 1.5 / this.camera.scale;
    ctx.setLineDash([]);
    ctx.beginPath();
    // левый верхний
    ctx.moveTo(x, y + tick); ctx.lineTo(x, y);
    ctx.moveTo(x, y); ctx.lineTo(x + tick, y);
    // правый верхний
    ctx.moveTo(x + wWorld, y); ctx.lineTo(x + wWorld - tick, y);
    ctx.moveTo(x + wWorld, y); ctx.lineTo(x + wWorld, y + tick);
    // правый нижний
    ctx.moveTo(x + wWorld, y + hWorld); ctx.lineTo(x + wWorld - tick, y + hWorld);
    ctx.moveTo(x + wWorld, y + hWorld); ctx.lineTo(x + wWorld, y + hWorld - tick);
    // левый нижний
    ctx.moveTo(x, y + hWorld); ctx.lineTo(x + tick, y + hWorld);
    ctx.moveTo(x, y + hWorld); ctx.lineTo(x, y + hWorld - tick);
    ctx.stroke();

    // Подпись формата в центре нижней части рамки (экранные mm? нет, в мировых координатах)
    ctx.fillStyle = this.themeManager.getColor('sheetFrame');
    ctx.font = `${12 / this.camera.scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const label = `${sheet.pageSize} ${sheet.orientation === 'landscape' ? ' landscape' : ' portrait'} 1:${scale}`;
    ctx.fillText(label, cx, y + hWorld - 5 / this.camera.scale);

    ctx.restore();
  }
}
