import { InputEvent } from '../engine/InputManager';
import { SnapEngine } from '../snap/SnapEngine';
import { Plan } from '../model/Plan';
import { wallLength, wallDirection } from '../model/Wall';
import { CanvasEngine } from '../engine/CanvasEngine';
import { Tool } from './ToolManager';
import { AddDeviceCommand, AddFreeDeviceCommand } from '../editor/CommandManager';
import { findDeviceCatalogItem } from '../model/Device';

/**
 * Инструмент размещения электрооборудования.
 * Конкретный тип устройства берётся из EditorState.selectedDeviceType.
 * Устройство примагничивается к ближайшей стене и встает с той стороны, где курсор.
 */
export class DeviceTool implements Tool {
  readonly name = 'device' as const;
  private preview: { wallId: string; t: number; side: 1 | -1 } | null = null;
  private previewFree: import('../geometry/Vector2.js').Vector2 | null = null;

  constructor(
    private canvas: CanvasEngine,
    private plan: Plan,
    private snapEngine: SnapEngine,
  ) {}

  onActivate(): void {
    this.preview = null;
    this.previewFree = null;
  }

  onDeactivate(): void {
    this.canvas.setGhost(null);
    this.canvas.requestRender();
  }

  /** Светильники можно размещать свободно (потолок, центр комнаты), не только на стене. */
  private isFreePlaceable(): boolean {
    const type = this.canvas.editorState.get('selectedDeviceType');
    return findDeviceCatalogItem(type)?.category === 'light';
  }

  onPointerMove(e: InputEvent): void {
    const nearest = this.snapEngine.findNearestWall(e.screenPoint);
    if (nearest) {
      const side = this.computeSide(nearest.wall, nearest.t, e.worldPoint);
      this.preview = {
        wallId: nearest.wall.id,
        t: nearest.t,
        side,
      };
      this.previewFree = null;
      const snap = this.snapEngine.snap(e.screenPoint, { wallOnly: true });
      this.canvas.setSnap(snap);
    } else if (this.isFreePlaceable()) {
      // Свободное размещение: потолок, центр помещения — со снапом к сетке
      this.preview = null;
      const snap = this.snapEngine.snap(e.screenPoint);
      this.previewFree = snap.point;
      this.canvas.setSnap(snap);
    } else {
      this.preview = null;
      this.previewFree = null;
      const snap = this.snapEngine.snap(e.screenPoint);
      this.canvas.setSnap(snap);
    }
    this.updateGhost();
  }

  onPointerDown(e: InputEvent): void {
    if (this.preview) {
      const wall = this.plan.findWall(this.preview.wallId);
      if (wall) {
        const type = this.canvas.editorState.get('selectedDeviceType');
        this.canvas.commandManager.execute(
          new AddDeviceCommand(this.plan, wall.id, type, this.preview.t, 0, this.preview.side),
        );
        this.canvas.notifyChanged();
      }
    } else if (this.previewFree) {
      const type = this.canvas.editorState.get('selectedDeviceType');
      this.canvas.commandManager.execute(
        new AddFreeDeviceCommand(this.plan, type, this.previewFree.clone()),
      );
      this.canvas.notifyChanged();
    }
  }

  /** Определяет, с какой стороны от стены находится курсор. */
  private computeSide(wall: import('../model/Wall.js').Wall, t: number, worldPoint: import('../geometry/Vector2.js').Vector2): 1 | -1 {
    const len = wallLength(wall);
    if (len === 0) return 1;
    const dir = wallDirection(wall);
    const n = dir.perpendicular();
    const centerOnWall = wall.a.add(dir.scale(t * len));
    const cursorDir = worldPoint.sub(centerOnWall);
    const dot = cursorDir.dot(n);
    return dot >= 0 ? 1 : -1;
  }

  private updateGhost(): void {
    this.canvas.setGhost(ctx => {
      if (this.preview) {
        const wall = this.plan.findWall(this.preview.wallId);
        if (wall) {
          const len = wallLength(wall);
          const dir = wallDirection(wall);
          const n = dir.perpendicular();
          const centerOnWall = wall.a.add(dir.scale(this.preview.t * len));
          const pos = centerOnWall.add(n.scale(wall.thickness / 2 * this.preview.side));
          const iconScale = this.canvas.editorState.get('deviceIconScale') ?? 1;
          const type = this.canvas.editorState.get('selectedDeviceType');
          const item = findDeviceCatalogItem(type);
          const baseSize = item ? Math.max(item.width, item.height) : 600;
          // Мировой размер в мм — ghost масштабируется вместе с планом
          const worldSize = baseSize * iconScale;
          // Поворот по углу стены (как в DeviceRenderer)
          let angle = Math.atan2(dir.y, dir.x);
          if (angle > Math.PI / 2) angle -= Math.PI;
          else if (angle <= -Math.PI / 2) angle += Math.PI;
          this.canvas.ghostRenderer.drawDeviceGhost(ctx, pos, type, worldSize, worldSize, 1, angle);
        }
      } else if (this.previewFree) {
        // Ghost свободного размещения (светильник на потолке)
        const iconScale = this.canvas.editorState.get('deviceIconScale') ?? 1;
        const type = this.canvas.editorState.get('selectedDeviceType');
        const item = findDeviceCatalogItem(type);
        const baseSize = item ? Math.max(item.width, item.height) : 600;
        const worldSize = baseSize * iconScale;
        this.canvas.ghostRenderer.drawDeviceGhost(ctx, this.previewFree, type, worldSize, worldSize, 1, 0);
      }
      if (this.canvas.snap) {
        this.canvas.ghostRenderer.drawSnapMarker(ctx, this.canvas.snap);
      }
    });
    this.canvas.requestRender();
  }
}
