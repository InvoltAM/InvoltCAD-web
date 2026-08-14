import { Vector2 } from '../geometry/Vector2';
import { InputEvent } from '../engine/InputManager';
import { Plan } from '../model/Plan';
import { SnapEngine } from '../snap/SnapEngine';
import { CanvasEngine } from '../engine/CanvasEngine';
import { Tool } from './ToolManager';

export type DrawingToolType = 'polyline' | 'segment' | 'rectangle' | 'circle';

type DrawingState = 'idle' | 'drawing';

/**
 * Инструменты черчения примитивов: полилиния, отрезок, прямоугольник, круг.
 * Пока что рисуют только ghost-превью; сохранение в план будет добавлено позже.
 */
export class DrawingTool implements Tool {
  readonly name: DrawingToolType;

  private state: DrawingState = 'idle';
  private start = new Vector2(0, 0);
  private end = new Vector2(0, 0);
  private polylinePoints: Vector2[] = [];
  private lastSnap: ReturnType<SnapEngine['snap']> | null = null;

  constructor(
    toolType: DrawingToolType,
    private canvas: CanvasEngine,
    private plan: Plan,
    private snapEngine: SnapEngine,
  ) {
    this.name = toolType;
  }

  onActivate(): void {
    this.state = 'idle';
    this.polylinePoints = [];
  }

  onDeactivate(): void {
    this.state = 'idle';
    this.polylinePoints = [];
    this.canvas.setGhost(null);
    this.canvas.hideMagnifier();
    this.snapEngine.clearTracking();
    this.canvas.requestRender();
  }

  onPointerDown(e: InputEvent): void {
    const snap = this.snapEngine.snap(e.screenPoint);
    if (this.name === 'polyline') {
      if (this.state === 'idle') {
        this.polylinePoints = [snap.point];
        this.state = 'drawing';
      } else {
        this.polylinePoints.push(snap.point);
      }
    } else {
      this.start = snap.point;
      this.end = snap.point;
      this.state = 'drawing';
    }
    this.lastSnap = snap;
    if (e.pointerType === 'touch') {
      this.canvas.showMagnifier(e.screenPoint);
    }
    this.updateGhost();
  }

  onPointerMove(e: InputEvent): void {
    if (e.pointerType === 'touch' && this.state === 'drawing') {
      this.canvas.showMagnifier(e.screenPoint);
    }

    const snap = this.snapEngine.snap(e.screenPoint);
    this.lastSnap = snap;
    if (this.state === 'drawing' && this.name !== 'polyline') {
      this.end = this.applyOrtho(e, snap.point);
    }
    this.updateGhost();
  }

  onPointerUp(e: InputEvent): void {
    if (e.pointerType === 'touch') {
      this.canvas.hideMagnifier();
    }
    if (this.state !== 'drawing') return;

    if (this.name === 'polyline') {
      // Полилиния продолжается до следующего клика или Escape
      return;
    }

    // Для разовых фигур после отпускания кнопки завершаем ghost
    this.state = 'idle';
    this.updateGhost();
  }

  onKeyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') {
      this.state = 'idle';
      this.polylinePoints = [];
      this.canvas.setGhost(null);
      this.canvas.hideMagnifier();
      this.snapEngine.clearTracking();
      this.canvas.requestRender();
      return true;
    }
    return false;
  }

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
    this.canvas.setGhost((ctx) => {
      const color = this.canvas.themeManager.getColor('dimension');
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1 / this.canvas.camera.scale;

      if (this.name === 'segment' || this.name === 'rectangle') {
        if (this.state === 'drawing') {
          if (this.name === 'segment') {
            ctx.beginPath();
            ctx.moveTo(this.start.x, this.start.y);
            ctx.lineTo(this.end.x, this.end.y);
            ctx.stroke();
          } else {
            const x = Math.min(this.start.x, this.end.x);
            const y = Math.min(this.start.y, this.end.y);
            const w = Math.abs(this.end.x - this.start.x);
            const h = Math.abs(this.end.y - this.start.y);
            ctx.strokeRect(x, y, w, h);
          }
        }
      } else if (this.name === 'circle') {
        if (this.state === 'drawing') {
          const radius = this.start.distanceTo(this.end);
          ctx.beginPath();
          ctx.arc(this.start.x, this.start.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (this.name === 'polyline') {
        if (this.polylinePoints.length > 1) {
          ctx.beginPath();
          ctx.moveTo(this.polylinePoints[0].x, this.polylinePoints[0].y);
          for (let i = 1; i < this.polylinePoints.length; i++) {
            ctx.lineTo(this.polylinePoints[i].x, this.polylinePoints[i].y);
          }
          if (this.state === 'drawing' && this.lastSnap) {
            ctx.lineTo(this.lastSnap.point.x, this.lastSnap.point.y);
          }
          ctx.stroke();
        } else if (this.state === 'drawing' && this.lastSnap && this.polylinePoints.length === 1) {
          ctx.beginPath();
          ctx.moveTo(this.polylinePoints[0].x, this.polylinePoints[0].y);
          ctx.lineTo(this.lastSnap.point.x, this.lastSnap.point.y);
          ctx.stroke();
        }
      }

      if (this.lastSnap) {
        this.canvas.ghostRenderer.drawSnapMarker(ctx, this.lastSnap);
      }
    });
    this.canvas.setSnap(this.lastSnap);
    this.canvas.requestRender();
  }
}
