import { Camera } from '../engine/Camera';
import { Plan } from '../model/Plan';
import { ThemeManager } from '../editor/ThemeManager';
import { getSheetDimensions } from '../model/Sheet';

/**
 * Пошаговая отрисовка основной надписи (штампа).
 * Шаг 2: каркас 185×55 мм + 11 строк по 5 мм + левая группа столбцов 10+10+10+10+15+10 мм.
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

    // Внешняя рамка листа.
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

    // Штамп 185×55 мм в правом нижнем углу внутренней рамки.
    const stampW = this.mm(185, ps);
    const stampH = this.mm(55, ps);
    const stampX = innerX + innerW - stampW;
    const stampY = innerY + innerH - stampH;

    this.renderStamp(ctx, stampX, stampY, stampW, stampH, ps);

    ctx.restore();
  }

  private renderStamp(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    ps: number,
  ): void {
    // Внешняя рамка штампа 0,7 мм.
    ctx.lineWidth = this.strokeWidth(0.7, ps);
    ctx.strokeRect(x, y, w, h);

    // Левая группа столбцов: 10+10+10+10+15+10 = 65 мм.
    const leftCols = [10, 10, 10, 10, 15, 10];
    const leftW = this.mm(leftCols.reduce((a, b) => a + b, 0), ps);

    // Размеры частей основного поля (столбец 7).
    const mainLeftW = this.mm(70, ps);
    const mainRightX = x + leftW + mainLeftW;

    // 11 горизонтальных строк по 5 мм.
    // Левая группа: все линии от x до x+65.
    // Основное поле слева (70 мм): пропускаем линии внутри объединённых ячеек:
    // - строки 10–11 объединены (r=1, y+5);
    // - строки 7–9 объединены (r=3 y+15 и r=4 y+20);
    // - строки 4–6 объединены (r=6 y+30 и r=7 y+35);
    // - строки 1–3 объединены (r=9 y+45 и r=10 y+50).
    const skippedMainLeftRows = new Set([1, 3, 4, 6, 7, 9, 10]);
    // Основное поле справа (50 мм):
    // - строки 10–11 объединены с левой частью (r=1 y+5);
    // - строки 7–9 объединены с левой частью (r=3 y+15 и r=4 y+20);
    // - строки 4–5 объединены (r=7 y+35) во всех трёх подстолбцах;
    // - строки 1–3 объединены (r=9 y+45 и r=10 y+50).
    const skippedMainRightRows = new Set([1, 3, 4, 7, 9, 10]);
    ctx.lineWidth = this.strokeWidth(0.35, ps);
    for (let r = 1; r < 11; r++) {
      const ry = y + this.mm(5 * r, ps);
      // Левая группа.
      ctx.beginPath();
      ctx.moveTo(x, ry);
      ctx.lineTo(x + leftW, ry);
      ctx.stroke();
      // Основное поле слева (70 мм).
      if (!skippedMainLeftRows.has(r)) {
        ctx.beginPath();
        ctx.moveTo(x + leftW, ry);
        ctx.lineTo(x + leftW + mainLeftW, ry);
        ctx.stroke();
      }
      // Основное поле справа (50 мм).
      if (!skippedMainRightRows.has(r)) {
        ctx.beginPath();
        ctx.moveTo(mainRightX, ry);
        ctx.lineTo(x + w, ry);
        ctx.stroke();
      }
    }

    // Вертикальная граница между левой (70 мм) и правой (50 мм) частями основного поля.
    // Рисуется только для строк 1–6 (снизу), т.е. от y+25 до y+55. Выше — убрана.
    ctx.beginPath();
    ctx.moveTo(mainRightX, y + this.mm(25, ps));
    ctx.lineTo(mainRightX, y + h);
    ctx.stroke();

    // Вертикальные границы в правой части для строк 4–6: 15+15+20 мм.
    const rightSubX1 = mainRightX + this.mm(15, ps);
    const rightSubX2 = rightSubX1 + this.mm(15, ps);
    const zoneY1 = y + this.mm(25, ps); // строка 6 (снизу)
    const zoneY2 = y + this.mm(40, ps); // строка 3 (снизу)
    ctx.beginPath();
    ctx.moveTo(rightSubX1, zoneY1);
    ctx.lineTo(rightSubX1, zoneY2);
    ctx.moveTo(rightSubX2, zoneY1);
    ctx.lineTo(rightSubX2, zoneY2);
    ctx.stroke();

    // Граница между левой группой и основным полем (x + 65 мм) — на всю высоту.
    ctx.beginPath();
    ctx.moveTo(x + leftW, y);
    ctx.lineTo(x + leftW, y + h);
    ctx.stroke();

    // Внутренние вертикали левой группы.
    // Столбцы 1–2 и 3–4 объединены в строках 1–6 (снизу вверх), т.е. от y+25 до y+55.
    // Линии между этими парами не рисуются в нижней половине.
    const row6Y = y + this.mm(5 * 5, ps); // граница между строкой 6 и 7 (снизу)
    const mergedPairs = new Set([0, 2]); // индексы левых столбцов пар (1-2 и 3-4)
    let cx = x;
    for (let i = 0; i < leftCols.length - 1; i++) {
      cx += this.mm(leftCols[i], ps);

      if (mergedPairs.has(i)) {
        // Линия между объединёнными столбцами: только в верхней части (строки 7–11).
        ctx.beginPath();
        ctx.moveTo(cx, y);
        ctx.lineTo(cx, row6Y);
        ctx.stroke();
      } else {
        // Остальные линии — на всю высоту.
        ctx.beginPath();
        ctx.moveTo(cx, y);
        ctx.lineTo(cx, y + h);
        ctx.stroke();
      }
    }

    // --- Шаг 1 надписей: заголовки левой группы (строка 7 снизу, y+20..25) ---
    const leftHeaders = ['Изм.', 'Кол.уч.', 'Лист', '№док.', 'Подп.', 'Дата'];
    const labelY = y + this.mm(22.5, ps); // середина строки 7
    ctx.font = `${this.mmToPx(2.5, ps)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let hx = x;
    for (let i = 0; i < leftCols.length; i++) {
      ctx.fillText(leftHeaders[i], hx + this.mm(leftCols[i] / 2, ps), labelY);
      hx += this.mm(leftCols[i], ps);
    }

    // --- Шаг 14: заголовки правой части (строка 6 снизу, y+25..30) ---
    const rightHeaders = ['Стадия', 'Лист', 'Листов'];
    const rightHeaderY = y + this.mm(27.5, ps); // середина строки 6
    const rightSubCenters = [
      mainRightX + this.mm(7.5, ps),  // первый подстолбец 15 мм
      rightSubX1 + this.mm(7.5, ps),  // второй подстолбец 15 мм
      rightSubX2 + this.mm(10, ps),   // третий подстолбец 20 мм
    ];
    for (let i = 0; i < rightHeaders.length; i++) {
      ctx.fillText(rightHeaders[i], rightSubCenters[i], rightHeaderY);
    }

    const tb = this.plan.activeSheet.titleBlock;
    const show = tb.show;

    // --- Строки 1–6 левой группы (роль / фамилия / подпись / дата) ---
    // Все 6 строк управляются флагами show.row1..show.row6.
    const leftMergedCenter = x + this.mm(10, ps);
    const col2Center = x + this.mm(30, ps);
    const col3Center = x + this.mm(47.5, ps);
    const col6Center = x + this.mm(60, ps);
    const dateLabel = show.date && tb.date ? this.formatDateMmYy(tb.date) : '';

    const rows: Array<{
      show: boolean;
      role: string;
      name: string;
      signature: string;
    }> = [
      { show: show.row1, role: 'Утвердил', name: tb.approver, signature: tb.signatureApprover },
      { show: show.row2, role: 'Н.контр.', name: tb.normController, signature: tb.signatureNormController },
      { show: show.row3, role: 'ГИП', name: tb.gip, signature: tb.signatureGip },
      { show: show.row4, role: 'Проверил', name: tb.checker, signature: tb.signatureChecker },
      { show: show.row5, role: 'Согласовал', name: tb.reviewer, signature: tb.signatureReviewer },
      { show: show.row6, role: 'Разраб.', name: tb.designer, signature: tb.signatureDesigner },
    ];

    for (let i = 0; i < 6; i++) {
      const row = rows[i];
      if (!row.show) continue;
      const rowY = y + this.mm(52.5 - i * 5, ps);
      ctx.fillText(row.role, leftMergedCenter, rowY);
      if (row.name) ctx.fillText(row.name, col2Center, rowY);
      if (row.signature) ctx.fillText(row.signature, col3Center, rowY);
      if (dateLabel) ctx.fillText(dateLabel, col6Center, rowY);
    }

    // --- Заполняемые поля основного поля ---
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${this.mmToPx(3.5, ps)}px sans-serif`;
    // Левая часть основного поля (70 мм)
    const mainLeftCenter = x + leftW + this.mm(35, ps);
    if (show.drawingTitle && tb.drawingTitle) {
      // строки 1–3, центр ячейки 70×15 мм
      ctx.fillText(tb.drawingTitle, mainLeftCenter, y + this.mm(47.5, ps));
    }
    if (show.section && tb.section) {
      // строки 4–6, центр ячейки 70×15 мм
      ctx.fillText(tb.section, mainLeftCenter, y + this.mm(32.5, ps));
    }
    // Правая часть основного поля (50 мм)
    if (show.address && tb.address) {
      // строки 7–9, центр ячейки 20×15 мм (столбец 7)
      ctx.fillText(tb.address, mainRightX + this.mm(40, ps), y + this.mm(17.5, ps));
    }
    if (show.projectCode && tb.projectCode) {
      // строки 10–11, центр ячейки 20×10 мм (столбец 7)
      ctx.fillText(tb.projectCode, mainRightX + this.mm(40, ps), y + this.mm(5, ps));
    }

    // --- Правая часть: Стадия ---
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${this.mmToPx(2.5, ps)}px sans-serif`;
    // Стадия — в объединённых строках 4–5 левого подстолбца правой части (15×10 мм), по центру
    if (show.stage) {
      ctx.fillText(tb.stage, mainRightX + this.mm(7.5, ps), y + this.mm(35, ps));
    }

    // --- Масса и масштаб (графы 24-25) ---
    const bottomY = y + this.mm(52.5, ps);
    if (show.weight && tb.weight) {
      ctx.fillText(tb.weight, mainRightX + this.mm(25, ps), bottomY);
    }
    if (show.scaleLabel && tb.scaleLabel) {
      ctx.fillText(tb.scaleLabel, mainRightX + this.mm(40, ps), bottomY);
    }
  }

  /** Форматирует дату в мм.гг (например 08.26). */
  private formatDateMmYy(dateStr: string): string {
    const parts = dateStr.split(/[.\\/-]/);
    if (parts.length >= 3) {
      const mm = parts[1]?.padStart(2, '0') ?? '';
      const yy = parts[2]?.slice(-2) ?? '';
      return `${mm}.${yy}`;
    }
    // Если формат уже мм.гг или не распарсился — оставляем как есть
    return dateStr;
  }

  /** Перевод мм в мировые единицы. */
  private mmToPx(valueMm: number, printScale: number): number {
    return valueMm * printScale;
  }

  /** Перевод мм в мировые единицы с учётом масштаба печати. */
  private mm(valueMm: number, printScale: number): number {
    return valueMm * printScale;
  }

  /** Толщина линии в мировых единицах с минимумом 1,5 px на экране. */
  private strokeWidth(valueMm: number, printScale: number): number {
    return Math.max(1.5 / this.camera.scale, valueMm * printScale);
  }
}
