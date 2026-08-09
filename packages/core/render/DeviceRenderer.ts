import { Camera } from '../engine/Camera';
import { Plan } from '../model/Plan';
import { Device, DEVICE_LABELS, getDeviceIconScale } from '../model/Device';
import { EditorState } from '../editor/EditorState';
import { wallDirection } from '../model/Wall';
import { Vector2 } from '../geometry/Vector2';
import { findDeviceCatalogItem } from '../model/Device';
import { ThemeManager, ThemeColorKey } from '../editor/ThemeManager';

const CATEGORY_THEME_KEY: Record<string, ThemeColorKey> = {
  socket: 'deviceSocket',
  switch: 'deviceSwitch',
  panel: 'devicePanel',
  breaker: 'deviceBreaker',
  light: 'deviceLight',
};

export class DeviceRenderer {
  private selectedDeviceIds: string[] = [];

  constructor(
    private plan: Plan,
    private camera: Camera,
    private editorState: EditorState,
    private themeManager?: ThemeManager,
  ) {}

  setSelectedDeviceIds(ids: string[]): void {
    this.selectedDeviceIds = ids;
  }

  private isDeviceSelected(device: Device): boolean {
    return this.selectedDeviceIds.includes(device.id);
  }

  private getColor(category: string): string {
    return this.themeManager?.getColor(CATEGORY_THEME_KEY[category] ?? 'deviceDefault') ?? '#2563eb';
  }

  private get selectedColor(): string {
    return this.themeManager?.getColor('selected') ?? '#ff8c00';
  }

  private get iconBg(): string {
    return this.themeManager?.getColor('deviceIconBg') ?? '#ffffff';
  }

  private get textColor(): string {
    return this.themeManager?.getColor('deviceText') ?? '#111827';
  }

  private isDeviceVisible(
    device: Device,
    surfacePos: Vector2,
    sizeWorld: number,
    rect: { min: Vector2; max: Vector2 },
  ): boolean {
    const wall = this.plan.findWall(device.wallId);
    let iconPos = surfacePos;
    if (wall) {
      const dir = wallDirection(wall);
      const n = dir.perpendicular();
      iconPos = surfacePos.add(n.scale((sizeWorld / 2) * device.side));
    }
    const halfWorld = sizeWorld / 2 + 10;
    const min = iconPos.sub(new Vector2(halfWorld, halfWorld));
    const max = iconPos.add(new Vector2(halfWorld, halfWorld));
    return !(max.x < rect.min.x || min.x > rect.max.x || max.y < rect.min.y || min.y > rect.max.y);
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.editorState.get('layers').devices) return;

    const globalIconScale = this.editorState.get('deviceIconScale') ?? 1;
    const rect = this.camera.visibleRect(0.1);

    for (const device of this.plan.devices) {
      const item = findDeviceCatalogItem(device.type);
      const baseSizeMm = item ? Math.max(item.width, item.height) : 600;
      // Мировой размер в мм: глобальный масштаб + персональный множитель устройства
      const sizeWorld = baseSizeMm * globalIconScale * getDeviceIconScale(device);
      const half = sizeWorld / 2;

      const surfacePos = this.plan.deviceWorldPosition(device);
      if (!this.isDeviceVisible(device, surfacePos, sizeWorld, rect)) continue;

      // Центр иконки — снаружи стены, чтобы не перекрываться ею
      const wall = this.plan.findWall(device.wallId);
      let iconPos = surfacePos;
      let angle = 0;
      let normal = new Vector2(0, 1);
      if (wall) {
        const dir = wallDirection(wall);
        const n = dir.perpendicular();
        normal = n;
        iconPos = surfacePos.add(n.scale(half * device.side));
        // Поворот значка по углу стены (нормализован, чтобы символ не был перевёрнут)
        angle = Math.atan2(dir.y, dir.x);
        if (angle > Math.PI / 2) angle -= Math.PI;
        else if (angle <= -Math.PI / 2) angle += Math.PI;
      }
      angle += device.rotation ?? 0;

      const color = this.getColor(item?.category ?? device.type);
      const selected = this.isDeviceSelected(device);

      ctx.save();
      ctx.translate(iconPos.x, iconPos.y);
      ctx.rotate(angle);
      ctx.fillStyle = this.iconBg;
      ctx.strokeStyle = selected ? this.selectedColor : color;
      ctx.lineWidth = selected ? 3 / this.camera.scale : 2 / this.camera.scale;
      ctx.beginPath();
      ctx.rect(-half, -half, sizeWorld, sizeWorld);
      ctx.fill();
      ctx.stroke();

      // Иконка устройства
      ctx.fillStyle = color;
      ctx.font = `${sizeWorld * 0.55}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(DEVICE_LABELS[device.type], 0, 0);
      ctx.restore();

      // Имя устройства (атрибут блока) — горизонтально, можно перетаскивать
      const label = this.getNameLabelBounds(device);
      if (label) {
        ctx.save();
        if (selected) {
          // Рамка-подсказка, что подпись можно перетаскивать
          ctx.strokeStyle = this.selectedColor;
          ctx.lineWidth = 1 / this.camera.scale;
          ctx.setLineDash([6 / this.camera.scale, 4 / this.camera.scale]);
          ctx.strokeRect(
            label.center.x - label.halfW,
            label.center.y - label.halfH,
            label.halfW * 2,
            label.halfH * 2,
          );
          ctx.setLineDash([]);
        }
        ctx.fillStyle = this.textColor;
        ctx.font = `${sizeWorld * 0.3}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(device.name, label.center.x, label.center.y);
        ctx.restore();
      }
    }
  }

  /**
   * Границы подписи устройства в мировых координатах
   * (позиция по умолчанию + nameOffset). Используется для hit-test.
   */
  getNameLabelBounds(device: Device): { center: Vector2; halfW: number; halfH: number } | null {
    if (!device.name) return null;
    const globalIconScale = this.editorState.get('deviceIconScale') ?? 1;
    const item = findDeviceCatalogItem(device.type);
    const baseSizeMm = item ? Math.max(item.width, item.height) : 600;
    const sizeWorld = baseSizeMm * globalIconScale * getDeviceIconScale(device);
    const half = sizeWorld / 2;

    const surfacePos = this.plan.deviceWorldPosition(device);
    const wall = this.plan.findWall(device.wallId);
    let iconPos = surfacePos;
    let normal = new Vector2(0, 1);
    if (wall) {
      const dir = wallDirection(wall);
      const n = dir.perpendicular();
      normal = n;
      iconPos = surfacePos.add(n.scale(half * device.side));
    }

    const nameDist = (half + sizeWorld * 0.25) * device.side;
    let center = iconPos.add(normal.scale(nameDist));
    if (device.nameOffset) {
      center = center.add(new Vector2(device.nameOffset.x, device.nameOffset.y));
    }

    const fontSize = sizeWorld * 0.3;
    const halfW = (device.name.length * fontSize * 0.55) / 2 + fontSize * 0.3;
    const halfH = fontSize * 0.7;
    return { center, halfW, halfH };
  }
}
