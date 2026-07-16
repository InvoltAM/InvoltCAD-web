import { Vector2 } from '../geometry/Vector2';

export interface Dimension {
  id: string;
  a: Vector2;
  b: Vector2;
  length: number;
  text?: string; // пользовательская подпись (если задана)
}

export function createDimension(a: Vector2, b: Vector2): Dimension {
  return {
    id: crypto.randomUUID(),
    a: a.clone(),
    b: b.clone(),
    length: a.distanceTo(b),
  };
}
