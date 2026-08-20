import { Vector2 } from '../geometry/Vector2';
import { InputEvent } from '../engine/InputManager';
import { Plan } from '../model/Plan';
import { CanvasEngine } from '../engine/CanvasEngine';
import { Tool } from './ToolManager';

type CalibrationState = 'idle' | 'first' | 'second';

export interface CalibrationRequest {
  currentMm: number;
  onApply: (realMm: number) => void;
  onCancel: () => void;
}

/**
 * Инструмент калибровки масштаба подложки.
 * Два клика на подложке задают отрезок; пользователь вводит реальную длину,
 * после чего подложка масштабируется так, чтобы этот отрезок соответствовал введённому значению.
 */
export class UnderlayCalibrationTool implements Tool {
  readonly name = 'underlay' as const;

  private state: CalibrationState = 'idle';
  private firstWorld = new Vector2(0, 0);
  private firstPx = new Vector2(0, 0);
  private secondWorld = new Vector2(0, 0);
  private secondPx = new Vector2(0, 0);

  constructor(
    private canvas: CanvasEngine,
    private plan: Plan,
    private requestCalibration: (req: CalibrationRequest) => void,
  ) {}

  onActivate(): void {
    this.state = 'idle';
    this.canvas.setGhost(null);
  }

  onDeactivate(): void {
    this.state = 'idle';
    this.canvas.setGhost(null);
    this.canvas.requestRender();
  }

  onPointerDown(e: InputEvent): void {
    const underlay = this.plan.activeSheet.underlay;
    if (!underlay) return;

    if (this.state === 'idle') {
      this.firstWorld = e.worldPoint.clone();
      this.firstPx = this.worldToImagePx(this.firstWorld, underlay);
      this.state = 'first';
      this.updateGhost();
      return;
    }

    if (this.state === 'first') {
      this.secondWorld = e.worldPoint.clone();
      this.secondPx = this.worldToImagePx(this.secondWorld, underlay);
      const distPx = this.firstPx.distanceTo(this.secondPx);
      const currentMm = distPx * underlay.scale;

      if (distPx < 1) {
        this.reset();
        return;
      }

      this.requestCalibration({
        currentMm,
        onApply: (realMm) => this.applyCalibration(realMm, distPx),
        onCancel: () => this.reset(),
      });

      this.state = 'second';
    }
  }

  onPointerMove(e: InputEvent): void {
    if (this.state === 'first') {
      this.secondWorld = e.worldPoint.clone();
      this.updateGhost();
    }
  }

  onKeyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') {
      this.reset();
      return true;
    }
    return false;
  }

  private applyCalibration(realMm: number, distPx: number): void {
    const underlay = this.plan.activeSheet.underlay;
    if (!underlay || distPx <= 0 || realMm <= 0) {
      this.reset();
      return;
    }

    const newScale = realMm / distPx;
    // Сохраняем положение первой точки: world = position + px * scale
    underlay.position.x = this.firstWorld.x - this.firstPx.x * newScale;
    underlay.position.y = this.firstWorld.y - this.firstPx.y * newScale;
    underlay.scale = newScale;

    this.canvas.notifyChanged?.();
    this.reset();
  }

  private reset(): void {
    this.state = 'idle';
    this.canvas.setGhost(null);
    this.canvas.requestRender();
  }

  private updateGhost(): void {
    const underlay = this.plan.activeSheet.underlay;
    if (!underlay || this.state !== 'first') return;

    const color = this.canvas.themeManager.getColor('selected');
    this.canvas.setGhost((ctx) => {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1 / this.canvas.camera.scale;

      // Линия калибровки
      ctx.beginPath();
      ctx.moveTo(this.firstWorld.x, this.firstWorld.y);
      ctx.lineTo(this.secondWorld.x, this.secondWorld.y);
      ctx.stroke();

      // Узлы
      const r = 3 / this.canvas.camera.scale;
      ctx.beginPath();
      ctx.arc(this.firstWorld.x, this.firstWorld.y, r, 0, Math.PI * 2);
      ctx.arc(this.secondWorld.x, this.secondWorld.y, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  private worldToImagePx(world: Vector2, underlay: { position: { x: number; y: number }; scale: number }): Vector2 {
    return new Vector2(
      (world.x - underlay.position.x) / underlay.scale,
      (world.y - underlay.position.y) / underlay.scale,
    );
  }
}
