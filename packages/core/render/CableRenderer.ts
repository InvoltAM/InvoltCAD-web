import { Camera } from '../engine/Camera';
import { Plan } from '../model/Plan';
import { EditorState } from '../editor/EditorState';
import { Vector2 } from '../geometry/Vector2';
import { ThemeManager, ThemeColorKey } from '../editor/ThemeManager';
import { validateCable, highlightCableViolations } from '../cables/CableValidator';
import { getCableStyle, CableStyle } from '../model/Cable';

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
      const style: CableStyle = getCableStyle(cable);
      ctx.strokeStyle = selected ? this.themeManager.getColor('selected') : style.color;
      // Толщина фиксирована в экранных пикселях, поэтому делим на масштаб камеры.
      ctx.lineWidth = (selected ? 7 : style.lineWidth * 2 + 2) / this.camera.scale;
      ctx.lineCap = style.capStyle;
      ctx.lineJoin = 'round';
      ctx.setLineDash(style.dashPattern.map((d) => d / this.camera.scale));
      ctx.beginPath();

      this.drawCablePath(ctx, route);
      ctx.stroke();
      ctx.setLineDash([]);

      const a = route[0];
      const b = route[route.length - 1];
      ctx.fillStyle = ctx.strokeStyle;
      const dotRadius = 4 / this.camera.scale;
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
        // Подсветка геометрических нарушений кабеля (только для выделенного).
        const validation = validateCable(this.plan, cable, 'strict', this.plan.devices);
        if (!validation.valid) {
          highlightCableViolations(ctx, validation, this.camera);
        }
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

  /**
   * Рисует путь кабеля со скруглёнными углами (fillet) между ортогональными
   * сегментами. Рисование ведётся в мировых координатах (контекст уже
   * трансформирован камерой), поэтому преобразование worldToScreen не нужно.
   */
  private drawCablePath(ctx: CanvasRenderingContext2D, route: Vector2[]): void {
    const CORNER_RADIUS = 40 // мм

    if (route.length < 2) return

    const start = route[0]
    ctx.moveTo(start.x, start.y)

    for (let i = 1; i < route.length; i++) {
      const p0 = route[i - 1]
      const p1 = route[i]

      if (i === route.length - 1) {
        // Последний сегмент — просто линия
        ctx.lineTo(p1.x, p1.y)
        continue
      }

      const p2 = route[i + 1]
      const v1 = p1.sub(p0)
      const v2 = p2.sub(p1)
      const len1 = v1.length()
      const len2 = v2.length()
      if (len1 < 1e-6 || len2 < 1e-6) {
        ctx.lineTo(p1.x, p1.y)
        continue
      }
      const d1 = v1.scale(1 / len1)
      const d2 = v2.scale(1 / len2)
      const dot = d1.dot(d2)

      // Скругляем только прямые углы (|dot| ≈ 0). Коллинеарные сегменты — линией.
      if (Math.abs(dot) > 0.1) {
        ctx.lineTo(p1.x, p1.y)
        continue
      }

      const seg1Len = len1
      const seg2Len = len2
      const r = Math.min(CORNER_RADIUS, seg1Len * 0.35, seg2Len * 0.35)
      if (r < 1) {
        ctx.lineTo(p1.x, p1.y)
        continue
      }

      const t1 = p1.sub(d1.scale(r))
      const t2 = p1.add(d2.scale(r))

      ctx.lineTo(t1.x, t1.y)
      ctx.arcTo(p1.x, p1.y, t2.x, t2.y, r)
    }
  }
}
