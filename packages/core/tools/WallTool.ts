import { Vector2 } from '../geometry/Vector2';
import { InputEvent } from '../engine/InputManager';
import { SnapEngine } from '../snap/SnapEngine';
import { Plan } from '../model/Plan';
import { DEFAULT_WALL_THICKNESS } from '../model/Wall';
import { CanvasEngine } from '../engine/CanvasEngine';
import { Tool } from './ToolManager';
import { AddWallCommand } from '../editor/CommandManager';

type WallState = 'idle' | 'drawing';

/**
 * Инструмент "Стена".
 * Поддерживает цепочное рисование. Новые стены добавляются через CommandManager
 * для поддержки undo/redo.
 */
export class WallTool implements Tool {
  readonly name = 'wall' as const;

  private state: WallState = 'idle';
  private start = new Vector2(0, 0);
  private end = new Vector2(0, 0);
  private lastSnap;

  constructor(
    private canvas: CanvasEngine,
    private plan: Plan,
    private snapEngine: SnapEngine,
  ) {
    this.lastSnap = this.snapEngine.snap(new Vector2(0, 0));
  }

  onActivate(): void {
    this.state = 'idle';
  }

  onDeactivate(): void {
    this.state = 'idle';
    this.canvas.setGhost(null);
    this.canvas.hideMagnifier();
    this.snapEngine.clearTracking();
    this.canvas.requestRender();
  }

  onPointerDown(e: InputEvent): void {
    if (this.state === 'idle') {
      const snap = this.snapEngine.snap(e.screenPoint);
      this.start = snap.point;
      this.end = snap.point;
      this.state = 'drawing';
      this.lastSnap = snap;
      if (e.pointerType === 'touch') {
        this.canvas.showMagnifier(e.screenPoint);
      }
      this.updateGhost();
    }
  }

  onPointerMove(e: InputEvent): void {
    if (e.pointerType === 'touch' && this.state === 'drawing') {
      this.canvas.showMagnifier(e.screenPoint);
    }
    if (this.state === 'drawing') {
      const snap = this.snapEngine.snap(e.screenPoint, { noGrid: false });
      this.end = this.applyOrtho(e, snap.point);
      this.lastSnap = snap;
      this.updateGhost();
    } else {
      this.lastSnap = this.snapEngine.snap(e.screenPoint);
      this.canvas.setSnap(this.lastSnap);
      this.canvas.requestRender();
    }
  }

  onPointerUp(e: InputEvent): void {
    if (e.pointerType === 'touch') {
      this.canvas.hideMagnifier();
    }
    if (this.state === 'drawing') {
      const snap = this.snapEngine.snap(e.screenPoint);
      this.end = this.applyOrtho(e, snap.point);
      this.lastSnap = snap;

      const len = this.start.distanceTo(this.end);
      if (len >= 50 && !this.start.equals(this.end)) {
        const thickness = this.canvas.editorState.get('wallThickness') || DEFAULT_WALL_THICKNESS;
        this.canvas.commandManager.execute(
          new AddWallCommand(this.plan, this.start, this.end, thickness),
        );
        // Непрерывное рисование
        this.start = this.end.clone();
      }

      this.updateGhost();
    }
  }

  onKeyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Escape' && this.state === 'drawing') {
      this.state = 'idle';
      this.canvas.setGhost(null);
      this.canvas.hideMagnifier();
      this.snapEngine.clearTracking();
      this.canvas.requestRender();
      return true;
    }
    return false;
  }

  /**
   * Орто-режим: при зажатом Shift или включённом переключателе «Орто»
   * проецирует конечную точку на доминантную ось относительно начала стены.
   */
  private applyOrtho(e: InputEvent, point: Vector2): Vector2 {
    if (!e.shiftKey && !this.canvas.editorState.get('orthoMode')) return point;
    const dx = point.x - this.start.x;
    const dy = point.y - this.start.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return new Vector2(point.x, this.start.y);
    }
    return new Vector2(this.start.x, point.y);
  }

  private updateGhost(): void {
    this.canvas.setGhost(ctx => {
      if (this.state === 'drawing') {
        const thickness = this.canvas.editorState.get('wallThickness') || DEFAULT_WALL_THICKNESS;
        this.canvas.ghostRenderer.drawWallGhost(ctx, this.start, this.end, thickness);

        // Направляющие лучи из стартовой точки
        const dir = this.end.sub(this.start);
        if (dir.length() > 1e-9) {
          const n = dir.perpendicular();
          this.canvas.ghostRenderer.drawGuideRays(ctx, this.start, [
            dir,
            dir.scale(-1),
            n,
            n.scale(-1),
          ]);
        }
      }
      this.canvas.ghostRenderer.drawSnapMarker(ctx, this.lastSnap);
    });
    this.canvas.setSnap(this.lastSnap);
    this.canvas.requestRender();
  }
}
