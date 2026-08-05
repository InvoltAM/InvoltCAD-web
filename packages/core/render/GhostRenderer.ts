import { Camera } from '../engine/Camera';
import { Vector2 } from '../geometry/Vector2';
import { SnapResult } from '../snap/SnapEngine';
import { ThemeManager, ThemeColorKey } from '../editor/ThemeManager';

/**
 * Слой предпросмотра: рисуемая стена, маркер snap, подсветка стены,
 * лупа для touch-рисования.
 */
export class GhostRenderer {
  private magnifier: HTMLCanvasElement | null = null;
  private magnifierCtx: CanvasRenderingContext2D | null = null;

  constructor(private camera: Camera, private themeManager?: ThemeManager) {}

  private getColor(key: ThemeColorKey): string {
    if (this.themeManager) return this.themeManager.getColor(key);
    const fallback: Record<ThemeColorKey, string> = {
      canvasBg: '#f4f2ee',
      gridMinor: 'rgba(0,0,0,0.06)',
      gridMajor: 'rgba(0,0,0,0.12)',
      wall: '#3a3a3a',
      wallStroke: 'rgba(0,0,0,0.15)',
      wallShadow: 'rgba(0,0,0,0.12)',
      openingBg: '#f4f2ee',
      openingStroke: '#3a3a3a',
      openingShadow: 'rgba(0,0,0,0.08)',
      openingSelectedFill: 'rgba(255, 140, 0, 0.15)',
      roomFill: 'rgba(200, 210, 200, 0.35)',
      roomStroke: 'rgba(100, 120, 100, 0.4)',
      roomText: '#3a3a3a',
      roomHandleFill: '#ff8c00',
      roomHandleStroke: '#ffffff',
      cablePower: '#ef4444',
      cableLighting: '#f59e0b',
      cableLowCurrent: '#10b981',
      deviceSocket: '#2563eb',
      deviceSwitch: '#7c3aed',
      devicePanel: '#dc2626',
      deviceBreaker: '#f59e0b',
      deviceLight: '#10b981',
      deviceDefault: '#2563eb',
      deviceText: '#111827',
      deviceIconBg: '#ffffff',
      dimension: '#1a1a1a',
      dimensionSelected: '#2563eb',
      dimensionTextBg: 'rgba(255,255,255,0.85)',
      text: '#1a1a1a',
      textBg: 'rgba(255,255,255,0.8)',
      ghostWall: 'rgba(58,58,58,0.5)',
      ghostOpening: 'rgba(255,140,0,0.4)',
      ghostSnap: '#ff8c00',
      ghostSnapText: '#1a1a1a',
      accent: '#ff8c00',
      selected: '#ff8c00',
      selectionFill: 'rgba(255, 140, 0, 0.15)',
      validationError: '#dc2626',
      validationWarning: '#eab308',
      validationInfo: '#3b82f6',
      sheetFrame: '#2563eb',
    };
    return fallback[key];
  }

  /**
   * Рисует "резиновую" стену от start до end.
   */
  drawWallGhost(
    ctx: CanvasRenderingContext2D,
    start: Vector2,
    end: Vector2,
    thickness: number,
  ): void {
    const dir = end.sub(start);
    const len = dir.length();
    if (len === 0) return;
    const d = dir.normalized();
    const n = d.perpendicular();
    const h = thickness / 2;

    const p1 = start.add(n.scale(h));
    const p2 = end.add(n.scale(h));
    const p3 = end.sub(n.scale(h));
    const p4 = start.sub(n.scale(h));

    ctx.fillStyle = this.getColor('ghostWall');
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    ctx.fill();

    // Размерная подпись
    this.drawDimensionLabel(ctx, start, end, Math.round(len));
  }

  /**
   * Подсветка проема на стене: полупрозрачный прямоугольник ширины openingWidth.
   */
  drawOpeningGhost(
    ctx: CanvasRenderingContext2D,
    wallA: Vector2,
    wallB: Vector2,
    t: number,
    openingWidth: number,
    wallThickness: number,
  ): void {
    const dir = wallB.sub(wallA);
    const len = dir.length();
    if (len === 0) return;
    const d = dir.normalized();
    const n = d.perpendicular();
    const center = wallA.add(d.scale(t * len));
    const half = openingWidth / 2;
    const h = wallThickness / 2 + 2 / this.camera.scale;

    ctx.fillStyle = this.getColor('ghostOpening');
    ctx.beginPath();
    const c1 = center.add(d.scale(-half)).add(n.scale(h));
    const c2 = center.add(d.scale(half)).add(n.scale(h));
    const c3 = center.add(d.scale(half)).sub(n.scale(h));
    const c4 = center.add(d.scale(-half)).sub(n.scale(h));
    ctx.moveTo(c1.x, c1.y);
    ctx.lineTo(c2.x, c2.y);
    ctx.lineTo(c3.x, c3.y);
    ctx.lineTo(c4.x, c4.y);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Рисует пунктирные направляющие лучи из точки.
   * directions — массив векторов направлений (не обязательно нормализованных).
   */
  drawGuideRays(
    ctx: CanvasRenderingContext2D,
    point: Vector2,
    directions: Vector2[],
    options: { color?: string; dash?: number[]; length?: number; lineWidth?: number } = {},
  ): void {
    const color = options.color ?? this.getColor('text');
    const dash = options.dash ?? [6 / this.camera.scale, 4 / this.camera.scale];
    const length = options.length ?? 10000;
    const lineWidth = options.lineWidth ?? 1 / this.camera.scale;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(dash);

    for (const dir of directions) {
      const len = dir.length();
      if (len < 1e-9) continue;
      const d = dir.normalized();
      const to = point.add(d.scale(length));
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  /** Маркеры snap-точек и направляющие лучи (в т.ч. от захваченных привязок). */
  drawSnapMarker(ctx: CanvasRenderingContext2D, snap: SnapResult): void {
    const r = 6 / this.camera.scale;

    // Захваченные точки (до двух) либо сама snap-точка
    const guides = snap.guides ?? [
      { point: snap.point, type: snap.type, wall: snap.wall, wall2: snap.wall2 },
    ];

    for (const guide of guides) {
      this.drawSnapMarkerShape(ctx, guide.point, guide.type, r);

      // Направляющие лучи от точки: оси X/Y + оси стен
      if (guide.type !== 'grid') {
        const xAxis = new Vector2(1, 0);
        const yAxis = new Vector2(0, 1);
        const dirs = [xAxis, xAxis.scale(-1), yAxis, yAxis.scale(-1)];
        for (const w of [guide.wall, guide.wall2]) {
          if (!w) continue;
          const d = w.b.sub(w.a);
          const n = d.perpendicular();
          dirs.push(d, d.scale(-1), n, n.scale(-1));
        }
        this.drawGuideRays(ctx, guide.point, dirs, { color: this.getColor('accent') });
      }
    }

    // При tracking — маленький маркер на текущей точке курсора
    if (snap.guides && !snap.guides.some(g => g.point.equals(snap.point))) {
      ctx.strokeStyle = this.getColor('accent');
      ctx.lineWidth = 1.5 / this.camera.scale;
      ctx.beginPath();
      ctx.arc(snap.point.x, snap.point.y, r * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /** Маркер конкретного типа привязки в точке p. */
  private drawSnapMarkerShape(
    ctx: CanvasRenderingContext2D,
    p: Vector2,
    type: SnapResult['type'],
    r: number,
  ): void {
    ctx.strokeStyle = this.getColor('accent');
    ctx.fillStyle = this.getColor('accent');
    ctx.lineWidth = 1.5 / this.camera.scale;

    ctx.beginPath();
    switch (type) {
      case 'endpoint':
        // Квадрат
        ctx.rect(p.x - r, p.y - r, r * 2, r * 2);
        break;
      case 'midpoint':
        // Треугольник
        ctx.moveTo(p.x, p.y - r);
        ctx.lineTo(p.x + r, p.y + r);
        ctx.lineTo(p.x - r, p.y + r);
        ctx.closePath();
        break;
      case 'center':
        // Окружность
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        break;
      case 'intersection': {
        // Косой крест «×»
        ctx.moveTo(p.x - r, p.y - r);
        ctx.lineTo(p.x + r, p.y + r);
        ctx.moveTo(p.x + r, p.y - r);
        ctx.lineTo(p.x - r, p.y + r);
        break;
      }
      case 'extension': {
        // Маленький квадрат
        const r2 = r * 0.6;
        ctx.rect(p.x - r2, p.y - r2, r2 * 2, r2 * 2);
        break;
      }
      default:
        // wall-line и прочие — круг
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        break;
    }
    ctx.stroke();
  }

  /** Размерная подпись длины стены. */
  private drawDimensionLabel(
    ctx: CanvasRenderingContext2D,
    start: Vector2,
    end: Vector2,
    lengthMm: number,
  ): void {
    const mid = start.add(end).scale(0.5);
    const dir = end.sub(start);
    const len = dir.length();
    if (len === 0) return;
    const n = dir.normalized().perpendicular();
    const offset = 12 / this.camera.scale;
    const pos = mid.add(n.scale(offset));

    const text = `${lengthMm} мм`;
    ctx.font = `${14 / this.camera.scale}px sans-serif`;
    const metrics = ctx.measureText(text);
    const padding = 4 / this.camera.scale;
    const w = metrics.width + padding * 2;
    const h = (16 / this.camera.scale) + padding * 2;

    ctx.fillStyle = this.getColor('textBg');
    ctx.beginPath();
    ctx.roundRect?.(pos.x - w / 2, pos.y - h / 2, w, h, 4 / this.camera.scale);
    ctx.fill();

    ctx.fillStyle = this.getColor('text');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pos.x, pos.y);
  }

  /** Ghost устройства. */
  drawDeviceGhost(
    ctx: CanvasRenderingContext2D,
    pos: Vector2,
    type: string,
    width: number,
    height: number,
    side = 1,
    angle = 0,
  ): void {
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(angle);
    ctx.strokeStyle = this.getColor('ghostWall');
    ctx.fillStyle = this.getColor('deviceIconBg');
    ctx.lineWidth = 1 / this.camera.scale;
    ctx.beginPath();
    ctx.rect(-width / 2, -height / 2, width, height);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Лупа для touch-рисования.
   * sourceCanvas — основной canvas, из которого берется фрагмент.
   */
  renderMagnifier(
    sourceCanvas: HTMLCanvasElement,
    screenPoint: Vector2,
    radius = 60,
    zoom = 2,
  ): HTMLCanvasElement {
    if (!this.magnifier) {
      this.magnifier = document.createElement('canvas');
      this.magnifier.width = radius * 2;
      this.magnifier.height = radius * 2;
      this.magnifierCtx = this.magnifier.getContext('2d');
    }
    if (!this.magnifierCtx) return this.magnifier;

    const ctx = this.magnifierCtx;
    ctx.clearRect(0, 0, radius * 2, radius * 2);

    // Рисуем увеличенный фрагмент основного canvas
    ctx.save();
    ctx.beginPath();
    ctx.arc(radius, radius, radius, 0, Math.PI * 2);
    ctx.clip();

    const srcX = Math.max(0, screenPoint.x - radius / zoom);
    const srcY = Math.max(0, screenPoint.y - radius / zoom);
    const srcW = (radius * 2) / zoom;
    const srcH = (radius * 2) / zoom;

    ctx.drawImage(
      sourceCanvas,
      srcX, srcY, srcW, srcH,
      0, 0, radius * 2, radius * 2,
    );

    // Крестик в центре
    ctx.strokeStyle = this.getColor('accent');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(radius - 8, radius);
    ctx.lineTo(radius + 8, radius);
    ctx.moveTo(radius, radius - 8);
    ctx.lineTo(radius, radius + 8);
    ctx.stroke();

    ctx.restore();

    // Обводка лупы
    ctx.strokeStyle = this.getColor('text');
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(radius, radius, radius, 0, Math.PI * 2);
    ctx.stroke();

    return this.magnifier;
  }
}
