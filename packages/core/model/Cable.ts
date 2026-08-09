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
  circuitId?: string;   // привязка к линии/цепи щита
  visible?: boolean;    // видимость на чертеже
  brand?: string;       // марка кабеля
  marking?: string;     // маркировка линии
  laid?: boolean;       // проложен по факту
}

export const DEFAULT_CABLE: { type: CableType; crossSection: number; visible: boolean; brand: string; marking: string; laid: boolean } = {
  type: 'power',
  crossSection: 2.5,
  visible: true,
  brand: '',
  marking: '',
  laid: false,
};

/** Стандартные марки кабеля для выпадающего списка. */
export const STANDARD_CABLE_BRANDS: string[] = [
  'ВВГнг(A)-LS',
  'ВВГнг-LS',
  'ВВГнг(A)-FRLS',
  'ВВГнг-FRLS',
  'ВВГнг(A)-HFRLS',
  'ВВГнг-HFRLS',
  'КГВВГнг(А)-FRLS',
  'КГВВГнг(А)-HFRLS',
  'NYM',
  'ПВС',
  'ШВВП',
  'КГ',
  'КГ-ХЛ',
];

/** Стандартные сечения кабеля, мм². */
export const STANDARD_CABLE_SECTIONS: number[] = [
  0.5, 0.75, 1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95,
];

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
