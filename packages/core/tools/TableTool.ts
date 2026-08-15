import { Vector2 } from '../geometry/Vector2';
import { InputEvent } from '../engine/InputManager';
import { Plan } from '../model/Plan';
import { SnapEngine } from '../snap/SnapEngine';
import { CanvasEngine } from '../engine/CanvasEngine';
import { Tool } from './ToolManager';
import { AddPrimitiveCommand } from '../editor/CommandManager';

/**
 * Инструмент «Таблица».
 * Первый клик — левый верхний угол таблицы.
 * Второй клик — правый нижний угол, по которому рассчитывается размер.
 * Создаёт таблицу 3×3 по умолчанию.
 */
export class TableTool implements Tool {
  readonly name = 'table' as const;

  private startPoint: Vector2 | null = null;

  constructor(
    private canvas: CanvasEngine,
    private plan: Plan,
    private snapEngine: SnapEngine,
  ) {}

  onActivate(): void {
    this.startPoint = null;
    this.canvas.setGhost(null);
    this.canvas.setSnap(null);
  }

  onDeactivate(): void {
    this.startPoint = null;
    this.canvas.setGhost(null);
    this.canvas.setSnap(null);
  }

  onPointerDown(e: InputEvent): void {
    const snap = this.snapEngine.snap(e.screenPoint);
    this.canvas.setSnap(snap);

    if (!this.startPoint) {
      this.startPoint = snap.point.clone();
      this.updateGhost();
      return;
    }

    const end = snap.point.clone();
    const width = Math.max(Math.abs(end.x - this.startPoint.x), 600);
    const height = Math.max(Math.abs(end.y - this.startPoint.y), 15);
    const cols = 3;
    const rows = 3;
    const colWidth = width / cols;
    const rowHeight = height / rows;

    const minX = Math.min(this.startPoint.x, end.x);
    const minY = Math.min(this.startPoint.y, end.y);

    this.canvas.commandManager.execute(
      new AddPrimitiveCommand(this.plan, 'table', [new Vector2(minX, minY)], '', 140, undefined, undefined, undefined, undefined, {
        rows,
        cols,
        cells: [],
        columnWidths: Array(cols).fill(colWidth),
        rowHeights: Array(rows).fill(rowHeight),
      }),
    );
    this.canvas.notifyChanged();
    this.startPoint = null;
    this.canvas.setGhost(null);
    this.canvas.setSnap(null);
  }

  onPointerMove(e: InputEvent): void {
    if (!this.startPoint) return;
    const snap = this.snapEngine.snap(e.screenPoint);
    this.canvas.setSnap(snap);
    this.updateGhost(snap.point);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onPointerUp(e: InputEvent): void {}

  onKeyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') {
      this.startPoint = null;
      this.canvas.setGhost(null);
      this.canvas.setSnap(null);
      return true;
    }
    return false;
  }

  private updateGhost(end?: Vector2): void {
    if (!this.startPoint) {
      this.canvas.setGhost(null);
      return;
    }
    const current = end ?? this.startPoint;
    this.canvas.setGhost((ctx) => {
      const minX = Math.min(this.startPoint!.x, current.x);
      const minY = Math.min(this.startPoint!.y, current.y);
      const maxX = Math.max(this.startPoint!.x, current.x);
      const maxY = Math.max(this.startPoint!.y, current.y);
      const color = this.canvas.themeManager.getColor('ghostWall');
      ctx.strokeStyle = color;
      ctx.lineWidth = 1 / this.canvas.camera.scale;
      ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);

      // Предварительная сетка
      ctx.beginPath();
      for (let i = 1; i < 3; i++) {
        const x = minX + ((maxX - minX) * i) / 3;
        ctx.moveTo(x, minY);
        ctx.lineTo(x, maxY);
      }
      for (let i = 1; i < 3; i++) {
        const y = minY + ((maxY - minY) * i) / 3;
        ctx.moveTo(minX, y);
        ctx.lineTo(maxX, y);
      }
      ctx.stroke();
    });
    this.canvas.requestRender();
  }
}
