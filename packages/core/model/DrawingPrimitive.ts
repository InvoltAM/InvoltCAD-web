import { Vector2 } from '../geometry/Vector2';

export type DrawingPrimitiveType = 'polyline' | 'segment' | 'rectangle' | 'circle' | 'text';

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
}

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
  return {
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
}
