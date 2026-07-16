import { CableType } from '../model/Cable';

export interface CablePreset {
  type: CableType;
  crossSection: number;
  label: string;
}

/**
 * Каталог сечений кабелей.
 */
export const CABLE_CATALOG: CablePreset[] = [
  { type: 'power', crossSection: 1.5, label: 'Силовой 1.5 мм²' },
  { type: 'power', crossSection: 2.5, label: 'Силовой 2.5 мм²' },
  { type: 'power', crossSection: 4, label: 'Силовой 4 мм²' },
  { type: 'power', crossSection: 6, label: 'Силовой 6 мм²' },
  { type: 'lighting', crossSection: 1.5, label: 'Освещение 1.5 мм²' },
  { type: 'low-current', crossSection: 0.5, label: 'Слаботочка 0.5 мм²' },
  { type: 'low-current', crossSection: 0.75, label: 'Слаботочка 0.75 мм²' },
];

export function getCableCatalogForType(type: CableType): CablePreset[] {
  return CABLE_CATALOG.filter(item => item.type === type);
}
