import { InputEvent } from '../engine/InputManager';
import { Plan } from '../model/Plan';
import { Device, findDeviceCatalogItem, getDeviceIconScale } from '../model/Device';
import { Wall, wallDirection } from '../model/Wall';
import { Vector2 } from '../geometry/Vector2';
import { CanvasEngine } from '../engine/CanvasEngine';
import { Tool } from './ToolManager';
import { AddCableCommand } from '../editor/CommandManager';
import { routeCableWithVia, simplifyRoute } from '../cables/cableRouting';

type EndpointType = 'device' | 'point';

interface CableEndpoint {
  type: EndpointType;
  deviceId?: string;
  point: Vector2;
}

interface PendingPoint {
  point: Vector2;
  snapType?: string;
}

/**
 * Инструмент прокладки кабеля.
 * Поддерживает:
 * - начало/конец на устройстве, на стене или в произвольной точке;
 * - промежуточные узлы маршрута (Shift + клик);
 * - привязку к цепи щита (circuitId);
 * - подсветку ближайшего устройства и точки привязки.
 */
export class CableTool implements Tool {
  readonly name = 'cable' as const;

  private state: 'idle' | 'drawing' = 'idle';
  private from: CableEndpoint | null = null;
  private viaPoints: Vector2[] = [];
  private pending: PendingPoint | null = null;
  private hoveredDevice: Device | null = null;

  constructor(
    private canvas: CanvasEngine,
    private plan: Plan,
  ) {}

  onActivate(): void {
    this.reset();
    this.canvas.canvas.style.cursor = 'crosshair';
  }

  onDeactivate(): void {
    this.canvas.setGhost(null);
    this.canvas.canvas.style.cursor = '';
    this.canvas.setSelectedDevice(null);
    this.canvas.requestRender();
  }

  onPointerMove(e: InputEvent): void {
    this.updateHover(e);
    this.updateGhost(e);
  }

  onPointerDown(e: InputEvent): void {
    const endpoint = this.resolveEndpoint(e.screenPoint, true);
    if (!endpoint) return;

    if (this.state === 'idle') {
      this.from = endpoint;
      this.state = 'drawing';
      this.viaPoints = [];
      if (endpoint.type === 'device' && endpoint.deviceId) {
        this.canvas.setSelectedDevice(endpoint.deviceId);
      }
      this.updateGhost(e);
      return;
    }

    // drawing state
    if (e.shiftKey) {
      // Добавляем промежуточный узел
      this.viaPoints.push(endpoint.point.clone());
      this.updateGhost(e);
      return;
    }

    if (!this.from) return;

    // Завершаем кабель
    const type = this.canvas.editorState.get('defaultCableType');
    const section = this.canvas.editorState.get('defaultCableSection');
    const circuitId = this.canvas.editorState.get('defaultCircuitId') ?? undefined;

    const fromDeviceId = this.from.type === 'device' && this.from.deviceId ? this.from.deviceId : null;
    const toDeviceId = endpoint.type === 'device' && endpoint.deviceId ? endpoint.deviceId : null;
    const fromPoint = fromDeviceId ? undefined : { x: this.from.point.x, y: this.from.point.y };
    const toPoint = toDeviceId ? undefined : { x: endpoint.point.x, y: endpoint.point.y };

    // Не создаём кабель нулевой длины
    const minLength = 1;
    if (this.from.point.distanceTo(endpoint.point) < minLength && this.viaPoints.length === 0) {
      this.reset();
      return;
    }

    // Автотрассировка с обходом стен и существующих кабелей.
    const routingPoints = [this.from.point.clone(), ...this.viaPoints.map(p => p.clone()), endpoint.point.clone()];
    const routed = routeCableWithVia(this.plan, routingPoints, 50);
    const route = routed && routed.length >= 2 ? simplifyRoute(routed, 1e-3, 25, this.viaPoints) : undefined;

    this.canvas.commandManager.execute(
      new AddCableCommand(
        this.plan,
        fromDeviceId,
        toDeviceId,
        type,
        section,
        {
          fromPoint,
          toPoint,
          viaPoints: this.viaPoints.length > 0 ? this.viaPoints.map(p => p.clone()) : undefined,
          circuitId,
          route,
        },
      ),
    );
    this.canvas.notifyChanged();
    this.reset();
  }

  onKeyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') {
      this.reset();
      return true;
    }
    return false;
  }

  private reset(): void {
    this.state = 'idle';
    this.from = null;
    this.viaPoints = [];
    this.pending = null;
    this.hoveredDevice = null;
    this.canvas.setSelectedDevice(null);
    this.canvas.setGhost(null);
    this.canvas.requestRender();
  }

  private updateHover(e: InputEvent): void {
    const device = this.hitTestDevice(e.screenPoint);
    if (device?.id !== this.hoveredDevice?.id) {
      this.hoveredDevice = device;
      this.canvas.requestRender();
    }
  }

  private updateGhost(e: InputEvent): void {
    const cursor = this.resolveEndpoint(e.screenPoint, false);
    this.pending = cursor ? { point: cursor.point.clone(), snapType: cursor.type } : null;

    const route = this.buildGhostRoute();
    if (!route || route.length < 2) {
      this.canvas.setGhost(null);
      this.canvas.requestRender();
      return;
    }

    this.canvas.setGhost((ctx) => {
      const color = '#d32f2f';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 / this.canvas.camera.scale;
      ctx.setLineDash([10 / this.canvas.camera.scale, 5 / this.canvas.camera.scale]);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < route.length; i++) {
        const p = route[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Точки узлов
      ctx.fillStyle = color;
      for (const p of route) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 / this.canvas.camera.scale, 0, Math.PI * 2);
        ctx.fill();
      }

      // Подсветка ближайшего устройства (точка входа кабеля)
      if (this.hoveredDevice) {
        const pos = this.plan.deviceCableEntryPoint(this.hoveredDevice);
        ctx.strokeStyle = '#1976d2';
        ctx.lineWidth = 2 / this.canvas.camera.scale;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 16 / this.canvas.camera.scale, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Подсветка начальной точки
      if (this.from) {
        ctx.strokeStyle = '#388e3c';
        ctx.lineWidth = 2 / this.canvas.camera.scale;
        ctx.beginPath();
        ctx.arc(this.from.point.x, this.from.point.y, 8 / this.canvas.camera.scale, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    this.canvas.requestRender();
  }

  private buildGhostRoute(): Vector2[] | null {
    if (!this.from) return null;
    const cursor = this.pending;
    if (!cursor) return null;
    const points = [this.from.point.clone(), ...this.viaPoints.map(p => p.clone()), cursor.point.clone()];
    return points;
  }

  private resolveEndpoint(screenPoint: Vector2, allowDevice: boolean): CableEndpoint | null {
    if (allowDevice) {
      const device = this.hitTestDevice(screenPoint);
      if (device) {
        return { type: 'device', deviceId: device.id, point: this.plan.deviceCableEntryPoint(device) };
      }
    }

    const snap = this.canvas.snapEngine.snap(screenPoint);
    // Если привязка к устройству через snap — тоже считаем устройством
    if (allowDevice && snap.type === 'center') {
      const device = this.hitTestDevice(screenPoint);
      if (device) {
        return { type: 'device', deviceId: device.id, point: this.plan.deviceCableEntryPoint(device) };
      }
    }

    return { type: 'point', point: snap.point.clone() };
  }

  private hitTestDevice(screenPoint: Vector2): Device | null {
    const world = this.canvas.camera.screenToWorld(screenPoint);
    const globalIconScale = this.canvas.editorState.get('deviceIconScale') ?? 1;

    for (const device of this.plan.devices) {
      const item = findDeviceCatalogItem(device.type);
      const baseSizeMm = item ? Math.max(item.width, item.height) : 600;
      const sizeWorld = baseSizeMm * globalIconScale * getDeviceIconScale(device);
      const halfWorld = sizeWorld / 2;
      const surfacePos = this.plan.deviceWorldPosition(device);
      const wall = this.plan.findWall(device.wallId);
      let iconPos = surfacePos;
      if (wall) {
        const dir = wallDirection(wall);
        const n = dir.perpendicular();
        iconPos = surfacePos.add(n.scale(halfWorld * device.side));
      }
      if (world.distanceTo(iconPos) <= halfWorld + 4 / this.canvas.camera.scale) {
        return device;
      }
    }
    return null;
  }
}
