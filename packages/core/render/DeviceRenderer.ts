import { Camera } from '../engine/Camera';
import { Plan } from '../model/Plan';
import { Device, DEVICE_LABELS } from '../model/Device';
import { EditorState } from '../editor/EditorState';
import { wallDirection } from '../model/Wall';
import { Vector2 } from '../geometry/Vector2';
import { findDeviceCatalogItem } from '../model/Device';
import { ThemeManager, ThemeColorKey } from '../editor/ThemeManager';

/** Базовый экранный размер условных обозначений (px). */
const BASE_DEVICE_SCREEN_SIZE = 80;

function categoryToColorKey(category: string): ThemeColorKey {
  switch (category) {
    case 'socket': return 'deviceSocket';
    case 'switch': return 'deviceSwitch';
    case 'panel': return 'devicePanel';
    case 'breaker': return 'deviceBreaker';
    case 'light': return 'deviceLight';
    default: return 'deviceDefault';
  }
}

export class DeviceRenderer {
  private selectedDeviceId: string | null = null;

  constructor(
    private plan: Plan,
    private camera: Camera,
    private editorState: EditorState,
    private themeManager: ThemeManager,
  ) {}

  setSelectedDevice(id: string | null): void {
    this.selectedDeviceId = id;
  }

  private isDeviceVisible(
    device: Device,
    surfacePos: Vector2,
    sizePx: number,
    rect: { min: Vector2; max: Vector2 },
  ): boolean {
    const wall = this.plan.findWall(device.wallId);
    let iconPos = surfacePos;
    if (wall) {
      const dir = wallDirection(wall);
      const n = dir.perpendicular();
      const halfWorld = (sizePx / 2) / this.camera.scale;
      iconPos = surfacePos.add(n.scale(halfWorld * device.side));
    }
    const halfWorld = (sizePx / 2 + 10) / this.camera.scale;
    const min = iconPos.sub(new Vector2(halfWorld, halfWorld));
    const max = iconPos.add(new Vector2(halfWorld, halfWorld));
    return !(max.x < rect.min.x || min.x > rect.max.x || max.y < rect.min.y || min.y > rect.max.y);
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.editorState.get('layers').devices) return;

    const iconScale = this.editorState.get('deviceIconScale') ?? 1;
    const rect = this.camera.visibleRect(0.1);

    for (const device of this.plan.devices) {
      const item = findDeviceCatalogItem(device.type);
      const baseSizeMm = item ? Math.max(item.width, item.height) : 600;
      const sizePx = (baseSizeMm / 10) * iconScale * (BASE_DEVICE_SCREEN_SIZE / 60);

      const surfacePos = this.plan.deviceWorldPosition(device);
      if (!this.isDeviceVisible(device, surfacePos, sizePx, rect)) continue;
      const sizeWorld = sizePx / this.camera.scale;
      const half = sizeWorld / 2;

      const wall = this.plan.findWall(device.wallId);
      let iconPos = surfacePos;
      if (wall) {
        const dir = wallDirection(wall);
        const n = dir.perpendicular();
        iconPos = surfacePos.add(n.scale(half * device.side));
      }

      const colorKey = categoryToColorKey(item?.category ?? device.type);
      const color = this.themeManager.getColor(colorKey);
      const selected = this.selectedDeviceId === device.id;

      ctx.save();
      ctx.translate(iconPos.x, iconPos.y);
      ctx.fillStyle = this.themeManager.getColor('deviceIconBg');
      ctx.strokeStyle = selected ? this.themeManager.getColor('selected') : color;
      ctx.lineWidth = selected ? 3 / this.camera.scale : 2 / this.camera.scale;
      ctx.beginPath();
      ctx.rect(-half, -half, sizeWorld, sizeWorld);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = `${sizeWorld * 0.55}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(DEVICE_LABELS[device.type], 0, 0);

      if (device.name) {
        ctx.fillStyle = this.themeManager.getColor('deviceText');
        ctx.font = `${sizeWorld * 0.3}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(device.name, 0, half + 4 / this.camera.scale);
      }

      ctx.restore();
    }
  }
}
