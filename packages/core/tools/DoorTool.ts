import { InputEvent } from '../engine/InputManager';
import { SnapEngine } from '../snap/SnapEngine';
import { Plan } from '../model/Plan';

import { CanvasEngine } from '../engine/CanvasEngine';
import { Tool } from './ToolManager';
import { AddOpeningCommand } from '../editor/CommandManager';

/**
 * Инструмент "Дверь".
 * Размещает проем через CommandManager для undo/redo.
 */
export class DoorTool implements Tool {
  readonly name = 'door' as const;

  private preview: { wallId: string; t: number; thickness: number } | null = null;

  constructor(
    private canvas: CanvasEngine,
    private plan: Plan,
    private snapEngine: SnapEngine,
  ) {}

  onActivate(): void {
    this.preview = null;
  }

  onDeactivate(): void {
    this.canvas.setGhost(null);
    this.canvas.requestRender();
  }

  onPointerMove(e: InputEvent): void {
    const nearest = this.snapEngine.findNearestWall(e.screenPoint);
    if (nearest) {
      this.preview = {
        wallId: nearest.wall.id,
        t: nearest.t,
        thickness: nearest.wall.thickness,
      };
      const snap = this.snapEngine.snap(e.screenPoint, { wallOnly: true });
      this.canvas.setSnap(snap);
    } else {
      this.preview = null;
      const snap = this.snapEngine.snap(e.screenPoint);
      this.canvas.setSnap(snap);
    }
    this.updateGhost();
  }

  onPointerDown(): void {
    if (this.preview) {
      const wall = this.plan.findWall(this.preview.wallId);
      if (wall) {
        this.canvas.commandManager.execute(
          new AddOpeningCommand(this.plan, wall.id, 'door', this.preview.t, this.canvas.editorState.get('doorWidth')),
        );
        this.canvas.notifyChanged();
      }
    }
  }

  private getWidth(): number {
    return this.canvas.editorState.get('doorWidth');
  }

  private updateGhost(): void {
    this.canvas.setGhost(ctx => {
      if (this.preview) {
        const wall = this.plan.findWall(this.preview.wallId);
        if (wall) {
          this.canvas.ghostRenderer.drawOpeningGhost(
            ctx, wall.a, wall.b, this.preview.t, this.getWidth(), this.preview.thickness,
          );
        }
      }
      if (this.canvas.snap) {
        this.canvas.ghostRenderer.drawSnapMarker(ctx, this.canvas.snap);
      }
    });
    this.canvas.requestRender();
  }
}
