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
}

export function createDrawingPrimitive(
  type: DrawingPrimitiveType,
  points: Vector2[],
  text?: string,
  fontSize?: number,
): DrawingPrimitive {
  return {
    id: crypto.randomUUID(),
    type,
    points: points.map((p) => p.clone()),
    text,
    fontSize,
  };
}
