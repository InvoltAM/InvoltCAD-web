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
 *
 * Линии:
 *  - основная толщина S принята 0,7 мм;
 *  - внешняя рамка (формата) — 0,25 мм (≈ S/3);
 *  - внутренняя рамка — 0,7 мм (S);
 *  - линии штампа и насечки — 0,25 мм.
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

    // Внешняя рамка (линия формата) — тонкая.
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

    // Вертикальные полосы переплёта в левом поле 20 мм.
    this.drawBindingMargin(ctx, x0 + otherMargin, y0 + paperH - otherMargin, ps);

    // Рамка для сквозной нумерации листов в правом верхнем углу внутренней рамки: 10×7 мм.
    this.drawPageNumberBox(ctx, innerX + innerW - this.mm(10, ps), innerY, this.mm(10, ps), this.mm(7, ps), ps);

    // Основная надпись (штамп) 185×55 мм в правом нижнем углу внутренней рамки.
    const stampW = this.mm(185, ps);
    const stampH = this.mm(55, ps);
    const stampX = innerX + innerW - stampW;
    const stampY = innerY + innerH - stampH;
    this.renderTitleBlock(ctx, sheet, stampX, stampY, stampW, stampH);

    // Подпись формата и масштаба внутри внутренней рамки сверху по центру.
    ctx.font = `${this.mmToPx(5, ps)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const label = `${sheet.pageSize} ${sheet.orientation === 'landscape' ? 'landscape' : 'portrait'} 1:${ps}`;
    ctx.fillText(label, cx, innerY + this.mmToPx(2, ps));

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

  /** Вертикальные полосы переплёта в левом поле 20 мм (подписи при сшивке). */
  private drawBindingMargin(
    ctx: CanvasRenderingContext2D,
    leftX: number,
    bottomY: number,
    ps: number,
  ): void {
    // Две полосы 7×35 мм, расположенные у нижнего края левого поля.
    // Левая полоса — "Подп. и дата", правая — "Инв. № подл.".
    const stripW = this.mm(7, ps);
    const stripH = this.mm(35, ps);
    const gap = this.mm(1, ps);

    ctx.lineWidth = this.strokeWidth(0.25, ps);
    ctx.strokeRect(leftX, bottomY - stripH, stripW, stripH);
    ctx.strokeRect(leftX + stripW + gap, bottomY - stripH, stripW, stripH);

    this.drawVerticalText(ctx, 'Подп. и дата', leftX + stripW / 2, bottomY - stripH / 2, 3, ps);
    this.drawVerticalText(ctx, 'Инв. № подл.', leftX + stripW + gap + stripW / 2, bottomY - stripH / 2, 3, ps);
  }

  /** Рамка для сквозной нумерации листов (правый верхний угол). */
  private drawPageNumberBox(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    ps: number,
  ): void {
    ctx.lineWidth = this.strokeWidth(0.25, ps);
    ctx.strokeRect(x, y, w, h);

    // Внутренняя вертикальная линия отсекает квадрат 7×7 мм слева.
    ctx.beginPath();
    ctx.moveTo(x + h, y);
    ctx.lineTo(x + h, y + h);
    ctx.stroke();

    ctx.font = `${this.mmToPx(3.5, ps)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Лист', x + h / 2, y + h / 2);
    ctx.fillText('№', x + h + (w - h) / 2, y + h / 2);
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
    // Заголовки колонок (центрируем в верхних 4 строках = 20 мм).
    ctx.font = `${this.mmToPx(3.5, ps)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const leftHeaders = ['Изм.', 'Лист', '№ докум.', 'Подпись', 'Дата'];
    cx = x;
    leftCols.forEach((cw, i) => {
      ctx.fillText(leftHeaders[i], cx + mm(cw) / 2, y + mm(10));
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

    // Горизонтальные зоны по высоте: 8, 7, 15, 15, 10 мм.
    const zoneHs = [8, 7, 15, 15, 10];
    let zy = y;
    for (const zh of zoneHs.slice(0, -1)) {
      zy += mm(zh);
      ctx.beginPath();
      ctx.moveTo(mainX, zy);
      ctx.lineTo(x + w, zy);
      ctx.stroke();
    }

    // Высоты зон (накопленные).
    const z1 = y + mm(8);
    const z2 = z1 + mm(7);
    const z3 = z2 + mm(15);
    const z4 = z3 + mm(15);
    // const z5 = z4 + mm(10); // нижняя граница

    // --- Правая колонка ---
    // Верхние 15 мм: Литера / Масса / Масштаб (подколонки 15/15/20 мм).
    const rcTopY = y;
    const rcMidY = y + mm(15);
    const rcSubCols = [15, 15, 20];
    let rx = rightX;
    for (const cw of rcSubCols.slice(0, -1)) {
      rx += mm(cw);
      ctx.beginPath();
      ctx.moveTo(rx, rcTopY);
      ctx.lineTo(rx, rcMidY);
      ctx.stroke();
    }
    // Средние 15 мм: Лист / № / Листов (подколонки 15/15/20 мм).
    rx = rightX;
    for (const cw of rcSubCols.slice(0, -1)) {
      rx += mm(cw);
      ctx.beginPath();
      ctx.moveTo(rx, rcMidY);
      ctx.lineTo(rx, y + h);
      ctx.stroke();
    }
    // Горизонтальная линия, разделяющая заголовки и значения в каждой подзоне (на 5 мм).
    ctx.beginPath();
    ctx.moveTo(rightX, y + mm(5));
    ctx.lineTo(rightX + rightW, y + mm(5));
    ctx.moveTo(rightX, y + mm(20));
    ctx.lineTo(rightX + rightW, y + mm(20));
    ctx.stroke();

    // Метки правой колонки.
    ctx.font = `${this.mmToPx(3.5, ps)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const rcLabelsTop = ['Литера', 'Масса', 'Масштаб'];
    const rcLabelsMid = ['Лист', '№', 'Листов'];
    rx = rightX;
    rcSubCols.forEach((cw, i) => {
      ctx.fillText(rcLabelsTop[i], rx + mm(cw) / 2, y + mm(2.5));
      ctx.fillText(rcLabelsMid[i], rx + mm(cw) / 2, y + mm(17.5));
      rx += mm(cw);
    });

    // Значения правой колонки.
    ctx.font = `${this.mmToPx(5, ps)}px sans-serif`;
    rx = rightX;
    ctx.fillText(tb.weight || '', rx + mm(rcSubCols[0]) / 2, y + mm(10));
    ctx.fillText(tb.weight || '', rx + mm(rcSubCols[1]) / 2, y + mm(10));
    ctx.fillText(tb.scaleLabel || `1:${ps}`, rx + mm(rcSubCols[2]) / 2, y + mm(10));
    ctx.fillText(tb.sheetNo || '', rx + mm(rcSubCols[0]) / 2, y + mm(25));
    ctx.fillText(tb.docCode || '', rx + mm(rcSubCols[1]) / 2, y + mm(25));
    ctx.fillText(tb.sheetTotal || '', rx + mm(rcSubCols[2]) / 2, y + mm(25));

    // --- Основное поле ---
    const mainCx = mainX + mainW / 2;

    // Зона 1 (8 мм): № документа.
    ctx.font = `${this.mmToPx(3.5, ps)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('№ документа', mainCx, y + mm(3));
    ctx.font = `${this.mmToPx(5, ps)}px sans-serif`;
    ctx.fillText(tb.docCode || '', mainCx, y + mm(6));

    // Зона 2 (7 мм): дата.
    ctx.font = `${this.mmToPx(3.5, ps)}px sans-serif`;
    ctx.fillText('Дата', mainCx, z1 + mm(2));
    ctx.font = `${this.mmToPx(5, ps)}px sans-serif`;
    ctx.fillText(tb.date || '', mainCx, z1 + mm(5));

    // Зона 3 (15 мм): организация и объект.
    ctx.font = `${this.mmToPx(5, ps)}px sans-serif`;
    ctx.fillText(tb.organization || '', mainCx, z2 + mm(5));
    ctx.font = `${this.mmToPx(4, ps)}px sans-serif`;
    ctx.fillText(tb.objectName || '', mainCx, z2 + mm(10));

    // Зона 4 (15 мм): наименование чертежа.
    ctx.font = `${this.mmToPx(7, ps)}px sans-serif`;
    ctx.fillText(tb.drawingName || sheet.name || '', mainCx, z3 + mm(7.5));

    // Зона 5 (10 мм): подписи — 4 столбца.
    const signTop = z4;
    const signH = mm(10);
    const signColW = mainW / 4;
    for (let i = 1; i < 4; i++) {
      const vx = mainX + signColW * i;
      ctx.beginPath();
      ctx.moveTo(vx, signTop);
      ctx.lineTo(vx, signTop + signH);
      ctx.stroke();
    }
    // Горизонтальная линия подписей на 5 мм.
    ctx.beginPath();
    ctx.moveTo(mainX, signTop + mm(5));
    ctx.lineTo(rightX, signTop + mm(5));
    ctx.stroke();

    const signLabels = ['Разраб.', 'Пров.', 'Н. контр.', 'Утв.'];
    const signValues = [tb.designer, tb.checker, tb.normController, tb.approver];
    ctx.font = `${this.mmToPx(3.5, ps)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 4; i++) {
      const cx_ = mainX + signColW * (i + 0.5);
      ctx.fillText(signLabels[i], cx_, signTop + mm(2.5));
    }
    ctx.font = `${this.mmToPx(5, ps)}px sans-serif`;
    for (let i = 0; i < 4; i++) {
      const cx_ = mainX + signColW * (i + 0.5);
      ctx.fillText(signValues[i] || '', cx_, signTop + mm(7.5));
    }
  }

  /** Перевод мм в мировые единицы с учётом масштаба печати. */
  private mm(valueMm: number, printScale: number): number {
    return valueMm * printScale;
  }

  /**
   * Перевод мм бумаги в мировые единицы.
   * 1 мм бумаги = printScale мировых единиц. Поскольку контекст уже масштабирован
   * камерой, результат задаёт размер в мировых координатах, который на экране
   * даст требуемый пиксельный размер.
   */
  private mmToPx(valueMm: number, printScale: number): number {
    return valueMm * printScale;
  }

  /** Толщина линии в мировых единицах с минимумом 1,5 px на экране. */
  private strokeWidth(valueMm: number, printScale: number): number {
    return Math.max(1.5 / this.camera.scale, this.mmToPx(valueMm, printScale));
  }

  /** Вертикальный текст по центру точки (снизу вверх). */
  private drawVerticalText(
    ctx: CanvasRenderingContext2D,
    text: string,
    cx: number,
    cy: number,
    sizeMm: number,
    ps: number,
  ): void {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${this.mmToPx(sizeMm, ps)}px sans-serif`;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
}
