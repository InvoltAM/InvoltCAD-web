import { Camera } from '../engine/Camera';
import { Plan } from '../model/Plan';
import { ThemeManager } from '../editor/ThemeManager';
import { getSheetDimensions, Sheet } from '../model/Sheet';

/**
 * Отрисовка рамки листа и основной надписи (штампа) по ГОСТ 2.104-2006,
 * форма 1 (для первого/единственного листа чертежей и схем).
 *
 * Геометрия задана в мм бумаги, затем умножается на масштаб печати printScale
 * для перевода в мировые координаты плана.
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

  /** Основная надпись (штамп) по ГОСТ 2.104-2006, форма 1. */
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

    ctx.lineWidth = this.strokeWidth(0.25, ps);
    ctx.strokeRect(x, y, w, h);

    // --- Левая группа колонок учёта изменений: 7+10+23+15+10 = 65 мм ---
    const leftCols = [7, 10, 23, 15, 10];
    const leftW = mm(leftCols.reduce((a, b) => a + b, 0));
    let cx = x;
    for (const cw of leftCols.slice(0, -1)) {
      cx += mm(cw);
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(cx, y + h);
      ctx.stroke();
    }
    // 11 горизонтальных строк по 5 мм.
    for (let r = 1; r < 11; r++) {
      const ry = y + mm(5 * r);
      ctx.beginPath();
      ctx.moveTo(x, ry);
      ctx.lineTo(x + leftW, ry);
      ctx.stroke();
    }
    // Заголовки колонок — центрируем в первой строке (5 мм).
    ctx.font = `${this.mmToPx(3.5, ps)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const leftHeaders = ['Изм.', 'Лист', '№ докум.', 'Подпись', 'Дата'];
    cx = x;
    leftCols.forEach((cw, i) => {
      ctx.fillText(leftHeaders[i], cx + mm(cw) / 2, y + mm(2.5));
      cx += mm(cw);
    });

    // --- Основное поле (70 мм) и правая колонка (50 мм) ---
    const mainW = mm(70);
    const rightW = mm(50);
    const mainX = x + leftW;
    const rightX = mainX + mainW;

    ctx.beginPath();
    ctx.moveTo(rightX, y);
    ctx.lineTo(rightX, y + h);
    ctx.stroke();

    // Высотные зоны основного поля: 8 / 32 / 15 мм.
    // 8 мм — № документа (зона 2 на образце),
    // 32 мм — дата / организация / объект / наименование (зона 1),
    // 15 мм — подписи (зона 3).
    const mainZoneHs = [8, 32, 15];
    let zy = y;
    for (const zh of mainZoneHs.slice(0, -1)) {
      zy += mm(zh);
      ctx.beginPath();
      ctx.moveTo(mainX, zy);
      ctx.lineTo(x + w, zy);
      ctx.stroke();
    }

    const zDocTop = y;
    const zDocBottom = y + mm(8);
    const zMainTop = zDocBottom;
    const zMainBottom = zMainTop + mm(32);
    const zSignTop = zMainBottom;

    // --- Правая колонка ---
    // Высоты: верхняя 15 мм, средняя 25 мм, нижняя 15 мм.
    const rcTopH = mm(15);
    const rcBottomH = mm(15);
    const rcMidY = y + rcTopH;
    const rcBottomY = y + h - rcBottomH;

    // Горизонтальные разделители правой колонки.
    ctx.beginPath();
    ctx.moveTo(rightX, rcMidY);
    ctx.lineTo(x + w, rcMidY);
    ctx.moveTo(rightX, rcBottomY);
    ctx.lineTo(x + w, rcBottomY);
    ctx.stroke();

    // Подколонки правой колонки: 15 / 15 / 20 мм.
    const rcSubCols = [15, 15, 20];
    let rx = rightX;
    for (const cw of rcSubCols.slice(0, -1)) {
      rx += mm(cw);
      ctx.beginPath();
      ctx.moveTo(rx, y);
      ctx.lineTo(rx, y + h);
      ctx.stroke();
    }

    // Горизонтальные линии, разделяющие заголовки и значения (на 5 мм от верха/низа).
    ctx.beginPath();
    ctx.moveTo(rightX, y + mm(5));
    ctx.lineTo(x + w, y + mm(5));
    ctx.moveTo(rightX, rcBottomY + mm(5));
    ctx.lineTo(x + w, rcBottomY + mm(5));
    ctx.stroke();

    // Метки правой колонки.
    ctx.font = `${this.mmToPx(3.5, ps)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const rcLabelsTop = ['Литера', 'Масса', 'Масштаб'];
    const rcLabelsBottom = ['Лист', '№', 'Листов'];
    rx = rightX;
    rcSubCols.forEach((cw, i) => {
      ctx.fillText(rcLabelsTop[i], rx + mm(cw) / 2, y + mm(2.5));
      ctx.fillText(rcLabelsBottom[i], rx + mm(cw) / 2, rcBottomY + mm(2.5));
      rx += mm(cw);
    });

    // Значения правой колонки.
    ctx.font = `${this.mmToPx(5, ps)}px sans-serif`;
    rx = rightX;
    ctx.fillText(tb.weight || '', rx + mm(rcSubCols[0]) / 2, y + mm(10));   // Литера
    ctx.fillText(tb.weight || '', rx + mm(rcSubCols[1]) / 2, y + mm(10));   // Масса
    ctx.fillText(tb.scaleLabel || `1:${ps}`, rx + mm(rcSubCols[2]) / 2, y + mm(10)); // Масштаб
    ctx.fillText(tb.sheetNo || '', rx + mm(rcSubCols[0]) / 2, rcBottomY + mm(10));   // Лист
    ctx.fillText(tb.docCode || '', rx + mm(rcSubCols[1]) / 2, rcBottomY + mm(10));    // №
    ctx.fillText(tb.sheetTotal || '', rx + mm(rcSubCols[2]) / 2, rcBottomY + mm(10)); // Листов

    // --- Основное поле ---
    const mainCx = mainX + mainW / 2;

    // Зона № документа (8 мм).
    ctx.font = `${this.mmToPx(3.5, ps)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('№ документа', mainCx, zDocTop + mm(2.5));
    ctx.font = `${this.mmToPx(5, ps)}px sans-serif`;
    ctx.fillText(tb.docCode || '', mainCx, zDocTop + mm(5.5));

    // Зона 1 (32 мм): дата, организация, объект, наименование.
    ctx.font = `${this.mmToPx(3.5, ps)}px sans-serif`;
    ctx.fillText('Дата', mainCx, zMainTop + mm(2));
    ctx.font = `${this.mmToPx(4.5, ps)}px sans-serif`;
    ctx.fillText(tb.date || '', mainCx, zMainTop + mm(5));

    ctx.font = `${this.mmToPx(5, ps)}px sans-serif`;
    ctx.fillText(tb.organization || '', mainCx, zMainTop + mm(10));
    ctx.font = `${this.mmToPx(4, ps)}px sans-serif`;
    ctx.fillText(tb.objectName || '', mainCx, zMainTop + mm(15));

    ctx.font = `${this.mmToPx(7, ps)}px sans-serif`;
    ctx.fillText(tb.drawingName || sheet.name || '', mainCx, zMainTop + mm(23));

    // Зона 3 (15 мм): подписи — 4 столбца.
    const signH = mm(15);
    const signColW = mainW / 4;
    for (let i = 1; i < 4; i++) {
      const vx = mainX + signColW * i;
      ctx.beginPath();
      ctx.moveTo(vx, zSignTop);
      ctx.lineTo(vx, zSignTop + signH);
      ctx.stroke();
    }
    // Горизонтальная линия подписей на 5 мм.
    ctx.beginPath();
    ctx.moveTo(mainX, zSignTop + mm(5));
    ctx.lineTo(rightX, zSignTop + mm(5));
    ctx.stroke();

    const signLabels = ['Разраб.', 'Пров.', 'Н. контр.', 'Утв.'];
    const signValues = [tb.designer, tb.checker, tb.normController, tb.approver];
    ctx.font = `${this.mmToPx(3.5, ps)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 4; i++) {
      const cx_ = mainX + signColW * (i + 0.5);
      ctx.fillText(signLabels[i], cx_, zSignTop + mm(2.5));
    }
    ctx.font = `${this.mmToPx(5, ps)}px sans-serif`;
    for (let i = 0; i < 4; i++) {
      const cx_ = mainX + signColW * (i + 0.5);
      ctx.fillText(signValues[i] || '', cx_, zSignTop + mm(10));
    }
  }

  /** Перевод мм в мировые единицы с учётом масштаба печати. */
  private mm(valueMm: number, printScale: number): number {
    return valueMm * printScale;
  }

  /**
   * Перевод мм бумаги в мировые единицы.
   * 1 мм бумаги = printScale мировых единиц.
   */
  private mmToPx(valueMm: number, printScale: number): number {
    return valueMm * printScale;
  }

  /** Толщина линии в мировых единицах с минимумом 1,5 px на экране. */
  private strokeWidth(valueMm: number, printScale: number): number {
    return Math.max(1.5 / this.camera.scale, this.mmToPx(valueMm, printScale));
  }
}
