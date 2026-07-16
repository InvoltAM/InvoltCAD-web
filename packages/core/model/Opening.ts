export type OpeningType = 'door' | 'window';

export interface Opening {
  id: string;
  type: OpeningType;
  wallId: string;               // ссылка на стену
  t: number;                    // 0..1 — позиция ЦЕНТРА проема вдоль стены
  width: number;                // ширина проема, мм
  // дверь:
  swingSide?: 'left' | 'right'; // сторона петель
  openDir?: 1 | -1;             // направление открывания
}

export const DEFAULT_DOOR_WIDTH = 900;
export const DEFAULT_WINDOW_WIDTH = 1200;
