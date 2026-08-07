import { Camera } from '../engine/Camera';
import { Plan } from '../model/Plan';
import { ThemeManager } from '../editor/ThemeManager';
import { getSheetDimensions, Sheet } from '../model/Sheet';

/**
 * Отрисовка рамки листа и основной надписи (штампа) по ГОСТ Р 21.101-2020,
 * приложение Ж, форма 3 (основная надпись без дополнительной графы 27).
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

  /**
   * Основная надпись по ГОСТ Р 21.101-2020, приложение Ж, форма 3.
   * Штамп 185×55 мм.
   * - Левая группа учёта изменений: 10+10+10+10+15+10 = 65 мм.
   * - Основное поле: 120 мм (70 мм левая часть + 50 мм правая часть).
   * - Высотные зоны основного поля: 10+15+10+15+5 = 55 мм.
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

    // Общая обводка штампа.
    ctx.lineWidth = this.strokeWidth(0.5, ps);
    ctx.strokeRect(x, y, w, h);

    // --- Левая группа колонок учёта изменений ---
    const leftCols = [10, 10, 10, 10, 15, 10];
    const leftHeaders = ['Изм.', 'Кол.уч.', 'Лист', '№ док.', 'Подп.', 'Дата'];
    const leftW = mm(leftCols.reduce((a, b) => a + b, 0)); // 65 мм

    // Вертикальные разделители левой группы (на всю высоту штампа).
    let cx = x;
    for (const cw of leftCols.slice(0, -1)) {
      cx += mm(cw);
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(cx, y + h);
      ctx.stroke();
    }

    // 11 горизонтальных строк по 5 мм в левой группе.
    ctx.lineWidth = this.strokeWidth(0.35, ps);
    for (let r = 1; r < 11; r++) {
      const ry = y + mm(5 * r);
      ctx.beginPath();
      ctx.moveTo(x, ry);
      ctx.lineTo(x + leftW, ry);
      ctx.stroke();
    }

    // Заголовки колонок — первая строка (5 мм).
    this.setFont(ctx, 3.5, ps);
    cx = x;
    leftCols.forEach((cw, i) => {
      this.fillCentered(ctx, leftHeaders[i], cx + mm(cw) / 2, y + mm(2.5));
      cx += mm(cw);
    });

    // --- Основное поле ---
    const mainX = x + leftW; // x + 65
    const mainW = mm(120);   // от mainX до x + w
    const leftPartW = mm(70);
    const rightX = mainX + leftPartW; // x + 135

    // Вертикальная граница левая/правая части основного поля.
    ctx.lineWidth = this.strokeWidth(0.35, ps);
    ctx.beginPath();
    ctx.moveTo(rightX, y);
    ctx.lineTo(rightX, y + mm(50)); // до нижней границы рабочих зон
    ctx.stroke();

    // Горизонтальные разделители основного поля.
    const rowYs = [mm(10), mm(25), mm(35), mm(50)]; // относительно y
    for (const dy of rowYs) {
      ctx.beginPath();
      ctx.moveTo(mainX, y + dy);
      ctx.lineTo(x + w, y + dy);
      ctx.stroke();
    }

    // Вертикальные разделители правой части (15+15+20) только в зонах 2–3.
    const rightSubCols = [15, 15, 20];
    let rx = rightX;
    for (const cw of rightSubCols.slice(0, -1)) {
      rx += mm(cw);
      ctx.beginPath();
      ctx.moveTo(rx, y + mm(10));
      ctx.lineTo(rx, y + mm(35));
      ctx.stroke();
    }

    // --- Заполнение основного поля ---
    // Зона 1 (высота 10): наименование организации.
    this.setFont(ctx, 5, ps);
    this.fillCentered(ctx, tb.organization || '', mainX + mainW / 2, y + mm(5));

    // Зона 2 (левая часть, высота 15): обозначение документа.
    this.setFont(ctx, 3.5, ps);
    this.fillCentered(ctx, '№ документа', mainX + leftPartW / 2, y + mm(12.5));
    this.setFont(ctx, 4.5, ps);
    this.fillCentered(ctx, tb.docCode || '', mainX + leftPartW / 2, y + mm(20));

    // Зона 3 (левая часть, высота 10): наименование документа/листа.
    this.setFont(ctx, 4, ps);
    this.fillCentered(ctx, tb.drawingName || sheet.name || '', mainX + leftPartW / 2, y + mm(30));

    // Зона 4 (левая часть, высота 15): подписи — 4 столбца.
    const signCount = 4;
    const signW = leftPartW / signCount;
    const signTop = y + mm(35);
    const signBottom = y + mm(50);
    for (let i = 1; i < signCount; i++) {
      const vx = mainX + signW * i;
      ctx.beginPath();
      ctx.moveTo(vx, signTop);
      ctx.lineTo(vx, signBottom);
      ctx.stroke();
    }
    // Горизонтальная линия подписей на 5 мм от верха зоны.
    ctx.beginPath();
    ctx.moveTo(mainX, signTop + mm(5));
    ctx.lineTo(rightX, signTop + mm(5));
    ctx.stroke();

    const signLabels = ['Разраб.', 'Пров.', 'Н. контр.', 'Утв.'];
    const signValues = [tb.designer, tb.checker, tb.normController, tb.approver];
    this.setFont(ctx, 3.5, ps);
    for (let i = 0; i < signCount; i++) {
      const cx_ = mainX + signW * (i + 0.5);
      this.fillCentered(ctx, signLabels[i], cx_, signTop + mm(2.5));
    }
    this.setFont(ctx, 4, ps);
    for (let i = 0; i < signCount; i++) {
      const cx_ = mainX + signW * (i + 0.5);
      this.fillCentered(ctx, signValues[i] || '', cx_, signTop + mm(10));
    }

    // --- Правая часть основного поля (50 мм) ---
    // Заголовки верхней зоны (стадия, лист, листов) — высота 5 мм внутри зоны 2.
    const rightLabels = ['Стадия', 'Лист', 'Листов'];
    const rightValues = [tb.stage, tb.sheetNo, tb.sheetTotal];
    this.setFont(ctx, 3.5, ps);
    rx = rightX;
    rightSubCols.forEach((cw, i) => {
      this.fillCentered(ctx, rightLabels[i], rx + mm(cw) / 2, y + mm(12.5));
      rx += mm(cw);
    });

    // Значения стадии, листа, листов — зона 3 (высота 10).
    this.setFont(ctx, 4.5, ps);
    rx = rightX;
    rightSubCols.forEach((cw, i) => {
      this.fillCentered(ctx, rightValues[i] || '', rx + mm(cw) / 2, y + mm(30));
      rx += mm(cw);
    });

    // Зона 9 (правая нижняя, 50×15): масштаб.
    this.setFont(ctx, 3.5, ps);
    this.fillCentered(ctx, 'Масштаб', rightX + mm(25), signTop + mm(2.5));
    this.setFont(ctx, 4.5, ps);
    const scaleText = tb.scaleLabel || `1:${ps}`;
    this.fillCentered(ctx, scaleText, rightX + mm(25), signTop + mm(10));

    // --- Нижняя строка "Формат" (высота 5 мм) на всю ширину штампа ---
    const formatLabel = `Формат ${sheet.pageSize} ${sheet.orientation === 'landscape' ? 'альбомный' : 'портретный'}`;
    this.setFont(ctx, 3.5, ps);
    this.fillCentered(ctx, formatLabel, x + w / 2, y + mm(52.5));
  }

  /** Устанавливает шрифт для текста штампа (размер в мм бумаги). */
  private setFont(
    ctx: CanvasRenderingContext2D,
    sizeMm: number,
    printScale: number,
  ): void {
    ctx.font = `${this.mmToPx(sizeMm, printScale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
  }

  /** Рисует текст, выровненный по центру ячейки. */
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
