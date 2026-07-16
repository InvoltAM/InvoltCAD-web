import { Vector2 } from '../geometry/Vector2';

export type CableType = 'power' | 'lighting' | 'low-current';

export interface Cable {
  id: string;
  fromDeviceId: string;
  toDeviceId: string;
  type: CableType;
  crossSection: number; // сечение, мм²
  length: number;       // длина в мм (геометрическая длина маршрута)
  spareLength?: number; // длина запаса, мм
  totalLength?: number; // длина с запасом, мм
  route: Vector2[];     // точки маршрута кабеля
}

export const DEFAULT_CABLE: { type: CableType; crossSection: number } = {
  type: 'power',
  crossSection: 2.5,
};

export const CABLE_TYPES: Record<CableType, string> = {
  power: 'Силовой',
  lighting: 'Освещение',
  'low-current': 'Слаботочка',
};

/** Запас на подъём/спуск: 10% или минимум 500 мм. */
export function computeCableSpareLength(length: number): number {
  return Math.max(length * 0.1, 500);
}

/** Полная длина кабеля с запасом. */
export function computeCableTotalLength(length: number): number {
  return length + computeCableSpareLength(length);
}
