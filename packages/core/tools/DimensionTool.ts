import { InputEvent } from '../engine/InputManager';
import { SnapEngine } from '../snap/SnapEngine';
import { Plan } from '../model/Plan';
import { Vector2 } from '../geometry/Vector2';
import { CanvasEngine } from '../engine/CanvasEngine';
import { Tool } from './ToolManager';
import { AddDimensionCommand } from '../editor/CommandManager';

type DimensionState = 'idle' | 'selecting-to';

/**
 * Инструмент ручной простановки размеров.
 * Первый клик — начальная точка, второй клик — конечная точка.
 */
export class DimensionTool implements Tool {
  readonly name = 'dimension' as const;

  private state: DimensionState = 'idle';
  private startPoint: Vector2 | null = null;

  constructor(
    private canvas: CanvasEngine,
    private plan: Plan,
    private snapEngine: SnapEngine,
  ) {}

  onActivate(): void {
    this.state = 'idle';
    this.startPoint = null;
  }

  onDeactivate(): void {
    this.canvas.setGhost(null);
    this.canvas.requestRender();
  }

  onPointerMove(e: InputEvent): void {
    const snap = this.snapEngine.snap(e.screenPoint);
    this.canvas.setSnap(snap);

    if (this.state === 'selecting-to' && this.startPoint) {
      this.updateGhost(this.startPoint, snap.point);
    } else {
      this.canvas.setGhost(null);
      this.canvas.requestRender();
    }
  }

  onPointerDown(e: InputEvent): void {
    const snap = this.snapEngine.snap(e.screenPoint);

    if (this.state === 'idle') {
      this.startPoint = snap.point.clone();
      this.state = 'selecting-to';
      this.updateGhost(this.startPoint, snap.point);
    } else if (this.state === 'selecting-to' && this.startPoint) {
      const endPoint = snap.point.clone();
      if (endPoint.distanceTo(this.startPoint) > 1) {
        this.canvas.commandManager.execute(new AddDimensionCommand(this.plan, this.startPoint, endPoint));
        this.canvas.notifyChanged();
      }
      this.state = 'idle';
      this.startPoint = null;
      this.canvas.setGhost(null);
      this.canvas.requestRender();
    }
  }

  onKeyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Escape' && this.state === 'selecting-to') {
      this.state = 'idle';
      this.startPoint = null;
      this.canvas.setGhost(null);
      this.canvas.requestRender();
      return true;
    }
    return false;
  }

  private updateGhost(a: Vector2, b: Vector2): void {
    this.canvas.setGhost(ctx => {
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1 / this.canvas.camera.scale;
      ctx.setLineDash([5 / this.canvas.camera.scale, 5 / this.canvas.camera.scale]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);

      const len = a.distanceTo(b);
      if (len > 0) {
        const mid = a.add(b).scale(0.5);
        ctx.fillStyle = '#1a1a1a';
        ctx.font = `${12 / this.canvas.camera.scale}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.round(len)} мм`, mid.x, mid.y);
      }
    });
    this.canvas.requestRender();
  }
}
