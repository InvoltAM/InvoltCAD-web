import { InputEvent } from '../engine/InputManager';
import { Plan } from '../model/Plan';
import { Device } from '../model/Device';
import { Vector2 } from '../geometry/Vector2';
import { CanvasEngine } from '../engine/CanvasEngine';
import { Tool } from './ToolManager';
import { AddCableCommand } from '../editor/CommandManager';

type CableState = 'idle' | 'selecting-to';

/**
 * Инструмент прокладки кабеля между двумя устройствами.
 */
export class CableTool implements Tool {
  readonly name = 'cable' as const;

  private state: CableState = 'idle';
  private fromDevice: Device | null = null;

  constructor(
    private canvas: CanvasEngine,
    private plan: Plan,
  ) {}

  onActivate(): void {
    this.state = 'idle';
    this.fromDevice = null;
  }

  onDeactivate(): void {
    this.canvas.setGhost(null);
    this.canvas.requestRender();
  }

  onPointerMove(e: InputEvent): void {
    this.updateGhost(e);
  }

  onPointerDown(e: InputEvent): void {
    const device = this.hitTestDevice(e.screenPoint);
    if (!device) return;

    if (this.state === 'idle') {
      this.fromDevice = device;
      this.state = 'selecting-to';
      this.canvas.setSelectedDevice(device.id);
      this.updateGhost(e);
    } else if (this.state === 'selecting-to' && this.fromDevice) {
      if (device.id !== this.fromDevice.id) {
        const type = this.canvas.editorState.get('defaultCableType');
        const section = this.canvas.editorState.get('defaultCableSection');
        this.canvas.commandManager.execute(
          new AddCableCommand(this.plan, this.fromDevice.id, device.id, type, section),
        );
        this.canvas.notifyChanged();
      }
      this.state = 'idle';
      this.fromDevice = null;
      this.canvas.setSelectedDevice(null);
      this.canvas.setGhost(null);
      this.canvas.requestRender();
    }
  }

  onKeyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Escape' && this.state === 'selecting-to') {
      this.state = 'idle';
      this.fromDevice = null;
      this.canvas.setSelectedDevice(null);
      this.canvas.setGhost(null);
      this.canvas.requestRender();
      return true;
    }
    return false;
  }

  private updateGhost(e: InputEvent): void {
    if (this.state !== 'selecting-to' || !this.fromDevice) return;

    const toDevice = this.hitTestDevice(e.screenPoint);
    const fromPos = this.plan.deviceWorldPosition(this.fromDevice);
    const toPos = toDevice
      ? this.plan.deviceWorldPosition(toDevice)
      : this.canvas.camera.screenToWorld(e.screenPoint);

    this.canvas.setGhost(ctx => {
      ctx.strokeStyle = '#d32f2f';
      ctx.lineWidth = 2 / this.canvas.camera.scale;
      ctx.setLineDash([10 / this.canvas.camera.scale, 5 / this.canvas.camera.scale]);
      ctx.beginPath();
      ctx.moveTo(fromPos.x, fromPos.y);
      ctx.lineTo(toPos.x, toPos.y);
      ctx.stroke();
      ctx.setLineDash([]);
    });
    this.canvas.requestRender();
  }

  private hitTestDevice(screenPoint: Vector2): Device | null {
    const world = this.canvas.camera.screenToWorld(screenPoint);
    const thresholdMm = 25 / this.canvas.camera.scale;

    for (const device of this.plan.devices) {
      const pos = this.plan.deviceWorldPosition(device);
      if (pos.distanceTo(world) < thresholdMm) {
        return device;
      }
    }
    return null;
  }
}
