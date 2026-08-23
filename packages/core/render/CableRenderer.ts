import { Camera } from '../engine/Camera';
import { Plan } from '../model/Plan';
import { EditorState } from '../editor/EditorState';
import { Vector2 } from '../geometry/Vector2';
import { ThemeManager, ThemeColorKey } from '../editor/ThemeManager';

function typeToColorKey(type: string): ThemeColorKey {
  switch (type) {
    case 'power': return 'cablePower';
    case 'lighting': return 'cableLighting';
    case 'low-current': return 'cableLowCurrent';
    default: return 'cablePower';
  }
}

export class CableRenderer {
  private selectedCableIds: string[] = [];

  constructor(
    private plan: Plan,
    private camera: Camera,
    private editorState: EditorState,
    private themeManager: ThemeManager,
  ) {}

  setSelectedCableIds(ids: string[]): void {
    this.selectedCableIds = ids;
  }

  private isCableSelected(cable: import('../model/Cable').Cable): boolean {
    return this.selectedCableIds.includes(cable.id);
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.editorState.get('layers').cables) return;

    const rect = this.camera.visibleRect(0.1);

    for (const cable of this.plan.cables) {
      if (cable.visible === false) continue;
      const from = cable.fromDeviceId ? this.plan.findDevice(cable.fromDeviceId) : undefined;
      const to = cable.toDeviceId ? this.plan.findDevice(cable.toDeviceId) : undefined;
      const fromPos = from
        ? this.plan.deviceCableEntryPoint(from)
        : cable.fromPoint
          ? new Vector2(cable.fromPoint.x, cable.fromPoint.y)
          : cable.route[0];
      const toPos = to
        ? this.plan.deviceCableEntryPoint(to)
        : cable.toPoint
          ? new Vector2(cable.toPoint.x, cable.toPoint.y)
          : cable.route[cable.route.length - 1];
      if (!fromPos || !toPos) continue;

      const route = cable.route.length >= 2
        ? cable.route
        : [fromPos, toPos];

      if (!this.isRouteVisible(route, rect)) continue;

      const selected = this.isCableSelected(cable);
      ctx.strokeStyle = selected ? this.themeManager.getColor('selected') : this.themeManager.getColor(typeToColorKey(cable.type));
      // Толщина фиксирована в экранных пикселях, поэтому делим на масштаб камеры.
      ctx.lineWidth = (selected ? 5 : 4) / this.camera.scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();

      for (let i = 0; i < route.length; i++) {
        const p = route[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();

      const a = route[0];
      const b = route[route.length - 1];
      ctx.fillStyle = ctx.strokeStyle;
      const dotRadius = 3 / this.camera.scale;
      this.drawDot(ctx, a.x, a.y, dotRadius);
      this.drawDot(ctx, b.x, b.y, dotRadius);

      // Промежуточные узлы
      if (cable.viaPoints && cable.viaPoints.length > 0) {
        for (const via of cable.viaPoints) {
          this.drawDot(ctx, via.x, via.y, dotRadius);
        }
      }

      // Ручки редактирования маршрута для выделенного кабеля
      if (selected) {
        this.renderRouteHandles(ctx, cable, route, ctx.strokeStyle);
      }

      if (route.length >= 2) {
        const mid = route[Math.floor(route.length / 2)];
        ctx.fillStyle = this.themeManager.getColor('text');
        ctx.font = `${12 / this.camera.scale}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const label = `${(cable.length / 1000).toFixed(2)} м`;
        ctx.fillText(label, mid.x, mid.y - 4 / this.camera.scale);
      }
    }
  }

  private isRouteVisible(route: Vector2[], rect: { min: Vector2; max: Vector2 }): boolean {
    if (route.length === 0) return false;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of route) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return !(maxX < rect.min.x || minX > rect.max.x || maxY < rect.min.y || minY > rect.max.y);
  }

  private drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    ctx.beginPath();
    // Радиус в мировых единицах, минимум 2 экранных пикселя.
    ctx.arc(x, y, Math.max(2 / this.camera.scale, r), 0, Math.PI * 2);
    ctx.fill();
  }

  private renderRouteHandles(
    ctx: CanvasRenderingContext2D,
    cable: import('../model/Cable').Cable,
    route: Vector2[],
    color: string,
  ): void {
    const editableRadius = 5 / this.camera.scale;
    const anchorRadius = 4 / this.camera.scale;
    const lineWidth = 1 / this.camera.scale;

    for (let i = 0; i < route.length; i++) {
      const p = route[i];
      const isAnchor = i === 0 || i === route.length - 1;
      if (isAnchor) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(2 / this.camera.scale, anchorRadius), 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Редактируемая вершина — белый квадрат с обводкой
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.fillStyle = '#ffffff';
        const half = Math.max(2 / this.camera.scale, editableRadius);
        ctx.beginPath();
        ctx.rect(p.x - half, p.y - half, half * 2, half * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }
}
