import { CableType } from '../model/Cable';

/**
 * Каталоги параметров проектирования.
 * Используются в UI для быстрого выбора типовых значений.
 */

export const WALL_THICKNESS_PRESETS = [80, 100, 120, 150, 200, 250, 300];

export const DOOR_WIDTH_PRESETS = [600, 700, 800, 900, 1000, 1100, 1200];

export const WINDOW_WIDTH_PRESETS = [600, 800, 1000, 1200, 1500, 1800, 2000];

export const CABLE_SECTION_PRESETS: Record<CableType, number[]> = {
  power: [1.5, 2.5, 4, 6, 10, 16],
  lighting: [1.5, 2.5],
  'low-current': [0.5, 0.75, 1],
};
