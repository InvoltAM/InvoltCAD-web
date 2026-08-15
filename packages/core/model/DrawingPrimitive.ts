import { Vector2 } from '../geometry/Vector2';

export type DrawingPrimitiveType = 'polyline' | 'segment' | 'rectangle' | 'circle' | 'text' | 'table';

export interface DrawingTableCell {
  row: number;
  col: number;
  text?: string;
  rowSpan?: number;
  colSpan?: number;
}

export interface DrawingTable {
  rows: number;
  cols: number;
  cells: DrawingTableCell[];
  columnWidths: number[];
  rowHeights: number[];
  fontSize?: number;
}

export interface DrawingPrimitive {
  id: string;
  type: DrawingPrimitiveType;
  points: Vector2[];
  /** Текстовое содержимое (для типа 'text' и примитивов с подписями). */
  text?: string;
  /** Размер шрифта в миллиметрах (для типа 'text'). */
  fontSize?: number;
  /** Семейство шрифта (для типа 'text'). */
  fontFamily?: string;
  /** Цвет текста в формате hex/rgb (для типа 'text'). */
  color?: string;
  /** Курсив (для типа 'text'). */
  italic?: boolean;
  /** Выравнивание текста: left | center | right (для типа 'text'). */
  textAlign?: 'left' | 'center' | 'right';
  /** Данные таблицы (для типа 'table'). */
  table?: DrawingTable;
}

const DEFAULT_TABLE_COL_WIDTH = 600;
const DEFAULT_TABLE_ROW_HEIGHT = 500;
const DEFAULT_TABLE_FONT_SIZE = 140;

export function createDrawingPrimitive(
  type: DrawingPrimitiveType,
  points: Vector2[],
  text?: string,
  fontSize?: number,
  fontFamily?: string,
  color?: string,
  italic?: boolean,
  textAlign?: 'left' | 'center' | 'right',
): DrawingPrimitive {
  const primitive: DrawingPrimitive = {
    id: crypto.randomUUID(),
    type,
    points: points.map((p) => p.clone()),
    text,
    fontSize,
    fontFamily,
    color,
    italic,
    textAlign,
  };

  if (type === 'table' && points.length > 0) {
    const rows = 3;
    const cols = 3;
    primitive.table = {
      rows,
      cols,
      columnWidths: Array(cols).fill(DEFAULT_TABLE_COL_WIDTH),
      rowHeights: Array(rows).fill(DEFAULT_TABLE_ROW_HEIGHT),
      fontSize: fontSize ?? DEFAULT_TABLE_FONT_SIZE,
      cells: [],
    };
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        primitive.table.cells.push({ row: r, col: c });
      }
    }
  }

  return primitive;
}
