import { Camera } from '../engine/Camera';
import { Plan } from '../model/Plan';
import { SheetTable, SheetTableType } from '../model/SheetTable';
import { Vector2 } from '../geometry/Vector2';
import { ThemeManager } from '../editor/ThemeManager';
import { CABLE_TYPES } from '../model/Cable';
import { DEFAULT_DEVICE_NAMES } from '../model/Device';

interface TableRow {
  cells: string[];
  bold?: boolean;
}

interface TableData {
  title: string;
  headers: string[];
  rows: TableRow[];
  colWeights: number[];
  colExtraChars?: number[];
  autoWidth?: boolean;
}

const TABLE_WIDTH_MM = 120;
const ROW_HEIGHT_MM = 7;
const HEADER_HEIGHT_MM = 8;
const TITLE_HEIGHT_MM = 8;
const PADDING_MM = 2.5;
const FONT_SIZE_MM = 2.0;
const LINE_WIDTH_MM = 0.35;
const SELECTED_LINE_WIDTH_MM = 0.6;
const FALLBACK_HEIGHT_MM = 40;
const HANDLE_SIZE_MM = 3;
const MIN_SCALE = 0.3;

export type TableResizeCorner = 'nw' | 'ne' | 'sw' | 'se';

export class TableRenderer {
  private selectedTableIds: string[] = [];

  constructor(
    private plan: Plan,
    private camera: Camera,
    private themeManager: ThemeManager,
  ) {}

  setSelectedTableIds(ids: string[]): void {
    this.selectedTableIds = ids;
  }

  private isSelected(table: SheetTable): boolean {
    return this.selectedTableIds.includes(table.id);
  }

  private getColor(key: string): string {
    return this.themeManager?.getColor(key as any) ?? '#111827';
  }

  render(ctx: CanvasRenderingContext2D): void {
    const tables = this.plan.tables;
    if (tables.length === 0) return;

    ctx.save();
    // Рисуем таблицы в мировых координатах — они масштабируются вместе с рамкой листа.

    for (const table of tables) {
      const data = this.buildTableData(table.type);
      if (!data) continue;
      const width = this.computeTableWidth(ctx, table, data);
      const height = this.tableHeight(data, table);
      table.width = width;
      table.height = height;
      this.drawTable(ctx, table, data, width, height);
    }

    ctx.restore();
  }

  /**
   * Границы таблицы в мировых координатах (для hit-test и выделения).
   */
  getTableBounds(table: SheetTable, data?: TableData): { min: Vector2; max: Vector2 } {
    const d = data ?? this.buildTableData(table.type);
    const height = d ? this.tableHeight(d, table) : this.mm(FALLBACK_HEIGHT_MM) * this.tableScale(table);
    const width = d ? this.tableWidth(table, d) : this.mm(TABLE_WIDTH_MM) * this.tableScale(table);
    const pos = new Vector2(table.position.x, table.position.y);
    return {
      min: pos,
      max: new Vector2(pos.x + width, pos.y + height),
    };
  }

  /**
   * Границы таблицы в экранных координатах.
   */
  getTableScreenBounds(table: SheetTable, data?: TableData): { min: Vector2; max: Vector2 } {
    const bounds = this.getTableBounds(table, data);
    return {
      min: this.camera.worldToScreen(bounds.min),
      max: this.camera.worldToScreen(bounds.max),
    };
  }

  /**
   * Размер ручки изменения размера в мировых координатах
   * (минимум 8 px на экране, чтобы было удобно тянуть мышью).
   */
  getHandleSize(table: SheetTable): number {
    const base = this.mm(HANDLE_SIZE_MM) * this.tableScale(table);
    const minWorld = 8 / this.camera.scale;
    return Math.max(base, minWorld);
  }

  /**
   * Hit-test для ручек изменения размера (в экранных координатах).
   */
  hitTestResizeHandle(
    screenPoint: Vector2,
    table: SheetTable,
    data?: TableData,
  ): { table: SheetTable; corner: TableResizeCorner } | null {
    const bounds = this.getTableScreenBounds(table, data);
    const handleSize = this.getHandleSize(table) * this.camera.scale;
    const corners: Array<{ corner: TableResizeCorner; point: Vector2 }> = [
      { corner: 'nw', point: bounds.min },
      { corner: 'ne', point: new Vector2(bounds.max.x, bounds.min.y) },
      { corner: 'sw', point: new Vector2(bounds.min.x, bounds.max.y) },
      { corner: 'se', point: bounds.max },
    ];
    for (const { corner, point } of corners) {
      if (point.distanceTo(screenPoint) <= handleSize) {
        return { table, corner };
      }
    }
    return null;
  }

  getAnchorForCorner(corner: TableResizeCorner, bounds: { min: Vector2; max: Vector2 }): Vector2 {
    switch (corner) {
      case 'nw': return bounds.max;
      case 'ne': return new Vector2(bounds.min.x, bounds.max.y);
      case 'sw': return new Vector2(bounds.max.x, bounds.min.y);
      case 'se': return bounds.min;
    }
  }

  private get printScale(): number {
    return this.plan.activeSheet?.printScale || 100;
  }

  private mm(valueMm: number): number {
    return valueMm * this.printScale;
  }

  private px(valueMm: number): number {
    return this.mm(valueMm);
  }

  private strokeWidth(valueMm: number, table: SheetTable): number {
    return Math.max(1.5 / this.camera.scale, this.mm(valueMm) * this.tableScale(table));
  }

  private tableScale(table: SheetTable): number {
    return table.scale ?? 1;
  }

  private computeTableWidth(ctx: CanvasRenderingContext2D, table: SheetTable, data: TableData): number {
    const scale = this.tableScale(table);
    const padding = this.mm(PADDING_MM) * scale;
    const fontSize = this.px(FONT_SIZE_MM) * scale;
    if (data.autoWidth) {
      const colWidths = this.measureColWidths(ctx, data, fontSize).map((w) => w + padding);
      return colWidths.reduce((a, b) => a + b, 0) + padding;
    }
    return this.mm(TABLE_WIDTH_MM) * scale;
  }

  private tableWidth(table: SheetTable, data?: TableData): number {
    const d = data ?? this.buildTableData(table.type);
    if (!d) return this.mm(TABLE_WIDTH_MM) * this.tableScale(table);
    if (d.autoWidth) {
      return this.approximateTableWidth(table, d);
    }
    return this.mm(TABLE_WIDTH_MM) * this.tableScale(table);
  }

  private approximateTableWidth(table: SheetTable, data: TableData): number {
    const scale = this.tableScale(table);
    const padding = this.mm(PADDING_MM) * scale;
    const fontSize = this.px(FONT_SIZE_MM) * scale;
    const charWidth = fontSize * 0.6;
    const extra = data.colExtraChars ?? data.colWeights.map(() => 0);
    let total = 0;
    for (let i = 0; i < data.headers.length; i++) {
      const header = data.headers[i];
      let maxLen = header.length;
      for (const row of data.rows) {
        if (i < row.cells.length) {
          maxLen = Math.max(maxLen, row.cells[i].length);
        }
      }
      total += maxLen * charWidth + (extra[i] ?? 0) * charWidth + padding;
    }
    return total + padding;
  }

  private measureColWidths(ctx: CanvasRenderingContext2D, data: TableData, fontSize: number): number[] {
    const charWidth = ctx.measureText('0').width || fontSize * 0.5;
    const extra = data.colExtraChars ?? data.colWeights.map(() => 0);
    const widths: number[] = [];
    for (let i = 0; i < data.headers.length; i++) {
      ctx.font = `bold ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
      const headerWidth = ctx.measureText(data.headers[i]).width;
      let maxCellWidth = 0;
      for (const row of data.rows) {
        if (i < row.cells.length) {
          const isBold = row.bold ?? false;
          ctx.font = `${isBold ? 'bold ' : ''}${fontSize}px ui-sans-serif, system-ui, sans-serif`;
          const w = ctx.measureText(row.cells[i]).width;
          if (w > maxCellWidth) maxCellWidth = w;
        }
      }
      widths.push(Math.max(headerWidth, maxCellWidth) + (extra[i] ?? 0) * charWidth);
    }
    return widths;
  }

  private tableHeight(data: TableData, table: SheetTable): number {
    return this.mm(TITLE_HEIGHT_MM + HEADER_HEIGHT_MM + data.rows.length * ROW_HEIGHT_MM + PADDING_MM * 2) * this.tableScale(table);
  }

  private buildTableData(type: SheetTableType): TableData | null {
    switch (type) {
      case 'cables':
        return this.buildCablesData();
      case 'spec':
        return this.buildSpecData();
      case 'roomNumbers':
        return this.buildRoomNumbersData();
      default:
        return null;
    }
  }

  private buildCablesData(): TableData {
    const cables = this.plan.cables;
    const rows: TableRow[] = cables.map((c, i) => {
      const brand = (c.brand ?? '').trim() || CABLE_TYPES[c.type] || c.type;
      const lengthM = ((c.totalLength ?? c.length) / 1000).toFixed(1);
      return { cells: [String(i + 1), c.marking ?? '', brand, `${c.crossSection} мм²`, `${lengthM} м`] };
    });
    return {
      title: 'Кабели',
      headers: ['№', 'Маркировка', 'Марка', 'Сечение', 'Длина'],
      rows,
      colWeights: [0.5, 1.2, 1.2, 0.8, 0.8],
    };
  }

  private buildSpecData(): TableData {
    const devices = this.plan.devices;
    const cables = this.plan.cables;
    const rows: TableRow[] = [];

    const deviceGroups = new Map<string, { label: string; count: number }>();
    for (const d of devices) {
      const label = DEFAULT_DEVICE_NAMES[d.type] ?? d.type;
      const existing = deviceGroups.get(label);
      if (existing) existing.count++;
      else deviceGroups.set(label, { label, count: 1 });
    }
    if (deviceGroups.size > 0) {
      rows.push({ cells: ['Оборудование'], bold: true });
      for (const g of deviceGroups.values()) {
        rows.push({ cells: [g.label, `${g.count} шт`] });
      }
    }

    const cableGroups = new Map<string, { label: string; count: number; totalLengthM: number }>();
    for (const c of cables) {
      const brand = (c.brand ?? '').trim() || CABLE_TYPES[c.type] || c.type;
      const key = `${brand} ${c.crossSection} мм²`;
      const totalMm = c.totalLength ?? c.length;
      const existing = cableGroups.get(key);
      if (existing) {
        existing.count++;
        existing.totalLengthM += totalMm / 1000;
      } else {
        cableGroups.set(key, { label: key, count: 1, totalLengthM: totalMm / 1000 });
      }
    }
    if (cableGroups.size > 0) {
      rows.push({ cells: ['Кабели'], bold: true });
      for (const g of cableGroups.values()) {
        rows.push({ cells: [g.label, `${g.totalLengthM.toFixed(1)} м`] });
      }
    }

    return {
      title: 'Спецификация листа',
      headers: ['Наименование', 'Кол-во'],
      rows,
      colWeights: [0.5, 1],
      colExtraChars: [0, 4],
    };
  }

  private buildRoomNumbersData(): TableData {
    const rooms = this.plan.getRooms();
    const rows: TableRow[] = rooms.map((r, i) => ({
      cells: [String(r.number ?? i + 1), r.name ?? ''],
    }));
    return {
      title: '№ помещения',
      headers: ['№', 'Наименование'],
      rows,
      colWeights: [0, 0],
      colExtraChars: [0, 0],
      autoWidth: true,
    };
  }

  private drawTable(
    ctx: CanvasRenderingContext2D,
    table: SheetTable,
    data: TableData,
    width: number,
    height: number,
  ): void {
    const x = table.position.x;
    const y = table.position.y;
    const scale = this.tableScale(table);
    const padding = this.mm(PADDING_MM) * scale;
    const titleHeight = this.mm(TITLE_HEIGHT_MM) * scale;
    const headerHeight = this.mm(HEADER_HEIGHT_MM) * scale;
    const rowHeight = this.mm(ROW_HEIGHT_MM) * scale;
    const fontSize = this.px(FONT_SIZE_MM) * scale;
    const selected = this.isSelected(table);

    const textColor = this.getColor('text');
    const borderColor = this.getColor('wall');
    const bgColor = this.getColor('textBg');
    const headerBg = this.getColor('wallStroke');

    // Фон
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, width, height);

    // Рамка
    ctx.strokeStyle = selected ? this.getColor('selected') : borderColor;
    ctx.lineWidth = selected ? this.strokeWidth(SELECTED_LINE_WIDTH_MM, table) : this.strokeWidth(LINE_WIDTH_MM, table);
    ctx.strokeRect(x, y, width, height);

    // Заголовок таблицы
    ctx.fillStyle = headerBg;
    ctx.fillRect(x, y, width, titleHeight);
    ctx.fillStyle = textColor;
    ctx.font = `bold ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(data.title, x + padding, y + titleHeight / 2);

    // Шапка
    const headerY = y + titleHeight;
    ctx.fillStyle = headerBg;
    ctx.fillRect(x, headerY, width, headerHeight);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = this.strokeWidth(LINE_WIDTH_MM, table);
    ctx.strokeRect(x, headerY, width, headerHeight);

    ctx.fillStyle = textColor;
    ctx.font = `bold ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
    const colWidths = this.calcColWidths(data, width, padding, ctx, fontSize);
    let cellX = x + padding;
    for (let i = 0; i < data.headers.length; i++) {
      ctx.fillText(data.headers[i], cellX, headerY + headerHeight / 2);
      cellX += colWidths[i];
    }

    // Строки
    let rowY = headerY + headerHeight;
    for (const row of data.rows) {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = this.strokeWidth(LINE_WIDTH_MM, table);
      ctx.strokeRect(x, rowY, width, rowHeight);
      ctx.fillStyle = textColor;
      const isBold = row.bold ?? false;
      ctx.font = `${isBold ? 'bold ' : ''}${fontSize}px ui-sans-serif, system-ui, sans-serif`;
      let cellX2 = x + padding;
      for (let i = 0; i < row.cells.length; i++) {
        ctx.fillText(row.cells[i], cellX2, rowY + rowHeight / 2);
        cellX2 += colWidths[i];
      }
      rowY += rowHeight;
    }

    // Вертикальные линии между колонками
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = this.strokeWidth(LINE_WIDTH_MM, table);
    let lineX = x;
    for (let i = 0; i < data.headers.length - 1; i++) {
      lineX += colWidths[i];
      ctx.beginPath();
      ctx.moveTo(lineX, headerY);
      ctx.lineTo(lineX, rowY);
      ctx.stroke();
    }

    if (selected) {
      this.drawResizeHandles(ctx, table, width, height);
    }
  }

  private drawResizeHandles(ctx: CanvasRenderingContext2D, table: SheetTable, width: number, height: number): void {
    const x = table.position.x;
    const y = table.position.y;
    const handleSize = this.getHandleSize(table);
    const half = handleSize / 2;
    const corners = [
      new Vector2(x - half, y - half),
      new Vector2(x + width - half, y - half),
      new Vector2(x - half, y + height - half),
      new Vector2(x + width - half, y + height - half),
    ];
    ctx.fillStyle = this.getColor('selected');
    ctx.strokeStyle = this.getColor('textBg');
    ctx.lineWidth = this.strokeWidth(0.25, table);
    for (const corner of corners) {
      ctx.fillRect(corner.x, corner.y, handleSize, handleSize);
      ctx.strokeRect(corner.x, corner.y, handleSize, handleSize);
    }
  }

  private calcColWidths(
    data: TableData,
    totalWidth: number,
    padding: number,
    ctx: CanvasRenderingContext2D,
    fontSize: number,
  ): number[] {
    if (data.autoWidth) {
      // При автоширине колонка = содержимое + внутренний отступ.
      // Внешние отступы таблицы добавляются в computeTableWidth.
      return this.measureColWidths(ctx, data, fontSize).map((w) => w + padding);
    }

    const weights = data.colWeights;
    const extraChars = data.colExtraChars ?? weights.map(() => 0);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const available = totalWidth - padding * 2;
    if (totalWeight <= 0 || available <= 0) {
      return weights.map(() => 0);
    }

    const charWidth = ctx.measureText('0').width || fontSize * 0.5;
    const minWidths = weights.map((_, i) => {
      const header = data.headers[i] ?? '';
      const textWidth = ctx.measureText(header).width;
      return textWidth + (extraChars[i] ?? 0) * charWidth;
    });

    const totalMin = minWidths.reduce((a, b) => a + b, 0);
    const extra = Math.max(0, available - totalMin);
    return weights.map((w, i) => minWidths[i] + (extra * w) / totalWeight);
  }
}
