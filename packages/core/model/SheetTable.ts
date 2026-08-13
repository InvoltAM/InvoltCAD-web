import { Vector2 } from '../geometry/Vector2';

export type SheetTableType = 'cables' | 'spec' | 'roomNumbers';

export interface SheetTable {
  id: string;
  type: SheetTableType;
  position: { x: number; y: number };
  width: number;
  height: number;
  scale: number;
}

export function createSheetTable(
  type: SheetTableType,
  position: Vector2,
  width = 300,
  height = 200,
  scale = 1,
): SheetTable {
  return {
    id: crypto.randomUUID(),
    type,
    position: { x: position.x, y: position.y },
    width,
    height,
    scale,
  };
}
