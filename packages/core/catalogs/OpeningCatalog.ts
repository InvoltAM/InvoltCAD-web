import { OpeningType } from '../model/Opening';

export interface OpeningPreset {
  width: number;
  label: string;
}

/**
 * Каталог ширин проёмов.
 */
export const OPENING_CATALOG: Record<OpeningType, OpeningPreset[]> = {
  door: [
    { width: 600, label: '600 мм' },
    { width: 700, label: '700 мм' },
    { width: 800, label: '800 мм' },
    { width: 900, label: '900 мм' },
    { width: 1000, label: '1000 мм' },
    { width: 1200, label: '1200 мм' },
  ],
  window: [
    { width: 600, label: '600 мм' },
    { width: 800, label: '800 мм' },
    { width: 1000, label: '1000 мм' },
    { width: 1200, label: '1200 мм' },
    { width: 1500, label: '1500 мм' },
    { width: 1800, label: '1800 мм' },
  ],
};
