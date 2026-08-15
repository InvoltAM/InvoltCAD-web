import { Vector2 } from '../geometry/Vector2';
import { InputEvent } from '../engine/InputManager';
import { Plan } from '../model/Plan';
import { SnapEngine } from '../snap/SnapEngine';
import { CanvasEngine } from '../engine/CanvasEngine';
import { Tool } from './ToolManager';
import { AddPrimitiveCommand } from '../editor/CommandManager';

const TABLE_COLS = 3;
const TABLE_ROWS = 3;
const TABLE_COL_WIDTH = 2500;
const TABLE_ROW_HEIGHT = 500;

/**
 * Инструмент «Таблица».
 * Один клик — вставка таблицы 3×3 в указанную точку.
 * Размеры фиксированы: ширина столбца 2500 мм, высота строки 500 мм.
 */
export class TableTool implements Tool {
  readonly name = 'table' as const;

  constructor(
    private canvas: CanvasEngine,
    private plan: Plan,
    private snapEngine: SnapEngine,
  ) {}

  onActivate(): void {
    this.canvas.setGhost(null);
    this.canvas.setSnap(null);
  }

  onDeactivate(): void {
    this.canvas.setGhost(null);
    this.canvas.setSnap(null);
  }

  onPointerDown(e: InputEvent): void {
    const snap = this.snapEngine.snap(e.screenPoint);
    this.canvas.setSnap(snap);

    this.canvas.commandManager.execute(
      new AddPrimitiveCommand(this.plan, 'table', [snap.point.clone()], '', 140, undefined, undefined, undefined, undefined, {
        rows: TABLE_ROWS,
        cols: TABLE_COLS,
        cells: [],
        columnWidths: Array(TABLE_COLS).fill(TABLE_COL_WIDTH),
        rowHeights: Array(TABLE_ROWS).fill(TABLE_ROW_HEIGHT),
      }),
    );
    this.canvas.notifyChanged();
    this.canvas.setSnap(null);
  }

  onPointerMove(e: InputEvent): void {
    const snap = this.snapEngine.snap(e.screenPoint);
    this.canvas.setSnap(snap);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onPointerUp(e: InputEvent): void {}

  onKeyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') {
      this.canvas.setGhost(null);
      this.canvas.setSnap(null);
      return true;
    }
    return false;
  }
}
