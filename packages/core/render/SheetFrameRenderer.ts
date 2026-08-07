import { Camera } from '../engine/Camera';
import { Plan } from '../model/Plan';
import { ThemeManager } from '../editor/ThemeManager';
import { getSheetDimensions, Sheet } from '../model/Sheet';

/**
 * Отрисовка рамки листа и основной надписи (штампа) по ГОСТ Р 21.101-2020,
 * приложение Ж, форма 3 (без дополнительных граф).
 *
 * Габарит штампа строго 185×55 мм. Координаты задаются в мм бумаги,
 * затем умножаются на масштаб печати printScale.
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
    const ps = sheet.printScale || 100;
    const paperW = dims.width * ps;
    const paperH = dims.height * ps;

    const bounds = this.plan.getBounds(0);
    const cx = (bounds.min.x + bounds.max.x) / 2;
    const cy = (bounds.min.y + bounds.max.y) / 2;

    const x0 = cx - paperW / 2;
    const y0 = cy - paperH / 2;

    ctx.save();
    const color = this.themeManager.getColor('sheetFrame');
    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    // Внешняя рамка (линия формата).
    ctx.lineWidth = this.strokeWidth(0.5, ps);
    ctx.setLineDash([]);
    ctx.strokeRect(x0, y0, paperW, paperH);

    // Внутренняя рамка: слева 20 мм, справа/сверху/снизу 5 мм.
    const leftMargin = this.mm(20, ps);
    const otherMargin = this.mm(5, ps);
    const innerX = x0 + leftMargin;
    const innerY = y0 + otherMargin;
    const innerW = paperW - leftMargin - otherMargin;
    const innerH = paperH - 2 * otherMargin;

    ctx.lineWidth = this.strokeWidth(0.7, ps);
    ctx.strokeRect(innerX, innerY, innerW, innerH);

    // Угловые насечки (уголки) на внутренней рамке: отрезки 5 мм от угла.
    this.drawCornerTicks(ctx, innerX, innerY, innerW, innerH, this.mm(5, ps), ps);

    // Основная надпись (штамп) 185×55 мм в правом нижнем углу внутренней рамки.
    const stampW = this.mm(185, ps);
    const stampH = this.mm(55, ps);
    const stampX = innerX + innerW - stampW;
    const stampY = innerY + innerH - stampH;
    this.renderTitleBlock(ctx, sheet, stampX, stampY, stampW, stampH);

    ctx.restore();
  }

  /** Рисует угловые насечки по внутренней рамке. */
  private drawCornerTicks(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    tick: number,
    ps: number,
  ): void {
    ctx.lineWidth = this.strokeWidth(0.25, ps);
    ctx.beginPath();
    // левый верхний
    ctx.moveTo(x, y + tick); ctx.lineTo(x, y);
    ctx.moveTo(x, y); ctx.lineTo(x + tick, y);
    // правый верхний
    ctx.moveTo(x + w, y); ctx.lineTo(x + w - tick, y);
    ctx.moveTo(x + w, y); ctx.lineTo(x + w, y + tick);
    // правый нижний
    ctx.moveTo(x + w, y + h); ctx.lineTo(x + w - tick, y + h);
    ctx.moveTo(x + w, y + h); ctx.lineTo(x + w, y + h - tick);
    // левый нижний
    ctx.moveTo(x, y + h); ctx.lineTo(x + tick, y + h);
    ctx.moveTo(x, y + h); ctx.lineTo(x, y + h - tick);
    ctx.stroke();
  }

  /**
   * Основная надпись (штамп) строго по форме 3.
   * viewBox="0 0 185 55".
   */
  private renderTitleBlock(
    ctx: CanvasRenderingContext2D,
    sheet: Sheet,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const ps = sheet.printScale || 100;
    const mm = (v: number) => this.mm(v, ps);
    const tb = sheet.titleBlock;

    // --- Сетка ---
    const cols = [23, 25, 17, 23, 15, 17, 15, 17, 33]; // сумма 185
    const rows = [7, 7, 5, 5, 5, 5, 5, 8, 8]; // сумма 55

    const colX: number[] = [0];
    for (const cw of cols) colX.push(colX[colX.length - 1] + cw);
    const rowY: number[] = [0];
    for (const rh of rows) rowY.push(rowY[rowY.length - 1] + rh);

    // Внешняя рамка штампа (0,7 мм).
    ctx.lineWidth = this.strokeWidth(0.7, ps);
    ctx.strokeRect(x, y, w, h);

    ctx.lineWidth = this.strokeWidth(0.35, ps);

    // Внутренние горизонтальные линии.
    // y=14 — между верхним блоком и средним (на всю ширину).
    this.drawHLine(ctx, y + mm(rowY[2]), x, x + w);
    // y=39 — между средним и нижним блоком (на всю ширину).
    this.drawHLine(ctx, y + mm(rowY[7]), x, x + w);

    // y=19,24,29,34 — строки внутри графы изменений (столбцы 5–9).
    for (let r = 3; r <= 6; r++) {
      this.drawHLine(ctx, y + mm(rowY[r]), x + mm(colX[4]), x + w);
    }

    // y=44 — линия подписей в нижнем левом блоке (столбцы 1–4).
    this.drawHLine(ctx, y + mm(rowY[7] + 5), x, x + mm(colX[4]));

    // y=47 — граница между строками 8 и 9 в нижнем левом блоке (столбцы 1–4).
    this.drawHLine(ctx, y + mm(rowY[8]), x, x + mm(colX[4]));

    // Внутренние вертикальные линии.
    // x=88 — граница между левой и правой частями (на всю высоту).
    this.drawVLine(ctx, x + mm(colX[4]), y, y + h);

    // Вертикали в нижнем левом блоке (столбцы 1–4), только строки 8–9.
    for (let c = 1; c <= 3; c++) {
      this.drawVLine(ctx, x + mm(colX[c]), y + mm(rowY[7]), y + h);
    }

    // Вертикали в графе изменений (столбцы 5–9), только строки 3–7.
    for (let c = 5; c <= 8; c++) {
      this.drawVLine(ctx, x + mm(colX[c]), y + mm(rowY[2]), y + mm(rowY[7]));
    }

    // --- Текст ---
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fontPx = this.mmToPx(3.5, ps);
    ctx.font = `${fontPx}px sans-serif`;

    // Верхний левый блок (столбцы 1–4, строки 1–2): наименование изделия.
    const topLeftCx = x + mm(colX[4]) / 2;
    const topLeftCy = y + mm(rowY[2]) / 2;
    this.fillCentered(ctx, 'Наименование изделия', topLeftCx, y + mm(3.5));
    this.fillCentered(ctx, tb.objectName || tb.drawingName || sheet.name || '', topLeftCx, y + mm(10));

    // Верхний правый блок (столбцы 5–9, строки 1–2): Лист / Листов.
    const topRightX = x + mm(colX[4]);
    const topRightW = mm(colX[9] - colX[4]);
    // Лист — левая половина блока, Листов — правая половина (без линии, так как ячейка объединена).
    this.fillCentered(ctx, 'Лист', topRightX + topRightW * 0.25, y + mm(3.5));
    this.fillCentered(ctx, tb.sheetNo || '', topRightX + topRightW * 0.25, y + mm(10));
    this.fillCentered(ctx, 'Листов', topRightX + topRightW * 0.75, y + mm(3.5));
    this.fillCentered(ctx, tb.sheetTotal || '', topRightX + topRightW * 0.75, y + mm(10));

    // Средний левый блок (столбцы 1–4, строки 3–7): обозначение.
    const midLeftCx = x + mm(colX[4]) / 2;
    const midTop = y + mm(rowY[2]);
    const midBottom = y + mm(rowY[7]);
    this.fillCentered(ctx, 'Обозначение', midLeftCx, midTop + mm(2.5));
    this.fillCentered(ctx, tb.docCode || '', midLeftCx, midTop + (midBottom - midTop) / 2);

    // Графа изменений (столбцы 5–9, строки 3–7): заголовки.
    const changeHeaders = ['Изм.', 'Лист', '№ докум.', 'Подп.', 'Дата'];
    const changeTop = y + mm(rowY[2]);
    const changeHeaderCy = changeTop + mm(2.5);
    for (let i = 0; i < 5; i++) {
      const cx_ = x + mm(colX[4 + i] + cols[4 + i] / 2);
      this.fillCentered(ctx, changeHeaders[i], cx_, changeHeaderCy);
    }

    // Нижний левый блок (столбцы 1–4, строки 8–9): подписи.
    const signLabels = ['Разраб.', 'Пров.', 'Н. контр.', 'Утв.'];
    const signValues = [tb.designer, tb.checker, tb.normController, tb.approver];
    const signTop = y + mm(rowY[7]);
    const signLabelCy = signTop + mm(2.5);
    const signValueCy = signTop + mm(11); // середина зоны значений (44..55)
    for (let i = 0; i < 4; i++) {
      const cx_ = x + mm(colX[i] + cols[i] / 2);
      this.fillCentered(ctx, signLabels[i], cx_, signLabelCy);
      this.fillCentered(ctx, signValues[i] || '', cx_, signValueCy);
    }

    // Нижний правый блок (столбцы 5–9, строки 8–9): масштаб.
    const bottomRightX = x + mm(colX[4]);
    const bottomRightW = mm(colX[9] - colX[4]);
    const bottomRightCy = signTop + mm(8);
    this.fillCentered(ctx, 'Масштаб', bottomRightX + bottomRightW / 2, signTop + mm(2.5));
    this.fillCentered(ctx, tb.scaleLabel || `1:${ps}`, bottomRightX + bottomRightW / 2, bottomRightCy);
  }

  private drawHLine(
    ctx: CanvasRenderingContext2D,
    y: number,
    x1: number,
    x2: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
  }

  private drawVLine(
    ctx: CanvasRenderingContext2D,
    x: number,
    y1: number,
    y2: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.stroke();
  }

  private fillCentered(
    ctx: CanvasRenderingContext2D,
    text: string,
    cx: number,
    cy: number,
  ): void {
    ctx.fillText(text, cx, cy);
  }

  /** Перевод мм в мировые единицы с учётом масштаба печати. */
  private mm(valueMm: number, printScale: number): number {
    return valueMm * printScale;
  }

  /** Перевод мм бумаги в мировые единицы. */
  private mmToPx(valueMm: number, printScale: number): number {
    return valueMm * printScale;
  }

  /** Толщина линии в мировых единицах с минимумом 1,5 px на экране. */
  private strokeWidth(valueMm: number, printScale: number): number {
    return Math.max(1.5 / this.camera.scale, this.mmToPx(valueMm, printScale));
  }
}
