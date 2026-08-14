import { Vector2 } from '../geometry/Vector2';

export type DrawingPrimitiveType = 'polyline' | 'segment' | 'rectangle' | 'circle';

export interface DrawingPrimitive {
  id: string;
  type: DrawingPrimitiveType;
  points: Vector2[];
}

export function createDrawingPrimitive(
  type: DrawingPrimitiveType,
  points: Vector2[],
): DrawingPrimitive {
  return {
    id: crypto.randomUUID(),
    type,
    points: points.map((p) => p.clone()),
  };
}
