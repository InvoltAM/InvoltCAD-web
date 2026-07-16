export interface WallPreset {
  thickness: number;
  label: string;
}

/**
 * Каталог толщин стен.
 */
export const WALL_CATALOG: WallPreset[] = [
  { thickness: 80, label: '80 мм' },
  { thickness: 100, label: '100 мм' },
  { thickness: 120, label: '120 мм' },
  { thickness: 150, label: '150 мм' },
  { thickness: 200, label: '200 мм' },
  { thickness: 250, label: '250 мм' },
  { thickness: 300, label: '300 мм' },
  { thickness: 400, label: '400 мм' },
];
