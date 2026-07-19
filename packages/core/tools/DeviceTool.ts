import { InputEvent } from '../engine/InputManager';
import { SnapEngine } from '../snap/SnapEngine';
import { Plan } from '../model/Plan';
import { wallLength, wallDirection } from '../model/Wall';
import { CanvasEngine } from '../engine/CanvasEngine';
import { Tool } from './ToolManager';
import { AddDeviceCommand } from '../editor/CommandManager';
import { findDeviceCatalogItem, defaultDeviceHeight } from '../model/Device';

/**
 * Инструмент размещения электрооборудования.
 * Конкретный тип устройства берётся из EditorState.selectedDeviceType.
 * Устройство примагничивается к ближайшей стене и встает с той стороны, где курсор.
 */
export class DeviceTool implements Tool {
  readonly name = 'device' as const;
  private preview: { wallId: string; t: number; side: 1 | -1 } | null = null;

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
      const side = this.computeSide(nearest.wall, nearest.t, e.worldPoint);
      this.preview = {
        wallId: nearest.wall.id,
        t: nearest.t,
        side,
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
        const type = this.canvas.editorState.get('selectedDeviceType');
        const height = defaultDeviceHeight(type);
        this.canvas.commandManager.execute(
          new AddDeviceCommand(this.plan, wall.id, type, this.preview.t, 0, this.preview.side, height),
        );
        this.canvas.notifyChanged();
      }
    }
  }

  /** Определяет, с какой стороны от стены находится курсор. */
  private computeSide(wall: import('../model/Wall').Wall, t: number, worldPoint: import('../geometry/Vector2').Vector2): 1 | -1 {
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
          const sizePx = (baseSize / 10) * iconScale; // мм -> px (масштаб 0.1)
          const worldSize = sizePx / this.canvas.camera.scale;
          this.canvas.ghostRenderer.drawDeviceGhost(ctx, pos, type, worldSize, worldSize);
        }
      }
      if (this.canvas.snap) {
        this.canvas.ghostRenderer.drawSnapMarker(ctx, this.canvas.snap);
      }
    });
    this.canvas.requestRender();
  }
}
