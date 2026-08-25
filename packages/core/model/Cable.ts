import { Vector2 } from '../geometry/Vector2';

export type CableType = 'power' | 'lighting' | 'low-current';

export type CablePhase = 'L1' | 'L2' | 'L3' | 'N' | 'PE' | 'low-voltage';

export type CableRoutingMode = 'auto' | 'wall' | 'manual' | 'through-doorway';

export type CableBundleMode = 'trunk' | 'parallel' | 'none';

export interface CableStyle {
  color: string;         // hex, например '#e74c3c'
  lineWidth: number;     // мм, например 1.5
  dashPattern: number[]; // [] = сплошная, [8, 4] = пунктир
  capStyle: 'round' | 'butt';
}

export interface Cable {
  id: string;
  fromDeviceId: string | null; // null если начало — точка на стене/в пространстве
  toDeviceId: string | null;   // null если конец — точка на стене/в пространстве
  fromPoint?: { x: number; y: number }; // мировые координаты начала, когда нет устройства
  toPoint?: { x: number; y: number };   // мировые координаты конца, когда нет устройства
  type: CableType;
  crossSection: number; // сечение, мм²
  length: number;       // длина в мм (геометрическая длина маршрута)
  spareLength?: number; // длина запаса, мм
  totalLength?: number; // длина с запасом, мм
  route: Vector2[];     // точки маршрута кабеля
  viaPoints?: Vector2[]; // промежуточные узлы маршрута
  routing?: 'auto' | 'manual'; // auto = пересчитывать A*-обходом стен при recalc
  circuitId?: string;   // привязка к линии/цепи щита
  visible?: boolean;    // видимость на чертеже
  brand?: string;       // марка кабеля
  marking?: string;     // маркировка линии
  laid?: boolean;       // проложен по факту
  /** Визуальный стиль линии. Если не задан — берётся по фазе/типу кабеля. */
  style?: CableStyle;
  /** Фаза/назначение кабеля (L1, L2, L3, N, PE, слаботочка). */
  phase?: CablePhase;
  /** Режим прокладки из спецификации. */
  routingMode?: CableRoutingMode;
  /** Режим групповой прокладки нескольких кабелей. */
  bundleMode?: CableBundleMode;
  /** Идентификатор группы пучка/параллельной прокладки. */
  bundleGroup?: string | null;
  /** Точка разветвления пучка (для trunk-режима). */
  trunkPoint?: { x: number; y: number } | null;
}

/** Стандартные стили кабеля по фазе (соответствуют спецификации v3.1). */
export const DEFAULT_CABLE_STYLES: Record<CablePhase, CableStyle> = {
  'L1': { color: '#e74c3c', lineWidth: 1.5, dashPattern: [], capStyle: 'round' },
  'L2': { color: '#2ecc71', lineWidth: 1.5, dashPattern: [], capStyle: 'round' },
  'L3': { color: '#3498db', lineWidth: 1.5, dashPattern: [], capStyle: 'round' },
  'N':  { color: '#95a5a6', lineWidth: 1.5, dashPattern: [], capStyle: 'round' },
  'PE': { color: '#f1c40f', lineWidth: 2.0, dashPattern: [4, 4], capStyle: 'round' },
  'low-voltage': { color: '#9b59b6', lineWidth: 1.0, dashPattern: [2, 2], capStyle: 'round' },
};

/** Фаза по умолчанию для типа кабеля. */
export function defaultPhaseForType(type: CableType): CablePhase {
  switch (type) {
    case 'lighting': return 'L2';
    case 'low-current': return 'low-voltage';
    case 'power':
    default: return 'L1';
  }
}

/** Возвращает эффективный стиль кабеля (явный или по фазе/типу). */
export function getCableStyle(cable: Cable): CableStyle {
  if (cable.style) return cable.style;
  const phase = cable.phase ?? defaultPhaseForType(cable.type);
  return DEFAULT_CABLE_STYLES[phase];
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
