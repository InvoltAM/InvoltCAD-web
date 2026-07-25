import { Device } from './Device';
import { Cable } from './Cable';
import { Dimension } from './Dimension';

/**
 * Лист проекта: общие стены живут в Plan,
 * а устройства, кабели и размеры — отдельные на каждом листе.
 */
export interface Sheet {
  id: string;
  name: string;
  devices: Device[];
  cables: Cable[];
  dimensions: Dimension[];
}

export const DEFAULT_SHEET_NAMES = [
  'Розетки',
  'Освещение',
  'Подсветки',
  'Вентиляция',
  'Теплые полы',
];

export function createSheet(name: string): Sheet {
  return {
    id: crypto.randomUUID(),
    name,
    devices: [],
    cables: [],
    dimensions: [],
  };
}

export function createDefaultSheets(): Sheet[] {
  return DEFAULT_SHEET_NAMES.map(createSheet);
}
